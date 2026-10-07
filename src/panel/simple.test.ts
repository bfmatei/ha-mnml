import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Template } from '../contract/templates.ts';
import { readTemplates } from '../templates/shipped.ts';

import { simpleOf, switchedOff, switchedOn } from './simple.ts';
import { valueAt } from './tree.ts';

const SHIPPED = readTemplates();
const ROOM = SHIPPED['room'];

const TILE: Template = {
  card: {
    type: 'custom:mnml-tile-card',
    name: 'Garden',
    icon: 'mdi:flower',
    entity: '[[entity]]',
    chips: [
      { id: 'rain', type: 'indicator', entity: '[[rain]]', color: 'blue', if: 'rain' },
      { id: 'wind', type: 'indicator', entity: '[[wind]]', color: 'teal' },
      { id: 'sun', type: 'indicator', entity: '[[sun]]', color: 'amber' },
    ],
  },
};

const rowOf = (template: Template, shipped: Template | undefined, id: string) =>
  simpleOf(template, shipped).find((row) => row.path.at(-1) === `#${id}`);

test("a template's parts are rows to switch, with their conditions and their literal looks", () => {
  const rows = simpleOf(TILE, TILE);
  assert.equal(rows[0]?.switchable, false);
  assert.deepEqual(
    rows[0]?.looks.map((look) => [look.key, look.value]),
    [
      ['name', 'Garden'],
      ['icon', 'mdi:flower'],
    ],
  );
  const rain = rowOf(TILE, TILE, 'rain');
  assert.equal(rain?.on, true);
  assert.equal(rain?.switchable, true);
  assert.equal(rain?.condition, 'when rain is set');
  assert.deepEqual(rain?.looks, [
    { path: ['card', 'chips', '#rain', 'color'], key: 'color', value: 'blue' },
  ]);
  assert.ok(rows.every((row) => row.looks.every((look) => !look.value.includes('[['))));
});

test('a part switched off is a row that is off, and switched on comes back at its shipped place', () => {
  const off = switchedOff(TILE, ['card', 'chips', '#wind']);
  assert.equal(valueAt(off, ['card', 'chips', '#wind']), undefined);
  assert.equal(rowOf(off, TILE, 'wind')?.on, false);
  const back = switchedOn(off, TILE, ['card', 'chips', '#wind'], undefined);
  assert.deepEqual(back, TILE);
  const twice = switchedOff(switchedOff(TILE, ['card', 'chips', '#rain']), [
    'card',
    'chips',
    '#wind',
  ]);
  const wind = switchedOn(twice, TILE, ['card', 'chips', '#wind'], undefined);
  const chips = valueAt(wind, ['card', 'chips']);
  assert.ok(Array.isArray(chips));
  assert.deepEqual(
    chips.map((chip) => (isMapping(chip) ? chip['id'] : '')),
    ['wind', 'sun'],
  );
});

test("a part of the home's own template comes back from what was kept when it went", () => {
  const kept = valueAt(TILE, ['card', 'chips', '#sun']);
  const off = switchedOff(TILE, ['card', 'chips', '#sun']);
  assert.equal(rowOf(off, undefined, 'sun'), undefined);
  assert.deepEqual(
    switchedOn(off, undefined, ['card', 'chips', '#sun'], { value: kept, after: 'wind' }),
    TILE,
  );
});

test('the shipped room has its chips as switches, with their conditions in words', () => {
  assert.ok(ROOM);
  const rows = simpleOf(ROOM, ROOM);
  const window = rows.find((row) => row.path.at(-1) === '#window');
  assert.equal(window?.on, true);
  assert.equal(window?.condition, 'when window is set');
  assert.ok(rows.some((row) => row.path.at(-1) === '#lock'));
  assert.ok(rows.every((row) => !row.label.includes('[[')));
});
