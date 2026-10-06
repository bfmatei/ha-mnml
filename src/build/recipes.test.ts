import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { test } from 'vitest';
import { parse } from 'yaml';

test('the messages recipe is a package with the list sensor and the clear script', () => {
  const text = readFileSync(resolve(import.meta.dirname, '../../recipes/messages.yaml'), 'utf8');
  const recipe: unknown = parse(text);
  assert.ok(typeof recipe === 'object' && recipe !== null);
  assert.ok('template' in recipe && 'script' in recipe);
  assert.ok(text.includes('mnml_message'));
  assert.ok(text.includes('mnml_message_clear'));
});

test('the messages sensor reads its own list through this, whatever entity id it gets', () => {
  const text = readFileSync(resolve(import.meta.dirname, '../../recipes/messages.yaml'), 'utf8');
  assert.ok(!text.includes("'sensor.messages'"), 'no template names the sensor by its id');
  assert.ok(text.includes('this.attributes.messages'));
  assert.ok(text.includes("trigger.id == 'add'"), 'the trigger ids are quoted strings');
});
