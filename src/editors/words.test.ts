import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlWords } from './words.ts';

define('mnml-words', MnmlWords);

interface Opened {
  readonly root: ShadowRoot;
  readonly written: Record<string, string>[];
}

async function open(words: Record<string, string>): Promise<Opened> {
  const element = document.createElement('mnml-words');
  assert.ok(element instanceof MnmlWords);
  const written: Record<string, string>[] = [];
  element.words = words;
  element.changed = (next): void => {
    written.push(next);
    element.words = next;
  };
  const root = await mounted(element);
  return { root, written };
}

const boxes = (root: ShadowRoot): HTMLInputElement[] => [...root.querySelectorAll('input')];

async function type(root: ShadowRoot, box: HTMLInputElement | undefined, typed: string) {
  assert.ok(box, 'there is a box');
  box.value = typed;
  box.dispatchEvent(new Event('input'));
  await (root.host instanceof MnmlWords ? root.host.updateComplete : undefined);
}

async function press(root: ShadowRoot, label: string): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  assert.ok(button, `there is ${label}`);
  button.click();
  await (root.host instanceof MnmlWords ? root.host.updateComplete : undefined);
}

test('removing one of two rows that clash keeps what was typed in the other', async () => {
  const { root, written } = await open({ a: 'A', b: 'B' });
  await type(root, boxes(root)[2], 'a');
  assert.deepEqual(written, [], 'a clash writes nothing');
  await press(root, 'Remove the word for a');
  assert.deepEqual(written.at(-1), { a: 'B' });
  assert.deepEqual(
    boxes(root).map((box) => box.value),
    ['a', 'B'],
  );
});

test('a new word is held in the editor, and written only once it has a state', async () => {
  const { root, written } = await open({ on: 'An' });
  await press(root, 'Add a word');
  assert.deepEqual(written, []);
  assert.deepEqual(
    boxes(root).map((box) => box.value),
    ['on', 'An', '', ''],
  );
  await type(root, boxes(root)[3], 'Aus');
  assert.deepEqual(written, []);
  await type(root, boxes(root)[2], 'off');
  assert.deepEqual(written.at(-1), { on: 'An', off: 'Aus' });
});

test('a word changed while a new one waits for its state is written, and the new one stays', async () => {
  const { root, written } = await open({ on: 'An' });
  await press(root, 'Add a word');
  await type(root, boxes(root)[1], 'Ein');
  assert.deepEqual(written.at(-1), { on: 'Ein' });
  assert.deepEqual(
    boxes(root).map((box) => box.value),
    ['on', 'Ein', '', ''],
  );
});

async function openColours(words: Record<string, string>): Promise<Opened> {
  const element = document.createElement('mnml-words');
  assert.ok(element instanceof MnmlWords);
  const written: Record<string, string>[] = [];
  element.words = words;
  element.options = ['red', 'orange', 'amber', 'blue'];
  element.changed = (next): void => {
    written.push(next);
    element.words = next;
  };
  const root = await mounted(element);
  return { root, written };
}

test('a colour for each word is picked from the list, and a new one starts with the first', async () => {
  const { root, written } = await openColours({ warnings: 'orange' });
  const picker = root.querySelector('select[aria-label="Colour for warnings"]');
  assert.ok(picker instanceof HTMLSelectElement);
  assert.equal(picker.value, 'orange');
  assert.deepEqual(
    [...picker.options].map((option) => option.value),
    ['red', 'orange', 'amber', 'blue'],
  );
  picker.value = 'amber';
  picker.dispatchEvent(new Event('change'));
  assert.deepEqual(written.at(-1), { warnings: 'amber' });
  await press(root, 'Add a colour');
  await type(root, boxes(root)[1], 'failed');
  assert.deepEqual(written.at(-1), { warnings: 'amber', failed: 'red' });
  assert.ok(root.querySelector('button[aria-label="Remove the colour for failed"]'));
});
