import assert from 'node:assert/strict';

import { test } from 'vitest';
import { parse } from 'yaml';

import { toYaml } from './yaml.ts';

test('YAML 1.1 booleans and sexagesimals are single-quoted, as values and as keys', () => {
  const text = toYaml({ state: 'on', when: ['off', 'yes', 'No'], aspect_ratio: '3:1', on: 1 });
  assert.match(text, /state: 'on'/);
  assert.match(text, /- 'off'/);
  assert.match(text, /- 'yes'/);
  assert.match(text, /- 'No'/);
  assert.match(text, /aspect_ratio: '3:1'/);
  assert.match(text, /^'on': 1$/m);
});

test('every other string is written plainly, and the text reads back as it was', () => {
  const value = {
    entity: 'sensor.kitchen_window_battery',
    name: "Jane's phone",
    values: [1, 'open'],
  };
  const text = toYaml(value);
  assert.match(text, /entity: sensor\.kitchen_window_battery/);
  assert.deepEqual(parse(text), value);
});

test('an undefined key is dropped, so an optional key reads as intent', () => {
  assert.equal(
    toYaml({ type: 'custom:mnml-list-card', fold: undefined }).trim(),
    'type: custom:mnml-list-card',
  );
});

test('long strings are never folded', () => {
  const name = 'a'.repeat(200);
  assert.equal(toYaml({ name }).trim(), `name: ${name}`);
});
