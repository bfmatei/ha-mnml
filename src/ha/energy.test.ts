import { expect, test } from 'vitest';

import { fakeConnection } from '../test/hass.ts';

import { energyPrefs, knownEnergy } from './energy.ts';
import type { HassConnection } from './hass.ts';

function answering(
  answer: () => Promise<unknown>,
): HassConnection & { asked: Record<string, unknown>[] } {
  const asked: Record<string, unknown>[] = [];
  const connection = fakeConnection({
    sendMessagePromise: (message) => {
      asked.push(message);
      return answer();
    },
  });
  return Object.assign(connection, { asked });
}

test('the energy settings are read from energy/get_prefs, each source and device as far as it is well formed', async () => {
  const connection = answering(() =>
    Promise.resolve({
      energy_sources: [
        {
          type: 'grid',
          stat_energy_from: 'sensor.grid_in',
          stat_rate: 'sensor.grid_power',
          power_config: { stat_rate_from: 'sensor.grid_from' },
          name: 'Grid',
        },
        { type: 'solar', stat_energy_from: 'sensor.solar_energy' },
        { type: 'battery', stat_rate: 'sensor.battery_power', stat_soc: 'sensor.battery_soc' },
        { type: 'battery', stat_rate: 4 },
        { stat_rate: 'sensor.typeless' },
        'grid',
      ],
      device_consumption: [
        { stat_consumption: 'sensor.washer_energy', stat_rate: 'sensor.washer_power', name: 'W' },
        {
          stat_consumption: 'sensor.kettle_energy',
          included_in_stat: 'sensor.kitchen_energy',
        },
        { stat_rate: 'sensor.no_total' },
      ],
      device_consumption_water: [],
    }),
  );
  expect(await energyPrefs(connection)).toEqual({
    energy_sources: [
      { type: 'grid', stat_rate: 'sensor.grid_power' },
      { type: 'solar' },
      { type: 'battery', stat_rate: 'sensor.battery_power', stat_soc: 'sensor.battery_soc' },
      { type: 'battery' },
    ],
    device_consumption: [
      { stat_consumption: 'sensor.washer_energy', stat_rate: 'sensor.washer_power' },
      { stat_consumption: 'sensor.kettle_energy', included_in_stat: 'sensor.kitchen_energy' },
    ],
  });
  expect(connection.asked).toEqual([{ type: 'energy/get_prefs' }]);
});

test('a connection is asked once, every reader sharing its answer', async () => {
  const connection = answering(() =>
    Promise.resolve({ energy_sources: [{ type: 'grid', stat_rate: 'sensor.grid_power' }] }),
  );
  const [first, second] = await Promise.all([energyPrefs(connection), energyPrefs(connection)]);
  expect(second).toBe(first);
  expect(await energyPrefs(connection)).toBe(first);
  expect(connection.asked).toHaveLength(1);
});

test('the settings are known at once after the answer, and not before or without a connection', async () => {
  const connection = answering(() =>
    Promise.resolve({ energy_sources: [{ type: 'grid', stat_rate: 'sensor.grid_power' }] }),
  );
  expect(knownEnergy(connection)).toBeUndefined();
  const answer = energyPrefs(connection);
  expect(knownEnergy(connection)).toBeUndefined();
  const prefs = await answer;
  expect(prefs).toBeDefined();
  expect(knownEnergy(connection)).toBe(prefs);
  expect(knownEnergy(undefined)).toBeUndefined();
  const unset = answering(() => Promise.reject({ code: 'not_found', message: 'No prefs' }));
  await energyPrefs(unset);
  expect(knownEnergy(unset)).toBeUndefined();
});

test('a home without energy settings, or a refused or odd answer, has none', async () => {
  const unset = answering(() => Promise.reject({ code: 'not_found', message: 'No prefs' }));
  expect(await energyPrefs(unset)).toBeUndefined();
  expect(await energyPrefs(answering(() => Promise.resolve(null)))).toBeUndefined();
  expect(await energyPrefs(answering(() => Promise.resolve({ energy_sources: 'grid' })))).toEqual({
    energy_sources: [],
    device_consumption: [],
  });
});
