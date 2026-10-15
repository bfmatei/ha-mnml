import assert from 'node:assert/strict';

import { test } from 'vitest';

import { overridesOf } from '../templates/overrides.ts';

import { sameValue, sameWritten } from './templates.ts';

test('two values with their keys in another order are the same value, but not the same as written', () => {
  const one = { entity: 'sensor.a', fields: { power: 'sensor.p', today: 'sensor.t' } };
  const other = { fields: { today: 'sensor.t', power: 'sensor.p' }, entity: 'sensor.a' };
  assert.equal(sameValue(one, other), true);
  assert.equal(sameWritten(one, other), false);
  assert.equal(sameValue([1, 2], [2, 1]), false, 'a list keeps its order');
});

test('a slot found as a mapping and given back in another key order is not an override', () => {
  const found = { meter: { power: 'sensor.p', today: 'sensor.t' } };
  assert.deepEqual(overridesOf(found, { meter: { today: 'sensor.t', power: 'sensor.p' } }), {});
});
