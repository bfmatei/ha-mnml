import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertContrast } from './contrast.ts';
import { THEME } from './model.ts';

test('the theme meets every contrast claim its documentation makes', () => {
  assert.deepEqual(assertContrast(THEME), []);
});
