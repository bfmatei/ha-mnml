import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import type { Plan } from '../contract/plan.ts';
import type { Registries } from '../ha/registries.ts';
import { readTemplates } from '../templates/shipped.ts';
import { press, text } from '../test/render.ts';
import { until } from '../test/until.ts';
import { PANEL_EN } from '../words/panel/en.ts';

import { boardsOf, builtOf } from './building.ts';
import {
  buildDashboard,
  forgetBuilt,
  fromTemplate,
  quickStart,
  shareBuilt,
  undoRebuild,
} from './dashboard-actions.ts';
import type { DashboardHost } from './dashboard-actions.ts';
import type { Entry, PanelState } from './data.ts';
import { dialogsOn } from './dialog.ts';

type Message = { type: string } & Record<string, unknown>;

const SHIPPED = readTemplates();
const PLAN: Plan = {
  title: 'Flat',
  icon: 'mdi:home-variant',
  rooms: [],
  people: [],
  cars: [],
  system: [],
  open: {},
};
const NEXT: Plan = { ...PLAN, title: 'Our flat' };
const BOARD = { id: 'dashboard_flat', url_path: 'dashboard-flat', title: 'Flat', mode: 'storage' };

interface World {
  host: DashboardHost;
  root: HTMLElement;
  sent: Message[];
  built: Record<string, unknown>;
  boards: (typeof BOARD)[];
  went: string[];
  visited: string[];
  saved: [string, Entry | undefined][];
  downloads: [string, string][];
  refreshed: () => number;
}

function world(
  given: {
    built?: Record<string, unknown>;
    boards?: (typeof BOARD)[];
    registries?: Registries;
  } = {},
  refuse: readonly string[] = [],
  boardsFailure?: string,
): World {
  const root = document.createElement('div');
  document.body.append(root);
  const made: Omit<World, 'host' | 'refreshed'> = {
    root,
    sent: [],
    built: structuredClone(given.built ?? {}),
    boards: structuredClone(given.boards ?? []),
    went: [],
    visited: [],
    saved: [],
    downloads: [],
  };
  const read = (): PanelState => ({
    kept: { own: {}, changes: {} },
    shipped: SHIPPED,
    shippedFailure: undefined,
    resolved: SHIPPED,
    taken: new Set(Object.keys(SHIPPED)),
    registries: given.registries ?? HOME,
    dashboards: [],
    built: builtOf({ dashboards: structuredClone(made.built) }),
    boards: boardsOf(made.boards),
    boardsFailure,
    addresses: new Set(made.boards.map((board) => board.url_path)),
  });
  let state = read();
  let refreshes = 0;
  const answer = (message: Message): unknown => {
    const url = message['url_path'];
    const at = typeof url === 'string' ? url : '';
    if (message.type === 'mnml/dashboards/save') {
      made.built[at] = { plan: message['plan'], previous: message['previous'] };
    } else if (message.type === 'mnml/dashboards/delete') {
      Reflect.deleteProperty(made.built, at);
    } else if (message.type === 'lovelace/dashboards/create') {
      made.boards.push({ ...BOARD, id: at.replaceAll('-', '_'), url_path: at });
    } else if (message.type === 'lovelace/dashboards/delete') {
      const index = made.boards.findIndex((board) => board.id === message['dashboard_id']);
      made.boards.splice(index, 1);
    } else if (message.type === 'lovelace/config') {
      return { views: [{ title: 'by hand' }] };
    }
    return null;
  };
  return {
    ...made,
    refreshed: () => refreshes,
    host: {
      call: (message) => {
        made.sent.push(message);
        return refuse.includes(message.type)
          ? Promise.reject({ code: 'home_assistant_error', message: 'Cannot save' })
          : Promise.resolve(answer(message));
      },
      dialogs: dialogsOn(root),
      words: PANEL_EN,
      state: () => state,
      refresh: () => {
        refreshes += 1;
        state = read();
        return Promise.resolve();
      },
      save: (name, entry) => {
        made.saved.push([name, entry]);
        return Promise.resolve();
      },
      download: (name, body) => {
        made.downloads.push([name, body]);
      },
      go: (path) => {
        made.went.push(path);
      },
      visit: (path) => {
        made.visited.push(path);
      },
    },
  };
}

async function shown(root: HTMLElement): Promise<HTMLDialogElement> {
  await until(() => root.querySelector('dialog') !== null, 'a dialog');
  const dialog = [...root.querySelectorAll('dialog')].at(-1);
  assert.ok(dialog instanceof HTMLDialogElement, 'a dialog');
  return dialog;
}

const types = (at: World): string[] => at.sent.map((message) => message.type);

test('a create whose cards Home Assistant refuses moves to the builder of the dashboard it made, and says why', async () => {
  const at = world({}, ['lovelace/config/save']);
  await assert.rejects(buildDashboard(at.host, 'new', PLAN, 'dashboard-flat'), {
    message: 'Cannot save',
  });
  assert.deepEqual(types(at), [
    'mnml/dashboards/save',
    'lovelace/dashboards/create',
    'lovelace/config/save',
  ]);
  assert.deepEqual(Object.keys(at.built), ['dashboard-flat']);
  assert.deepEqual(at.went, ['/dashboards/dashboard-flat']);
  assert.equal(at.refreshed(), 1);
  at.root.remove();
});

test('a create Home Assistant refuses to make keeps nothing of it, and stays on the new builder', async () => {
  const at = world({}, ['lovelace/dashboards/create']);
  await assert.rejects(buildDashboard(at.host, 'new', PLAN, 'dashboard-flat'), {
    message: 'Cannot save',
  });
  assert.deepEqual(types(at), [
    'mnml/dashboards/save',
    'lovelace/dashboards/create',
    'mnml/dashboards/delete',
  ]);
  assert.deepEqual(at.built, {});
  assert.deepEqual(at.went, []);
  at.root.remove();
});

test('a rebuild whose cards Home Assistant refuses puts back what MNML kept, and stays', async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } }, boards: [BOARD] }, [
    'lovelace/config/save',
  ]);
  const done = buildDashboard(at.host, 'dashboard-flat', NEXT, 'dashboard-flat');
  const asked = await shown(at.root);
  assert.match(text(asked), /Rebuild Flat\?/);
  press(asked, 'Rebuild');
  await assert.rejects(done, { message: 'Cannot save' });
  assert.deepEqual(types(at), [
    'lovelace/config',
    'mnml/dashboards/save',
    'lovelace/config/save',
    'mnml/dashboards/save',
  ]);
  assert.deepEqual(at.built['dashboard-flat'], { plan: PLAN, previous: undefined });
  assert.deepEqual(at.went, []);
  at.root.remove();
});

test("a rebuild is refused while Home Assistant's dashboards cannot be read, before anything is asked or sent", async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } }, boards: [BOARD] }, [], 'offline');
  await assert.rejects(
    buildDashboard(at.host, 'dashboard-flat', NEXT, 'dashboard-flat'),
    /cannot tell whether Flat is still there: offline/,
  );
  assert.equal(at.root.querySelector('dialog'), null);
  assert.deepEqual(at.sent, []);
  at.root.remove();
});

test('a rebuild keeps the cards it replaces, goes back to the dashboards and offers to open it', async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } }, boards: [BOARD] });
  const done = buildDashboard(at.host, 'dashboard-flat', NEXT, 'dashboard-flat');
  press(await shown(at.root), 'Rebuild');
  const ready = await shown(at.root);
  assert.match(text(ready), /Our flat is rebuilt/);
  assert.deepEqual(at.built['dashboard-flat'], {
    plan: NEXT,
    previous: { plan: PLAN, config: { views: [{ title: 'by hand' }] } },
  });
  assert.ok(types(at).includes('lovelace/dashboards/update'), 'the title follows the plan');
  assert.deepEqual(at.went, ['']);
  press(ready, 'Open it');
  await done;
  assert.deepEqual(at.visited, ['/dashboard-flat']);
  at.root.remove();
});

test("a rebuild's question lists what changed since the build, by section and name, or says nothing did", async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } }, boards: [BOARD] });
  const next: Plan = {
    ...NEXT,
    rooms: [{ area: 'living' }],
    system: [{ template: 'adguard' }],
    sections: { rooms: { title: 'Spaces' } },
  };
  const done = buildDashboard(at.host, 'dashboard-flat', next, 'dashboard-flat');
  const asked = await shown(at.root);
  assert.deepEqual(
    [...asked.querySelectorAll('li')].map((item) => text(item)),
    [
      'The title changed',
      "A section's title, icon or template changed",
      'Spaces: Living added',
      'System: AdGuard Home added',
    ],
  );
  press(asked, 'Cancel');
  await done;
  const again = buildDashboard(at.host, 'dashboard-flat', PLAN, 'dashboard-flat');
  const same = await shown(at.root);
  assert.equal(same.querySelector('li'), null);
  assert.match(text(same), /Nothing chosen here changed since it was last built/);
  press(same, 'Cancel');
  await again;
  assert.deepEqual(at.sent, []);
  at.root.remove();
});

test('a rebuild cancelled sends nothing', async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } }, boards: [BOARD] });
  const done = buildDashboard(at.host, 'dashboard-flat', NEXT, 'dashboard-flat');
  press(await shown(at.root), 'Cancel');
  await done;
  assert.deepEqual(at.sent, []);
  at.root.remove();
});

test('Forget with Delete it too, when Home Assistant refuses the delete, keeps MNML building it', async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } }, boards: [BOARD] }, [
    'lovelace/dashboards/delete',
  ]);
  const built = at.host.state().built?.[0];
  assert.ok(built);
  const done = forgetBuilt(at.host, built);
  press(await shown(at.root), 'Delete it too');
  await assert.rejects(done, { message: 'Cannot save' });
  assert.deepEqual(types(at), ['lovelace/dashboards/delete']);
  assert.deepEqual(Object.keys(at.built), ['dashboard-flat']);
  assert.equal(at.refreshed(), 1);
  at.root.remove();
});

test('Forget with Delete it too, when MNML cannot forget it, has the dashboard deleted all the same, and reads both again', async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } }, boards: [BOARD] }, [
    'mnml/dashboards/delete',
  ]);
  const built = at.host.state().built?.[0];
  assert.ok(built);
  const done = forgetBuilt(at.host, built);
  press(await shown(at.root), 'Delete it too');
  await assert.rejects(done, { message: 'Cannot save' });
  assert.deepEqual(types(at), ['lovelace/dashboards/delete', 'mnml/dashboards/delete']);
  assert.deepEqual(at.boards, []);
  assert.deepEqual(Object.keys(at.built), ['dashboard-flat']);
  assert.equal(at.refreshed(), 1);
  assert.deepEqual(at.host.state().boards, []);
  at.root.remove();
});

test('Forget a dashboard gone from Home Assistant offers no delete, and forgets it alone', async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } } });
  const built = at.host.state().built?.[0];
  assert.ok(built);
  const done = forgetBuilt(at.host, built);
  const asked = await shown(at.root);
  assert.equal(
    [...asked.querySelectorAll('button')].some((button) => text(button) === 'Delete it too'),
    false,
  );
  press(asked, 'Forget');
  await done;
  assert.deepEqual(types(at), ['mnml/dashboards/delete']);
  at.root.remove();
});

test('Quick start says what it makes and where, makes it, and offers to open it', async () => {
  const at = world();
  const done = quickStart(at.host);
  const asked = await shown(at.root);
  assert.match(text(asked), /MNML makes Home at \/dashboard-home: 2 rooms, 2 people/);
  press(asked, 'Make it');
  const ready = await shown(at.root);
  assert.match(text(ready), /Home is ready/);
  assert.deepEqual(types(at), [
    'mnml/dashboards/save',
    'lovelace/dashboards/create',
    'lovelace/config/save',
  ]);
  press(ready, 'Open it');
  await done;
  assert.deepEqual(at.visited, ['/dashboard-home']);
  at.root.remove();
});

const SCATTERED: Registries = {
  ...HOME,
  devices: Object.fromEntries(
    Object.entries(HOME.devices).map(([id, { area_id: _area, ...device }]) => [id, device]),
  ),
  entities: Object.fromEntries(
    Object.entries(HOME.entities).map(([id, { area_id: _area, ...entity }]) => [id, entity]),
  ),
};

test('Quick start on a home mostly in no area offers to sort it first, and goes to the assistant', async () => {
  const at = world({ registries: SCATTERED });
  const done = quickStart(at.host);
  const asked = await shown(at.root);
  assert.match(text(asked), /Most of the home is in no area/);
  press(asked, 'Sort it first');
  await done;
  assert.deepEqual(at.went, ['/areas']);
  assert.deepEqual(types(at), []);
  at.root.remove();
});

test('Build anyway goes on to what Quick start makes', async () => {
  const at = world({ registries: SCATTERED });
  const done = quickStart(at.host);
  press(await shown(at.root), 'Build anyway');
  await until(() => /MNML makes Home at/.test(text(at.root)), 'what Quick start makes');
  press([...at.root.querySelectorAll('dialog')].at(-1), 'Cancel');
  await done;
  assert.deepEqual(at.went, []);
  assert.deepEqual(types(at), []);
  at.root.remove();
});

test('Undo puts back the cards, title and icon the last rebuild replaced', async () => {
  const previous = { plan: { ...PLAN, title: 'Old flat' }, config: { views: [{ title: 'old' }] } };
  const at = world({ built: { 'dashboard-flat': { plan: PLAN, previous } }, boards: [BOARD] });
  const built = at.host.state().built?.[0];
  assert.ok(built);
  const done = undoRebuild(at.host, built);
  const asked = await shown(at.root);
  assert.match(text(asked), /go back to how they were before it: Old flat, with nothing/);
  press(asked, 'Undo');
  await done;
  assert.deepEqual(at.sent[0], {
    type: 'lovelace/config/save',
    url_path: 'dashboard-flat',
    config: previous.config,
  });
  assert.deepEqual(at.built['dashboard-flat'], { plan: previous.plan, previous: undefined });
  assert.equal(at.refreshed(), 1);
  at.root.remove();
});

test('Share downloads the dashboard template, named after its address', async () => {
  const at = world({ built: { 'dashboard-flat': { plan: PLAN } }, boards: [BOARD] });
  const built = at.host.state().built?.[0];
  assert.ok(built);
  const done = shareBuilt(at.host, built);
  press(await shown(at.root), 'Download');
  await done;
  assert.equal(at.downloads[0]?.[0], 'dashboard-flat.yaml');
  assert.match(at.downloads[0]?.[1] ?? '', /^mnml_dashboard:\n {2}title: Flat/);
  at.root.remove();
});

test('From a template says what it makes here, brings its templates and gives the plan to open', async () => {
  const at = world();
  const done = fromTemplate(at.host);
  const ask = await shown(at.root);
  const area = ask.querySelector('textarea');
  assert.ok(area);
  area.value = [
    'mnml_dashboard:',
    '  title: Our flat',
    '  icon: mdi:home-city',
    '  sections:',
    '    rooms: { template: my-room }',
    '  templates:',
    '    my-room:',
    '      slots: { name: { kind: text } }',
    '      card: { type: custom:mnml-heading-card, title: "[[name]]" }',
  ].join('\n');
  area.dispatchEvent(new Event('input'));
  press(ask, 'Next');
  const preview = await shown(at.root);
  assert.match(text(preview), /Here it makes/);
  assert.match(text(preview), /comes in as a template of the home/);
  press(preview, 'Open in the builder');
  const plan = await done;
  assert.equal(plan?.title, 'Our flat');
  assert.deepEqual(
    at.saved.map(([name]) => name),
    ['my-room'],
  );
  at.root.remove();
});

test('From a template refuses one that brings a template whose shape cannot be resolved, saying which and why', async () => {
  const at = world();
  const done = fromTemplate(at.host);
  const ask = await shown(at.root);
  const area = ask.querySelector('textarea');
  assert.ok(area);
  area.value = [
    'mnml_dashboard:',
    '  title: Our flat',
    '  icon: mdi:home-city',
    '  sections:',
    '    rooms: { template: my-room }',
    '  templates:',
    '    my-room:',
    '      slots: { name: { kind: text }, energy: { shape: metre } }',
    '      card: { type: custom:mnml-heading-card, title: "[[name]]" }',
  ].join('\n');
  area.dispatchEvent(new Event('input'));
  press(ask, 'Next');
  assert.match(text(ask), /my-room: the slot energy uses the shape metre, which is not known/);
  press(ask, 'Cancel');
  assert.equal(await done, undefined);
  assert.deepEqual(at.saved, []);
  at.root.remove();
});
