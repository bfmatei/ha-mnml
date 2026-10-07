import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import { planFrom } from '../builder/plan.ts';
import type { Recipe } from '../contract/builder.ts';
import type { Template } from '../contract/templates.ts';
import { readTemplates } from '../templates/shipped.ts';

import { previewOf, settled, summary } from './share.ts';
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
