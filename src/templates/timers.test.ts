import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';

import { discover } from './discover.ts';
import { expand } from './expand.ts';
import { SHIPPED } from './shipped.ts';

const HOME: Registries = {
  areas: {
    kitchen: { area_id: 'kitchen', name: 'Kitchen' },
    hall: { area_id: 'hall', name: 'Hall' },
  },
  devices: {},
  entities: {
    'timer.kitchen_eggs': { entity_id: 'timer.kitchen_eggs', area_id: 'kitchen' },
    'timer.hall_lights': { entity_id: 'timer.hall_lights', area_id: 'hall' },
    'timer.laundry': { entity_id: 'timer.laundry' },
  },
  states: {
    'timer.kitchen_eggs': { state: 'idle', attributes: {} },
    'timer.hall_lights': { state: 'active', attributes: {} },
    'timer.laundry': { state: 'paused', attributes: {} },
  },
};

const listed = (value: Value | undefined): Record<string, Value>[] =>
  Array.isArray(value) ? value.filter(isMapping) : [];

const control = (service: string, name: string, icon: string, show: Value): Value => ({
  type: 'service',
  entity: 'timer.kitchen_eggs',
  service,
  name,
  icon,
  ...(service === 'timer.start' || service === 'timer.pause' ? { primary: true } : {}),
  show,
});

test('timer-card counts down, starts while not running, pauses while running, cancels and finishes while not idle, and offers its presets', () => {
  const { card } = expand(SHIPPED, {
    template: 'timer-card',
    slots: { entity: 'timer.kitchen_eggs' },
  });
  assert.deepEqual(card, {
    type: 'custom:mnml-entity-card',
    entity: 'timer.kitchen_eggs',
    color: 'amber',
    when: { is: ['active'] },
    state: [{ remaining: true }],
    controls: [
      control('timer.start', 'Start', 'mdi:play', { not: ['active'] }),
      control('timer.pause', 'Pause', 'mdi:pause', { is: ['active'] }),
      control('timer.cancel', 'Cancel', 'mdi:stop', { not: ['idle'] }),
      control('timer.finish', 'Finish', 'mdi:check', { not: ['idle'] }),
      { type: 'select', entity: 'timer.kitchen_eggs' },
    ],
  });
});

test("a room finds its area's timers, and its pop-up draws each under Other, with the room's other devices", () => {
  const room = SHIPPED['room'];
  assert.ok(room);
  const found = discover(room, 'kitchen', HOME);
  assert.deepEqual(found['timers'], ['timer.kitchen_eggs']);
  const { popups } = expand(SHIPPED, { template: 'room' }, found);
  const popup = popups.find((one) => isMapping(one) && one['hash'] === '#kitchen');
  assert.ok(isMapping(popup));
  const cards = listed(popup['cards']);
  const other = cards.findIndex((card) => card['title'] === 'Other');
  assert.ok(other !== -1);
  const timer = cards[other + 1];
  assert.equal(timer?.['entity'], 'timer.kitchen_eggs');
  assert.deepEqual(timer?.['state'], [{ remaining: true }]);
});

test('the glances strip finds every timer of the home with its room, and draws each while it runs, counting down, among the calm statuses, opening its room', () => {
  const glances = SHIPPED['glances'];
  assert.ok(glances);
  const found = discover(glances, undefined, HOME);
  assert.deepEqual(found['timers'], [
    { entity: 'timer.hall_lights', room: 'hall' },
    { entity: 'timer.kitchen_eggs', room: 'kitchen' },
    { entity: 'timer.laundry' },
  ]);
  const { card } = expand(SHIPPED, { template: 'glances' }, found);
  assert.ok(isMapping(card));
  const items = listed(card['items']).filter(
    (item) => typeof item['entity'] === 'string' && item['entity'].startsWith('timer.'),
  );
  const shown = { is: ['active'] };
  assert.deepEqual(items, [
    {
      entity: 'timer.hall_lights',
      color: 'amber',
      when: shown,
      show: shown,
      calm: true,
      state: [{ remaining: true }],
      popup: '#hall',
    },
    {
      entity: 'timer.kitchen_eggs',
      color: 'amber',
      when: shown,
      show: shown,
      calm: true,
      state: [{ remaining: true }],
      popup: '#kitchen',
    },
    {
      entity: 'timer.laundry',
      color: 'amber',
      when: shown,
      show: shown,
      calm: true,
      state: [{ remaining: true }],
    },
  ]);
});

test('a running timer is not an issue: the issues pop-up lists none', () => {
  const problems = SHIPPED['glance-problems'];
  assert.ok(problems);
  assert.equal(problems.slots?.['timers'], undefined);
});
