import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/builder.ts';

import { movedBy, trimmed, withDeclared, withGlances, withLook, withOrder } from './plan-edits.ts';

const PLAN: Plan = {
  title: 'Home',
  icon: 'mdi:home-variant',
  rooms: [{ area: 'kitchen', slots: { name: 'Cook', lights: [] } }, { area: 'hall' }],
  people: [],
  cars: [],
  system: [],
  open: {},
};

test('a row moves up or down by one, and stays where it is at either end', () => {
  assert.deepEqual(movedBy(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(movedBy(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  assert.deepEqual(movedBy(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(movedBy(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
});

test("a section's look keeps only what differs from its default, and an icon only once it is one", () => {
  assert.deepEqual(withLook(PLAN, 'rooms', { title: 'Spaces', icon: 'mdi:floor-plan' }), {
    rooms: { title: 'Spaces' },
  });
  assert.deepEqual(withLook(PLAN, 'rooms', { icon: 'floor' }), undefined);
  assert.deepEqual(
    withLook({ ...PLAN, sections: { people: { title: 'Us' } } }, 'rooms', { template: 'room' }),
    { people: { title: 'Us' } },
  );
});

test('a template changed drops the slots of the rows it does not declare', () => {
  assert.deepEqual(withDeclared(PLAN, 'rooms', new Set(['name'])).rooms, [
    { area: 'kitchen', slots: { name: 'Cook' } },
    { area: 'hall' },
  ]);
  assert.deepEqual(withDeclared(PLAN, 'rooms', new Set()).rooms, [
    { area: 'kitchen' },
    { area: 'hall' },
  ]);
});

test('the order is kept only when it is not the default, and titles are trimmed when saved', () => {
  assert.equal(withOrder(PLAN, ['rooms', 'people', 'garage', 'system']).order, undefined);
  assert.deepEqual(withOrder(PLAN, ['people', 'rooms', 'garage', 'system']).order, [
    'people',
    'rooms',
    'garage',
    'system',
  ]);
  assert.deepEqual(trimmed({ rooms: { title: '  Spaces ' }, people: { title: ' ' } }), {
    rooms: { title: 'Spaces' },
  });
});

test('a template changed keeps a spelled row spelled, with the slots it declares', () => {
  const plan: Plan = {
    ...PLAN,
    rooms: [{ slots: { name: 'Office', lights: [] }, spelled: true }],
    people: [{ entity: 'person.jane', slots: { key: 'jane', low: 30 }, spelled: true }],
  };
  assert.deepEqual(withDeclared(plan, 'rooms', new Set(['lights'])).rooms, [
    { slots: { lights: [] }, spelled: true },
  ]);
  assert.deepEqual(withDeclared(plan, 'people', new Set(['name'])).people, [
    { entity: 'person.jane', slots: {}, spelled: true },
  ]);
});

test('the Glances strip shown keeps what it had, and hidden is left out', () => {
  assert.deepEqual(withGlances(PLAN, true).glances, {});
  const kept = { slots: { weather: 'weather.home' } };
  assert.deepEqual(withGlances({ ...PLAN, glances: kept }, true).glances, kept);
  assert.equal('glances' in withGlances({ ...PLAN, glances: kept }, false), false);
});
