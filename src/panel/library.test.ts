import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import type { Row } from './data.ts';
import { MnmlLibrary } from './library.ts';
import type { LibraryActions } from './library.ts';

define('mnml-library', MnmlLibrary);

const ACTIONS: LibraryActions = {
  open: () => undefined,
  create: () => undefined,
  duplicate: () => undefined,
  history: () => undefined,
  exportAll: () => undefined,
  importFile: () => undefined,
  remove: () => undefined,
  rename: () => undefined,
  importDashboards: () => undefined,
};

function row(name: string, role: Row['role']): Row {
  return {
    name,
    description: `The ${name}.`,
    family: 'common',
    status: 'shipped',
    changes: 0,
    use: { cards: 0, dashboards: [] },
    role,
  };
}

const ROWS = [row('room', 'tile'), row('room-popup', 'popup'), row('power', 'part')];

async function library(): Promise<{ element: MnmlLibrary; root: ShadowRoot }> {
  try {
    localStorage.removeItem('mnml-library-everything');
  } catch {}
  const element = new MnmlLibrary();
  element.rows = ROWS;
  element.actions = ACTIONS;
  return { element, root: await mounted(element) };
}

const names = (root: ShadowRoot): string[] =>
  [...root.querySelectorAll('.library-row .library-name')].map((each) => text(each));

test('the library lists the tiles, and says how many pop-ups and parts it leaves out', async () => {
  const { element, root } = await library();
  assert.deepEqual(names(root), ['room']);
  assert.match(text(root), /and 2 pop-ups and parts/);
  const everything = root.querySelector<HTMLInputElement>('input[aria-label="Pop-ups and parts"]');
  assert.ok(everything);
  everything.checked = true;
  everything.dispatchEvent(new Event('change'));
  await element.updateComplete;
  assert.deepEqual(names(root), ['room', 'room-popup', 'power']);
  assert.doesNotMatch(text(root), /and 2 pop-ups and parts/);
  element.remove();
});

test('a search that matches only pop-ups or parts says so, and offers to show them', async () => {
  const { element, root } = await library();
  const search = root.querySelector<HTMLInputElement>('input.search');
  assert.ok(search);
  search.value = 'power';
  search.dispatchEvent(new Event('input'));
  await element.updateComplete;
  assert.match(text(root), /Only pop-ups and parts match/);
  const show = [...root.querySelectorAll('button')].find((each) => text(each) === 'Show them');
  assert.ok(show);
  show.click();
  await element.updateComplete;
  assert.deepEqual(names(root), ['power']);
  element.remove();
});
