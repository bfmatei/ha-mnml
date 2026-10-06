import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';
import { parse } from 'yaml';

import { DEMO } from '../../demo/home.ts';
import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { drawn } from '../home/view.ts';

import { DESCRIPTIONS } from './cards.ts';
import { formData, fromForm, labelFor, schemaOf } from './form.ts';
import { variantOf } from './shape.ts';
import type { Shape } from './shape.ts';

const SLIDER = DESCRIPTIONS['custom:mnml-slider-card'];
const CAR = DESCRIPTIONS['custom:mnml-car-plan-card'];

test("a section's plain fields become one ha-form schema with Home Assistant's pickers", () => {
  assert.ok(SLIDER?.kind === 'plain');
  assert.deepEqual(schemaOf(SLIDER, ['entity', 'slider', 'turn_on'], []), [
    { name: 'entity', required: true, selector: { entity: {} } },
    {
      name: 'slider',
      required: true,
      selector: {
        select: {
          mode: 'dropdown',
          options: ['brightness', 'color_temp', 'hue', 'temperature', 'value', 'volume'],
        },
      },
    },
    { name: 'turn_on', required: false, selector: { boolean: {} } },
  ]);
});

test('corners become a grid of four entity pickers, labelled by corner', () => {
  assert.ok(CAR?.kind === 'plain');
  const [doors] = schemaOf(CAR, ['doors'], []);
  assert.equal(doors?.type, 'grid');
  assert.deepEqual(
    doors?.schema?.map((item) => item.name),
    ['doors.0', 'doors.1', 'doors.2', 'doors.3'],
  );
  assert.equal(labelFor(CAR, 'doors.3'), 'Doors: rear right');
  assert.equal(labelFor(CAR, 'tyre_low_share'), 'Tyre low share');
});

test('a pop-up field offers the hashes of the dashboard, and takes a new one', () => {
  const media = DESCRIPTIONS['custom:mnml-media-card'];
  assert.ok(media?.kind === 'plain');
  assert.deepEqual(schemaOf(media, ['popup'], ['#a', '#b']), [
    {
      name: 'popup',
      required: false,
      selector: { select: { mode: 'dropdown', custom_value: true, options: ['#a', '#b'] } },
    },
  ]);
});

test('a flag that writes a word is a switch, and the word comes back', () => {
  const entity = DESCRIPTIONS['custom:mnml-entity-card'];
  assert.ok(entity?.kind === 'plain');
  const value: Record<string, Value> = { type: 'custom:mnml-entity-card', entity: 'light.a' };
  assert.deepEqual(formData(entity, ['label'], { ...value, label: 'device' }), { label: true });
  assert.deepEqual(fromForm(entity, ['label'], { label: true }, value), {
    ...value,
    label: 'device',
  });
  assert.deepEqual(
    fromForm(entity, ['label'], { label: false }, { ...value, label: 'device' }),
    value,
  );
});

function sections(shape: Shape, value: Record<string, Value>): (readonly string[])[] {
  return variantOf(shape, value).sections.map((section) => section.keys);
}

function roundTrip(shape: Shape, value: Record<string, Value>): void {
  const chosen = variantOf(shape, value);
  for (const keys of sections(shape, value)) {
    const back = fromForm(chosen, keys, formData(chosen, keys, value), value);
    assert.equal(JSON.stringify(back), JSON.stringify(value), `${chosen.id} ${keys.join(',')}`);
  }
  for (const [key, field] of Object.entries(chosen.fields)) {
    const inner = value[key];
    if (field.of === undefined || inner === undefined) {
      continue;
    }
    for (const item of Array.isArray(inner) ? inner : [inner]) {
      if (isMapping(item)) {
        roundTrip(field.of, item);
      }
    }
  }
}

function collect(value: unknown, into: Record<string, Value>[]): Record<string, Value>[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, into);
    }
  } else if (isMapping(value)) {
    const type = value['type'];
    if (typeof type === 'string' && Object.hasOwn(DESCRIPTIONS, type)) {
      into.push(value);
    }
    for (const item of Object.values(value)) {
      collect(item, into);
    }
  }
  return into;
}

test('every section of every demo and example card, and of every part in it, goes through ha-form data unchanged', () => {
  const examples: unknown = parse(readFileSync('examples/cards.yaml', 'utf8'));
  for (const card of [...collect(drawn(DEMO), []), ...collect(examples, [])]) {
    const type = card['type'];
    const shape = typeof type === 'string' ? DESCRIPTIONS[type] : undefined;
    assert.ok(shape);
    roundTrip(shape, card);
  }
});

test('a rule written by hand keeps the order of its keys', () => {
  const entity = DESCRIPTIONS['custom:mnml-entity-card'];
  assert.ok(entity?.kind === 'plain');
  const value: Record<string, Value> = {
    type: 'custom:mnml-entity-card',
    entity: 'light.a',
    when: { not: ['off'], is: ['on'] },
  };
  const back = fromForm(entity, ['when'], formData(entity, ['when'], value), value);
  assert.equal(JSON.stringify(back), JSON.stringify(value));
});

test('a pop-up typed without its # gets one, so the card takes it', () => {
  const media = DESCRIPTIONS['custom:mnml-media-card'];
  assert.ok(media?.kind === 'plain');
  const value: Record<string, Value> = {
    type: 'custom:mnml-media-card',
    entity: 'media_player.tv',
  };
  assert.deepEqual(fromForm(media, ['popup'], { popup: 'kitchen' }, value), {
    ...value,
    popup: '#kitchen',
  });
});

test("a list's sum is labelled as the column it adds up", () => {
  const list = DESCRIPTIONS['custom:mnml-list-card'];
  assert.ok(list?.kind === 'plain');
  assert.equal(labelFor(list, 'summary.sum'), 'Summary: the column to sum, 0 for the first value');
});

test('a required text or entity cleared in the form stays, empty, so the part keeps its kind', () => {
  const header = DESCRIPTIONS['custom:mnml-header-card'];
  assert.ok(header?.kind === 'marked');
  const value: Record<string, Value> = {
    type: 'custom:mnml-header-card',
    name: 'Hall',
    icon: 'mdi:door',
  };
  const named = variantOf(header, value);
  const back = fromForm(named, ['name', 'icon'], { icon: 'mdi:door' }, value);
  assert.deepEqual(back, { type: 'custom:mnml-header-card', name: '', icon: 'mdi:door' });
  assert.equal(variantOf(header, back), named);
});
