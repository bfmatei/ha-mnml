import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { HomeAssistant } from './hass.ts';
import { cardName, entityName, nameOf } from './names.ts';

const hass = {
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
  },
  entities: {
    'sensor.sedan_fuel': { entity_id: 'sensor.sedan_fuel', device_id: 'car' },
    'sensor.sedan_metadata': { entity_id: 'sensor.sedan_metadata', device_id: 'car' },
    'sensor.renamed': { entity_id: 'sensor.renamed', name: 'Short', device_id: 'car' },
  },
  devices: { car: { id: 'car', name: 'Family sedan', name_by_user: 'Sedan' } },
} as unknown as HomeAssistant;

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

test('a card without an entity keeps its own name; with one, the entity names it', () => {
  assert.equal(cardName(hass, undefined, { name: 'Kitchen' }), 'Kitchen');
  assert.equal(cardName(hass, 'sensor.sedan_metadata', { label: 'device' }), 'Sedan');
  assert.equal(cardName(hass, 'sensor.sedan_metadata', {}), 'Metadata');
});
