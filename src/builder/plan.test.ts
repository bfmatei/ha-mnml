import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isPlan } from '../contract/builder.ts';
import type { Template } from '../contract/templates.ts';
import { readTemplates } from '../templates/shipped.ts';

import { HOME } from './fixture.ts';
import { defaultPlan } from './plan.ts';

const TEMPLATES = readTemplates();

test('the default plan has the rooms with something to show, in the order Home Assistant lists them', () => {
  assert.deepEqual(defaultPlan(HOME, TEMPLATES).rooms, [{ area: 'kitchen' }, { area: 'living' }]);
});

test('the default plan has every person, and pop-ups that unfold on tablet and desktop', () => {
  const plan = defaultPlan(HOME, TEMPLATES);
  assert.deepEqual(plan.people, [{ entity: 'person.jane' }, { entity: 'person.bob' }]);
  assert.deepEqual(plan.open, { tablet: 'unfold', desktop: 'unfold' });
  assert.equal(plan.title, 'Home');
  assert.equal(plan.icon, 'mdi:home-variant');
  assert.deepEqual(plan.cars, []);
  assert.equal(isPlan(plan), true);
});

test('the default plan has each system template whose required slots discovery fills', () => {
  assert.deepEqual(defaultPlan(HOME, TEMPLATES).system, []);
  const adguard: Template = {
    slots: {
      protection: {
        kind: 'entity',
        required: true,
        discover: { domain: 'light', platform: 'hue', scope: 'all' },
      },
    },
    card: { type: 'custom:mnml-tile-card', entity: '[[protection]]' },
  };
  assert.deepEqual(defaultPlan(HOME, { ...TEMPLATES, adguard }).system, [{ template: 'adguard' }]);
});
