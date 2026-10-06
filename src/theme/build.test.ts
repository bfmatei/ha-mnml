import assert from 'node:assert/strict';

import { test } from 'vitest';
import { parse } from 'yaml';

import { renderTheme } from './build.ts';

test('the rendered theme is one theme, named MNML, with a light and a dark mode', () => {
  const theme: unknown = parse(renderTheme());
  assert.ok(theme !== null && typeof theme === 'object');
  assert.deepEqual(Object.keys(theme), ['MNML']);
  const modes = (theme as { MNML: { modes?: Record<string, unknown> } }).MNML.modes;
  assert.deepEqual(Object.keys(modes ?? {}).toSorted(), ['dark', 'light']);
});
