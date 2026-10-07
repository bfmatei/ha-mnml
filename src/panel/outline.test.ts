import assert from 'node:assert/strict';

import { test } from 'vitest';

import { badgesOf } from './outline.ts';

test('a condition reads as a sentence', () => {
  assert.deepEqual(badgesOf({ id: 'a', if: 'window' }), ['when window is set']);
  assert.deepEqual(badgesOf({ id: 'a', unless: 'window' }), ['when window is not set']);
  assert.deepEqual(badgesOf({ id: 'a', each: 'devices' }), ['one for each of devices']);
  assert.deepEqual(badgesOf({ id: 'a', if: ['window', 'door'] }), ['when window and door are set']);
  assert.deepEqual(badgesOf({ id: 'a', unless: ['window', 'door'] }), [
    'when window and door are not set',
  ]);
  assert.deepEqual(badgesOf({ id: 'a' }), []);
});
