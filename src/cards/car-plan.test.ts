import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import { MnmlCarPlanCard } from './car-plan.ts';

define('mnml-car-plan-card', MnmlCarPlanCard);

const CORNERS = ['front_left', 'front_right', 'rear_left', 'rear_right'];

const CONFIG = {
  type: 'custom:mnml-car-plan-card',
  doors: CORNERS.map((corner) => `binary_sensor.door_${corner}`),
  hood: 'binary_sensor.hood',
  tailgate: 'binary_sensor.tailgate',
  windows: CORNERS.map((corner) => `sensor.window_${corner}`),
  tyres: CORNERS.map((corner) => `sensor.tyre_${corner}`),
  tyre_targets: CORNERS.map((corner) => `sensor.target_${corner}`),
  tyre_low_share: 0.9,
  tyre_warn_share: 0.95,
};

function hassOf(states: Record<string, string>): unknown {
  const all: Record<string, string> = {
    'binary_sensor.hood': 'off',
    'binary_sensor.tailgate': 'off',
  };
  for (const corner of CORNERS) {
    all[`binary_sensor.door_${corner}`] = 'off';
    all[`sensor.window_${corner}`] = 'closed';
    all[`sensor.tyre_${corner}`] = '2.4';
    all[`sensor.target_${corner}`] = '2.4';
  }
  Object.assign(all, states);
  return {
    states: Object.fromEntries(
      Object.entries(all).map(([id, state]) => [id, { entity_id: id, state, attributes: {} }]),
    ),
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
  };
}

function card(): MnmlCarPlanCard {
  const made = document.createElement('mnml-car-plan-card');
  assert.ok(made instanceof MnmlCarPlanCard);
  return made;
}

async function problems(config: unknown, states: Record<string, string>): Promise<string> {
  const made = card();
  made.setConfig(config as never);
  made.hass = hassOf(states) as never;
  return text(await mounted(made));
}

test('by default, BMW words: OPEN is open and INTERMEDIATE half open', async () => {
  assert.ok(
    (await problems(CONFIG, { 'sensor.window_front_left': 'OPEN' })).includes(
      'Front left window open',
    ),
  );
  assert.ok(
    (await problems(CONFIG, { 'sensor.window_rear_left': 'INTERMEDIATE' })).includes(
      'Rear left window half open',
    ),
  );
  assert.ok((await problems(CONFIG, {})).endsWith('All closed'));
});

test('another integration maps its own words, and the default words stop counting', async () => {
  const config = { ...CONFIG, open_states: ['ajar'], half_states: ['vented'] };
  assert.ok(
    (await problems(config, { 'sensor.window_front_left': 'ajar' })).includes(
      'Front left window open',
    ),
  );
  assert.ok(
    (await problems(config, { 'sensor.window_rear_left': 'Vented' })).includes(
      'Rear left window half open',
    ),
  );
  assert.ok(
    (await problems(config, { 'sensor.window_front_left': 'open' })).endsWith('All closed'),
  );
});

test('a car plan without a number for each tyre share is an error card', () => {
  const made = card();
  const { tyre_low_share: _low, ...withoutLow } = CONFIG;
  assert.throws(() => {
    made.setConfig(withoutLow as never);
  }, /tyre_low_share must be a number/);
  assert.throws(() => {
    made.setConfig({ ...CONFIG, tyre_warn_share: '0.95' } as never);
  }, /tyre_warn_share must be a number/);
});
