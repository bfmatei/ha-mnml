import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fakeHass } from '../test/hass.ts';

import { cardName, distinctNames, entityName, nameOf } from './names.ts';

const hass = fakeHass({
  states: {
    'light.top': {
      entity_id: 'light.top',
      state: 'on',
      attributes: { friendly_name: 'Top Lights' },
    },
    'sensor.sedan_fuel': {
      entity_id: 'sensor.sedan_fuel',
      state: '37',
      attributes: { friendly_name: 'Sedan Fuel' },
    },
    'sensor.sedan_metadata': {
      entity_id: 'sensor.sedan_metadata',
      state: 'ok',
      attributes: { friendly_name: 'Sedan Metadata' },
    },
    'sensor.renamed': {
      entity_id: 'sensor.renamed',
      state: '1',
      attributes: { friendly_name: 'Long' },
    },
    'sensor.router': {
      entity_id: 'sensor.router',
      state: '1',
      attributes: { friendly_name: 'Tailscale router' },
    },
    'sensor.angie': {
      entity_id: 'sensor.angie',
      state: '1',
      attributes: { friendly_name: 'Tailscale Angie phone' },
    },
    'sensor.phone': {
      entity_id: 'sensor.phone',
      state: '1',
      attributes: { friendly_name: 'iPhone battery' },
    },
  },
  entities: {
    'sensor.sedan_fuel': { entity_id: 'sensor.sedan_fuel', device_id: 'car' },
    'sensor.sedan_metadata': { entity_id: 'sensor.sedan_metadata', device_id: 'car' },
    'sensor.renamed': { entity_id: 'sensor.renamed', name: 'Short', device_id: 'car' },
  },
  devices: { car: { id: 'car', name: 'Family sedan', name_by_user: 'Sedan' } },
});

test('a registry name wins, and a friendly name loses its device prefix', () => {
  assert.equal(entityName(hass, 'sensor.renamed'), 'Short');
  assert.equal(entityName(hass, 'sensor.sedan_fuel'), 'Fuel');
  assert.equal(entityName(hass, 'sensor.missing'), 'sensor.missing');
});

test('label: device names an entity after its device, as the user renamed it', () => {
  assert.equal(nameOf(hass, 'sensor.sedan_fuel', { label: 'device' }), 'Sedan');
  assert.equal(nameOf(hass, 'sensor.sedan_fuel', { name: 'Given', label: 'device' }), 'Given');
});

test('strip removes a literal suffix, strip_word a word with its plural', () => {
  assert.equal(nameOf(hass, 'light.top', { strip: ' Lights' }), 'Top');
  assert.equal(nameOf(hass, 'light.top', { strip_word: 'Light' }), 'Top');
});

test('strip_word that removes the first word capitalises the rest, and only then', () => {
  assert.equal(nameOf(hass, 'sensor.router', { strip_word: 'Tailscale' }), 'Router');
  assert.equal(nameOf(hass, 'sensor.angie', { strip_word: 'Tailscale' }), 'Angie phone');
  assert.equal(
    nameOf(hass, 'sensor.angie', { strip_word: 'tailscale' }),
    'Angie phone',
    'whatever its case',
  );
  assert.equal(
    nameOf(hass, 'sensor.phone', { strip_word: 'Tailscale' }),
    'iPhone battery',
    'no match, no change',
  );
  assert.equal(
    nameOf(hass, 'sensor.phone', { strip_word: 'battery' }),
    'iPhone',
    'a later word leaves the start alone',
  );
});

test('a card without an entity keeps its own name; with one, the entity names it', () => {
  assert.equal(cardName(hass, undefined, { name: 'Kitchen' }), 'Kitchen');
  assert.equal(cardName(hass, 'sensor.sedan_metadata', { label: 'device' }), 'Sedan');
  assert.equal(cardName(hass, 'sensor.sedan_metadata', {}), 'Metadata');
});

test('names that would read the same take their area first, and only those', () => {
  const rooms = fakeHass({
    states: {},
    areas: {
      bedroom: { area_id: 'bedroom', name: 'Bedroom' },
      entry: { area_id: 'entry', name: 'Entry' },
      kitchen: { area_id: 'kitchen', name: 'Kitchen' },
    },
    entities: {
      'sensor.bedroom_ac': { entity_id: 'sensor.bedroom_ac', device_id: 'bedroom_ac' },
      'sensor.entry_ac': { entity_id: 'sensor.entry_ac', device_id: 'entry_ac' },
      'sensor.kettle': { entity_id: 'sensor.kettle', device_id: 'kettle' },
      'sensor.kitchen_ac': { entity_id: 'sensor.kitchen_ac', device_id: 'kitchen_ac' },
      'sensor.spare_ac': { entity_id: 'sensor.spare_ac', device_id: 'spare_ac' },
    },
    devices: {
      bedroom_ac: { id: 'bedroom_ac', name: 'AC', area_id: 'bedroom' },
      entry_ac: { id: 'entry_ac', name_by_user: 'AC', area_id: 'entry' },
      kettle: { id: 'kettle', name: 'Kettle', area_id: 'kitchen' },
      kitchen_ac: { id: 'kitchen_ac', name: 'Kitchen AC', area_id: 'kitchen' },
      spare_ac: { id: 'spare_ac', name: 'Kitchen AC' },
    },
  });
  assert.deepEqual(
    distinctNames(rooms, [
      { entity: 'sensor.bedroom_ac', label: 'device' },
      { entity: 'sensor.entry_ac', label: 'device' },
      { entity: 'sensor.kettle', label: 'device' },
    ]),
    ['Bedroom AC', 'Entry AC', 'Kettle'],
  );
  assert.deepEqual(
    distinctNames(rooms, [
      { entity: 'sensor.kitchen_ac', label: 'device' },
      { entity: 'sensor.spare_ac', label: 'device' },
      { entity: 'sensor.bedroom_ac', name: 'AC' },
      { entity: 'sensor.entry_ac', name: 'AC' },
    ]),
    ['Kitchen AC', 'Kitchen AC', 'AC', 'AC'],
    'a name that already starts with its area, no area, or a given name stays as it is',
  );
});
