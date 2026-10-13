import assert from 'node:assert/strict';

import { test } from 'vitest';

import { snapshotOf } from './snapshot.ts';

const ROWS = {
  areas: [
    {
      area_id: 'bedroom',
      name: 'Bedroom',
      icon: null,
      temperature_entity_id: null,
      humidity_entity_id: null,
      floor_id: null,
    },
  ],
  devices: [
    {
      id: 'ac',
      area_id: 'bedroom',
      name: 'AC',
      name_by_user: 'Bedroom AC',
      manufacturer: 'Daikin',
      model: 'FTXM25R',
      entry_type: null,
      via_device_id: 'hub',
      labels: ['mnml_ac'],
      serial_number: '123',
    },
  ],
  entities: [
    {
      entity_id: 'climate.ac',
      device_id: 'ac',
      area_id: null,
      platform: 'daikin',
      translation_key: null,
      entity_category: null,
      name: 'Cooler',
      hidden_by: null,
      disabled_by: null,
      labels: [],
      unique_id: 'x',
    },
    {
      entity_id: 'sensor.ac_rssi',
      device_id: 'ac',
      area_id: null,
      platform: 'daikin',
      translation_key: 'rssi',
      entity_category: 'diagnostic',
      name: null,
      hidden_by: null,
      disabled_by: 'integration',
      labels: [],
    },
  ],
  states: [
    {
      entity_id: 'person.jane',
      state: 'home',
      attributes: {
        friendly_name: 'Jane',
        device_trackers: ['device_tracker.phone'],
        user_id: 'u',
      },
    },
    {
      entity_id: 'climate.ac',
      state: 'cool',
      attributes: {
        friendly_name: 'Bedroom AC',
        hvac_modes: ['off', 'heat', 'cool'],
        min_temp: 16,
        supported_features: 1,
      },
    },
    {
      entity_id: 'device_tracker.phone',
      state: 'home',
      attributes: {
        friendly_name: 'Phone',
        source_type: 'gps',
        latitude: 1,
        longitude: 2,
        gps_accuracy: 5,
      },
    },
  ],
};

test("a snapshot keeps what discovery reads: the attributes its rules filter on, a person's trackers, a tracker's source, the device's maker, model, type, link and labels", () => {
  const snapshot = snapshotOf(ROWS);
  assert.deepEqual(
    snapshot.states['device_tracker.phone'],
    { state: 'home', attributes: { friendly_name: 'Phone', source_type: 'gps' } },
    'whether a tracker moves with someone, and not where it is',
  );
  assert.deepEqual(snapshot.states['person.jane'], {
    state: 'home',
    attributes: { friendly_name: 'Jane', device_trackers: ['device_tracker.phone'] },
  });
  assert.deepEqual(snapshot.states['climate.ac'], {
    state: 'cool',
    attributes: { friendly_name: 'Bedroom AC', hvac_modes: ['off', 'heat', 'cool'] },
  });
  assert.deepEqual(snapshot.devices['ac'], {
    id: 'ac',
    area_id: 'bedroom',
    name: 'AC',
    name_by_user: 'Bedroom AC',
    manufacturer: 'Daikin',
    model: 'FTXM25R',
    entry_type: null,
    via_device_id: 'hub',
    labels: ['mnml_ac'],
  });
  assert.deepEqual(snapshot.entities['climate.ac'], {
    entity_id: 'climate.ac',
    device_id: 'ac',
    area_id: null,
    platform: 'daikin',
    translation_key: null,
    name: 'Cooler',
    entity_category: null,
    hidden: false,
    labels: [],
  });
  assert.equal(snapshot.entities['sensor.ac_rssi'], undefined, 'a disabled entity is left out');
  assert.deepEqual(snapshot.areas['bedroom'], {
    area_id: 'bedroom',
    name: 'Bedroom',
    icon: null,
    temperature_entity_id: null,
    humidity_entity_id: null,
  });
});
