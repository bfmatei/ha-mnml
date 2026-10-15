import assert from 'node:assert/strict';

import { test } from 'vitest';

import { text } from '../test/render.ts';

import { dialogsOn } from './dialog.ts';

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

test('a name typed as words is taken as its slug, said under the field, and refused only when taken or empty', async () => {
  const root = document.createElement('div');
  document.body.append(root);
  const asked = dialogsOn(root).name('A new template', '', new Set(['my-room']));
  const dialog = root.querySelector('dialog');
  assert.ok(dialog);
  const input = dialog.querySelector<HTMLInputElement>('input[aria-label="Name"]');
  assert.ok(input);
  const type = (value: string): void => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const ok = (): void => {
    [...dialog.querySelectorAll('button')].find((button) => text(button) === 'OK')?.click();
  };
  type('My Room');
  assert.match(text(dialog), /It is saved as my-room\./);
  ok();
  assert.match(text(dialog), /my-room is taken\./);
  type(' !? ');
  ok();
  assert.match(text(dialog), /A name needs a letter or a digit\./);
  type('Café Bar_2');
  ok();
  assert.equal(await asked, 'cafe-bar_2');
  root.remove();
});

test('a template is named by the title typed, its name in YAML made from it free of every taken one, and kept as typed once edited', async () => {
  const root = document.createElement('div');
  document.body.append(root);
  const asked = dialogsOn(root).titled('A new template', '', new Set(['my-room', 'my-room-2']));
  const dialog = root.querySelector('dialog');
  assert.ok(dialog);
  const field = (label: string): HTMLInputElement => {
    const input = dialog.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    assert.ok(input, label);
    return input;
  };
  const type = (label: string, value: string): void => {
    field(label).value = value;
    field(label).dispatchEvent(new Event('input'));
  };
  const ok = (): void => {
    [...dialog.querySelectorAll('button')].find((button) => text(button) === 'OK')?.click();
  };
  ok();
  assert.match(text(dialog), /A title needs a word\./);
  type('Title', 'My Room');
  assert.equal(field('Name in YAML').value, 'my-room-3');
  type('Name in YAML', 'my-room');
  ok();
  assert.match(text(dialog), /my-room is taken\./);
  type('Name in YAML', 'Den Room');
  assert.match(text(dialog), /It is saved as den-room\./);
  type('Title', 'The den');
  assert.equal(field('Name in YAML').value, 'Den Room', 'a name typed is not made again');
  ok();
  assert.deepEqual(await asked, { title: 'The den', name: 'den-room' });
  root.remove();
});
