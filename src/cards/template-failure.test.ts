import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { ChildCard } from '../ha/card-helpers.ts';
import { fetched } from '../test/families.ts';
import { fakeHass, fakeStore } from '../test/hass.ts';
import { created, define } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlCardNote } from './parts/card-element.ts';
import { MnmlTemplateCard } from './template.ts';

vi.mock('../templates/families.ts', () => import('../test/families.ts'));

define('mnml-template-card', MnmlTemplateCard);
define('mnml-card-note', MnmlCardNote);

const built: Record<string, unknown>[] = [];
window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement(config: object): ChildCard {
      built.push(config as Record<string, unknown>);
      return document.createElement('div');
    },
  });

function failureIn(card: MnmlTemplateCard): string {
  const note = card.shadowRoot?.firstElementChild;
  assert.ok(note instanceof MnmlCardNote, note?.localName ?? 'nothing is drawn');
  assert.equal(note.failed, true);
  return note.message;
}
const noted = (card: MnmlTemplateCard): boolean =>
  card.shadowRoot?.firstElementChild instanceof MnmlCardNote;

const make = (): MnmlTemplateCard => created('mnml-template-card', MnmlTemplateCard);

test('a family that cannot be loaded turns the card that needs it into an error note naming the file, in the order a page loads', async () => {
  const original = console.error;
  console.error = (): void => undefined;
  const card = make();
  try {
    const store = fakeStore();
    card.setConfig({
      type: 'custom:mnml-template-card',
      template: 'light-card',
      slots: { entity: 'light.kitchen' },
    });
    card.hass = store.hass;
    document.body.append(card);
    await until(() => noted(card), 'the error note');
  } finally {
    console.error = original;
  }
  assert.deepEqual(fetched, ['lights']);
  assert.match(
    failureIn(card),
    /mnml: the shipped templates could not be loaded: mnml-cards-lights\.json: 404 Not Found/,
  );
  assert.equal(built.length, 0);
});

test('a card whose family failed for a passing reason asks again 30 seconds later', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
  const original = console.error;
  console.error = (): void => undefined;
  try {
    fetched.length = 0;
    const store = fakeStore();
    const hass = store.hass;
    const card = make();
    card.setConfig({ type: 'custom:mnml-template-card', template: 'vacuum-card', slots: {} });
    card.hass = hass;
    document.body.append(card);
    await until(() => noted(card), 'the error note');
    card.hass = fakeHass({ ...hass, states: { 'light.a': {} } });
    await card.updateComplete;
    assert.deepEqual(fetched, ['vacuum'], 'not again at once');
    vi.advanceTimersByTime(31_000);
    card.hass = fakeHass({ ...hass, states: { 'light.b': {} } });
    await until(() => fetched.length === 2, 'the second ask');
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
    const store = fakeStore();
    const hass = store.hass;
    const config = { type: 'custom:mnml-template-card', template: 'adguard', slots: {} } as const;
    const first = make();
    first.setConfig(config);
    first.hass = hass;
    document.body.append(first);
    await until(() => noted(first), 'the error note');
    const second = make();
    assert.doesNotThrow(() => {
      second.setConfig(config);
    });
    document.body.append(second);
    second.hass = hass;
    await until(() => noted(second), 'the error note');
    assert.match(failureIn(second), /mnml-cards-adguard\.json/);
    vi.advanceTimersByTime(31_000);
    second.hass = fakeHass({ ...hass, states: { 'light.c': {} } });
    await until(() => fetched.length === 2, 'the second ask');
    assert.deepEqual(fetched, ['adguard', 'adguard']);
  } finally {
    console.error = original;
    vi.useRealTimers();
  }
});
