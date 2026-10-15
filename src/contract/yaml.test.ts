import assert from 'node:assert/strict';

import { test, vi } from 'vitest';
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

test('what YAML 1.1 reads as a number, a date, a value or a merge is single-quoted, as values and as keys', () => {
  const tricky = ['1_000', '0b101', '017', '+1_0', '2026-10-13', '=', '<<'];
  const value = {
    values: tricky,
    keys: Object.fromEntries(tricky.map((word) => [word, 1])),
  };
  const text = toYaml(value);
  for (const word of tricky) {
    assert.match(text, new RegExp(`^ {2}- '${word.replaceAll('+', '\\+')}'$`, 'm'), word);
    assert.match(text, new RegExp(`^ {2}'${word.replaceAll('+', '\\+')}': 1$`, 'm'), word);
  }
  assert.deepEqual(parse(text, { version: '1.1' }), value);
});

test('what YAML 1.2 reads as a number is quoted too, so the panel reads back the strings it wrote', () => {
  for (const text of ['0o17', '0x1f', '1e3', '.inf', '+12']) {
    const written = toYaml({ [text]: text });
    assert.deepEqual(parse(written), { [text]: text }, text);
    assert.deepEqual(parse(written, { version: '1.1' }), { [text]: text }, text);
  }
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

test('a Jinja template is single-quoted without a warning, and reads back as it was', () => {
  const warned = vi.spyOn(process, 'emitWarning');
  const value = { state: '{{ true }}', position: "{{ 'open' }}" };
  const text = toYaml(value);
  assert.match(text, /^state: '\{\{ true \}\}'$/m);
  assert.deepEqual(parse(text), value);
  assert.equal(warned.mock.calls.length, 0);
  warned.mockRestore();
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
