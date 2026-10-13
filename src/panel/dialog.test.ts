import assert from 'node:assert/strict';

import { test } from 'vitest';

import { text } from '../test/render.ts';

import { dialogsOn } from './dialog.ts';

HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
  this.open = false;
};

function named(dialog: HTMLDialogElement): string {
  const id = dialog.getAttribute('aria-labelledby');
  assert.ok(id);
  return text(dialog.querySelector(`h2[id="${id}"]`));
}

test('a dialog is named by its title, and two open at once each by its own', async () => {
  const root = document.createElement('div');
  document.body.append(root);
  const dialogs = dialogsOn(root);
  const first = dialogs.confirm('Delete garden?', 'It is on 2 cards.', 'Delete');
  const second = dialogs.confirm('That did not work', 'Cannot save', 'OK');
  const [one, two] = [...root.querySelectorAll('dialog')];
  assert.ok(one && two);
  assert.equal(named(one), 'Delete garden?');
  assert.equal(named(two), 'That did not work');
  for (const dialog of [one, two]) {
    [...dialog.querySelectorAll('button')].find((button) => text(button) === 'Cancel')?.click();
  }
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  root.remove();
});
