import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import type { Plan } from '../contract/plan.ts';
import type { Template, Templates, WrittenTemplate } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { changesOf } from '../templates/changes.ts';
import type { Change } from '../templates/changes.ts';
import { SLOT_SHAPES } from '../templates/families.ts';
import { readTemplates } from '../templates/shipped.ts';
import { withShapes } from '../templates/slot-shapes.ts';
import { fakeConnection, fakeHass } from '../test/hass.ts';
import { press, text, updated } from '../test/render.ts';

import type { Entry } from './data.ts';
import { MnmlLibrary } from './library.ts';
import { MnmlPlanEditor } from './plan-editor.ts';
import { MnmlBuilder } from './template-builder.ts';

interface Given {
  own: Templates;
  written: Record<string, WrittenTemplate>;
  changes: Record<string, Change[]>;
  missing: string[];
  failure: string | undefined;
}

const given: Given = vi.hoisted(() => ({
  own: {},
  written: {},
  changes: {},
  missing: [],
  failure: undefined,
}));

vi.mock('../store/store.ts', () => ({
  onShared: () => () => undefined,
  sharedTemplates: () => ({
    status: 'ready',
    own: given.own,
    written: given.written,
    changes: given.changes,
  }),
}));

vi.mock('./lovelace.ts', () => ({ loadLovelace: () => Promise.resolve() }));

vi.mock('../store/shipped.ts', () => ({
  SHIPPED_TEMPLATES: {
    need: () => Promise.resolve(),
    templates: () =>
      Object.fromEntries(
        Object.entries(readTemplates()).filter(([name]) => !given.missing.includes(name)),
      ),
    failure: () => given.failure,
  },
}));

vi.mock(import('../editors/ha-form.ts'), async (original) => ({
  ...(await original()),
  loadHaForm: () => Promise.resolve(undefined),
}));

const { MnmlPanel } = await import('./main.ts');

type Message = { type: string } & Record<string, unknown>;

interface Home {
  hass: HomeAssistant;
  sent: Message[];
  configs: Map<string | null, unknown>;
  refuse: Set<string>;
}

const PLAN: Plan = {
  title: 'Home',
  icon: 'mdi:home-variant',
  rooms: [],
  people: [],
  cars: [],
  system: [{ template: 'garden' }],
  open: {},
};
const BEFORE: Plan = { ...PLAN, system: [], sections: { rooms: { template: 'garden' } } };
const GARDEN_CARD = { type: 'custom:mnml-template-card', template: 'garden' };

let open = 0;

function answered(answer: Promise<unknown>): Promise<unknown> {
  open += 1;
  return answer.finally(() => {
    open -= 1;
  });
}

function home(): Home {
  const sent: Message[] = [];
  const configs = new Map<string | null, unknown>();
  const refuse = new Set<string>();
  const answer = (message: Message): unknown => {
    if (message.type === 'lovelace/dashboards/list') {
      return [{ id: 'dashboard_home', url_path: 'dashboard-home', title: 'Home', mode: 'storage' }];
    }
    if (message.type === 'mnml/dashboards/list') {
      return {
        dashboards: {
          'dashboard-home': {
            plan: PLAN,
            previous: { plan: BEFORE, config: { views: [{ cards: [GARDEN_CARD] }] } },
          },
        },
      };
    }
    if (message.type === 'lovelace/config') {
      const url = message['url_path'];
      return configs.get(typeof url === 'string' ? url : null) ?? { views: [] };
    }
    return null;
  };
  return {
    sent,
    configs,
    refuse,
    hass: fakeHass({
      ...HOME,
      connection: fakeConnection({
        sendMessagePromise: (message: Message) => {
          sent.push(message);
          return answered(
            refuse.has(message.type)
              ? Promise.reject({ code: 'home_assistant_error', message: 'Cannot save' })
              : Promise.resolve(answer(message)),
          );
        },
      }),
    }),
  };
}

const settled = (): Promise<void> => updated(document, () => open === 0);

async function opened(path: string, at: Home): Promise<InstanceType<typeof MnmlPanel>> {
  const panel = new MnmlPanel();
  panel.hass = at.hass;
  panel.route = { path };
  document.body.append(panel);
  await settled();
  return panel;
}

function dialogOf(panel: InstanceType<typeof MnmlPanel>): HTMLDialogElement {
  const dialog = panel.shadowRoot?.querySelector('dialog');
  assert.ok(dialog instanceof HTMLDialogElement, 'a dialog');
  return dialog;
}

function named(panel: InstanceType<typeof MnmlPanel>, name: string): void {
  const input = dialogOf(panel).querySelector<HTMLInputElement>('input[aria-label="Name"]');
  assert.ok(input);
  input.value = name;
  input.dispatchEvent(new Event('input'));
  press(dialogOf(panel), 'OK');
}

function libraryOf(panel: InstanceType<typeof MnmlPanel>): MnmlLibrary {
  const library = panel.shadowRoot?.querySelector('mnml-library');
  assert.ok(library instanceof MnmlLibrary);
  return library;
}

function reset(): void {
  given.own = {};
  given.written = {};
  given.changes = {};
  given.missing = [];
  given.failure = undefined;
}

test('Edit it for everyone, from a template with changes not saved, asks before it leaves', async () => {
  reset();
  const panel = await opened('/templates/room', home());
  const builder = panel.shadowRoot?.querySelector('mnml-builder');
  assert.ok(builder instanceof MnmlBuilder);
  vi.spyOn(builder, 'dirty').mockReturnValue(true);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  builder.host?.open('person');
  await settled();
  assert.equal(confirm.mock.calls.length, 1);
  const still = panel.shadowRoot?.querySelector('mnml-builder');
  assert.ok(still instanceof MnmlBuilder);
  assert.equal(still.name, 'room');
  confirm.mockRestore();
  panel.remove();
});

const HEADING: Template = { card: { type: 'custom:mnml-heading-card', title: 'Garden' } };

function withGarden(): void {
  reset();
  const room = readTemplates()['room'];
  assert.ok(room);
  given.own = {
    garden: HEADING,
    hall: { card: { type: 'vertical-stack', cards: [{ id: 'g', template: 'garden' }] } },
  };
  given.written = given.own;
  given.changes = {
    room: changesOf(room, {
      ...room,
      popups: [...(room.popups ?? []), { id: 'my-garden', template: 'garden' }],
    }),
  };
}

async function renamed(at: Home): Promise<InstanceType<typeof MnmlPanel>> {
  const panel = await opened('/templates', at);
  at.configs.set(null, { views: [{ cards: [GARDEN_CARD] }] });
  const library = libraryOf(panel);
  const row = library.rows.find((each) => each.name === 'garden');
  assert.ok(row);
  library.actions?.rename(row);
  await settled();
  named(panel, 'patio');
  await settled();
  return panel;
}

test("a rename reads the dashboards again, and renames the piece in other templates, in a customised shipped one's changes and in the plans of the dashboards MNML built", async () => {
  withGarden();
  const at = home();
  const panel = await renamed(at);
  const saved = (name: string): unknown =>
    at.sent.find((message) => message.type === 'mnml/templates/save' && message['name'] === name)?.[
      'entry'
    ];
  assert.deepEqual(saved('patio'), { kind: 'own', template: HEADING });
  assert.deepEqual(saved('hall'), {
    kind: 'own',
    template: { card: { type: 'vertical-stack', cards: [{ id: 'g', template: 'patio' }] } },
  });
  assert.match(JSON.stringify(saved('room')), /"id":"my-garden","template":"patio"/);
  assert.doesNotMatch(JSON.stringify(saved('room')), /"garden"/);
  const cards = at.sent.find(
    (message) => message.type === 'lovelace/config/save' && message['url_path'] === null,
  );
  assert.deepEqual(cards?.['config'], {
    views: [{ cards: [{ ...GARDEN_CARD, template: 'patio' }] }],
  });
  const plan = at.sent.find((message) => message.type === 'mnml/dashboards/save');
  assert.deepEqual(plan, {
    type: 'mnml/dashboards/save',
    url_path: 'dashboard-home',
    plan: { ...PLAN, system: [{ template: 'patio' }] },
    previous: {
      plan: { ...BEFORE, sections: { rooms: { template: 'patio' } } },
      config: { views: [{ cards: [{ ...GARDEN_CARD, template: 'patio' }] }] },
    },
  });
  assert.ok(
    at.sent.some(
      (message) => message.type === 'mnml/templates/delete' && message['name'] === 'garden',
    ),
  );
  assert.match(text(dialogOf(panel)), /Garden is now patio in YAML/);
  press(dialogOf(panel), 'OK');
  panel.remove();
});

test('a rename whose plan cannot be saved keeps the old name beside the new one, and says so', async () => {
  withGarden();
  const at = home();
  at.refuse.add('mnml/dashboards/save');
  const panel = await renamed(at);
  assert.equal(
    at.sent.some((message) => message.type === 'mnml/templates/delete'),
    false,
  );
  assert.match(text(dialogOf(panel)), /garden stays beside patio/);
  assert.match(text(dialogOf(panel)), /Home: Cannot save/);
  press(dialogOf(panel), 'OK');
  panel.remove();
});

test("a rename while Home Assistant's dashboards cannot be read keeps the old name", async () => {
  withGarden();
  const at = home();
  at.refuse.add('lovelace/dashboards/list');
  const panel = await renamed(at);
  assert.equal(
    at.sent.some((message) => message.type === 'mnml/templates/delete'),
    false,
  );
  assert.match(text(dialogOf(panel)), /Home Assistant's dashboards, which MNML could not read/);
  press(dialogOf(panel), 'OK');
  panel.remove();
});

test('while a family of shipped templates is missing, the panel says so, its names stay taken, and nothing is imported', async () => {
  reset();
  given.missing = ['person'];
  given.failure = 'mnml: the shipped templates could not be loaded: offline';
  const at = home();
  const panel = await opened('/templates', at);
  assert.match(text(panel.shadowRoot), /the shipped templates could not be loaded: offline/);
  libraryOf(panel).actions?.create();
  await settled();
  const title = dialogOf(panel).querySelector<HTMLInputElement>('input[aria-label="Title"]');
  assert.ok(title);
  title.value = 'Person';
  title.dispatchEvent(new Event('input'));
  const name = dialogOf(panel).querySelector<HTMLInputElement>('input[aria-label="Name in YAML"]');
  assert.equal(name?.value, 'person-2');
  press(dialogOf(panel), 'Cancel');
  await settled();
  libraryOf(panel).actions?.importFile();
  await settled();
  assert.match(text(dialogOf(panel)), /That did not work/);
  assert.match(text(dialogOf(panel)), /could not be loaded: offline/);
  press(dialogOf(panel), 'OK');
  panel.remove();
  reset();
});

const YARD: WrittenTemplate = {
  description: 'A yard.',
  slots: {
    energy: { shape: 'meter', label: 'Energy', fields: { power: { required: true } } },
    lamp: { kind: 'entity' },
  },
  card: { type: 'custom:mnml-heading-card', title: 'Yard', icon: 'mdi:barn' },
  example: { energy: { power: 'sensor.yard_power' } },
};

test("a template of the home's own written with shapes opens as written, and a title changed and saved keeps its slots byte for byte", async () => {
  reset();
  given.written = { yard: YARD };
  given.own = { yard: withShapes('yard', YARD, SLOT_SHAPES) };
  const at = home();
  const panel = await opened('/templates/yard', at);
  const builder = panel.shadowRoot?.querySelector('mnml-builder');
  assert.ok(builder instanceof MnmlBuilder);
  assert.deepEqual(builder.draft?.template, YARD);
  assert.equal(builder.host?.templates()['yard']?.slots?.['energy']?.kind, 'object');
  const root = builder.shadowRoot;
  assert.ok(root);
  const stage = root.querySelector('mnml-preview');
  assert.ok(stage);
  const pick: unknown = Reflect.get(stage, 'pick');
  assert.equal(typeof pick, 'function');
  Reflect.apply(pick as (key: string) => void, undefined, ['card']);
  await builder.updateComplete;
  const title = root.querySelector<HTMLInputElement>('input[data-path="card/title"]');
  assert.ok(title);
  title.value = 'Back yard';
  title.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  press(root, 'Save');
  await settled();
  const entry = at.sent.find(
    (message) => message.type === 'mnml/templates/save' && message['name'] === 'yard',
  )?.['entry'] as Entry | undefined;
  assert.equal(entry?.kind, 'own');
  assert.equal(JSON.stringify(entry.template.slots), JSON.stringify(YARD.slots));
  assert.deepEqual(entry.template.card, { ...(YARD.card as object), title: 'Back yard' });
  panel.remove();
});

test("the dashboards' builder is given the home's own templates with their shapes resolved", async () => {
  reset();
  given.written = { yard: YARD };
  given.own = { yard: withShapes('yard', YARD, SLOT_SHAPES) };
  const panel = await opened('/dashboards/new', home());
  const editor = panel.shadowRoot?.querySelector('mnml-plan-editor');
  assert.ok(editor instanceof MnmlPlanEditor);
  assert.equal(editor.templates['yard']?.slots?.['energy']?.kind, 'object');
  panel.remove();
});
