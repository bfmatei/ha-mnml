import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';

import { expand } from './expand.ts';
import { SHIPPED } from './shipped.ts';

const CONDITIONS = ['is', 'not', 'below', 'within_days'];

function unconditioned(node: Value, inRules = false, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      unconditioned(item, inRules, out);
    }
    return out;
  }
  if (!isMapping(node)) {
    return out;
  }
  if (inRules && !CONDITIONS.some((key) => Object.hasOwn(node, key))) {
    out.push(JSON.stringify(node));
  }
  for (const [key, value] of Object.entries(node)) {
    unconditioned(value, key === 'rules', out);
  }
  return out;
}

test('a threshold set to none drops the rule it conditions, so no rule flags every entity', () => {
  let checked = 0;
  for (const [name, template] of Object.entries(SHIPPED)) {
    const example = template.example;
    const numbers = Object.entries(template.slots ?? {}).filter(
      ([, spec]) => spec.kind === 'number',
    );
    if (!isMapping(example) || numbers.length === 0) {
      continue;
    }
    const slots = { ...example, ...Object.fromEntries(numbers.map(([slot]) => [slot, null])) };
    const { card, popups } = expand(SHIPPED, { template: name, slots });
    assert.deepEqual(unconditioned([card, ...popups]), [], name);
    checked += 1;
  }
  assert.ok(checked >= 3, `checked ${checked} templates`);
});
