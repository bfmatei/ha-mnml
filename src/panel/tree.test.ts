import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';
import { changesOf } from '../templates/changes.ts';

import { adoptIds, moved, uniqueId, valueAt, withValue } from './tree.ts';

const ROOM: Template = {
  card: {
    type: 'custom:mnml-tile-card',
    'chips?': [
      { id: 'window', type: 'indicator' },
      { id: 'lock', type: 'toggle', color: 'red' },
    ],
  },
};

test('a part is read and written by its path of keys and ids, and the input stays', () => {
  const path = ['card', 'chips?', '#lock', 'color'];
  assert.equal(valueAt(ROOM, path), 'red');
  const next = withValue(ROOM, path, 'amber');
  assert.equal(valueAt(next, path), 'amber');
  assert.equal(valueAt(ROOM, path), 'red');
});

test('writing nothing at a path takes the key, or the part, away', () => {
  const noLock = withValue(ROOM, ['card', 'chips?', '#lock'], undefined);
  assert.deepEqual(valueAt(noLock, ['card', 'chips?']), [{ id: 'window', type: 'indicator' }]);
  const noType = withValue(ROOM, ['card', 'type'], undefined);
  assert.equal(valueAt(noType, ['card', 'type']), undefined);
});

test('a new id is unique in its list, and a move keeps every part', () => {
  const list = valueAt(ROOM, ['card', 'chips?']);
  assert.ok(Array.isArray(list));
  assert.equal(uniqueId(list, 'lock'), 'my-lock');
  assert.equal(uniqueId(list, 'door'), 'my-door');
  assert.deepEqual(moved(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
});

const stripped = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stripped)
    : typeof value === 'object' && value !== null
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== 'id')
            .map(([key, inner]) => [key, stripped(inner)]),
        )
      : value;

test('a part without an id, or with an id another part of its list has, gets one of its own', () => {
  const given: Template = {
    card: {
      type: 'custom:mnml-tile-card',
      'chips?': [
        { type: 'custom:mnml-indicator' },
        { id: 'lock', type: 'toggle' },
        { id: 'lock', type: 'toggle', color: 'red' },
      ],
    },
    popups: [{ hash: '#hall', cards: [{ type: 'markdown' }] }],
  };
  const named = adoptIds(given, undefined);
  const chips = (named.card as { 'chips?': { id: string }[] })['chips?'].map((chip) => chip.id);
  assert.equal(new Set(chips).size, 3);
  assert.equal(chips[1], 'lock');
  assert.ok(chips.every((id) => typeof id === 'string' && id !== ''));
  assert.ok(
    chips[0]?.startsWith('my-') && chips[2]?.startsWith('my-'),
    'a home-made id starts with my-',
  );
  const popups = named.popups as { id: string; cards: { id: string }[] }[];
  assert.equal(typeof popups[0]?.id, 'string');
  assert.equal(typeof popups[0]?.cards[0]?.id, 'string');
  assert.deepEqual(stripped(named), stripped(given));
});

test("a copy of a shipped template written without ids takes the shipped template's ids, so it is no change at all", () => {
  const shipped: Template = {
    card: {
      type: 'custom:mnml-tile-card',
      'chips?': [
        { id: 'window', if: 'window', type: 'indicator' },
        { id: 'lock', if: 'lock', type: 'toggle', color: 'red' },
      ],
    },
  };
  const old = stripped(shipped) as Template;
  assert.deepEqual(changesOf(shipped, adoptIds(old, shipped)), []);
  const recoloured = stripped(shipped) as Template;
  Object.assign((recoloured.card as { 'chips?': object[] })['chips?'][1] ?? {}, { color: 'blue' });
  assert.deepEqual(
    changesOf(shipped, adoptIds(recoloured, shipped)).map((change) => [
      change.op,
      change.path.join('/'),
    ]),
    [['set', 'card/chips?/#lock']],
  );
});

test('a part the home adds gets an id that starts with my-, which no shipped part uses', () => {
  assert.equal(uniqueId([{ id: 'my-lock' }], 'lock'), 'my-lock-2');
  assert.equal(uniqueId([], 'my-door'), 'my-door');
});
