import assert from 'node:assert/strict';

import { test } from 'vitest';

import { badgesOf, changedParts } from './outline.ts';

test('a condition reads as a sentence', () => {
  assert.deepEqual(badgesOf({ id: 'a', if: 'window' }), ['when window is set']);
  assert.deepEqual(badgesOf({ id: 'a', unless: 'window' }), ['when window is not set']);
  assert.deepEqual(badgesOf({ id: 'a', each: 'devices' }), ['one for each of devices']);
  assert.deepEqual(badgesOf({ id: 'a', if: ['window', 'door'] }), ['when window or door is set']);
  assert.deepEqual(badgesOf({ id: 'a', unless: ['window', 'door'] }), [
    'when window and door are not set',
  ]);
  assert.deepEqual(badgesOf({ id: 'a' }), []);
});

test('the parts a change touches are marked in the outline: the part, the inserted one, the moved one, the parent of a removed one', () => {
  const lock = ['card', 'chips?', '#lock'];
  const marks = changedParts([
    { op: 'set', path: lock, key: 'color', value: 'amber', base: '' },
    { op: 'insert', path: ['card', 'chips?'], after: null, value: { id: 'door' }, base: '' },
    { op: 'move', path: ['card', 'chips?'], id: 'window', after: 'door', base: '' },
    { op: 'remove', path: ['card', 'name'], base: '' },
    { op: 'set', path: [...lock, 'tap_action'], key: 'action', value: 'none', base: '' },
  ]);
  assert.deepEqual([...marks].toSorted(), [
    'card',
    'card/chips?/#door',
    'card/chips?/#lock',
    'card/chips?/#window',
  ]);
});
