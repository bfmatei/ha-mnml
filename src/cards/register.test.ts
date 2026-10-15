import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { homes } from '../templates/corpus.ts';
import { fakeHass } from '../test/hass.ts';

import { MnmlCard } from './base.ts';
import { MnmlPopupsCard } from './popups.ts';
import { MnmlTemplateCard } from './template.ts';

test('loading the bundle twice defines each card once and throws nothing', async () => {
  await import('./register.ts');
  const first = customElements.get('mnml-list-card');
  const slider = customElements.get('mnml-slider');
  const note = customElements.get('mnml-card-note');
  assert.ok(first, 'mnml-list-card is defined');
  assert.ok(slider, 'and the slider its cards draw');
  assert.ok(note, 'and the note a card draws in place of one it cannot draw');
  vi.resetModules();
  await import('./register.ts');
  assert.equal(customElements.get('mnml-list-card'), first);
  assert.equal(customElements.get('mnml-slider'), slider);
  assert.equal(customElements.get('mnml-card-note'), note);
  const types = (window.customCards ?? []).map((entry) => entry.type);
  assert.equal(types.filter((type) => type === 'mnml-list-card').length, 1);
});

const COLUMNS: Record<string, number> = {
  'mnml-heading-card': 12,
  'mnml-list-card': 12,
  'mnml-agenda-card': 12,
  'mnml-messages-card': 12,
  'mnml-clients-card': 12,
  'mnml-report-card': 12,
  'mnml-weather-card': 12,
  'mnml-glances-card': 12,
  'mnml-button-card': 6,
  'mnml-select-card': 6,
  'mnml-slider-card': 6,
  'mnml-entity-card': 12,
  'mnml-header-card': 12,
  'mnml-tile-card': 6,
  'mnml-media-card': 12,
  'mnml-car-plan-card': 12,
  'mnml-popups-card': 1,
  'mnml-template-card': 12,
};

test('each card asks for its share of a section: the small ones half, the pop-ups one column', async () => {
  await import('./register.ts');
  const types = (window.customCards ?? []).map((entry) => entry.type);
  assert.deepEqual(Object.keys(COLUMNS).toSorted(), types.toSorted());
  for (const [name, columns] of Object.entries(COLUMNS)) {
    const card = document.createElement(name);
    assert.ok(
      card instanceof MnmlCard ||
        card instanceof MnmlPopupsCard ||
        card instanceof MnmlTemplateCard,
      name,
    );
    assert.deepEqual(card.getGridOptions(), { columns, rows: 'auto' }, name);
  }
});

test('every card has a picker entry with a name, a description, a docs link, and a stub', async () => {
  await import('./register.ts');
  for (const entry of window.customCards ?? []) {
    assert.match(entry.name, /^MNML /, entry.type);
    assert.ok(entry.description.length > 0, entry.type);
    assert.equal(
      entry.documentationURL,
      `https://github.com/bfmatei/ha-mnml/blob/main/docs/keys.md#${entry.type}`,
    );
    const Card = customElements.get(entry.type);
    assert.ok(Card, entry.type);
    assert.equal(typeof Reflect.get(Card, 'getStubConfig'), 'function', entry.type);
    const editable = entry.type !== 'mnml-popups-card';
    assert.equal(
      typeof Reflect.get(Card, 'getConfigElement'),
      editable ? 'function' : 'undefined',
      entry.type,
    );
  }
  assert.equal(window.customCards?.[0]?.type, 'mnml-template-card');
});

test("only the template card's entry suggests a card for an entity in Home Assistant's card picker, from the shipped index", async () => {
  await import('./register.ts');
  const entries = window.customCards ?? [];
  assert.deepEqual(
    entries.filter((entry) => entry.getEntitySuggestion !== undefined).map((entry) => entry.type),
    ['mnml-template-card'],
  );
  const suggest = entries[0]?.getEntitySuggestion;
  assert.ok(suggest);
  const home = homes()['devices'];
  assert.ok(home);
  const hass = fakeHass({
    areas: home.areas,
    devices: home.devices,
    entities: home.entities,
    states: home.states,
  });
  assert.deepEqual(suggest(hass, 'vacuum.roborock_s8')?.at(-1), {
    config: { type: 'custom:mnml-template-card', template: 'room', area: 'living' },
    label: 'Living: Room',
  });
  assert.equal(suggest(hass, 'update.kettle_plug_firmware'), null);
  assert.equal(suggest(hass, 'light.nowhere'), null);
});

test('the bundle offers the MNML dashboard strategy once, with its editor', async () => {
  await import('./register.ts');
  const strategy = customElements.get('ll-strategy-dashboard-mnml');
  assert.ok(strategy, 'll-strategy-dashboard-mnml is defined');
  assert.equal(typeof Reflect.get(strategy, 'generate'), 'function', 'and generates a dashboard');
  assert.ok(customElements.get('mnml-strategy-editor'), 'and its editor is defined');
  vi.resetModules();
  await import('./register.ts');
  assert.equal(customElements.get('ll-strategy-dashboard-mnml'), strategy);
  assert.deepEqual(window.customStrategies, [
    {
      type: 'mnml',
      strategyType: 'dashboard',
      name: 'MNML',
      description:
        'A dashboard of the rooms, people and system cards MNML finds, rebuilt as the home changes',
      documentationURL:
        'https://github.com/bfmatei/ha-mnml/blob/main/docs/home.md#the-dashboard-strategy',
    },
  ]);
});
