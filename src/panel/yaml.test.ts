import assert from 'node:assert/strict';

import { test } from 'vitest';

import { readTemplate, readYaml } from './yaml.ts';

test('a template in YAML is read back whole', () => {
  assert.deepEqual(readTemplate('description: A garden.\ncard:\n  type: x\n  title: Garden\n'), {
    description: 'A garden.',
    card: { type: 'x', title: 'Garden' },
  });
});

test('YAML that does not read says where, a tag is refused, and a template needs its card', () => {
  assert.throws(() => readYaml('card:\n  type: [x\n'), /^Error: line \d+:/);
  assert.throws(() => readYaml('card: !include card.yaml\n'), /!include is a YAML tag/);
  assert.throws(() => readTemplate('slots: {}\n'), /a mapping with a card/);
});
