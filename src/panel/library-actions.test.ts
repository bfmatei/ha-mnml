import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/plan.ts';
import type { Template } from '../contract/templates.ts';
import { press, text } from '../test/render.ts';
import { until } from '../test/until.ts';
import { PANEL_EN } from '../words/panel/en.ts';

import type { Built } from './building.ts';
import type { Dashboard, Entry, PanelState, Row } from './data.ts';
import { dialogsOn } from './dialog.ts';
import {
  exportTemplates,
  importDashboards,
  importFile,
  duplicateTemplate,
  newTemplate,
  removeTemplate,
  renameTemplate,
  restoreVersion,
} from './library-actions.ts';
import type { LibraryHost } from './library-actions.ts';

type Message = { type: string } & Record<string, unknown>;

const HEADING: Template = { card: { type: 'custom:mnml-heading-card', title: 'Garden' } };
const HALL: Template = {
  card: { type: 'vertical-stack', cards: [{ id: 'g', template: 'garden' }] },
};
const GARDEN_CARD = { type: 'custom:mnml-template-card', template: 'garden' };
const PLAN: Plan = {
  title: 'Home',
  icon: 'mdi:home-variant',
  rooms: [],
  people: [],
  cars: [],
  system: [{ template: 'garden' }],
  open: {},
};
const BUILT: Built = {
  url_path: 'dashboard-home',
  plan: PLAN,
  previous: undefined,
  updated: undefined,
};
const OVERVIEW: Dashboard = {
  path: null,
  title: 'Overview',
  storage: true,
  config: { views: [{ cards: [GARDEN_CARD] }] },
};
const WALL: Dashboard = {
  path: 'wall',
  title: 'Wall',
  storage: false,
  config: { views: [{ cards: [GARDEN_CARD] }] },
};
const ROW: Row = {
  name: 'garden',
  title: 'Garden',
  icon: 'mdi:puzzle-outline',
  description: '',
  family: undefined,
  status: 'own',
  changes: 0,
  use: { cards: 1, dashboards: ['Overview'] },
  role: 'tile',
};

function stateOf(given: Partial<PanelState> = {}): PanelState {
  const own = { garden: HEADING, hall: HALL };
  return {
    kept: { own, changes: {} },
    shipped: {},
    shippedFailure: undefined,
    resolved: own,
    taken: new Set(Object.keys(own)),
    registries: { areas: {}, devices: {}, entities: {}, states: {} },
    dashboards: [OVERVIEW, WALL],
    built: [BUILT],
    boards: [],
    boardsFailure: undefined,
    addresses: new Set(),
    ...given,
  };
}

interface Fake {
  host: LibraryHost;
  root: HTMLElement;
  sent: Message[];
  saved: [string, Entry | undefined][];
  downloads: [string, string][];
  refreshed: () => number;
}

function fake(
  state: PanelState,
  refuse: readonly string[] = [],
  answers: Record<string, unknown> = {},
  failSave: readonly string[] = [],
): Fake {
  const root = document.createElement('div');
  document.body.append(root);
  const sent: Message[] = [];
  const saved: [string, Entry | undefined][] = [];
  const downloads: [string, string][] = [];
  let refreshes = 0;
  return {
    root,
    sent,
    saved,
    downloads,
    refreshed: () => refreshes,
    host: {
      call: (message) => {
        sent.push(message);
        if (refuse.includes(message.type)) {
          return Promise.reject({ code: 'home_assistant_error', message: 'Cannot save' });
        }
        if (message.type === 'lovelace/config') {
          return Promise.resolve({ views: [{ cards: [GARDEN_CARD] }] });
        }
        return Promise.resolve(answers[message.type] ?? null);
      },
      dialogs: dialogsOn(root),
      words: PANEL_EN,
      state: () => state,
      refresh: () => {
        refreshes += 1;
        return Promise.resolve();
      },
      save: (name, entry) => {
        saved.push([name, entry]);
        return failSave.includes(name)
          ? Promise.reject(new Error(`${name} could not be saved`))
          : Promise.resolve();
      },
      download: (name, body) => {
        downloads.push([name, body]);
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

async function named(root: HTMLElement, name: string): Promise<void> {
  const dialog = await shown(root);
  const input = dialog.querySelector<HTMLInputElement>('input[aria-label="Name"]');
  assert.ok(input);
  input.value = name;
  input.dispatchEvent(new Event('input'));
  press(dialog, 'OK');
}

test('a rename that cannot save a dashboard part-way keeps the old name beside the new one, and says which and why', async () => {
  const at = fake(stateOf(), ['lovelace/config/save']);
  const done = renameTemplate(at.host, ROW);
  await named(at.root, 'patio');
  const told = await shown(at.root);
  assert.deepEqual(
    at.saved.map(([name]) => name),
    ['patio', 'hall'],
  );
  assert.deepEqual(at.saved[1]?.[1], {
    kind: 'own',
    template: { card: { type: 'vertical-stack', cards: [{ id: 'g', template: 'patio' }] } },
  });
  assert.ok(
    at.sent.some(
      (message) =>
        message.type === 'mnml/dashboards/save' &&
        JSON.stringify(message['plan']) ===
          JSON.stringify({ ...PLAN, system: [{ template: 'patio' }] }),
    ),
    'the plan MNML built is renamed',
  );
  assert.equal(
    at.sent.some((message) => message.type === 'mnml/templates/delete'),
    false,
  );
  assert.match(text(told), /Garden is now patio in YAML/);
  assert.match(text(told), /change garden to patio in them by hand: Wall/);
  assert.match(
    text(told),
    /garden stays beside patio until they are changed by hand: Overview: Cannot save/,
  );
  assert.equal(at.refreshed(), 2);
  press(told, 'OK');
  await done;
  at.root.remove();
});

test('a rename whose dashboards all take the new name forgets the old one', async () => {
  const at = fake(stateOf({ dashboards: [OVERVIEW] }));
  const done = renameTemplate(at.host, ROW);
  await named(at.root, 'patio');
  const told = await shown(at.root);
  assert.ok(
    at.sent.some(
      (message) => message.type === 'mnml/templates/delete' && message['name'] === 'garden',
    ),
  );
  assert.match(text(told), /Updated the cards on Overview \(1\)/);
  press(told, 'OK');
  await done;
  at.root.remove();
});

test('a rename whose template cannot be saved stops there: no dashboard is touched and the old name stays', async () => {
  const at = fake(stateOf(), [], {}, ['hall']);
  const done = renameTemplate(at.host, ROW);
  await named(at.root, 'patio');
  await assert.rejects(done, /hall could not be saved/);
  assert.deepEqual(
    at.sent.map((message) => message.type),
    [],
  );
  assert.equal(at.refreshed(), 1);
  at.root.remove();
});

const CLASHING =
  'garden:\n  card: { type: custom:mnml-heading-card, title: Other }\npatio:\n  card: { type: custom:mnml-heading-card, title: Patio }\n';

for (const [choice, names] of [
  ['both', ['garden-2', 'patio']],
  ['skip', ['patio']],
  ['replace', ['garden', 'patio']],
] as const) {
  test(`an import that clashes with a template of the home does as chosen: ${choice}`, async () => {
    const at = fake(stateOf());
    const done = importFile(at.host);
    const ask = await shown(at.root);
    const area = ask.querySelector('textarea');
    assert.ok(area);
    area.value = CLASHING;
    area.dispatchEvent(new Event('input'));
    press(ask, 'Next');
    const fates = await shown(at.root);
    assert.match(text(fates), /replaces the template of the same name/);
    assert.match(text(fates), /comes in as a template of the home/);
    const select = fates.querySelector<HTMLSelectElement>(
      'select[aria-label="What to do with Garden"]',
    );
    assert.ok(select);
    select.value = choice;
    select.dispatchEvent(new Event('change'));
    press(fates, 'Import');
    await done;
    assert.deepEqual(
      at.saved.map(([name]) => name),
      names,
    );
    assert.deepEqual(at.saved.at(-1)?.[1], {
      kind: 'own',
      template: { card: { type: 'custom:mnml-heading-card', title: 'Patio' } },
    });
    at.root.remove();
  });
}

test('an import of text that holds no template says so, and waits for another', async () => {
  const at = fake(stateOf());
  const done = importFile(at.host);
  const ask = await shown(at.root);
  const area = ask.querySelector('textarea');
  assert.ok(area);
  area.value = '{}';
  area.dispatchEvent(new Event('input'));
  press(ask, 'Next');
  assert.match(text(ask), /The text holds no template\./);
  press(ask, 'Cancel');
  await done;
  assert.deepEqual(at.saved, []);
  at.root.remove();
});

test('an import of a template whose shape cannot be resolved says which and why, and waits for another', async () => {
  const at = fake(stateOf());
  const done = importFile(at.host);
  const ask = await shown(at.root);
  const area = ask.querySelector('textarea');
  assert.ok(area);
  area.value = `${CLASHING}yard:\n  slots: { energy: { shape: metre } }\n  card: { type: custom:mnml-heading-card, title: Yard }\n`;
  area.dispatchEvent(new Event('input'));
  press(ask, 'Next');
  assert.match(text(ask), /yard: the slot energy uses the shape metre, which is not known/);
  press(ask, 'Cancel');
  await done;
  assert.deepEqual(at.saved, []);
  at.root.remove();
});

test("an import of the dashboards' templates, one of whose shapes cannot be resolved, is refused with which and why before anything is saved", async () => {
  const yard = {
    slots: { energy: { shape: 'metre' } },
    card: { type: 'custom:mnml-heading-card', title: 'Yard' },
  };
  const board: Dashboard = {
    path: 'yard',
    title: 'Yard',
    storage: true,
    config: { views: [], mnml_templates: { patio: HEADING, yard } },
  };
  const at = fake(stateOf({ dashboards: [board] }));
  await assert.rejects(importDashboards(at.host), {
    message: 'yard: the slot energy uses the shape metre, which is not known',
  });
  assert.equal(at.root.querySelector('dialog'), null);
  assert.deepEqual(at.saved, []);
  at.root.remove();
});

test('History restores the version chosen at once, and asks for one first', async () => {
  const older: Template = { card: { type: 'custom:mnml-heading-card', title: 'Older' } };
  const at = fake(stateOf(), [], {
    'mnml/templates/history': {
      history: [
        { updated: '2026-10-01T10:00:00+00:00', kind: 'own', template: older },
        { kind: 'changes', changes: [] },
      ],
    },
  });
  const done = restoreVersion(at.host, 'garden');
  const ask = await shown(at.root);
  assert.match(text(ask), /The history of Garden/);
  assert.match(text(ask), /0 changes to the shipped one/);
  press(ask, 'Restore');
  assert.match(text(ask), /Choose a version first\./);
  const first = ask.querySelector<HTMLInputElement>('input[type="radio"]');
  assert.ok(first);
  first.dispatchEvent(new Event('change'));
  press(ask, 'Restore');
  await done;
  assert.deepEqual(at.saved, [['garden', { kind: 'own', template: older }]]);
  at.root.remove();
});

for (const [refuse, answers, said] of [
  [['mnml/templates/history'], {}, /It could not be read: Cannot save/],
  [[], { 'mnml/templates/history': { history: [] } }, /There is no earlier version\./],
] as const) {
  test(`a history that cannot be read, or has nothing, says so and restores nothing: ${String(said)}`, async () => {
    const at = fake(stateOf(), refuse, answers);
    const done = restoreVersion(at.host, 'garden');
    const told = await shown(at.root);
    assert.match(text(told), said);
    press(told, 'OK');
    await done;
    assert.deepEqual(at.saved, []);
    at.root.remove();
  });
}

test('Delete says where the template is used, and Reset to shipped what goes', async () => {
  const at = fake(stateOf());
  const done = removeTemplate(at.host, ROW);
  const asked = await shown(at.root);
  assert.match(text(asked), /Delete Garden\?/);
  assert.match(text(asked), /It is on 1 card, on Overview\. Its history keeps it\./);
  press(asked, 'Delete');
  await done;
  assert.deepEqual(at.sent, [{ type: 'mnml/templates/delete', name: 'garden' }]);
  const reset = removeTemplate(at.host, {
    ...ROW,
    status: 'customised',
    use: { cards: 0, dashboards: [] },
  });
  const again = await shown(at.root);
  assert.match(text(again), /No dashboard uses it\. Your changes go; its history keeps them\./);
  press(again, 'Cancel');
  await reset;
  assert.equal(at.sent.length, 1);
  at.root.remove();
});

test('a new template is a heading with a title slot, named by the title typed, under a name no template has', async () => {
  const at = fake(stateOf());
  const made = newTemplate(at.host);
  const dialog = await shown(at.root);
  const title = dialog.querySelector<HTMLInputElement>('input[aria-label="Title"]');
  assert.ok(title);
  title.value = 'Garden';
  title.dispatchEvent(new Event('input'));
  press(dialog, 'OK');
  const draft = await made;
  assert.equal(draft?.name, 'garden-2');
  assert.equal(draft?.blank, true);
  assert.equal(draft?.template.title, 'Garden');
  assert.deepEqual(Object.keys(draft?.template ?? {}).slice(0, 2), ['description', 'title']);
  assert.deepEqual(draft?.template.slots, {
    title: { kind: 'text', required: true, label: 'Title' },
  });
  at.root.remove();
});

test('a duplicate starts from the title of the template, and keeps it after the description', async () => {
  const at = fake(stateOf());
  const made = duplicateTemplate(at.host, 'garden', { description: 'Mine.', ...HEADING });
  const dialog = await shown(at.root);
  assert.match(text(dialog), /A copy of Garden/);
  const title = dialog.querySelector<HTMLInputElement>('input[aria-label="Title"]');
  assert.equal(title?.value, 'Garden copy');
  press(dialog, 'OK');
  const draft = await made;
  assert.equal(draft?.name, 'garden-copy');
  assert.deepEqual(draft?.template, { description: 'Mine.', title: 'Garden copy', ...HEADING });
  at.root.remove();
});

test('an export of one template is named after it, and of several after them all', () => {
  const at = fake(stateOf());
  exportTemplates(at.host, ['garden'], { garden: HEADING });
  exportTemplates(at.host, ['garden', 'hall'], { garden: HEADING, hall: HALL });
  assert.deepEqual(
    at.downloads.map(([name]) => name),
    ['garden.yaml', 'mnml-templates.yaml'],
  );
  assert.match(at.downloads[0]?.[1] ?? '', /^garden:\n {2}card:/);
  at.root.remove();
});
