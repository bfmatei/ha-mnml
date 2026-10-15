import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  corners,
  entity,
  flag,
  marked,
  need,
  parts,
  plain,
  rule,
  tagged,
  text,
  texts,
} from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import type { Value } from '../contract/templates.ts';

import { DESCRIPTIONS, describer } from './cards.ts';
import {
  UnsupportedConfig,
  checkValue,
  cleanValue,
  labelOf,
  place,
  switchVariant,
} from './form.ts';
import type { ChoiceForm, PlainForm, Form } from './form.ts';
import type { Labels } from './labels.ts';

const describe = describer(
  {
    row: { label: 'Row' },
    toy: { label: 'Toy' },
    ball: { label: 'Ball', kinds: { ping: { label: 'Ping' }, pong: { label: 'Pong' } } },
    line: {
      label: 'Line',
      kinds: { text: { label: 'Text' }, shown: { label: 'Shown' } },
      otherwise: { label: 'Value' },
    },
    fields: { label: 'Fields' },
  } satisfies Readonly<Record<string, Labels>>,
  {},
);

const plainOf = (structure: Structure): PlainForm => {
  const form = describe(structure);
  assert.ok(form.kind === 'plain');
  return form;
};

const choiceOf = (structure: Structure): ChoiceForm => {
  const form = describe(structure);
  assert.ok(form.kind !== 'plain');
  return form;
};

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

const ROW_STRUCTURE = plain<{ entity: string; name?: string }>('row', {
  entity: need(entity()),
  name: text(),
});

const ROW = plainOf(ROW_STRUCTURE);

const TOY = plainOf(
  plain<Toy>('toy', {
    entity: need(entity(['light'])),
    name: text(),
    label: flag('device'),
    hidden: flag(),
    states: texts(['on']),
    mode: text('auto'),
    when: rule(),
    wheels: corners(['sensor']),
    rows: parts(ROW_STRUCTURE),
  }),
);

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

test('a key the description lacks, or a value of the wrong form, is unsupported, and says where', () => {
  assert.throws(
    () => checkValue(TOY, { type: 'custom:toy', entity: 'light.desk', extra: 1 }),
    (error: unknown) =>
      error instanceof UnsupportedConfig && error.message === 'extra is not a key the editor knows',
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

test('cleaning keeps a rule written empty, which matches every state, and drops one whose lists were emptied', () => {
  assert.deepEqual(cleanValue(TOY, { type: 'custom:toy', entity: 'light.desk', when: {} }), {
    type: 'custom:toy',
    entity: 'light.desk',
    when: {},
  });
  assert.deepEqual(
    cleanValue(TOY, { type: 'custom:toy', entity: 'light.desk', when: { is: [], not: [] } }),
    { type: 'custom:toy', entity: 'light.desk' },
  );
});

test('cleaning keeps an emptied list with a default, which means none, and drops an emptied text, which asks for its default', () => {
  assert.deepEqual(
    cleanValue(TOY, { type: 'custom:toy', entity: 'light.desk', states: [], mode: '' }),
    { type: 'custom:toy', entity: 'light.desk', states: [] },
  );
});

test('cleaning against what was there leaves the keys that did not change as they are', () => {
  const before: Record<string, Value> = {
    type: 'custom:toy',
    entity: 'light.desk',
    name: '',
    rows: [{ entity: 'sensor.a', name: '' }],
  };
  assert.deepEqual(cleanValue(TOY, { ...before, entity: 'light.lamp', hidden: false }, before), {
    type: 'custom:toy',
    entity: 'light.lamp',
    name: '',
    rows: [{ entity: 'sensor.a', name: '' }],
  });
  assert.deepEqual(
    cleanValue(
      TOY,
      {
        ...before,
        rows: [
          { entity: 'sensor.a', name: '' },
          { entity: 'sensor.b', name: '' },
        ],
      },
      before,
    ),
    { ...before, rows: [{ entity: 'sensor.a', name: '' }, { entity: 'sensor.b' }] },
  );
  assert.deepEqual(cleanValue(TOY, { ...before, rows: [] }, before), {
    type: 'custom:toy',
    entity: 'light.desk',
    name: '',
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

type Ball =
  | { type: 'ping'; entity: string; name?: string }
  | { type: 'pong'; entity: string; color?: string };

const BALL = choiceOf(
  tagged<Ball>('ball', {
    ping: { entity: need(entity()), name: text() },
    pong: { entity: need(entity()), color: text() },
  }),
);

type Line =
  | { text: string; entity?: never; shown?: never; when?: { is?: string[] } }
  | { text?: never; entity?: string; shown: true; when?: { is?: string[] } }
  | { text?: never; entity?: string; shown?: never; when?: { is?: string[] } };

const LINE = choiceOf(
  marked<Line>('line')(
    {
      text: { text: need(text()), when: rule() },
      shown: { entity: entity(), shown: need(flag()), when: rule() },
    },
    { entity: entity(), when: rule() },
  ),
);

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

const FIELDS = plainOf(
  plain<{ type?: string; name?: string }>('fields', { type: text(), name: text() }),
);

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

const fieldForm = (type: string, key: string): Form => {
  const card = DESCRIPTIONS[type];
  const of = card?.kind === 'plain' ? card.fields[key]?.of : undefined;
  assert.ok(of, `${type} ${key}`);
  return of;
};

test('switching a control to a kind that takes fewer entities drops the entity it cannot take', () => {
  const control = fieldForm('custom:mnml-heading-card', 'controls');
  assert.ok(control.kind !== 'plain');
  assert.deepEqual(
    switchVariant(control, { type: 'toggle', entity: 'light.a', color: 'red' }, 'select'),
    {
      type: 'select',
      color: 'red',
    },
  );
  assert.deepEqual(switchVariant(control, { type: 'toggle', entity: 'select.mode' }, 'select'), {
    type: 'select',
    entity: 'select.mode',
  });
});

test('a key named type that is a field takes its place in the description like any other', () => {
  const fields = fieldForm('custom:mnml-clients-card', 'fields');
  assert.ok(fields.kind === 'plain');
  assert.deepEqual(Object.keys(place(fields, { type: 'kind' }, 'name', 'host')), ['name', 'type']);
});
