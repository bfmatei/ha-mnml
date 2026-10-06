import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Value } from '../contract/templates.ts';

import {
  Unsupported,
  checkValue,
  cleanValue,
  corners,
  entity,
  flag,
  labelOf,
  marked,
  need,
  parts,
  place,
  plain,
  rule,
  switchVariant,
  tagged,
  text,
  textOr,
  texts,
} from './shape.ts';

interface Toy {
  type: 'custom:toy';
  entity: string;
  name?: string;
  label?: 'device';
  hidden?: true;
  states?: string[];
  mode?: string;
  when?: { is?: string[]; not?: string[] };
  wheels?: readonly [string, string, string, string];
  rows?: { entity: string; name?: string }[];
}

const ROW = plain<{ entity: string; name?: string }>('row', 'Row', {
  entity: need(entity()),
  name: text(),
});

const TOY = plain<Toy>('toy', 'Toy', {
  entity: need(entity(['light'])),
  name: text(),
  label: flag('device'),
  hidden: flag(),
  states: texts(['on']),
  mode: textOr('auto'),
  when: rule(),
  wheels: corners(['sensor']),
  rows: parts(ROW),
});

test('a configuration the description holds passes, layout keys included', () => {
  checkValue(TOY, {
    type: 'custom:toy',
    entity: 'light.desk',
    label: 'device',
    hidden: true,
    when: { is: ['on'] },
    wheels: ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d'],
    rows: [{ entity: 'sensor.x' }],
    grid_options: { columns: 6 },
    visibility: [],
  });
});

test('a key the description lacks, or a value of the wrong shape, is unsupported, and says where', () => {
  assert.throws(
    () => checkValue(TOY, { type: 'custom:toy', entity: 'light.desk', extra: 1 }),
    (error: unknown) =>
      error instanceof Unsupported && error.message === 'extra is not a key the editor knows',
  );
  assert.throws(
    () => checkValue(TOY, { type: 'custom:toy', entity: 'switch.desk' }),
    /entity is not an entity of light/,
  );
  assert.throws(
    () =>
      checkValue(TOY, {
        type: 'custom:toy',
        entity: 'light.desk',
        rows: [{ entity: 'sensor.x', bad: true }],
      }),
    /rows\[0\]\.bad is not a key the editor knows/,
  );
  assert.throws(
    () => checkValue(TOY, { type: 'custom:toy', entity: 'light.desk', label: true }),
    /label is not 'device'/,
  );
});

test('a field left empty is not unsupported, so a half-filled form stays in the editor', () => {
  checkValue(TOY, {
    type: 'custom:toy',
    entity: '',
    wheels: ['', 'sensor.b', '', ''],
    rows: [{ entity: '' }],
  });
});

test('cleaning drops empty optional values, defaults and flags turned off, and keeps the rest in place', () => {
  const cleaned = cleanValue(TOY, {
    type: 'custom:toy',
    entity: 'light.desk',
    name: '',
    hidden: false,
    states: ['on'],
    mode: 'auto',
    when: { is: [], not: ['off'] },
    rows: [],
    grid_options: { columns: 6 },
  });
  assert.equal(
    JSON.stringify(cleaned),
    JSON.stringify({
      type: 'custom:toy',
      entity: 'light.desk',
      when: { not: ['off'] },
      grid_options: { columns: 6 },
    }),
  );
  assert.deepEqual(cleanValue(TOY, { type: 'custom:toy', entity: '' }), {
    type: 'custom:toy',
    entity: '',
  });
});

test('a key set again keeps its place, and a new one goes after the keys before it in the description', () => {
  const value: Record<string, Value> = { type: 'custom:toy', rows: [], entity: 'light.a' };
  assert.deepEqual(Object.keys(place(TOY, value, 'entity', 'light.b')), ['type', 'rows', 'entity']);
  assert.deepEqual(Object.keys(place(TOY, value, 'name', 'Desk')), [
    'type',
    'rows',
    'entity',
    'name',
  ]);
  assert.deepEqual(
    Object.keys(place(TOY, { type: 'custom:toy', hidden: true }, 'entity', 'light.a')),
    ['type', 'entity', 'hidden'],
  );
  assert.deepEqual(place(TOY, value, 'rows', undefined), { type: 'custom:toy', entity: 'light.a' });
});

const PING = plain<{ type: 'ping'; entity: string; name?: string }>('ping', 'Ping', {
  entity: need(entity()),
  name: text(),
});
const PONG = plain<{ type: 'pong'; entity: string; color?: string }>('pong', 'Pong', {
  entity: need(entity()),
  color: text(),
});
const BALL = tagged<{ type: 'ping' | 'pong' }>('ball', 'Ball', { ping: PING, pong: PONG });

const SAID = plain<{ text: string; when?: { is?: string[] } }>('said', 'Text', {
  text: need(text()),
  when: rule(),
});
const SHOWN = plain<{ entity?: string; shown: true; when?: { is?: string[] } }>('shown', 'Shown', {
  entity: entity(),
  shown: need(flag()),
  when: rule(),
});
const PLAIN = plain<{ entity?: string; when?: { is?: string[] } }>('value', 'Value', {
  entity: entity(),
  when: rule(),
});
const LINE = marked('line', 'Line', { text: SAID, shown: SHOWN }, PLAIN);

test('a part with kinds is checked against the kind it is', () => {
  checkValue(BALL, { type: 'ping', entity: 'light.a', name: 'A' }, 'controls[0]');
  assert.throws(
    () => checkValue(BALL, { type: 'pong', name: 'A' }, 'controls[0]'),
    /controls\[0\]\.name is not a key/,
  );
  assert.throws(
    () => checkValue(BALL, { type: 'zap' }, 'controls[0]'),
    /controls\[0\]\.type is not one of ping, pong/,
  );
  checkValue(LINE, { text: 'Hi', when: { is: ['on'] } }, 'state[0]');
  checkValue(LINE, {}, 'state[0]');
});

test('switching kinds keeps the keys both kinds have, drops the others, and starts the marker', () => {
  assert.deepEqual(switchVariant(BALL, { type: 'ping', entity: 'light.a', name: 'A' }, 'pong'), {
    type: 'pong',
    entity: 'light.a',
  });
  assert.deepEqual(switchVariant(LINE, { text: 'Hi', when: { is: ['on'] } }, 'shown'), {
    shown: true,
    when: { is: ['on'] },
  });
  assert.deepEqual(switchVariant(LINE, { entity: 'light.a', shown: true }, undefined), {
    entity: 'light.a',
  });
  const same = { text: 'Hi' };
  assert.equal(switchVariant(LINE, same, 'text'), same);
});

const FIELDS = plain<{ type?: string; name?: string }>('fields', 'Fields', {
  type: text(),
  name: text(),
});

test('a key named type that is not a tag is a field like any other', () => {
  checkValue(FIELDS, { type: 'kind', name: 'x' }, 'fields');
  assert.throws(() => checkValue(FIELDS, { type: 1 }, 'fields'), /fields\.type is not a text/);
});

test('a part is labelled by its kind and its name, title or entity, or by its place', () => {
  assert.equal(labelOf(BALL, { type: 'ping', entity: 'light.a' }, 0), 'Ping: light.a');
  assert.equal(labelOf(BALL, { type: 'ping', entity: 'light.a', name: 'Desk' }, 0), 'Ping: Desk');
  assert.equal(labelOf(LINE, {}, 2), 'Value 3');
  assert.equal(
    labelOf(ROW, { entity: 'sensor.x' }, 0, () => 'Hall'),
    'Hall',
  );
  assert.equal(labelOf(ROW, { entity: 'sensor.x', name: 'Desk' }, 0), 'Desk');
  assert.equal(labelOf(ROW, {}, 1), 'Row 2');
});

test('switching a control to a kind that takes fewer entities drops the entity it cannot take', async () => {
  const { CONTROL } = await import('./kinds.ts');
  assert.deepEqual(
    switchVariant(CONTROL, { type: 'toggle', entity: 'light.a', color: 'red' }, 'select'),
    {
      type: 'select',
      color: 'red',
    },
  );
  assert.deepEqual(switchVariant(CONTROL, { type: 'toggle', entity: 'select.mode' }, 'select'), {
    type: 'select',
    entity: 'select.mode',
  });
});

test('a key named type that is a field takes its place in the description like any other', async () => {
  const { CLIENT_FIELDS } = await import('./kinds.ts');
  assert.ok(CLIENT_FIELDS.kind === 'plain');
  assert.deepEqual(Object.keys(place(CLIENT_FIELDS, { type: 'kind' }, 'name', 'host')), [
    'name',
    'type',
  ]);
});
