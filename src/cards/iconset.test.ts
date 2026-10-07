import assert from 'node:assert/strict';

import { test } from 'vitest';

import { registerIcons } from './iconset.ts';

test('MNML registers its icon set beside the others, and draws mnml:mnml as one 24 px glyph', async () => {
  const other = {
    getIcon: () => Promise.resolve({ path: 'M0 0Z' }),
    getIconList: () => Promise.resolve([]),
  };
  window.customIcons = { hacs: other };
  registerIcons();
  assert.equal(window.customIcons['hacs'], other, 'another icon set stays');
  const set = window.customIcons['mnml'];
  assert.ok(set);
  const { path } = await set.getIcon('mnml');
  assert.match(path, /^M/);
  const numbers = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  assert.ok(numbers.length > 20);
  assert.ok(
    numbers.every((value) => value >= 0 && value <= 24),
    'every point sits in the 24 by 24 box',
  );
  assert.deepEqual(await set.getIconList(), [{ name: 'mnml', keywords: ['mnml'] }]);
  assert.equal((await set.getIcon('nothing')).path, '');
});
