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
    title: `The ${name.replaceAll('-', ' ')}`,
    icon: 'mdi:sofa',
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
  [...root.querySelectorAll('.library-row .code-name')].map((each) => text(each));

test("a row is named by the template's title and icon; its code name shows once, small, in the details line", async () => {
  const element = new MnmlLibrary();
  element.rows = [
    { ...row('adguard', 'tile'), title: 'AdGuard Home', family: 'adguard' },
    { ...row('adguard-popup', 'popup'), title: 'AdGuard Home pop-up', family: 'adguard' },
  ];
  element.actions = ACTIONS;
  const root = await mounted(element);
  const [tile] = root.querySelectorAll('.library-row');
  assert.ok(tile);
  assert.equal(text(tile.querySelector('.library-name') ?? tile), 'AdGuard Home');
  assert.equal(Reflect.get(tile.querySelector('ha-icon.library-icon') ?? {}, 'icon'), 'mdi:sofa');
  assert.equal(text(tile.querySelector('.library-status') ?? tile), 'adguard');
  assert.equal(
    tile.querySelector('.library-open')?.getAttribute('aria-label'),
    'Edit AdGuard Home',
  );
  const search = root.querySelector<HTMLInputElement>('input.search');
  assert.ok(search);
  search.value = 'guard home';
  search.dispatchEvent(new Event('input'));
  await element.updateComplete;
  assert.deepEqual(names(root), ['adguard']);
  element.remove();
});

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

test("the home's own, customised and conflicted pop-ups and parts stay listed with the switch off", async () => {
  try {
    localStorage.removeItem('mnml-library-everything');
  } catch {}
  const element = new MnmlLibrary();
  element.rows = [
    row('room', 'tile'),
    { ...row('my-popup', 'popup'), status: 'own', family: undefined },
    { ...row('power', 'part'), status: 'customised', changes: 1 },
    { ...row('room-popup', 'popup'), status: 'conflict', changes: 1 },
    row('light-card', 'part'),
  ];
  element.actions = ACTIONS;
  const root = await mounted(element);
  assert.deepEqual(names(root), ['room', 'my-popup', 'power', 'room-popup']);
  assert.match(text(root), /and 1 pop-ups and parts/);
  assert.match(text(root), /Conflicts 1/);
  element.remove();
});
