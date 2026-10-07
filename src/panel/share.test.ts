import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import { planFrom } from '../builder/plan.ts';
import type { Recipe } from '../contract/builder.ts';
import type { Template } from '../contract/templates.ts';
import { readTemplates } from '../templates/shipped.ts';

import { bringing, broughtIn, previewOf, previewPlan, settled, summary } from './share.ts';
import { planImport } from './transfer.ts';

const SHIPPED = readTemplates();
const MINE: Template = {
  card: { type: 'custom:mnml-heading-card', title: 'Mine', icon: 'mdi:star' },
};

const RECIPE: Recipe = {
  title: 'Our flat',
  icon: 'mdi:home-city',
  open: {},
  sections: { rooms: {}, people: {}, system: { templates: ['home-assistant', 'adguard'] } },
  templates: {},
};

test('a plan is summed up by what it has', () => {
  const plan = planFrom(RECIPE, HOME, SHIPPED);
  assert.equal(summary(plan), '2 rooms, 2 people');
  assert.equal(summary({ ...plan, rooms: [], people: [] }), 'nothing but its pop-ups yet');
});

test('the preview of a dashboard template says what it makes here, and what it cannot find', () => {
  const plan = planFrom(RECIPE, HOME, SHIPPED);
  assert.equal(
    previewOf(RECIPE, plan),
    'Here it makes 2 rooms, 2 people. Home Assistant and AdGuard Home need their entities: Choose its entities picks them in the builder.',
  );
  const empty = planFrom({ ...RECIPE, sections: { rooms: { template: 'person' } } }, HOME, SHIPPED);
  assert.match(
    previewOf({ ...RECIPE, sections: { rooms: { template: 'person' } } }, empty),
    /no room/,
  );
});

test('a template brought in beside one of the same name is renamed, and the recipe follows', () => {
  const plan = planImport(
    { mine: MINE },
    SHIPPED,
    { own: { mine: { ...MINE, description: 'Here.' } }, changes: {} },
    { ...SHIPPED, mine: { ...MINE, description: 'Here.' } },
  );
  const both = settled(plan, { mine: 'both' }, new Set(['mine']));
  assert.equal(both.save.length, 1);
  assert.deepEqual(both.renames, { mine: 'mine-2' });
  assert.equal(both.save[0]?.name, 'mine-2');
  const kept = settled(plan, { mine: 'skip' }, new Set(['mine']));
  assert.deepEqual(kept, { save: [], renames: {} });
});

test('a template that would change one of the home, or a shipped one, is asked about, keeping both by default', () => {
  const room = SHIPPED['room'];
  const heading = SHIPPED['section-heading'];
  assert.ok(room && heading);
  const incoming = planImport(
    {
      room: { ...room, description: 'Theirs.' },
      'section-heading': { ...heading, description: 'Theirs.' },
      mine: MINE,
    },
    SHIPPED,
    { own: {}, changes: {} },
    SHIPPED,
  );
  const { offered, choices, alone } = bringing(incoming);
  assert.deepEqual(
    offered.map((each) => [each.name, each.clash]),
    [
      ['room', true],
      ['section-heading', true],
      ['mine', false],
    ],
  );
  assert.deepEqual(choices, { room: 'both', 'section-heading': 'skip' });
  assert.deepEqual([...alone], ['section-heading']);
});

test('templates brought in beside the home ones are saved with the names inside them renamed too', () => {
  const chip: Template = { card: { type: 'indicator', name: 'Theirs' } };
  const room: Template = {
    card: { type: 'custom:mnml-tile-card', chips: [{ id: 'c', template: 'room-chip', slots: {} }] },
  };
  const recipe: Recipe = {
    ...RECIPE,
    sections: { rooms: { template: 'my-room' } },
    templates: { 'my-room': room, 'room-chip': chip },
  };
  const incoming = planImport(
    recipe.templates,
    SHIPPED,
    { own: { 'room-chip': { card: { type: 'indicator', name: 'Ours' } } }, changes: {} },
    { ...SHIPPED, 'room-chip': { card: { type: 'indicator', name: 'Ours' } } },
  );
  const { offered, choices } = bringing(incoming);
  const brought = broughtIn(recipe, offered, choices, new Set(['room-chip']));
  const saved = Object.fromEntries(brought.save.map((each) => [each.name, each.template]));
  assert.deepEqual(Object.keys(saved).toSorted(), ['my-room', 'room-chip-2']);
  assert.ok(JSON.stringify(saved['my-room']).includes('"template":"room-chip-2"'));
  assert.equal(brought.recipe.sections.rooms?.template, 'my-room');
});

test("the preview follows the choices: a template skipped is this home's in what it makes", () => {
  const room = SHIPPED['room'];
  assert.ok(room);
  const ours: Template = {
    slots: { key: { kind: 'text', required: true, discover: 'area.id' } },
    card: { type: 'custom:mnml-heading-card', title: 'Ours', icon: 'mdi:star' },
  };
  const recipe: Recipe = {
    ...RECIPE,
    sections: { rooms: { template: 'my-room' } },
    templates: { 'my-room': structuredClone(room) },
  };
  const resolved = { ...SHIPPED, 'my-room': ours };
  const incoming = planImport(
    recipe.templates,
    SHIPPED,
    { own: { 'my-room': ours }, changes: {} },
    resolved,
  );
  const { offered, choices } = bringing(incoming);
  const taken = new Set(['my-room']);
  assert.equal(previewPlan(recipe, offered, choices, taken, HOME, resolved).rooms.length, 2);
  assert.equal(
    previewPlan(recipe, offered, { ...choices, 'my-room': 'skip' }, taken, HOME, resolved).rooms
      .length,
    0,
  );
});
