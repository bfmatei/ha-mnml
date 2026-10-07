import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isPlan, orderOf } from './builder.ts';

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

test('a plan may give each section its own title, icon and template, and the system section no template', () => {
  const sections = {
    rooms: { title: 'Spaces', icon: 'mdi:home-floor-1', template: 'my-room' },
    people: { template: 'person' },
    garage: { title: 'Cars' },
    system: { title: 'Servers', icon: 'mdi:server' },
  };
  assert.equal(isPlan({ ...PLAN, sections }), true);
  assert.equal(isPlan({ ...PLAN, sections: {} }), true);
  assert.equal(isPlan({ ...PLAN, sections: { system: { template: 'home-assistant' } } }), false);
  assert.equal(isPlan({ ...PLAN, sections: { attic: { title: 'Attic' } } }), false);
  assert.equal(isPlan({ ...PLAN, sections: { rooms: { icon: 'floor' } } }), false);
  assert.equal(isPlan({ ...PLAN, sections: { rooms: { template: 'My Room' } } }), false);
  assert.equal(isPlan({ ...PLAN, sections: { rooms: { title: '' } } }), false);
  assert.equal(isPlan({ ...PLAN, sections: [] }), false);
});

test('a plan may put its sections in another order, each section once', () => {
  assert.equal(isPlan({ ...PLAN, order: ['people', 'rooms', 'system', 'garage'] }), true);
  assert.equal(isPlan({ ...PLAN, order: ['system'] }), true);
  assert.equal(isPlan({ ...PLAN, order: ['rooms', 'rooms'] }), false);
  assert.equal(isPlan({ ...PLAN, order: ['attic'] }), false);
  assert.equal(isPlan({ ...PLAN, order: 'rooms' }), false);
  assert.deepEqual(orderOf({ order: ['system', 'people'] }), [
    'system',
    'people',
    'rooms',
    'garage',
  ]);
  assert.deepEqual(orderOf({}), ['rooms', 'people', 'garage', 'system']);
});
