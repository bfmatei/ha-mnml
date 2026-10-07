import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isPlan } from './builder.ts';

const PLAN = {
  title: 'Home',
  icon: 'mdi:home-variant',
  rooms: [{ area: 'kitchen' }, { area: 'living', slots: { name: 'Lounge' } }],
  people: [{ entity: 'person.jane' }],
  cars: [{ key: 'sedan', slots: { metadata: 'sensor.sedan' } }],
  system: [{ template: 'home-assistant' }],
  open: { tablet: 'unfold', desktop: 'unfold' },
};

test('a plan names its dashboard, its rooms by area, its people by entity, and how pop-ups open', () => {
  assert.equal(isPlan(PLAN), true);
  assert.equal(isPlan({ ...PLAN, rooms: [], people: [], cars: [], system: [], open: {} }), true);
});

test('a plan with a missing or malformed part is refused', () => {
  assert.equal(isPlan({ ...PLAN, title: '' }), false);
  assert.equal(isPlan({ ...PLAN, icon: 'home' }), false);
  assert.equal(isPlan({ ...PLAN, rooms: [{ slots: {} }] }), false);
  assert.equal(isPlan({ ...PLAN, people: [{ entity: 'sensor.jane' }] }), false);
  assert.equal(isPlan({ ...PLAN, cars: [{ key: 'x' }] }), false);
  assert.equal(isPlan({ ...PLAN, system: [{ template: 'adguard', slots: [] }] }), false);
  assert.equal(isPlan({ ...PLAN, system: [{ template: 'Home Assistant' }] }), false);
  assert.equal(isPlan({ ...PLAN, cars: [{ key: 'My car', slots: {} }] }), false);
  assert.equal(isPlan({ ...PLAN, people: [{ entity: 'person.Jane Doe' }] }), false);
  assert.equal(isPlan({ ...PLAN, icon: 'mdi:Home' }), false);
  assert.equal(isPlan({ ...PLAN, open: { watch: 'sheet' } }), false);
  assert.equal(isPlan({ ...PLAN, open: { phone: 'drawer' } }), false);
  assert.equal(isPlan(null), false);
});
