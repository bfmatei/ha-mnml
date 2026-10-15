import assert from 'node:assert/strict';

import { afterEach, beforeEach, test, vi } from 'vitest';

import { openPanel } from './leave.ts';

const pushed: string[] = [];
const fired: string[] = [];

beforeEach(() => {
  pushed.length = 0;
  fired.length = 0;
  vi.spyOn(history, 'pushState').mockImplementation((_state, _title, path) => {
    pushed.push(String(path));
  });
  vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
    fired.push(event.type);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function inside(closed: boolean): { editor: object; closes: () => number } {
  let asked = 0;
  const dialog = {
    localName: 'hui-dialog-edit-card',
    parentNode: null,
    closeDialog: (): Promise<boolean> => {
      asked += 1;
      return Promise.resolve(closed);
    },
  };
  const shadow = { parentNode: null, host: dialog };
  const editor = { localName: 'mnml-template-card-editor', parentNode: { parentNode: shadow } };
  return { editor, closes: () => asked };
}

test("the panel opens once the card's dialog has closed", async () => {
  const { editor, closes } = inside(true);
  await openPanel(editor, '/mnml/templates/room');
  assert.equal(closes(), 1);
  assert.deepEqual(pushed, ['/mnml/templates/room']);
  assert.deepEqual(fired, ['location-changed']);
});

test('a dialog that stays open, its changes not given up, keeps the editor where it is', async () => {
  const { editor, closes } = inside(false);
  await openPanel(editor, '/mnml/templates/room');
  assert.equal(closes(), 1);
  assert.deepEqual(pushed, []);
  assert.deepEqual(fired, []);
});

test('an editor outside a dialog opens the panel at once', async () => {
  await openPanel(
    { localName: 'mnml-template-card-editor', parentNode: null },
    '/mnml/templates/room',
  );
  assert.deepEqual(pushed, ['/mnml/templates/room']);
});

function asking(): { dialog: EventTarget; editor: object } {
  const dialog = Object.assign(new EventTarget(), {
    localName: 'hui-dialog-edit-card',
    parentNode: null,
    closeDialog: (): boolean => false,
  });
  return { dialog, editor: { localName: 'mnml-template-card-editor', parentNode: dialog } };
}

const closedEvent = (): Event =>
  new CustomEvent('dialog-closed', { detail: { dialog: 'hui-dialog-edit-card' } });

test('a dialog that asks first and closes once its changes are given up opens the panel then', async () => {
  const { dialog, editor } = asking();
  await openPanel(editor, '/mnml/templates/room');
  assert.deepEqual(pushed, []);
  dialog.dispatchEvent(closedEvent());
  assert.deepEqual(pushed, ['/mnml/templates/room']);
  dialog.dispatchEvent(closedEvent());
  assert.deepEqual(pushed, ['/mnml/templates/room']);
});

test('a dialog kept open after it asked, then used, does not open the panel when it closes later', async () => {
  const { dialog, editor } = asking();
  await openPanel(editor, '/mnml/templates/room');
  dialog.dispatchEvent(new Event('pointerdown'));
  dialog.dispatchEvent(closedEvent());
  assert.deepEqual(pushed, []);
});

test('a dialog that cannot be closed from here stays, and the panel opens in a new tab', async () => {
  const opened: unknown[] = [];
  vi.spyOn(window, 'open').mockImplementation((...args) => {
    opened.push(args);
    return null;
  });
  const dialog = { localName: 'hui-dialog-edit-card', parentNode: null };
  await openPanel({ localName: 'mnml-template-card-editor', parentNode: dialog }, '/mnml');
  assert.deepEqual(pushed, []);
  assert.deepEqual(opened, [['/mnml', '_blank', 'noopener']]);
});
