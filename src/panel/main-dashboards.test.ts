import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { HOME, SCATTERED } from '../builder/fixture.ts';
import type { Plan } from '../contract/plan.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import type { Registries } from '../ha/registries.ts';
import { readTemplates } from '../templates/shipped.ts';
import { fakeConnection, fakeHass } from '../test/hass.ts';
import { press, text, updated } from '../test/render.ts';

vi.mock('../store/store.ts', () => ({
  onShared: () => () => undefined,
  sharedTemplates: () => ({ status: 'ready', own: {}, written: {}, changes: {} }),
}));

vi.mock('./lovelace.ts', () => ({ loadLovelace: () => Promise.resolve() }));

vi.mock('../store/shipped.ts', () => ({
  SHIPPED_TEMPLATES: {
    need: () => Promise.resolve(),
    templates: () => readTemplates(),
    failure: () => undefined,
  },
}));

vi.mock(import('../editors/ha-form.ts'), async (original) => ({
  ...(await original()),
  loadHaForm: () => Promise.resolve(undefined),
}));

const { MnmlPanel } = await import('./main.ts');

let open = 0;

function answered(answer: Promise<unknown>): Promise<unknown> {
  open += 1;
  return answer.finally(() => {
    open -= 1;
  });
}

const settled = (): Promise<void> => updated(document, () => open === 0);

function hassWith(list: () => Promise<unknown>): HomeAssistant {
  return fakeHass({
    ...HOME,
    connection: fakeConnection({
      sendMessagePromise: (message: { type: string }) =>
        answered(
          message.type === 'mnml/dashboards/list'
            ? list()
            : message.type === 'lovelace/dashboards/list'
              ? Promise.resolve([])
              : Promise.resolve({ views: [] }),
        ),
    }),
  });
}

type Message = { type: string } & Record<string, unknown>;

interface Home {
  hass: HomeAssistant;
  sent: Message[];
  boards: { id: string; url_path: string; title: string; mode: string }[];
  built: Record<string, unknown>;
  refuse: Map<string, number>;
}

const PLAN: Plan = {
  title: 'Flat',
  icon: 'mdi:home-variant',
  rooms: [],
  people: [],
  cars: [],
  system: [],
  open: {},
};

function answer(home: Home, message: Message): unknown {
  const url = message['url_path'];
  const at = typeof url === 'string' ? url : '';
  if (message.type === 'mnml/dashboards/list') {
    return { dashboards: structuredClone(home.built) };
  }
  if (message.type === 'lovelace/dashboards/list') {
    return structuredClone(home.boards);
  }
  if (message.type === 'mnml/dashboards/save') {
    home.built[at] = { plan: message['plan'], previous: message['previous'] };
  } else if (message.type === 'mnml/dashboards/delete') {
    Reflect.deleteProperty(home.built, at);
  } else if (message.type === 'lovelace/dashboards/create') {
    home.boards.push({ id: at.replaceAll('-', '_'), url_path: at, title: 'x', mode: 'storage' });
  } else if (message.type === 'lovelace/dashboards/delete') {
    home.boards = home.boards.filter((board) => board.id !== message['dashboard_id']);
  } else if (message.type === 'lovelace/config') {
    return { views: [] };
  } else if (message.type === 'config/area_registry/create') {
    return { area_id: String(message['name']).toLowerCase() };
  }
  return null;
}

function home(registries: Registries = HOME): Home {
  const made: Home = {
    hass: fakeHass({
      ...registries,
      connection: fakeConnection({
        sendMessagePromise: (message: Message) => {
          made.sent.push(message);
          const left = made.refuse.get(message.type) ?? 0;
          if (left > 0) {
            made.refuse.set(message.type, left - 1);
            return answered(
              Promise.reject({ code: 'home_assistant_error', message: 'Cannot save' }),
            );
          }
          return answered(Promise.resolve(answer(made, message)));
        },
      }),
    }),
    sent: [],
    boards: [],
    built: {},
    refuse: new Map(),
  };
  return made;
}

async function opened(path: string, at: Home): Promise<InstanceType<typeof MnmlPanel>> {
  const panel = new MnmlPanel();
  panel.hass = at.hass;
  panel.route = { path };
  document.body.append(panel);
  await settled();
  return panel;
}

function editorOf(panel: InstanceType<typeof MnmlPanel>): ShadowRoot {
  const root = panel.shadowRoot?.querySelector('mnml-plan-editor')?.shadowRoot;
  assert.ok(root, 'the dashboard builder');
  return root;
}

test("a create whose cards Home Assistant refuses keeps the edits and the dashboard's address, so trying again finishes that dashboard", async () => {
  const at = home();
  at.refuse.set('lovelace/config/save', 1);
  const panel = await opened('/dashboards/new', at);
  const title = editorOf(panel).querySelector<HTMLInputElement>('input.fact-input');
  assert.ok(title);
  title.value = 'Our flat';
  title.dispatchEvent(new Event('input'));
  press(editorOf(panel), 'Create');
  await settled();
  assert.match(text(editorOf(panel)), /Cannot save/);
  assert.equal(
    editorOf(panel).querySelector<HTMLInputElement>('input.fact-input')?.value,
    'Our flat',
  );
  press(editorOf(panel), 'Rebuild');
  await settled();
  press(panel.shadowRoot?.querySelector('dialog'), 'Rebuild');
  await settled();
  const created = at.sent.filter((message) => message.type === 'lovelace/dashboards/create');
  assert.equal(created.length, 1);
  assert.deepEqual(Object.keys(at.built), [created[0]?.['url_path']]);
  assert.equal(at.sent.filter((message) => message.type === 'lovelace/config/save').length, 2);
  press(panel.shadowRoot?.querySelector('dialog'), 'Cancel');
  panel.remove();
});

test('a rebuild Home Assistant refuses keeps the edits in the builder', async () => {
  const at = home();
  at.boards.push({
    id: 'dashboard_flat',
    url_path: 'dashboard-flat',
    title: 'Flat',
    mode: 'storage',
  });
  at.built['dashboard-flat'] = { plan: PLAN };
  at.refuse.set('lovelace/config/save', 1);
  const panel = await opened('/dashboards/dashboard-flat', at);
  const title = editorOf(panel).querySelector<HTMLInputElement>('input.fact-input');
  assert.ok(title);
  title.value = 'Our flat';
  title.dispatchEvent(new Event('input'));
  press(editorOf(panel), 'Rebuild');
  await settled();
  press(panel.shadowRoot?.querySelector('dialog'), 'Rebuild');
  await settled();
  assert.match(text(editorOf(panel)), /Cannot save/);
  assert.equal(
    editorOf(panel).querySelector<HTMLInputElement>('input.fact-input')?.value,
    'Our flat',
  );
  assert.deepEqual(at.built['dashboard-flat'], { plan: PLAN, previous: undefined });
  panel.remove();
});

test("Home Assistant's dashboards that cannot be read are not taken as gone, and nothing is made again", async () => {
  const at = home();
  at.boards.push({
    id: 'dashboard_flat',
    url_path: 'dashboard-flat',
    title: 'Flat',
    mode: 'storage',
  });
  at.built['dashboard-flat'] = { plan: PLAN };
  at.refuse.set('lovelace/dashboards/list', 99);
  const panel = await opened('/dashboards', at);
  assert.doesNotMatch(text(panel.shadowRoot), /No longer in Home Assistant/);
  assert.match(text(panel.shadowRoot), /cannot read Home Assistant's dashboards: Cannot save/);
  panel.route = { path: '/dashboards/dashboard-flat' };
  await settled();
  press(editorOf(panel), 'Rebuild');
  await settled();
  assert.equal(panel.shadowRoot?.querySelector('dialog'), null);
  assert.match(text(editorOf(panel)), /cannot read Home Assistant's dashboards/);
  assert.equal(
    at.sent.some((message) => message.type === 'mnml/dashboards/save'),
    false,
  );
  panel.remove();
});

test('a dashboard deleted in Home Assistant but not forgotten by MNML is shown as it is now', async () => {
  const at = home();
  at.boards.push({
    id: 'dashboard_flat',
    url_path: 'dashboard-flat',
    title: 'Flat',
    mode: 'storage',
  });
  at.built['dashboard-flat'] = { plan: PLAN };
  at.refuse.set('mnml/dashboards/delete', 1);
  const panel = await opened('/dashboards', at);
  const list = panel.shadowRoot?.querySelector('mnml-dashboards')?.shadowRoot;
  press(list, 'Forget Flat');
  await settled();
  press(panel.shadowRoot?.querySelector('dialog'), 'Delete it too');
  await settled();
  assert.match(text(panel.shadowRoot?.querySelector('dialog')), /That did not work/);
  press(panel.shadowRoot?.querySelector('dialog'), 'OK');
  await settled();
  const now = panel.shadowRoot?.querySelector('mnml-dashboards')?.shadowRoot;
  assert.match(text(now), /No longer in Home Assistant/);
  assert.equal(now?.querySelector('[aria-label="Open Flat"]'), null);
  panel.remove();
});

test('a store that cannot be read says so on the Dashboards tab, rather than offering to build', async () => {
  const panel = new MnmlPanel();
  panel.hass = hassWith(() => Promise.reject({ code: 'not_loaded', message: 'not loaded' }));
  panel.route = { path: '/dashboards' };
  document.body.append(panel);
  await settled();
  const page = text(panel.shadowRoot);
  assert.match(page, /MNML cannot read the dashboards it built: not loaded/);
  assert.equal(panel.shadowRoot?.querySelector('mnml-dashboards'), null);
  panel.remove();
});

test("the builder page follows Home Assistant's states, as the panel is given them", async () => {
  const panel = new MnmlPanel();
  panel.hass = hassWith(() => Promise.resolve({ dashboards: {} }));
  panel.route = { path: '/dashboards/new' };
  document.body.append(panel);
  await settled();
  const editor = panel.shadowRoot?.querySelector('mnml-plan-editor');
  assert.ok(editor);
  const next = hassWith(() => Promise.resolve({ dashboards: {} }));
  panel.hass = next;
  assert.equal(Reflect.get(editor, 'hass'), next);
  panel.remove();
});

test('the panel opens on its dashboards, and keeps its templates at /templates', async () => {
  const panel = new MnmlPanel();
  panel.hass = hassWith(() => Promise.resolve({ dashboards: {} }));
  panel.route = { path: '' };
  document.body.append(panel);
  await settled();
  const tabs = [...(panel.shadowRoot?.querySelectorAll('.tab') ?? [])].map((tab) => text(tab));
  assert.deepEqual(tabs, ['Dashboards', 'Templates']);
  assert.ok(panel.shadowRoot?.querySelector('mnml-dashboards'));
  assert.equal(panel.shadowRoot?.querySelector('.tab.active')?.textContent?.trim(), 'Dashboards');
  panel.route = { path: '/templates' };
  await settled();
  assert.ok(panel.shadowRoot?.querySelector('mnml-library'));
  assert.equal(panel.shadowRoot?.querySelector('.tab.active')?.textContent?.trim(), 'Templates');
  panel.route = { path: '/dashboards' };
  await settled();
  assert.ok(panel.shadowRoot?.querySelector('mnml-dashboards'));
  panel.remove();
});

test("a route away from a dashboard's builder with changes not built asks first, and stays when told to", async () => {
  const at = home();
  at.boards.push({
    id: 'dashboard_flat',
    url_path: 'dashboard-flat',
    title: 'Flat',
    mode: 'storage',
  });
  at.built['dashboard-flat'] = { plan: PLAN };
  const panel = await opened('/dashboards/dashboard-flat', at);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const title = editorOf(panel).querySelector<HTMLInputElement>('input.fact-input');
  assert.ok(title);
  title.value = 'Our flat';
  title.dispatchEvent(new Event('input'));
  await settled();
  panel.route = { path: '/templates' };
  await settled();
  assert.equal(confirm.mock.calls.length, 1);
  assert.match(String(confirm.mock.calls[0]?.[0]), /Leave without building your changes/);
  assert.equal(
    editorOf(panel).querySelector<HTMLInputElement>('input.fact-input')?.value,
    'Our flat',
  );
  confirm.mockReturnValue(true);
  panel.route = { path: '/templates' };
  await settled();
  assert.ok(panel.shadowRoot?.querySelector('mnml-library'));
  confirm.mockRestore();
  panel.remove();
});

test('the area assistant opens from the builder, asks before it writes, keeps Undo for the session, and Back returns to the builder', async () => {
  const at = home(SCATTERED);
  const panel = await opened('/dashboards/new', at);
  press(editorOf(panel), 'Sort them into areas');
  await settled();
  const areas = (): ShadowRoot => {
    const root = panel.shadowRoot?.querySelector('mnml-areas')?.shadowRoot;
    assert.ok(root, 'the area assistant');
    return root;
  };
  press(areas(), 'Assign 4 in Home Assistant');
  await settled();
  const asked = panel.shadowRoot?.querySelector('dialog');
  assert.match(
    text(asked),
    /MNML makes the area Office, then places 2 devices and 2 entities in their areas\./,
  );
  press(asked, 'Assign');
  await settled();
  const written = (): Message[] => at.sent.filter((message) => message.type.startsWith('config/'));
  assert.deepEqual(written(), [
    { type: 'config/area_registry/create', name: 'Office' },
    { type: 'config/device_registry/update', device_id: 'bulb', area_id: 'attic' },
    { type: 'config/device_registry/update', device_id: 'thermometer', area_id: 'attic' },
    { type: 'config/entity_registry/update', entity_id: 'light.office_desk', area_id: 'office' },
    {
      type: 'config/entity_registry/update',
      entity_id: 'sensor.office_temperature',
      area_id: 'office',
    },
  ]);
  at.sent.length = 0;
  press(areas(), 'Undo');
  await settled();
  press(panel.shadowRoot?.querySelector('dialog'), 'Put them back');
  await settled();
  assert.deepEqual(written(), [
    { type: 'config/device_registry/update', device_id: 'bulb', area_id: null },
    { type: 'config/device_registry/update', device_id: 'thermometer', area_id: null },
    { type: 'config/entity_registry/update', entity_id: 'light.office_desk', area_id: null },
    {
      type: 'config/entity_registry/update',
      entity_id: 'sensor.office_temperature',
      area_id: null,
    },
    { type: 'config/area_registry/delete', area_id: 'office' },
  ]);
  assert.ok(![...areas().querySelectorAll('button')].some((each) => text(each) === 'Undo'));
  press(areas(), 'Back');
  await settled();
  assert.ok(editorOf(panel));
  assert.equal(location.pathname, '/mnml/dashboards/new');
  panel.remove();
});
