import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';
import { parse } from 'yaml';

import { DEMO } from '../../demo/home.ts';
import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { drawn } from '../home/view.ts';

import { DESCRIPTIONS } from './cards.ts';
import { checkValue, cleanValue } from './form.ts';
import type { Form } from './form.ts';

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

const examples: unknown = parse(readFileSync('examples/cards.yaml', 'utf8'));
const CARDS = [...collect(drawn(DEMO), []), ...collect(examples, [])];

const formFor = (card: Record<string, Value>): Form => {
  const type = card['type'];
  const form = typeof type === 'string' ? DESCRIPTIONS[type] : undefined;
  assert.ok(form, `a description for ${JSON.stringify(type)}`);
  return form;
};

test('every card the demo home draws, and every example card, goes through the editor unchanged', () => {
  assert.ok(CARDS.length > 300, `${CARDS.length} cards`);
  for (const card of CARDS) {
    const form = formFor(card);
    checkValue(form, card);
    assert.equal(JSON.stringify(cleanValue(form, card)), JSON.stringify(card));
  }
});

test('the round trip meets every card with a description, and every kind of control', () => {
  const types = new Set(CARDS.map((card) => card['type']));
  assert.deepEqual(
    Object.keys(DESCRIPTIONS).filter((type) => !types.has(type)),
    [],
  );
  const controls = new Set(
    JSON.stringify(CARDS)
      .match(/"type":"(toggle|slider|select|service|nav|indicator|status|tyres|scenes)"/g)
      ?.map((found) => found.slice(8, -1)),
  );
  assert.deepEqual([...controls].toSorted(), [
    'indicator',
    'nav',
    'scenes',
    'select',
    'service',
    'slider',
    'status',
    'toggle',
    'tyres',
  ]);
});

function plains(form: Form, seen = new Set<Form>()): Set<Form> {
  if (seen.has(form)) {
    return seen;
  }
  seen.add(form);
  const own = form.kind === 'plain' ? [form] : form.variants.map((variant) => variant.form);
  for (const each of own) {
    seen.add(each);
    for (const field of Object.values(each.fields)) {
      if (field.of !== undefined) {
        plains(field.of, seen);
      }
    }
  }
  return seen;
}

test('every field of every form is in exactly one of its sections', () => {
  for (const top of Object.values(DESCRIPTIONS)) {
    for (const form of plains(top)) {
      if (form.kind !== 'plain') {
        continue;
      }
      const listed = form.sections.flatMap((section) => section.keys);
      assert.deepEqual(listed.toSorted(), Object.keys(form.fields).toSorted(), form.id);
    }
  }
});

test('a card with a key outside the contract is unsupported', () => {
  const slider = DESCRIPTIONS['custom:mnml-slider-card'];
  assert.ok(slider);
  assert.throws(
    () =>
      checkValue(slider, {
        type: 'custom:mnml-slider-card',
        entity: 'light.a',
        slider: 'brightness',
        tap_action: {},
      }),
    /tap_action is not a key the editor knows/,
  );
});

test("the report card's colours take only the colours of the contract", () => {
  const report = DESCRIPTIONS['custom:mnml-report-card'];
  assert.ok(report);
  checkValue(report, {
    type: 'custom:mnml-report-card',
    entity: 'sensor.report',
    colors: { warnings: 'orange' },
  });
  assert.throws(
    () =>
      checkValue(report, {
        type: 'custom:mnml-report-card',
        entity: 'sensor.report',
        colors: { warnings: 'purple' },
      }),
    /colors is not a mapping of words to one of red, orange, amber, blue/,
  );
});
