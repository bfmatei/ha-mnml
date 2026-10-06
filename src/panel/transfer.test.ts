import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template, Templates } from '../contract/templates.ts';
import { applyChanges } from '../templates/changes.ts';

import type { Dashboard, Kept } from './data.ts';
import {
  dashboardTemplates,
  entryFor,
  exportText,
  notKept,
  planImport,
  renameEverywhere,
  renamedConfig,
  renamedTemplate,
  settleImport,
  templatesIn,
} from './transfer.ts';

const HEADING = (title: string): Template => ({
  card: { type: 'custom:mnml-heading-card', title, icon: 'mdi:flower' },
});
const ROOM: Template = {
  card: {
    type: 'custom:mnml-tile-card',
    name: '[[name]]',
    'chips?': [{ id: 'lock', type: 'toggle' }],
  },
};
const SHIPPED: Templates = { room: ROOM };
const NOTHING: Kept = { own: {}, changes: {} };
const board = (title: string, path: string | null, config: unknown, storage = true): Dashboard => ({
  path,
  title,
  storage,
  config,
});

test('a file of templates is a mapping of names to templates, or a configuration whose mnml_templates holds them', () => {
  assert.deepEqual(Object.keys(templatesIn('garden:\n  card: { type: x }\n')), ['garden']);
  assert.deepEqual(
    Object.keys(templatesIn('views: []\nmnml_templates:\n  patio:\n    card: { type: x }\n')),
    ['patio'],
  );
  assert.throws(() => templatesIn('Garden:\n  card: { type: x }\n'), /lower case/);
  assert.throws(() => templatesIn('garden:\n  slots: {}\n'), /a mapping with a card/);
  assert.throws(() => templatesIn('- garden\n'), /no mapping/);
  assert.throws(() => templatesIn('garden: !secret token\n'), /YAML tag/);
});

test('an import named like a shipped template comes in as changes to it, any other as the home own, and one that is already kept is left out', () => {
  const room = structuredClone(ROOM);
  Object.assign(room.card as object, { name: 'Mine' });
  const kept: Kept = { own: { hall: HEADING('Hall') }, changes: {} };
  const plan = planImport(
    { room, garden: HEADING('Garden'), hall: HEADING('Other hall'), same: HEADING('Same') },
    SHIPPED,
    kept,
    { ...SHIPPED, ...kept.own, same: HEADING('Same') },
  );
  assert.deepEqual(
    plan.map((each) => [each.name, each.fate]),
    [
      ['room', 'changes'],
      ['garden', 'own'],
      ['hall', 'replaces'],
      ['same', 'same'],
    ],
  );
  const changes = entryFor(
    plan[0] ?? { name: '', template: ROOM, fate: 'own', clash: false, from: [] },
    SHIPPED,
  );
  assert.ok(changes?.kind === 'changes');
  assert.deepEqual(applyChanges(ROOM, changes.changes).template, room);
  assert.deepEqual(
    entryFor(
      { name: 'garden', template: HEADING('Garden'), fate: 'own', clash: false, from: [] },
      SHIPPED,
    ),
    {
      kind: 'own',
      template: HEADING('Garden'),
    },
  );
});

test("the dashboards' mnml_templates are read with the shared dashboard's first, each named with where it is, and only those MNML lacks are offered", () => {
  const { templates, from } = dashboardTemplates([
    board('Home', null, {
      mnml_templates: { garden: HEADING('Home garden'), hall: HEADING('Hall') },
    }),
    board('MNML templates', 'mnml-templates', {
      mnml_templates: { garden: HEADING('Shared garden') },
    }),
    board('Kiosk', 'kiosk', { views: [] }),
    board('Broken', 'broken', { mnml_templates: { draft: { slots: {} } } }),
  ]);
  assert.deepEqual(templates['garden'], HEADING('Shared garden'));
  assert.deepEqual(from, { garden: ['MNML templates', 'Home'], hall: ['Home'] });
  assert.deepEqual(
    Object.keys(
      notKept(templates, { own: { hall: HEADING('Hall') }, changes: {} }, SHIPPED, SHIPPED),
    ),
    ['garden'],
  );
  assert.deepEqual(Object.keys(notKept(templates, NOTHING, SHIPPED, SHIPPED)), ['garden', 'hall']);
});

test('a rename changes the template cards that name it, and the fragments of other templates, and nothing else', () => {
  const config = {
    views: [
      {
        cards: [
          { type: 'custom:mnml-template-card', template: 'garden' },
          { type: 'custom:mnml-template-card', template: 'room' },
          { type: 'custom:other-card', template: 'garden' },
        ],
      },
    ],
  };
  const { config: renamed, count } = renamedConfig(config, 'garden', 'patio');
  assert.equal(count, 1);
  assert.deepEqual(renamed, {
    views: [
      {
        cards: [
          { type: 'custom:mnml-template-card', template: 'patio' },
          { type: 'custom:mnml-template-card', template: 'room' },
          { type: 'custom:other-card', template: 'garden' },
        ],
      },
    ],
  });
  const host: Template = {
    card: { type: 'vertical-stack', cards: [{ id: 'g', template: 'garden', slots: {} }] },
  };
  assert.deepEqual(renamedTemplate(host, 'garden', 'patio'), {
    card: { type: 'vertical-stack', cards: [{ id: 'g', template: 'patio', slots: {} }] },
  });
  assert.equal(renamedTemplate(ROOM, 'garden', 'patio'), undefined);
});

test('an export holds the templates named, whole, as YAML', () => {
  assert.equal(exportText(['garden', 'nothing'], { garden: HEADING('Garden') }), templatesToYaml());
});

function templatesToYaml(): string {
  return 'garden:\n  card:\n    type: custom:mnml-heading-card\n    title: Garden\n    icon: mdi:flower\n';
}

const withoutIds = (template: Template): Template =>
  JSON.parse(JSON.stringify(template).replaceAll(/"id":"[^"]*",?/g, '')) as Template;

test('a copy of a shipped template from before part ids is the same as the shipped one, so it is not offered or imported', () => {
  const old = withoutIds(ROOM);
  assert.deepEqual(Object.keys(notKept({ room: old }, NOTHING, SHIPPED, SHIPPED)), []);
  assert.deepEqual(
    planImport({ room: old }, SHIPPED, NOTHING, SHIPPED).map((each) => each.fate),
    ['same'],
  );
});

test('an import that clashes with a template the home keeps is replaced, kept beside it under a new name, or skipped, as chosen', () => {
  const room = structuredClone(ROOM);
  Object.assign(room.card as object, { name: 'Mine' });
  const kept: Kept = {
    own: { hall: HEADING('Hall') },
    changes: { room: [{ op: 'set', path: ['card'], key: 'name', value: 'Other', base: 'x' }] },
  };
  const plan = planImport(
    { room, hall: HEADING('New hall'), garden: HEADING('Garden') },
    SHIPPED,
    kept,
    SHIPPED,
  );
  assert.deepEqual(
    plan.map((each) => [each.name, each.clash]),
    [
      ['room', true],
      ['hall', true],
      ['garden', false],
    ],
  );
  const settled = settleImport(
    plan,
    { room: 'both', hall: 'skip' },
    new Set(['room', 'hall', 'room-2']),
  );
  assert.deepEqual(
    settled.map((each) => [each.name, each.fate]),
    [
      ['room-3', 'own'],
      ['garden', 'own'],
    ],
  );
  assert.deepEqual(
    settleImport(plan, {}, new Set()).map((each) => each.name),
    ['room', 'hall', 'garden'],
  );
});

test('a rename reads each dashboard again before it writes it, says which it could not write, and which are YAML', async () => {
  const sent: Record<string, unknown>[] = [];
  const fresh = {
    views: [
      { cards: [{ type: 'custom:mnml-template-card', template: 'garden' }, { type: 'markdown' }] },
    ],
  };
  const call = (message: { type: string } & Record<string, unknown>): Promise<unknown> => {
    sent.push(message);
    if (message.type === 'lovelace/config') {
      return Promise.resolve(fresh);
    }
    if (message['url_path'] === 'broken') {
      return Promise.reject({ code: 'home_assistant_error', message: 'Cannot save' });
    }
    return Promise.resolve(null);
  };
  const stale = { views: [{ cards: [{ type: 'custom:mnml-template-card', template: 'garden' }] }] };
  const result = await renameEverywhere(
    call,
    [
      board('Home', null, stale),
      board('Broken', 'broken', stale),
      board('Wall', 'wall', stale, false),
      board('Kiosk', 'kiosk', { views: [] }),
    ],
    'garden',
    'patio',
  );
  assert.deepEqual(result, {
    written: ['Home (1)'],
    byHand: ['Wall'],
    failed: ['Broken: Cannot save'],
  });
  const saved = sent.find(
    (message) => message['type'] === 'lovelace/config/save' && message['url_path'] === null,
  );
  assert.deepEqual(saved?.['config'], {
    views: [
      { cards: [{ type: 'custom:mnml-template-card', template: 'patio' }, { type: 'markdown' }] },
    ],
  });
});

test('the dashboards that hold different versions of one name are said, so the import can name them', () => {
  const { differ } = dashboardTemplates([
    board('Home', null, {
      mnml_templates: { garden: HEADING('Home garden'), hall: HEADING('Hall') },
    }),
    board('Kiosk', 'kiosk', {
      mnml_templates: { garden: HEADING('Kiosk garden'), hall: HEADING('Hall') },
    }),
  ]);
  assert.deepEqual(differ, ['garden']);
});
