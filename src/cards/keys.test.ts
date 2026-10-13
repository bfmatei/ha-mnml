import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  entity,
  entityRule,
  marked,
  need,
  number,
  parts,
  plain,
  tagged,
  text,
} from '../contract/structure.ts';

import { cardKeysOf, keysOf, requireKnownKeys, unknownKeys } from './keys.ts';

interface Row {
  entity: string;
  low?: number;
}

interface Card {
  type: 'custom:mnml-list-card';
  title?: string;
  rows: Row[];
}

const ROW = plain<Row>('row', { entity: need(entity()), low: number() });

const CARD = cardKeysOf(plain<Card>('card', { title: text(), rows: need(parts(ROW)) }));

test('known keys pass, and so do the layout keys Home Assistant and card-mod add', () => {
  const config = {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a', low: 20 }],
    grid_options: { columns: 6 },
    visibility: [],
    view_layout: {},
    layout_options: {},
    card_mod: { style: '' },
  };
  assert.deepEqual(unknownKeys(config, CARD), []);
  assert.doesNotThrow(() => {
    requireKnownKeys(config, CARD);
  });
});

test('an unknown key is named with its path, at the top and inside a list', () => {
  const config = {
    type: 'x',
    titel: 'Batteries',
    rows: [{ entity: 'sensor.a' }, { entity: 'sensor.b', lowes: 20 }],
  };
  assert.deepEqual(unknownKeys(config, CARD), ['titel', 'rows[1].lowes']);
  assert.throws(() => {
    requireKnownKeys(config, CARD);
  }, /unknown keys: titel, rows\[1\]\.lowes/);
});

test('layout keys are allowed at the top only', () => {
  assert.deepEqual(unknownKeys({ type: 'x', rows: [{ entity: 'a', card_mod: {} }] }, CARD), [
    'rows[0].card_mod',
  ]);
});

test('a card keeps its type among its keys, and a part keeps only the keys its structure names', () => {
  assert.ok(CARD.keys.has('type'));
  assert.deepEqual([...keysOf(ROW).keys], ['entity', 'low']);
  assert.equal(keysOf(ROW), keysOf(ROW));
});

test('a rule is checked as the keys of its kind', () => {
  const shown = keysOf(
    plain<{ show?: { is?: string[]; entity?: string } }>('shown', { show: entityRule() }),
  );
  assert.deepEqual(unknownKeys({ show: { is: ['on'], entity: 'sensor.a', state: 'on' } }, shown), [
    'show.state',
  ]);
});

type Shape = { type: 'a'; x: number; y?: never } | { type: 'b'; x?: never; y: number };

const SHAPE = keysOf(
  tagged<Shape>('shape', { a: { x: need(number()) }, b: { y: need(number()) } }),
);

test('a tagged union checks a value against the variant its type names', () => {
  assert.deepEqual(unknownKeys({ type: 'a', x: 1, y: 2 }, SHAPE), ['y']);
  assert.deepEqual(unknownKeys({ type: 'b', y: 2 }, SHAPE), []);
  assert.deepEqual(
    unknownKeys({ type: 'c', x: 1, y: 2 }, SHAPE),
    [],
    "an unknown type is the card's to report",
  );
});

type Entry = { text: string; entity?: never } | { text?: never; entity: string };

const ENTRY = keysOf(
  marked<Entry>('entry')({ text: { text: need(text()) } }, { entity: need(entity()) }),
);

test('a marked union checks a value against the variant its marker key picks', () => {
  assert.deepEqual(
    unknownKeys([{ text: 'None', entity: 'sensor.a' }, { entity: 'sensor.a' }], ENTRY),
    ['[0].entity'],
  );
});

test('the path a template marks a part with is a key of every part, and of no card the author wrote', () => {
  const config = {
    type: 'x',
    rows: [{ entity: 'sensor.a', _part: 'card/rows/#a' }],
    _part: 'card',
  };
  assert.deepEqual(unknownKeys(config, CARD), []);
});
