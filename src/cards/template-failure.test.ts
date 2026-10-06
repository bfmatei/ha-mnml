import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { TemplateCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { fakeStore } from '../test/fake-hass.ts';
import { define } from '../test/render.ts';

import { MnmlTemplateCard } from './template.ts';

const fetched = vi.hoisted((): string[] => []);

vi.mock('../templates/families.ts', async () => {
  const { familyNames, readFamily } = await import('../templates/shipped.ts');
  const owner = Object.fromEntries(
    familyNames()
      .filter((family) => family !== 'common')
      .flatMap((family) => Object.keys(readFamily(family)).map((name) => [name, family])),
  );
  return {
    COMMON_FAMILY: 'common',
    COMMON: readFamily('common'),
    OWNER: owner,
    SHAPES: {},
    loadFamily: (family: string): Promise<never> => {
      fetched.push(family);
      return Promise.reject(new Error(`mnml-cards-${family}.json: 404 Not Found`));
    },
  };
});

define('mnml-template-card', MnmlTemplateCard);

const built: Record<string, unknown>[] = [];
window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement(config: object): ChildCard {
      built.push(config as Record<string, unknown>);
      return document.createElement('div');
    },
  });

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const hassOf = (hass: object): HomeAssistant => hass as HomeAssistant;

function make(): MnmlTemplateCard {
  const made = document.createElement('mnml-template-card');
  assert.ok(made instanceof MnmlTemplateCard);
  return made;
}

function configure(card: MnmlTemplateCard, config: unknown): void {
  card.setConfig(config as TemplateCard);
}

test('a family that cannot be loaded turns the card that needs it into an error card naming the file, in the order a page loads', async () => {
  const original = console.error;
  console.error = (): void => undefined;
  try {
    const store = fakeStore();
    const card = make();
    configure(card, {
      type: 'custom:mnml-template-card',
      template: 'light-card',
      slots: { entity: 'light.kitchen' },
    });
    card.hass = hassOf({ ...store.hass, states: {}, areas: {}, devices: {}, entities: {} });
    document.body.append(card);
    await tick();
    await tick();
    await tick();
    await tick();
  } finally {
    console.error = original;
  }
  assert.deepEqual(fetched, ['lights']);
  assert.equal(built[0]?.['type'], 'error');
  assert.match(
    String(built[0]?.['error']),
    /mnml: the shipped templates could not be loaded: mnml-cards-lights\.json: 404 Not Found/,
  );
});

test('a card whose family failed for a passing reason asks again 30 seconds later', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
  const original = console.error;
  console.error = (): void => undefined;
  try {
    fetched.length = 0;
    const store = fakeStore();
    const hass = { ...store.hass, states: {}, areas: {}, devices: {}, entities: {} };
    const card = make();
    configure(card, { type: 'custom:mnml-template-card', template: 'vacuum-card', slots: {} });
    card.hass = hassOf(hass);
    document.body.append(card);
    await tick();
    await tick();
    await tick();
    card.hass = hassOf({ ...hass, states: { 'light.a': {} } });
    await tick();
    assert.deepEqual(fetched, ['vacuum'], 'not again at once');
    vi.advanceTimersByTime(31_000);
    card.hass = hassOf({ ...hass, states: { 'light.b': {} } });
    await tick();
    await tick();
    assert.deepEqual(fetched, ['vacuum', 'vacuum']);
  } finally {
    console.error = original;
    vi.useRealTimers();
  }
});

test('a card configured while its family is failing for a passing reason draws the error itself, and asks again later', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
  const original = console.error;
  console.error = (): void => undefined;
  try {
    fetched.length = 0;
    built.length = 0;
    const store = fakeStore();
    const hass = { ...store.hass, states: {}, areas: {}, devices: {}, entities: {} };
    const config = { type: 'custom:mnml-template-card', template: 'adguard', slots: {} };
    const first = make();
    configure(first, config);
    first.hass = hassOf(hass);
    document.body.append(first);
    await tick();
    await tick();
    await tick();
    const second = make();
    assert.doesNotThrow(() => {
      configure(second, config);
    });
    document.body.append(second);
    second.hass = hassOf(hass);
    await tick();
    await tick();
    assert.ok(built.some((card) => card['type'] === 'error'));
    vi.advanceTimersByTime(31_000);
    second.hass = hassOf({ ...hass, states: { 'light.c': {} } });
    await tick();
    await tick();
    assert.deepEqual(fetched, ['adguard', 'adguard']);
  } finally {
    console.error = original;
    vi.useRealTimers();
  }
});
