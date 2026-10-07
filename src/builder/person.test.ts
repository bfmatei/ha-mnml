import assert from 'node:assert/strict';

import { test } from 'vitest';

import { expand } from '../templates/expand.ts';
import { readTemplates } from '../templates/shipped.ts';

import { HOME } from './fixture.ts';
import { personOf } from './person.ts';

const TEMPLATES = readTemplates();

test("a person's devices are their companion-app trackers, with the app's sensors", () => {
  assert.deepEqual(personOf(HOME, 'person.jane'), {
    key: 'jane',
    entity: 'person.jane',
    devices: [
      {
        key: 'phone',
        name: "Jane's iPhone",
        tracker: 'device_tracker.jane_phone',
        battery: 'sensor.jane_phone_battery_level',
        battery_state: 'sensor.jane_phone_battery_state',
        connection: 'sensor.jane_phone_connection_type',
        network: 'sensor.jane_phone_ssid',
        storage: 'sensor.jane_phone_storage',
        focus: 'binary_sensor.jane_phone_focus',
        activity: 'sensor.jane_phone_activity',
        permission: 'sensor.jane_phone_location_permission',
      },
    ],
    activities: ['sensor.jane_phone_activity'],
    focuses: ['binary_sensor.jane_phone_focus'],
    batteries: ['sensor.jane_phone_battery_level'],
  });
});

test('a person with no companion app is only their person entity', () => {
  assert.deepEqual(personOf(HOME, 'person.bob'), { key: 'bob', entity: 'person.bob' });
  assert.deepEqual(personOf(HOME, 'person.gone'), { key: 'gone', entity: 'person.gone' });
});

test("a person's slots draw the person template, with or without devices", () => {
  for (const entity of ['person.jane', 'person.bob'] as const) {
    const expanded = expand(TEMPLATES, { template: 'person', slots: personOf(HOME, entity) });
    assert.equal(expanded.missing, undefined);
    assert.notEqual(expanded.card, null);
  }
});

test("the pop-up of a person with no devices leaves the devices' parts out", () => {
  const expanded = expand(TEMPLATES, {
    template: 'person',
    slots: personOf(HOME, 'person.bob'),
  });
  const text = JSON.stringify(expanded.popups);
  assert.equal(text.includes('#person-bob'), true);
  assert.equal(text.includes('Devices'), false);
  assert.equal(text.includes('Location access'), false);
});
