import assert from 'node:assert/strict';

import { test } from 'vitest';

import { UNAVAILABLE, matches, tint, tyreBand } from './rules.ts';

const on = {
  entity_id: 'light.a',
  state: 'on',
  attributes: {},
  last_changed: '',
  last_updated: '',
};

test('matches() ignores case and hyphens, and reads a missing state as unavailable', () => {
  assert.equal(matches({ is: ['notcharging'] }, 'Not-Charging'), true);
  assert.equal(matches({ is: ['Authorized Always'] }, 'authorized always'), true);
  assert.equal(matches({ is: ['unavailable'] }, undefined), true);
  assert.equal(matches({ not: ['off'] }, 'OFF'), false);
  assert.equal(matches(undefined, 'anything'), true);
});

test('is and not both have to hold', () => {
  const rule = { is: ['on', 'idle'], not: ['idle'] };
  assert.equal(matches(rule, 'on'), true);
  assert.equal(matches(rule, 'idle'), false);
});

test('tint() colours on its rule, and paints an unavailable entity orange regardless', () => {
  assert.equal(tint('amber', undefined, on), 'amber');
  assert.equal(tint('amber', { is: ['off'] }, on), undefined);
  assert.equal(tint(undefined, undefined, { ...on, state: 'unavailable' }), UNAVAILABLE);
  assert.equal(tint('amber', undefined, undefined), undefined);
});

test('a tyre is low under its low share, dropping under its warn share', () => {
  assert.equal(tyreBand(2.1, 2.4, 0.9, 0.95), 'low');
  assert.equal(tyreBand(2.2, 2.4, 0.9, 0.95), 'warn');
  assert.equal(tyreBand(2.3, 2.4, 0.9, 0.95), undefined);
  assert.equal(tyreBand(0, 2.4, 0.9, 0.95), undefined);
  assert.equal(tyreBand(2.1, undefined, 0.9, 0.95), undefined);
});

test('matches() compares numbers as numbers, so 10000.0 is 10000 and 0.0 is 0', () => {
  assert.equal(matches({ not: ['10000'] }, '10000.0'), false);
  assert.equal(matches({ is: ['0'] }, '0.0'), true);
  assert.equal(matches({ is: ['1000'] }, '10000'), false);
  assert.equal(matches({ is: ['on'] }, 'On'), true);
});
