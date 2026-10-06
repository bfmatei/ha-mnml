import assert from 'node:assert/strict';

import { test } from 'vitest';

import { marked, requireKnownKeys, schema, tagged, unknownKeys, variant } from './keys.ts';

interface Row {
  entity: string;
  low?: number;
}

interface Card {
  type: string;
  title?: string;
  rows: Row[];
}

const ROW = schema<Row>({ entity: true, low: true });

const CARD = schema<Card>({ type: true, title: true, rows: true }, { rows: ROW });

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

type Shape = { type: 'a'; x: number; y?: never } | { type: 'b'; x?: never; y: number };

const SHAPE = tagged<Shape>({
  a: variant<Extract<Shape, { type: 'a' }>>({ type: true, x: true }),
  b: variant<Extract<Shape, { type: 'b' }>>({ type: true, y: true }),
});

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

const ENTRY = marked(
  { text: variant<Extract<Entry, { text: string }>>({ text: true }) },
  variant<Extract<Entry, { entity: string }>>({ entity: true }),
);

test('a marked union checks a value against the variant its marker key picks', () => {
  assert.deepEqual(
    unknownKeys([{ text: 'None', entity: 'sensor.a' }, { entity: 'sensor.a' }], ENTRY),
    ['[0].entity'],
  );
});
