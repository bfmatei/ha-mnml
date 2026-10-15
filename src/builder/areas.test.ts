import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Registries } from '../ha/registries.ts';
import { homes } from '../templates/corpus.ts';

import { groupedByArea, newAreaId, placedRegistries, suggestAreas, wordsOf } from './areas.ts';
import type { Suggestion } from './areas.ts';

const ROOMS = ['Office', 'Hall', 'Back Garden', 'Garden', 'Bathroom'];

const HOME: Registries = {
  areas: {
    living: { area_id: 'living', name: 'Living' },
    living_room: { area_id: 'living_room', name: 'Living Room' },
    kitchen: { area_id: 'kitchen', name: 'Bucătărie', aliases: ['Cook'] },
  },
  devices: {
    window: { id: 'window', name: 'Living Room Window' },
    lamp: { id: 'lamp', name: 'Shelly 1', name_by_user: 'Desk lamp' },
    hue: { id: 'hue', name: 'Hue bridge' },
    placed: { id: 'placed', name: 'Kitchen plug', area_id: 'kitchen' },
    cloud: { id: 'cloud', name: 'Office forecast', entry_type: 'service' },
    empty: { id: 'empty', name: 'Office printer' },
  },
  entities: {
    'binary_sensor.window': { entity_id: 'binary_sensor.window', device_id: 'window' },
    'light.desk': { entity_id: 'light.desk', device_id: 'lamp' },
    'light.office_1': { entity_id: 'light.office_1', device_id: 'hue' },
    'light.office_2': { entity_id: 'light.office_2', device_id: 'hue' },
    'light.hall': { entity_id: 'light.hall', device_id: 'hue' },
    'switch.plug': { entity_id: 'switch.plug', device_id: 'placed' },
    'weather.office': { entity_id: 'weather.office', device_id: 'cloud' },
    'sensor.bucatarie_temperature': { entity_id: 'sensor.bucatarie_temperature' },
    'sensor.cook_humidity': { entity_id: 'sensor.cook_humidity' },
    'binary_sensor.office_door': { entity_id: 'binary_sensor.office_door' },
    'binary_sensor.back_garden_motion': { entity_id: 'binary_sensor.back_garden_motion' },
    'sensor.hall_smoke': { entity_id: 'sensor.hall_smoke' },
    'sensor.office_hidden': { entity_id: 'sensor.office_hidden', hidden: true },
    'sensor.office_rssi': { entity_id: 'sensor.office_rssi', entity_category: 'diagnostic' },
    'person.office': { entity_id: 'person.office' },
    'light.own': { entity_id: 'light.own', area_id: 'living' },
  },
  states: {
    'binary_sensor.office_door': { attributes: { friendly_name: 'Door' } },
    'sensor.hall_smoke': { attributes: { friendly_name: 'Living Smoke' } },
  },
};

const found = (suggestions: readonly Suggestion[]): Record<string, string> =>
  Object.fromEntries(
    suggestions.map(({ kind, id, to, by }) => [
      `${kind}:${id}`,
      `${to.area ?? `new ${to.create}`}${by === 'entities' ? ' by its entities' : ''}`,
    ]),
  );

test('words are lower case, without accents, split on anything but letters and digits', () => {
  assert.deepEqual(wordsOf('Bucătărie, Living_Room-2'), ['bucatarie', 'living', 'room', '2']);
  assert.equal(newAreaId('Back Garden'), 'back_garden');
});

test('each unplaced device and device-less entity takes the area its name, its id or an alias names, the earliest and then the longest run of words', () => {
  assert.deepEqual(found(suggestAreas(HOME, ROOMS)), {
    'device:window': 'living_room',
    'device:hue': 'new Office by its entities',
    'entity:sensor.bucatarie_temperature': 'kitchen',
    'entity:sensor.cook_humidity': 'kitchen',
    'entity:binary_sensor.office_door': 'new Office',
    'entity:sensor.hall_smoke': 'living',
  });
});

test('a room word becomes a new area only when two things or more find it', () => {
  const suggested = suggestAreas(HOME, ROOMS);
  assert.ok(!suggested.some(({ to }) => to.create === 'Back Garden' || to.create === 'Hall'));
  const twice = suggestAreas(
    {
      ...HOME,
      entities: {
        ...HOME.entities,
        'light.back_garden': { entity_id: 'light.back_garden' },
      },
    },
    ROOMS,
  );
  assert.deepEqual(
    twice.filter(({ to }) => to.create === 'Back Garden').map(({ id }) => id),
    ['binary_sensor.back_garden_motion', 'light.back_garden'],
  );
});

test('a placed device, a service, a hidden or a diagnostic entity, a person and a device with no entity are left alone', () => {
  const ids = new Set(suggestAreas(HOME, ROOMS).map(({ id }) => id));
  for (const left of [
    'placed',
    'cloud',
    'empty',
    'lamp',
    'sensor.office_hidden',
    'sensor.office_rssi',
    'person.office',
    'light.own',
  ]) {
    assert.ok(!ids.has(left), left);
  }
});

test('the suggestions are grouped by area, those of Home Assistant in its order, then the new ones', () => {
  const groups = groupedByArea(suggestAreas(HOME, ROOMS), HOME);
  assert.deepEqual(
    groups.map((group) => [group.name, group.suggestions.length]),
    [
      ['Living', 1],
      ['Living Room', 1],
      ['Bucătărie', 2],
      ['Office', 2],
    ],
  );
});

test('placed registries hold the new areas and each device and entity in its area, for a preview', () => {
  const placed = placedRegistries(HOME, suggestAreas(HOME, ROOMS));
  assert.deepEqual(placed.areas['office'], { area_id: 'office', name: 'Office' });
  assert.equal(placed.devices['hue']?.area_id, 'office');
  assert.equal(placed.devices['window']?.area_id, 'living_room');
  assert.equal(placed.entities['binary_sensor.office_door']?.area_id, 'office');
  assert.equal(placed.entities['light.desk']?.area_id, undefined);
  assert.equal(HOME.devices['hue']?.area_id, undefined, 'the registries given are unchanged');
});

test('on the demo home, rooms that are not areas yet are proposed, and the areas there fill up', () => {
  const demo = homes()['demo'];
  assert.ok(demo);
  const groups = groupedByArea(suggestAreas(demo, ROOMS), demo);
  const names = new Set(groups.map((group) => group.name));
  for (const name of ['Bedroom', 'Kitchen', 'Living', 'Office', 'Hall', 'Bathroom']) {
    assert.ok(names.has(name), name);
  }
  assert.ok(groups.every((group) => group.suggestions.length >= 2));
});
