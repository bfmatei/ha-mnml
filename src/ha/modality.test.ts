import assert from 'node:assert/strict';

import { test } from 'vitest';

import { letGoOfFocus, trackInput } from './modality.ts';

function button(): HTMLButtonElement {
  const found = document.createElement('button');
  document.body.append(found);
  found.focus();
  assert.equal(document.activeElement, found);
  return found;
}

test('after a tap, the element that gets its focus back lets go of it', () => {
  trackInput();
  const found = button();
  window.dispatchEvent(new Event('pointerdown'));
  letGoOfFocus();
  assert.notEqual(document.activeElement, found);
  found.remove();
});

test('after a key press, the focus stays where the keyboard left it', () => {
  trackInput();
  const found = button();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
  letGoOfFocus();
  assert.equal(document.activeElement, found);
  found.remove();
});
