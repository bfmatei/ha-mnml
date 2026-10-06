import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { SlotSpec, Value } from '../contract/templates.ts';

import {
  defaultArea,
  groupsOf,
  homeWide,
  noteOf,
  overridesOf,
  singular,
  slotLabel,
  sourceOf,
  valuesOf,
} from './fill.ts';

const ROOM: Record<string, SlotSpec> = {
  key: { kind: 'text', required: true, group: 'Basics' },
  name: { kind: 'text', required: true, group: 'Basics' },
  temperature: { kind: 'entity', group: 'Sensors' },
  heating: { kind: 'object', group: 'Climate', fields: { entity: { kind: 'entity' } } },
  ac: {
    kind: 'object',
    group: 'Climate',
    label: 'Air conditioning',
    fields: { entity: { kind: 'entity' } },
  },
};

test('the panels follow the groups in the order they first appear, with an icon each', () => {
  assert.deepEqual(groupsOf(ROOM), [
    { name: 'Basics', icon: 'mdi:card-text-outline', slots: ['key', 'name'] },
    { name: 'Sensors', icon: 'mdi:thermometer', slots: ['temperature'] },
    { name: 'Climate', icon: 'mdi:thermostat', slots: ['heating', 'ac'] },
  ]);
});

test('slots without a group: the simple ones in Basics, each object in a panel of its own', () => {
  assert.deepEqual(
    groupsOf({
      title: { kind: 'text' },
      rows: { kind: 'objects', fields: { entity: { kind: 'entity' } } },
      icon: { kind: 'icon' },
    }),
    [
      { name: 'Basics', icon: 'mdi:card-text-outline', slots: ['title', 'icon'] },
      { name: 'Rows', icon: 'mdi:format-list-bulleted', slots: ['rows'] },
    ],
  );
});

test('a label wins over the name, and a list item is named in the singular', () => {
  assert.equal(slotLabel('ac', { kind: 'object', label: 'Air conditioning' }), 'Air conditioning');
  assert.equal(slotLabel('active_scene', { kind: 'entity' }), 'Active scene');
  assert.equal(singular('Speakers'), 'Speaker');
  assert.equal(singular('Batteries'), 'Battery');
  assert.equal(singular('Wi-Fi'), 'Wi-Fi');
});

test('the whole home is offered only to a template whose rules look there', () => {
  assert.equal(homeWide(ROOM), false);
  assert.equal(
    homeWide({ updates: { kind: 'entities', discover: { domain: 'update', scope: 'all' } } }),
    true,
  );
  assert.equal(
    homeWide({
      rows: { kind: 'objects', discover: { per: 'device', scope: 'all', fields: {} }, fields: {} },
    }),
    true,
  );
});

test('the source is read from the card', () => {
  assert.equal(sourceOf({ template: 'room', area: 'living' }), 'area');
  assert.equal(sourceOf({ template: 'room', slots: {} }), 'yourself');
  assert.equal(sourceOf({ template: 'room' }), 'home');
});

const AREAS = {
  bathroom: { area_id: 'bathroom', name: 'Bathroom' },
  living: { area_id: 'living', name: 'Living' },
};

test('the area defaults to the one matching the card, else to none', () => {
  assert.equal(defaultArea({ slots: { key: 'living', name: 'Living' } }, AREAS), 'living');
  assert.equal(defaultArea({ slots: { name: 'bathroom' } }, AREAS), 'bathroom');
  assert.equal(defaultArea({ slots: { key: 'garden' } }, AREAS), undefined);
});

const FOUND: Record<string, Value> = {
  key: 'living',
  name: 'Living',
  temperature: 'sensor.living_temperature',
};
const MINE: Record<string, Value> = {
  key: 'living',
  name: 'Living room',
  temperature: 'sensor.living_temperature',
  heating: { entity: 'climate.living' },
};

test('a card filled by hand keeps every value in an area, as overrides where they differ', () => {
  const overrides = overridesOf(FOUND, MINE);
  assert.deepEqual(overrides, { name: 'Living room', heating: { entity: 'climate.living' } });
  assert.deepEqual(valuesOf('area', FOUND, overrides), MINE);
  assert.deepEqual(valuesOf('yourself', FOUND, MINE), MINE);
});

test('a found value the person clears stays cleared', () => {
  const cleared = { key: 'living', name: 'Living' };
  const overrides = overridesOf(FOUND, cleared);
  assert.deepEqual(overrides, { temperature: null });
  assert.deepEqual(valuesOf('area', FOUND, overrides), cleared);
});

test('the whole home shows what it found', () => {
  assert.deepEqual(valuesOf('home', FOUND, {}), FOUND);
});

test('each field says where its value comes from', () => {
  assert.equal(noteOf('area', 'name', FOUND, { name: 'Living room' }, 'Living'), 'Set by you');
  assert.equal(noteOf('area', 'temperature', FOUND, {}, 'Living'), 'Found in Living');
  assert.equal(noteOf('area', 'heating', FOUND, {}, 'Living'), 'Nothing found in Living');
  assert.equal(noteOf('home', 'temperature', FOUND, {}, ''), 'Found in the home');
  assert.equal(noteOf('yourself', 'temperature', FOUND, {}, ''), undefined);
});

test('a value cleared in an area reads as not set, not as set by you', () => {
  assert.equal(noteOf('area', 'temperature', FOUND, { temperature: null }, 'Living'), 'Not set');
  assert.equal(noteOf('area', 'name', FOUND, { name: '' }, 'Living'), 'Not set');
  assert.equal(noteOf('area', 'scenes', FOUND, { scenes: [] }, 'Living'), 'Not set');
});
