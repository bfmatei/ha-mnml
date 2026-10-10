import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertContrast } from './contrast.ts';
import { THEMES } from './model.ts';

for (const theme of Object.values(THEMES)) {
  test(`the ${theme.design} theme meets every contrast claim its documentation makes`, () => {
    assert.deepEqual(assertContrast(theme), []);
  });
}
