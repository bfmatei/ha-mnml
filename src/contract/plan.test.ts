import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { test } from 'vitest';

import { isPlan, orderOf } from './plan.ts';

interface Example {
  why: string;
  with?: Record<string, unknown>;
  without?: string[];
}

interface Examples {
  base: Record<string, unknown>;
  valid: Example[];
  invalid: Example[];
}

const EXAMPLES = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../tests/plans.json'), 'utf8'),
) as Examples;

function planOf(example: Example): Record<string, unknown> {
  const plan: Record<string, unknown> = { ...EXAMPLES.base, ...example.with };
  for (const key of example.without ?? []) {
    delete plan[key];
  }
  return plan;
}

test.each(EXAMPLES.valid.map((example) => [example.why, example] as const))(
  'a plan is kept: %s',
  (_why, example) => {
    assert.equal(isPlan(planOf(example)), true);
  },
);

test.each(EXAMPLES.invalid.map((example) => [example.why, example] as const))(
  'a plan is refused: %s',
  (_why, example) => {
    assert.equal(isPlan(planOf(example)), false);
  },
);

test('a plan that is no mapping is refused', () => {
  assert.equal(isPlan(null), false);
  assert.equal(isPlan([EXAMPLES.base]), false);
});

test("a plan keeps the pop-ups' idle close and alerts as the pop-ups card takes them", () => {
  const alert = { entity: 'lock.front_door', is: ['jammed'], popup: '#hall' };
  assert.equal(isPlan({ ...EXAMPLES.base, idle_close: 90 }), true);
  assert.equal(isPlan({ ...EXAMPLES.base, idle_close: 0.5 }), true);
  assert.equal(isPlan({ ...EXAMPLES.base, alerts: [] }), true);
  assert.equal(isPlan({ ...EXAMPLES.base, alerts: [alert] }), true);
  assert.equal(
    isPlan({
      ...EXAMPLES.base,
      alerts: [
        {
          entity: 'sensor.door',
          attribute: 'reason',
          not: ['ok'],
          popup: '#hall',
          screens: ['tablet'],
          users: ['abc123'],
        },
      ],
    }),
    true,
  );
});

test("a plan is refused when the pop-ups' idle close or an alert is one the card would refuse", () => {
  const alert = { entity: 'lock.front_door', is: ['jammed'], popup: '#hall' };
  for (const idle of [0, -5, '90', true, Number.POSITIVE_INFINITY, null]) {
    assert.equal(isPlan({ ...EXAMPLES.base, idle_close: idle }), false, String(idle));
  }
  for (const alerts of [
    alert,
    [{ ...alert, entity: 'front door' }],
    [{ ...alert, popup: undefined }],
    [{ ...alert, popup: '' }],
    [{ ...alert, is: 'jammed' }],
    [{ ...alert, screens: ['watch'] }],
    [{ ...alert, users: 'abc123' }],
    [{ ...alert, colour: 'red' }],
    ['lock.front_door'],
  ]) {
    assert.equal(isPlan({ ...EXAMPLES.base, alerts }), false, JSON.stringify(alerts));
  }
});

test('a plan keeps the devices it draws, each with its template, and their section', () => {
  const vacuum = { device: 'roborock_s8', template: 'vacuum-card' };
  assert.equal(isPlan({ ...EXAMPLES.base, devices: [] }), true);
  assert.equal(
    isPlan({ ...EXAMPLES.base, devices: [vacuum, { device: 'prusa', template: 'camera-card' }] }),
    true,
  );
  assert.equal(
    isPlan({
      ...EXAMPLES.base,
      devices: [vacuum],
      sections: { devices: { title: 'Things', icon: 'mdi:robot-vacuum' } },
      order: ['devices', 'rooms'],
    }),
    true,
  );
});

test('a plan is refused when a device entry is not a device and its template', () => {
  const vacuum = { device: 'roborock_s8', template: 'vacuum-card' };
  for (const devices of [
    vacuum,
    ['roborock_s8'],
    [{ device: 'roborock_s8' }],
    [{ template: 'vacuum-card' }],
    [{ ...vacuum, device: '' }],
    [{ ...vacuum, device: 7 }],
    [{ ...vacuum, template: 'Vacuum card' }],
    [{ ...vacuum, slots: {} }],
    [{ ...vacuum, area: 'living' }],
  ]) {
    assert.equal(isPlan({ ...EXAMPLES.base, devices }), false, JSON.stringify(devices));
  }
  assert.equal(
    isPlan({ ...EXAMPLES.base, sections: { devices: { template: 'vacuum-card' } } }),
    false,
  );
  assert.equal(isPlan({ ...EXAMPLES.base, order: ['devices', 'devices'] }), false);
});

test('the sections come in the order given, then the others in the usual order', () => {
  assert.deepEqual(orderOf({ order: ['system', 'people'] }), [
    'system',
    'people',
    'rooms',
    'devices',
    'garage',
  ]);
  assert.deepEqual(orderOf({}), ['rooms', 'devices', 'people', 'garage', 'system']);
});
