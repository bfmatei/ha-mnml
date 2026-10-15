import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Registries } from '../ha/registries.ts';

import { inDomain, indexOf, relativesOf } from './entity-index.ts';

const R: Registries = {
  areas: {
    living: { area_id: 'living', name: 'Living' },
    kitchen: { area_id: 'kitchen', name: 'Kitchen' },
  },
  devices: {
    plug: { id: 'plug', area_id: 'kitchen', name: 'Plug', labels: ['power'] },
    robot: { id: 'robot', area_id: 'living', name: 'Robot' },
    dock: { id: 'dock', area_id: 'living', name: 'Dock', via_device_id: 'robot' },
  },
  entities: {
    'switch.plug': { entity_id: 'switch.plug', device_id: 'plug', platform: 'shelly' },
    'sensor.plug_daily': {
      entity_id: 'sensor.plug_daily',
      device_id: 'plug',
      platform: 'utility_meter',
      hidden: true,
    },
    'sensor.plug_power': {
      entity_id: 'sensor.plug_power',
      device_id: 'plug',
      area_id: 'living',
      platform: 'shelly',
    },
    'vacuum.robot': { entity_id: 'vacuum.robot', device_id: 'robot', labels: ['mnml_vacuum'] },
    'light.lamp': { entity_id: 'light.lamp', area_id: 'living', platform: 'hue' },
    'light.attic': { entity_id: 'light.attic', platform: 'hue' },
  },
  states: {},
};

const ids = (entries: readonly { entity_id: string }[] | undefined): string[] =>
  (entries ?? []).map((entry) => entry.entity_id);

test('the visible entities are listed once, in id order, by area, by device and by label', () => {
  const index = indexOf(R);
  assert.deepEqual(ids(index.visible), [
    'light.attic',
    'light.lamp',
    'sensor.plug_power',
    'switch.plug',
    'vacuum.robot',
  ]);
  assert.deepEqual(ids(index.areas.get('living')), [
    'light.lamp',
    'sensor.plug_power',
    'vacuum.robot',
  ]);
  assert.deepEqual(
    ids(index.areas.get('kitchen')),
    ['switch.plug'],
    "its own area beats its device's",
  );
  assert.deepEqual(ids(index.devices.get('plug')), ['sensor.plug_power', 'switch.plug']);
  assert.deepEqual(ids(index.labels.get('power')), ['sensor.plug_power', 'switch.plug']);
  assert.deepEqual(ids(index.labels.get('mnml_vacuum')), ['vacuum.robot']);
  assert.equal(index.ids.get('sensor.plug_daily'), undefined, 'a hidden entity is left out');
  assert.deepEqual(ids(inDomain(index, 'light')), ['light.attic', 'light.lamp']);
  assert.deepEqual(ids(inDomain(index, 'cover')), []);
  assert.equal(inDomain(index, undefined), index.visible, 'no domain is the whole home');
});

test("a device's integrations count its hidden entities too", () => {
  assert.deepEqual([...(indexOf(R).platforms.get('plug') ?? [])].toSorted(), [
    'shelly',
    'utility_meter',
  ]);
});

test('the areas are listed by name, and a device has its relatives either way round', () => {
  assert.deepEqual(
    indexOf(R).byName.map((area) => area.area_id),
    ['kitchen', 'living'],
  );
  assert.deepEqual(relativesOf('robot', R), ['dock']);
  assert.deepEqual(relativesOf('dock', R), ['robot']);
  assert.deepEqual(relativesOf('plug', R), []);
});

test('a snapshot is indexed once, and a new registry is indexed again', () => {
  const index = indexOf(R);
  assert.equal(indexOf({ ...R }), index, 'the same registries in a new object');
  assert.equal(indexOf({ ...R, states: {} }), index, 'a state change keeps the index');
  const moved: Registries = {
    ...R,
    devices: { ...R.devices, plug: { id: 'plug', area_id: 'living', name: 'Plug' } },
  };
  assert.notEqual(indexOf(moved), index);
  assert.deepEqual(ids(indexOf(moved).areas.get('kitchen')), [], 'the plug moved with its device');
  const renamed: Registries = {
    ...R,
    areas: { ...R.areas, kitchen: { area_id: 'kitchen', name: 'Scullery' } },
  };
  assert.deepEqual(
    indexOf(renamed).byName.map((area) => area.name),
    ['Living', 'Scullery'],
  );
  const added: Registries = {
    ...R,
    entities: { ...R.entities, 'light.new': { entity_id: 'light.new', area_id: 'kitchen' } },
  };
  assert.deepEqual(ids(indexOf(added).areas.get('kitchen')), ['light.new', 'switch.plug']);
});
