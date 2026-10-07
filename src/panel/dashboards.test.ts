import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/builder.ts';
import { define, mounted, text } from '../test/render.ts';

import type { Built } from './building.ts';
import { MnmlDashboards } from './dashboards.ts';
import type { DashboardActions } from './dashboards.ts';

define('mnml-dashboards', MnmlDashboards);

const PLAN: Plan = {
  title: 'Home',
  icon: 'mdi:home-variant',
  rooms: [],
  people: [],
  cars: [],
  system: [],
  open: {},
};
const BUILT: Built = {
  url_path: 'dashboard-home',
  plan: PLAN,
  previous: undefined,
  updated: undefined,
};

function recorded(): { actions: DashboardActions; done: string[] } {
  const done: string[] = [];
  const note =
    (name: string) =>
    (built?: Built): void => {
      done.push(built === undefined ? name : `${name} ${built.url_path}`);
    };
  return {
    done,
    actions: {
      quickStart: note('quick start'),
      stepByStep: note('step by step'),
      open: note('open'),
      edit: note('edit'),
      undo: note('undo'),
      forget: note('forget'),
    },
  };
}

function button(root: ShadowRoot, label: string): HTMLButtonElement {
  const found = [...root.querySelectorAll('button')].find(
    (each) => each.getAttribute('aria-label') === label || text(each) === label,
  );
  assert.ok(found, `a button ${label}`);
  return found;
}

test('with no dashboard built, the page offers a quick start or a step by step build', async () => {
  const element = new MnmlDashboards();
  const { actions, done } = recorded();
  element.actions = actions;
  const root = await mounted(element);
  assert.match(text(root), /Build your dashboard/);
  button(root, 'Quick start').click();
  button(root, 'Step by step').click();
  assert.deepEqual(done, ['quick start', 'step by step']);
  element.remove();
});

test('a built dashboard is listed with Open and Forget, and Undo only after a rebuild', async () => {
  const element = new MnmlDashboards();
  const { actions, done } = recorded();
  element.actions = actions;
  element.rows = [
    {
      built: BUILT,
      board: { id: 'dashboard_home', url_path: 'dashboard-home', title: 'Home', icon: undefined },
    },
  ];
  const root = await mounted(element);
  assert.doesNotMatch(text(root), /Build your dashboard/);
  assert.match(text(root), /\/dashboard-home/);
  assert.equal(root.querySelector('[aria-label="Undo the last rebuild of Home"]'), null);
  button(root, 'Edit Home').click();
  button(root, 'Open Home').click();
  button(root, 'Forget Home').click();
  element.rows = [
    {
      built: { ...BUILT, previous: { plan: PLAN, config: {} } },
      board: { id: 'dashboard_home', url_path: 'dashboard-home', title: 'Home', icon: undefined },
    },
  ];
  await element.updateComplete;
  button(root, 'Undo the last rebuild of Home').click();
  assert.deepEqual(done, [
    'edit dashboard-home',
    'open dashboard-home',
    'forget dashboard-home',
    'undo dashboard-home',
  ]);
  element.remove();
});

test('a dashboard deleted in Home Assistant says so, and has no Open', async () => {
  const element = new MnmlDashboards();
  element.rows = [{ built: BUILT, board: undefined }];
  const root = await mounted(element);
  assert.match(text(root), /No longer in Home Assistant: Edit makes it again/);
  assert.equal(root.querySelector('[aria-label="Open Home"]'), null);
  element.remove();
});
