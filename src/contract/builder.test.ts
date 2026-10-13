import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { test } from 'vitest';

import { isPlan, orderOf } from './builder.ts';

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

test('the sections come in the order given, then the others in the usual order', () => {
  assert.deepEqual(orderOf({ order: ['system', 'people'] }), [
    'system',
    'people',
    'rooms',
    'garage',
  ]);
  assert.deepEqual(orderOf({}), ['rooms', 'people', 'garage', 'system']);
});
