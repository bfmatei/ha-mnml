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

test('a template is refused unless its card is a mapping and its pop-ups a list of mappings, as the integration keeps them', () => {
  assert.throws(() => readTemplate('card: ~\n'), /card is a mapping/);
  assert.throws(() => readTemplate('card: [a]\n'), /card is a mapping/);
  assert.throws(() => readTemplate('card: { type: x }\npopups: { hash: a }\n'), /list of mappings/);
  assert.throws(() => readTemplate('card: { type: x }\npopups: [a]\n'), /list of mappings/);
  assert.deepEqual(readTemplate('card: [{ type: toggle }]\n', true), {
    card: [{ type: 'toggle' }],
  });
  assert.throws(() => readTemplate('card: ~\n', true), /card is a mapping/);
  assert.deepEqual(readTemplate('card: { type: x }\npopups: [{ hash: a }]\n'), {
    card: { type: 'x' },
    popups: [{ hash: 'a' }],
  });
});
