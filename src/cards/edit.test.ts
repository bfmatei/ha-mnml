import assert from 'node:assert/strict';

import { test } from 'vitest';

import { editorOf } from './edit.ts';

test('an editor that cannot be loaded says to reload the page, and tries again the next time', async () => {
  const open = editorOf('mnml-heading-card-editor');
  await assert.rejects(open(), /reload the page/);
  await assert.rejects(open(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(error.cause instanceof Error, 'the reason is kept');
    return true;
  });
});
