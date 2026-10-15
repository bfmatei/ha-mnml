import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Template, Value } from '../contract/templates.ts';
import type { EnergyPrefs, Registries } from '../ha/registries.ts';

import { discover } from './discover.ts';
import { expand } from './expand.ts';
import { explain } from './explain.ts';
import { SHIPPED } from './shipped.ts';

const reading = { attributes: { unit_of_measurement: 'W' } };

const HOME: Registries = {
  areas: { kitchen: { area_id: 'kitchen', name: 'Kitchen' } },
  devices: {},
  entities: {},
  states: {
    'sensor.grid_power': reading,
    'sensor.solar_roof': reading,
    'sensor.solar_shed': reading,
    'sensor.battery_power': reading,
    'sensor.battery_soc': { attributes: { unit_of_measurement: '%' } },
    'sensor.washer_power': reading,
    'sensor.washer_energy': { attributes: { unit_of_measurement: 'kWh' } },
    'sensor.kitchen_power': reading,
    'sensor.kitchen_energy': { attributes: { unit_of_measurement: 'kWh' } },
    'sensor.kettle_power': reading,
    'sensor.fridge_power': reading,
  },
};

const PREFS: EnergyPrefs = {
  energy_sources: [
    { type: 'grid', stat_rate: 'sensor.grid_power' },
    { type: 'solar', stat_rate: 'sensor.solar_roof' },
    { type: 'solar', stat_rate: 'sensor.solar_shed' },
    { type: 'battery', stat_rate: 'sensor.battery_power', stat_soc: 'sensor.battery_soc' },
    { type: 'gas' },
  ],
  device_consumption: [
    { stat_consumption: 'sensor.washer_energy', stat_rate: 'sensor.washer_power' },
    { stat_consumption: 'sensor.kitchen_energy', stat_rate: 'sensor.kitchen_power' },
    {
      stat_consumption: 'sensor.kettle_energy',
      stat_rate: 'sensor.kettle_power',
      included_in_stat: 'sensor.kitchen_energy',
    },
    { stat_consumption: 'sensor.dryer_energy' },
    { stat_consumption: 'external:fridge', stat_rate: 'sensor.fridge_power' },
  ],
};

const WITH: Registries = { ...HOME, energy: PREFS };

const POWER: Template = {
  slots: {
    grid: { kind: 'entity', discover: 'energy.grid_power' },
    solar: { kind: 'entity', discover: 'energy.solar_power' },
    arrays: { kind: 'entities', discover: 'energy.solar_power' },
    battery: { kind: 'entity', discover: 'energy.battery_charge' },
    battery_power: { kind: 'entity', discover: 'energy.battery_power' },
    meters: {
      kind: 'objects',
      fields: { power: { kind: 'entity', required: true }, total: { kind: 'entity' } },
      discover: 'energy.devices',
    },
    powers: { kind: 'entities', discover: 'energy.devices' },
  },
  card: {},
};

const METERS = [
  { power: 'sensor.washer_power', total: 'sensor.washer_energy' },
  { power: 'sensor.kitchen_power', total: 'sensor.kitchen_energy' },
  { power: 'sensor.fridge_power' },
];

test('the energy settings fill the grid, solar and battery power and the charge, home-wide', () => {
  const found = {
    grid: 'sensor.grid_power',
    solar: 'sensor.solar_roof',
    arrays: ['sensor.solar_roof', 'sensor.solar_shed'],
    battery: 'sensor.battery_soc',
    battery_power: 'sensor.battery_power',
    meters: METERS,
    powers: ['sensor.washer_power', 'sensor.kitchen_power', 'sensor.fridge_power'],
  };
  assert.deepEqual(discover(POWER, undefined, WITH), found);
  assert.deepEqual(discover(POWER, 'kitchen', WITH), found);
});

test('a meter is each device of the settings with a power, a device inside a listed one left out', () => {
  assert.deepEqual(discover(POWER, undefined, WITH)['meters'], METERS);
  const loose: Registries = {
    ...HOME,
    energy: {
      energy_sources: [],
      device_consumption: [
        {
          stat_consumption: 'sensor.kettle_energy',
          stat_rate: 'sensor.kettle_power',
          included_in_stat: 'sensor.kitchen_energy',
        },
        { stat_consumption: 'sensor.kitchen_energy' },
      ],
    },
  };
  assert.deepEqual(discover(POWER, undefined, loose)['meters'], [{ power: 'sensor.kettle_power' }]);
});

test('a statistic that names no entity of the home fills nothing', () => {
  const external: Registries = {
    ...HOME,
    energy: {
      energy_sources: [
        { type: 'grid', stat_rate: 'external:grid' },
        { type: 'battery', stat_rate: 'sensor.gone' },
      ],
      device_consumption: [{ stat_consumption: 'sensor.gone_energy', stat_rate: 'sensor.gone' }],
    },
  };
  assert.deepEqual(discover(POWER, undefined, external), {});
});

test('without energy settings the energy rules fill nothing', () => {
  assert.deepEqual(discover(POWER, undefined, HOME), {});
  assert.deepEqual(
    discover(POWER, undefined, {
      ...HOME,
      energy: { energy_sources: [], device_consumption: [] },
    }),
    {},
  );
});

test('a slot only takes the fields its spec declares from a meter', () => {
  const template: Template = {
    slots: {
      meters: {
        kind: 'objects',
        fields: { power: { kind: 'entity', required: true } },
        discover: 'energy.devices',
      },
      first: {
        kind: 'object',
        fields: { power: { kind: 'entity' }, total: { kind: 'entity' } },
        discover: 'energy.devices',
      },
    },
    card: {},
  };
  assert.deepEqual(discover(template, undefined, WITH), {
    meters: METERS.map(({ power }) => ({ power })),
    first: METERS[0],
  });
});

test('explain names the energy settings and what they gave, and why a slot is empty', () => {
  const traces = explain(POWER, undefined, WITH);
  assert.equal(traces['grid']?.steps[0]?.rule, "the grid's power in the energy settings");
  assert.deepEqual(traces['grid']?.steps[0]?.picked, ['sensor.grid_power']);
  assert.equal(traces['grid']?.steps[0]?.everywhere, true);
  assert.deepEqual(traces['powers']?.steps[0]?.picked, [
    'sensor.washer_power',
    'sensor.kitchen_power',
    'sensor.fridge_power',
  ]);
  const none = explain(POWER, undefined, HOME);
  assert.equal(none['grid']?.steps[0]?.missing, 'the energy settings name no grid power');
  assert.equal(none['meters']?.steps[0]?.missing, 'the energy settings name no device power');
});

const listed = (value: Value | undefined): Record<string, Value>[] =>
  Array.isArray(value) ? value.filter(isMapping) : [];

function meterTables(slots: Record<string, Value>): Record<string, Value>[] {
  const { card } = expand(SHIPPED, { template: 'energy-popup', slots });
  const cards = isMapping(card) ? listed(card['cards']) : [];
  return cards.filter((one) => one['title'] === 'Meters');
}

function meterValues(slots: Record<string, Value>): (Value | undefined)[] {
  return meterTables(slots).flatMap((table) => listed(table['rows']).map((row) => row['values']));
}

test('energy-popup draws one Meters table, with a Share column of the usage only when there is a usage sensor', () => {
  const meters = [{ power: 'sensor.washer_power', total: 'sensor.washer_energy' }];
  const plain = meterTables({ meters, grid: 'sensor.grid_power' });
  assert.deepEqual(
    plain.map((table) => table['headers']),
    [['Item', 'Now', 'Today', 'Total']],
  );
  assert.equal(listed(plain[0]?.['rows'])[0]?.['of'], undefined);
  const shared = meterTables({ meters, usage: 'sensor.usage' });
  assert.deepEqual(
    shared.map((table) => table['headers']),
    [['Item', 'Now', 'Today', 'Total', 'Share']],
  );
  assert.equal(listed(shared[0]?.['rows'])[0]?.['of'], 'sensor.usage');
});

test('energy-popup draws no Meters table without meters, with or without a usage sensor', () => {
  assert.deepEqual(meterTables({ usage: 'sensor.usage', grid: 'sensor.grid_power' }), []);
  assert.deepEqual(meterTables({ grid: 'sensor.grid_power' }), []);
});

test("energy-popup keeps a discovered meter's total under Total, Today left empty, with and without the home's usage", () => {
  const popup = SHIPPED['energy-popup'];
  assert.ok(popup !== undefined);
  const meters = discover(popup, undefined, WITH)['meters'] ?? [];
  assert.deepEqual(meterValues({ meters }), [
    ['sensor.washer_power', null, 'sensor.washer_energy'],
    ['sensor.kitchen_power', null, 'sensor.kitchen_energy'],
    ['sensor.fridge_power', null, null],
  ]);
  assert.deepEqual(meterValues({ meters, usage: 'sensor.usage' }), [
    ['sensor.washer_power', null, 'sensor.washer_energy', 'sensor.washer_power'],
    ['sensor.kitchen_power', null, 'sensor.kitchen_energy', 'sensor.kitchen_power'],
    ['sensor.fridge_power', null, null, 'sensor.fridge_power'],
  ]);
});

test("energy-table keeps a meter's total under Total when it has no today", () => {
  const { card } = expand(SHIPPED, {
    template: 'energy-table',
    slots: { meters: [{ power: 'sensor.washer_power', total: 'sensor.washer_energy' }] },
  });
  assert.ok(isMapping(card));
  assert.deepEqual(
    listed(card['rows']).map((row) => row['values']),
    [['sensor.washer_power', null, 'sensor.washer_energy']],
  );
});

test('energy-popup finds the grid, solar, battery and meters in the energy settings', () => {
  const popup = SHIPPED['energy-popup'];
  assert.ok(popup !== undefined);
  assert.deepEqual(discover(popup, undefined, WITH), {
    grid: 'sensor.grid_power',
    solar: 'sensor.solar_roof',
    battery: 'sensor.battery_soc',
    battery_power: 'sensor.battery_power',
    meters: METERS,
  });
});
