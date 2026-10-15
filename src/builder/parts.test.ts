import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';
import { readTemplates } from '../templates/shipped.ts';

import { partsOf, swapsFor } from './parts.ts';

test("a tile's parts are the slots its state, chips and item draw only when filled, in the card's order, once each", () => {
  const room = readTemplates()['room'];
  assert.ok(room);
  assert.deepEqual(partsOf(room), [
    'temperature',
    'humidity',
    'window',
    'door',
    'leaks',
    'batteries',
    'lock',
    'ac',
    'heating',
    'lights',
  ]);
});

test('a part drawn for each item of a list, under several slots, or under a required slot is not one', () => {
  const template: Template = {
    slots: {
      name: { kind: 'text', required: true },
      fans: { kind: 'entities' },
      a: { kind: 'entity' },
      b: { kind: 'entity' },
    },
    card: {
      type: 'custom:mnml-tile-card',
      name: '[[name]]',
      'chips?': [
        { id: 'named', if: 'name', type: 'indicator', entity: '[[a]]' },
        { id: 'each-fan', each: 'fans', as: 'fan', if: 'fan', type: 'toggle', entity: '[[fan]]' },
        { id: 'either', if: ['a', 'b'], type: 'indicator', entity: '[[a]]' },
        { id: 'b', if: 'b', type: 'indicator', entity: '[[b]]' },
      ],
    },
  };
  assert.deepEqual(partsOf(template), ['b']);
});

const HOME: Registries = {
  areas: { living: { area_id: 'living', name: 'Living' } },
  devices: {
    thermo: { id: 'thermo', area_id: 'living' },
    other: { id: 'other', area_id: 'living' },
  },
  entities: {
    'sensor.thermo_temperature': { entity_id: 'sensor.thermo_temperature', device_id: 'thermo' },
    'sensor.thermo_probe': { entity_id: 'sensor.thermo_probe', device_id: 'thermo' },
    'sensor.other_temperature': { entity_id: 'sensor.other_temperature', device_id: 'other' },
    'sensor.attic_temperature': { entity_id: 'sensor.attic_temperature' },
    'sensor.thermo_humidity': { entity_id: 'sensor.thermo_humidity', device_id: 'thermo' },
  },
  states: {
    'sensor.thermo_temperature': { attributes: { device_class: 'temperature' } },
    'sensor.thermo_probe': { attributes: { device_class: 'temperature' } },
    'sensor.other_temperature': { attributes: { device_class: 'temperature' } },
    'sensor.attic_temperature': { attributes: { device_class: 'temperature' } },
    'sensor.thermo_humidity': { attributes: { device_class: 'humidity' } },
  },
};

test("a swap offers the entities of the same domain and class, its device's first, then its area's, then the rest", () => {
  assert.deepEqual(swapsFor(HOME, 'sensor.thermo_temperature', 'living'), [
    'sensor.thermo_probe',
    'sensor.other_temperature',
    'sensor.attic_temperature',
  ]);
});
