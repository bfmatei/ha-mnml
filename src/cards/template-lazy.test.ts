import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { TemplateCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { baseOf } from '../templates/changes.ts';
import { readFamily } from '../templates/shipped.ts';
import { fakeStore } from '../test/fake-hass.ts';
import { define } from '../test/render.ts';

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

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const settle = async (): Promise<void> => {
  await tick();
  await tick();
  await tick();
  await tick();
};
const hassOf = (hass: object): HomeAssistant => hass as HomeAssistant;
const STORE = fakeStore();
const HASS = hassOf({ ...STORE.hass, states: {}, areas: {}, devices: {}, entities: {} });

function make(): MnmlTemplateCard {
  const made = document.createElement('mnml-template-card');
  assert.ok(made instanceof MnmlTemplateCard);
  return made;
}

const configure = (card: MnmlTemplateCard, config: unknown): void => {
  card.setConfig(config as TemplateCard);
};

test("before its family has loaded, a card takes the size of its template's card", () => {
  customElements.define(
    'mnml-select-card',
    class extends HTMLElement {
      getGridOptions(): Record<string, unknown> {
        return { columns: 6, rows: 'auto' };
      }
    },
  );
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'select-card',
    slots: { entity: 'select.living_scene' },
  });
  assert.deepEqual(card.getGridOptions(), { columns: 6, rows: 'auto' });
});

test('a card whose template is in a family draws once that family has loaded', async () => {
  built.length = 0;
  const card = make();
  card.hass = HASS;
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'switch-card',
    slots: { entity: 'switch.kitchen_outlet' },
  });
  document.body.append(card);
  await settle();
  assert.equal(built[0]?.['type'], 'custom:mnml-entity-card');
  const controls = built[0]?.['controls'];
  assert.ok(Array.isArray(controls));
  assert.equal((controls[0] as Record<string, unknown>)['type'], 'toggle', 'power, from common');
  card.remove();
});

test('before its family has loaded, a mistake is not thrown but drawn as an error card', async () => {
  built.length = 0;
  const card = make();
  card.hass = HASS;
  assert.doesNotThrow(() => {
    configure(card, { type: 'custom:mnml-template-card', template: 'speaker-popup', slots: {} });
  });
  document.body.append(card);
  await settle();
  assert.equal(built[0]?.['type'], 'error');
  assert.match(String(built[0]?.['error']), /speaker-popup: the slot key is required/);
  card.remove();
});

test('once its family has loaded, a mistake throws in setConfig, as in the card editor', () => {
  const card = make();
  assert.throws(() => {
    configure(card, { type: 'custom:mnml-template-card', template: 'switch-card', slots: {} });
  }, /switch-card: the slot entity is required/);
});

test('a card without hass draws its template once its family has loaded', async () => {
  built.length = 0;
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'light-card',
    slots: { entity: 'light.kitchen' },
  });
  document.body.append(card);
  await settle();
  assert.equal(built.length, 1);
  assert.notEqual(built[0]?.['type'], 'error');
  card.remove();
});

test('changes kept for a template whose family has not loaded yet lay over it once the family loads', async () => {
  built.length = 0;
  const shipped = readFamily('media')['media-server'];
  assert.ok(shipped);
  const rename = { op: 'set', path: ['card'], key: 'name', value: 'Films', base: '' } as const;
  const store = fakeStore();
  store.kept = {
    'media-server': { kind: 'changes', changes: [{ ...rename, base: baseOf(shipped, rename) }] },
  };
  const card = make();
  card.hass = hassOf({ ...store.hass, states: {}, areas: {}, devices: {}, entities: {} });
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'media-server',
    slots: shipped.example ?? {},
  });
  document.body.append(card);
  await settle();
  assert.equal(built[0]?.['name'], 'Films');
  card.remove();
});
