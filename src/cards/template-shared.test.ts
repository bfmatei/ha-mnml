import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { TemplateCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { baseOf } from '../templates/changes.ts';
import { readFamily } from '../templates/shipped.ts';
import { fakeStore } from '../test/fake-hass.ts';
import { define } from '../test/render.ts';

import { announced } from './parts/popup-registry.ts';
import { MnmlTemplateCard } from './template.ts';

define('mnml-template-card', MnmlTemplateCard);

const built: Record<string, unknown>[] = [];
window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement(config: object): ChildCard {
      built.push(config as Record<string, unknown>);
      return document.createElement('div');
    },
  });

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const REGISTRIES = { states: {}, areas: {}, devices: {}, entities: {} };

function make(): MnmlTemplateCard {
  const made = document.createElement('mnml-template-card');
  assert.ok(made instanceof MnmlTemplateCard);
  return made;
}

const hassOf = (hass: object): HomeAssistant => hass as HomeAssistant;
const configure = (card: MnmlTemplateCard, config: unknown): void => {
  card.setConfig(config as TemplateCard);
};
const heading = (title: string): Record<string, unknown> => ({
  card: { type: 'custom:mnml-heading-card', title, icon: 'mdi:share-variant' },
});
const own = (template: Record<string, unknown>): Record<string, unknown> => ({
  kind: 'own',
  template,
});

test('before the store answers, a card draws nothing and announces no pop-up; then it does both', async () => {
  built.length = 0;
  const answer = Promise.withResolvers<void>();
  const store = fakeStore();
  const { connection } = store.hass;
  const late = {
    ...connection,
    subscribeMessage: (
      ...args: Parameters<typeof connection.subscribeMessage>
    ): ReturnType<typeof connection.subscribeMessage> =>
      answer.promise.then(() => connection.subscribeMessage(...args)),
  };
  const card = make();
  card.hass = hassOf({ connection: late, ...REGISTRIES });
  configure(card, { type: 'custom:mnml-template-card', template: 'shared', slots: {} });
  document.body.append(card);
  await settle();
  assert.equal(built.length, 0);
  assert.deepEqual(
    announced().map((popup) => popup.hash),
    [],
  );
  store.kept = {
    shared: own({
      ...heading('Shared'),
      popups: [{ hash: '#shared', cards: [{ type: 'markdown', content: 'Shared' }] }],
    }),
  };
  answer.resolve();
  await settle();
  await settle();
  assert.equal(built[0]?.['title'], 'Shared');
  assert.deepEqual(
    announced().map((popup) => popup.hash),
    ['#shared'],
  );
  card.remove();
});

test("the store's own template wins over the shipped one, and the store's changes lay over a shipped one, inside shipped templates too", async () => {
  built.length = 0;
  const power = readFamily('common')['power'];
  assert.ok(power);
  const flash = { op: 'set', path: ['card'], key: 'icon', value: 'mdi:flash', base: '' } as const;
  const store = fakeStore();
  store.kept = {
    'section-heading': own({
      slots: { title: { kind: 'text', required: true }, icon: { kind: 'icon', required: true } },
      card: { type: 'custom:mnml-heading-card', title: '[[title]]', icon: 'mdi:share-variant' },
    }),
    power: { kind: 'changes', changes: [{ ...flash, base: baseOf(power, flash) }] },
  };
  const cards = [
    { template: 'section-heading', slots: { title: 'Rooms', icon: 'mdi:floor-plan' } },
    { template: 'switch-card', slots: { entity: 'switch.kitchen_outlet' } },
  ].map((config) => {
    const card = make();
    card.hass = hassOf({ ...store.hass, ...REGISTRIES });
    configure(card, { type: 'custom:mnml-template-card', ...config });
    document.body.append(card);
    return card;
  });
  await settle();
  await settle();
  assert.equal(
    built[0]?.['icon'],
    'mdi:share-variant',
    "the store's section-heading, not the shipped one",
  );
  const controls = built[1]?.['controls'];
  assert.ok(Array.isArray(controls));
  assert.equal((controls[0] as Record<string, unknown>)['icon'], 'mdi:flash');
  assert.equal(store.subscribed.length, 1, 'two cards, one subscription');
  for (const card of cards) {
    card.remove();
  }
});

test('a home without the store draws the shipped templates', async () => {
  built.length = 0;
  const store = fakeStore();
  const card = make();
  card.hass = hassOf({ ...store.hass, ...REGISTRIES });
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    slots: { title: 'Rooms', icon: 'mdi:floor-plan' },
  });
  document.body.append(card);
  await settle();
  await settle();
  assert.equal(built[0]?.['type'], 'custom:mnml-heading-card');
  assert.equal(built[0]?.['title'], 'Rooms');
  card.remove();
});

test('a store that cannot be read is an error card saying so', async () => {
  built.length = 0;
  const store = fakeStore();
  store.refuse = { code: 'unauthorized', message: 'Unauthorized' };
  const card = make();
  card.hass = hassOf({ ...store.hass, ...REGISTRIES });
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    slots: { title: 'Rooms', icon: 'mdi:floor-plan' },
  });
  document.body.append(card);
  await settle();
  await settle();
  assert.equal(built[0]?.['type'], 'error');
  assert.match(
    String(built[0]?.['error']),
    /mnml: the templates MNML keeps could not be read: Unauthorized/,
  );
  card.remove();
});

test('a save of the store redraws a card whose template changed, live', async () => {
  built.length = 0;
  const store = fakeStore();
  store.kept = { shared: own(heading('Before')) };
  const card = make();
  card.hass = hassOf({ ...store.hass, ...REGISTRIES });
  configure(card, { type: 'custom:mnml-template-card', template: 'shared', slots: {} });
  document.body.append(card);
  await settle();
  await settle();
  assert.deepEqual(
    built.map((config) => config['title']),
    ['Before'],
  );
  store.keep({ shared: own(heading('After')) });
  await settle();
  await settle();
  assert.deepEqual(
    built.map((config) => config['title']),
    ['Before', 'After'],
  );
  card.remove();
});

test('a save that changes another template leaves the card as it is', async () => {
  built.length = 0;
  const store = fakeStore();
  store.kept = { shared: own(heading('Same')), other: own(heading('One')) };
  const card = make();
  card.hass = hassOf({ ...store.hass, ...REGISTRIES });
  configure(card, { type: 'custom:mnml-template-card', template: 'shared', slots: {} });
  document.body.append(card);
  await settle();
  await settle();
  store.keep({ shared: own(heading('Same')), other: own(heading('Two')) });
  await settle();
  await settle();
  assert.deepEqual(
    built.map((config) => config['title']),
    ['Same'],
  );
  card.remove();
});

test('once the store has answered, a mistake in an explicit instance is thrown, as in the card editor', async () => {
  const store = fakeStore();
  const first = make();
  first.hass = hassOf({ ...store.hass, ...REGISTRIES });
  await settle();
  const card = make();
  assert.throws(() => {
    configure(card, {
      type: 'custom:mnml-template-card',
      template: 'section-heading',
      slots: { icon: 'mdi:floor-plan' },
    });
  }, /section-heading: the slot title is required/);
});

test('a card given hass but never attached does not follow saves', async () => {
  built.length = 0;
  const store = fakeStore();
  store.kept = { shared: own(heading('A')) };
  const card = make();
  card.hass = hassOf({ ...store.hass, ...REGISTRIES });
  await settle();
  configure(card, { type: 'custom:mnml-template-card', template: 'shared', slots: {} });
  await settle();
  store.keep({ shared: own(heading('B')) });
  await settle();
  await settle();
  assert.deepEqual(
    built.map((config) => config['title']),
    ['A'],
  );
});

test('a card detached during a save shows the saved template when it is attached again', async () => {
  built.length = 0;
  const store = fakeStore();
  store.kept = { shared: own(heading('Before')) };
  const card = make();
  card.hass = hassOf({ ...store.hass, ...REGISTRIES });
  configure(card, { type: 'custom:mnml-template-card', template: 'shared', slots: {} });
  document.body.append(card);
  await settle();
  await settle();
  card.remove();
  store.keep({ shared: own(heading('After')) });
  await settle();
  await settle();
  document.body.append(card);
  await settle();
  assert.deepEqual(
    built.map((config) => config['title']),
    ['Before', 'After'],
  );
  card.remove();
});
