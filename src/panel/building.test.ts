import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/builder.ts';

import {
  addressFor,
  boardsOf,
  builtOf,
  forgetDashboard,
  makeDashboard,
  rebuildDashboard,
  undoDashboard,
} from './building.ts';
import type { Board, Built, Call } from './building.ts';

const PLAN: Plan = {
  title: 'Home',
  icon: 'mdi:home-variant',
  rooms: [{ area: 'kitchen' }],
  people: [],
  cars: [],
  system: [],
  open: {},
};
const CONFIG = { title: 'Home', views: [] };
const BEFORE = { title: 'Home', views: [{ title: 'by hand' }] };
const BOARD: Board = {
  id: 'dashboard_home',
  url_path: 'dashboard-home',
  title: 'Home',
  icon: 'mdi:home-variant',
};
const EMPTY = Object.assign(new Error('No config found.'), { code: 'config_not_found' });
const BUILT: Built = {
  url_path: 'dashboard-home',
  plan: PLAN,
  previous: undefined,
  updated: '2026-10-07T10:00:00+00:00',
};

function recorder(answers: Record<string, unknown> = {}): {
  call: Call;
  sent: Record<string, unknown>[];
} {
  const sent: Record<string, unknown>[] = [];
  return {
    sent,
    call: (message) => {
      sent.push(message);
      const answer = answers[message.type];
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer ?? null);
    },
  };
}

test("a new dashboard's address is its title after dashboard-, free of every taken one", () => {
  assert.equal(addressFor('My_home', new Set()), 'dashboard-my-home');
  assert.equal(addressFor('Home', new Set()), 'dashboard-home');
  assert.equal(addressFor('Our flat!', new Set()), 'dashboard-our-flat');
  assert.equal(addressFor('Home', new Set(['dashboard-home'])), 'dashboard-home-2');
  assert.equal(
    addressFor('Home', new Set(['dashboard-home', 'dashboard-home-2'])),
    'dashboard-home-3',
  );
  assert.equal(addressFor('Ăla', new Set()), 'dashboard-ala');
  assert.equal(addressFor('***', new Set()), 'dashboard-mnml');
  assert.equal(addressFor('x'.repeat(100), new Set()).length, 64);
});

test('the kept dashboards are read with their plans, and one of a shape MNML does not know is left out', () => {
  const built = builtOf({
    dashboards: {
      'dashboard-home': { plan: PLAN, updated: 'then', by: 'u' },
      'dashboard-flat': {
        plan: PLAN,
        previous: { plan: PLAN, config: BEFORE },
        updated: 'later',
        by: 'u',
      },
      'dashboard-odd': { plan: { title: 'no rooms' } },
    },
  });
  assert.deepEqual(built, [
    { url_path: 'dashboard-home', plan: PLAN, previous: undefined, updated: 'then' },
    {
      url_path: 'dashboard-flat',
      plan: PLAN,
      previous: { plan: PLAN, config: BEFORE },
      updated: 'later',
    },
  ]);
  assert.deepEqual(builtOf(null), []);
});

test("Home Assistant's dashboards are read by their address, with their id, title and icon", () => {
  assert.deepEqual(
    boardsOf([
      { id: 'dashboard_home', url_path: 'dashboard-home', title: 'Home', icon: 'mdi:home-variant' },
      { id: 'map', url_path: 'map', title: 'Map', mode: 'storage' },
      { url_path: 'no-id', title: 'x' },
    ]),
    [BOARD, { id: 'map', url_path: 'map', title: 'Map', icon: undefined }],
  );
});

test('making a dashboard keeps its plan first, then creates it in Home Assistant and saves its cards', async () => {
  const { call, sent } = recorder();
  await makeDashboard(call, 'dashboard-home', PLAN, CONFIG);
  assert.deepEqual(sent, [
    { type: 'mnml/dashboards/save', url_path: 'dashboard-home', plan: PLAN },
    {
      type: 'lovelace/dashboards/create',
      url_path: 'dashboard-home',
      title: 'Home',
      icon: 'mdi:home-variant',
      show_in_sidebar: true,
      require_admin: false,
    },
    { type: 'lovelace/config/save', url_path: 'dashboard-home', config: CONFIG },
  ]);
});

test('a dashboard Home Assistant refuses to create is not kept', async () => {
  const { call, sent } = recorder({ 'lovelace/dashboards/create': new Error('invalid slug') });
  await assert.rejects(makeDashboard(call, 'dashboard-home', PLAN, CONFIG), /invalid slug/);
  assert.deepEqual(
    sent.map((message) => message['type']),
    ['mnml/dashboards/save', 'lovelace/dashboards/create', 'mnml/dashboards/delete'],
  );
});

test('a plan MNML refuses to keep makes no dashboard', async () => {
  const { call, sent } = recorder({ 'mnml/dashboards/save': new Error('too_many') });
  await assert.rejects(makeDashboard(call, 'dashboard-home', PLAN, CONFIG), /too_many/);
  assert.deepEqual(
    sent.map((message) => message['type']),
    ['mnml/dashboards/save'],
  );
});

test('a rebuild keeps the cards it replaces, by hand or not, and their plan, before it replaces them', async () => {
  const { call, sent } = recorder({ 'lovelace/config': BEFORE });
  const plan: Plan = { ...PLAN, title: 'Our flat', icon: 'mdi:home-city' };
  await rebuildDashboard(call, BUILT, BOARD, plan, CONFIG);
  assert.deepEqual(sent, [
    { type: 'lovelace/config', url_path: 'dashboard-home' },
    {
      type: 'mnml/dashboards/save',
      url_path: 'dashboard-home',
      plan,
      previous: { plan: PLAN, config: BEFORE },
    },
    { type: 'lovelace/config/save', url_path: 'dashboard-home', config: CONFIG },
    {
      type: 'lovelace/dashboards/update',
      dashboard_id: 'dashboard_home',
      title: 'Our flat',
      icon: 'mdi:home-city',
    },
  ]);
});

test('a rebuild that cannot read the cards it would replace replaces nothing', async () => {
  const { call, sent } = recorder({ 'lovelace/config': new Error('Connection lost') });
  await assert.rejects(rebuildDashboard(call, BUILT, BOARD, PLAN, CONFIG), /Connection lost/);
  assert.deepEqual(
    sent.map((message) => message['type']),
    ['lovelace/config'],
  );
});

test('a rebuild MNML refuses to keep leaves the cards as they are', async () => {
  const { call, sent } = recorder({
    'lovelace/config': BEFORE,
    'mnml/dashboards/save': new Error('too_large'),
  });
  await assert.rejects(rebuildDashboard(call, BUILT, BOARD, PLAN, CONFIG), /too_large/);
  assert.deepEqual(
    sent.map((message) => message['type']),
    ['lovelace/config', 'mnml/dashboards/save'],
  );
});

test('a rebuild with the same title and icon leaves the dashboard entry alone', async () => {
  const { call, sent } = recorder({ 'lovelace/config': BEFORE });
  await rebuildDashboard(call, BUILT, BOARD, PLAN, CONFIG);
  assert.deepEqual(
    sent.map((message) => message['type']),
    ['lovelace/config', 'mnml/dashboards/save', 'lovelace/config/save'],
  );
});

test('a rebuild of a dashboard with no cards yet keeps nothing to undo', async () => {
  const { call, sent } = recorder({ 'lovelace/config': EMPTY });
  await rebuildDashboard(call, BUILT, BOARD, PLAN, CONFIG);
  assert.deepEqual(sent[1], {
    type: 'mnml/dashboards/save',
    url_path: 'dashboard-home',
    plan: PLAN,
  });
  assert.equal(sent.length, 3);
});

test('a rebuild of a dashboard deleted in Home Assistant makes it again', async () => {
  const { call, sent } = recorder();
  await rebuildDashboard(call, BUILT, undefined, PLAN, CONFIG);
  assert.deepEqual(
    sent.map((message) => message['type']),
    ['mnml/dashboards/save', 'lovelace/dashboards/create', 'lovelace/config/save'],
  );
});

test('a dashboard made again that Home Assistant refuses keeps its plan as it was', async () => {
  const { call, sent } = recorder({ 'lovelace/dashboards/create': new Error('taken') });
  const plan: Plan = { ...PLAN, title: 'Our flat' };
  await assert.rejects(rebuildDashboard(call, BUILT, undefined, plan, CONFIG), /taken/);
  assert.deepEqual(sent.at(-1), {
    type: 'mnml/dashboards/save',
    url_path: 'dashboard-home',
    plan: PLAN,
  });
});

test('an undo puts the replaced cards, title and icon back, and lets the kept version go', async () => {
  const { call, sent } = recorder();
  const plan = { ...PLAN, title: 'Our flat' };
  await undoDashboard(
    call,
    { ...BUILT, plan, previous: { plan: PLAN, config: BEFORE } },
    { ...BOARD, title: 'Our flat' },
  );
  assert.deepEqual(sent, [
    { type: 'lovelace/config/save', url_path: 'dashboard-home', config: BEFORE },
    {
      type: 'lovelace/dashboards/update',
      dashboard_id: 'dashboard_home',
      title: 'Home',
      icon: 'mdi:home-variant',
    },
    { type: 'mnml/dashboards/save', url_path: 'dashboard-home', plan: PLAN },
  ]);
});

test('forgetting leaves the dashboard as it is, unless it is deleted too', async () => {
  const kept = recorder();
  await forgetDashboard(kept.call, BUILT, BOARD, false);
  assert.deepEqual(kept.sent, [{ type: 'mnml/dashboards/delete', url_path: 'dashboard-home' }]);
  const deleted = recorder();
  await forgetDashboard(deleted.call, BUILT, BOARD, true);
  assert.deepEqual(deleted.sent, [
    { type: 'lovelace/dashboards/delete', dashboard_id: 'dashboard_home' },
    { type: 'mnml/dashboards/delete', url_path: 'dashboard-home' },
  ]);
});
