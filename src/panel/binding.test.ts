import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';

import {
  automateField,
  dataFields,
  findsItself,
  fixField,
  resolvedEntity,
  setPreview,
  slotIn,
  slotLabel,
} from './binding.ts';
import { chainTo, partOf } from './outline.ts';

const TEMPLATE: Template = {
  slots: {
    temperature: {
      kind: 'entity',
      label: 'Temperature sensor',
      discover: { domain: 'sensor', device_class: 'temperature' },
    },
    lights: { kind: 'object', fields: { group: { kind: 'entity' } } },
  },
  card: {
    type: 'custom:mnml-tile-card',
    name: 'Hall',
    icon: 'mdi:door',
    popup: '#hall',
    state: [
      { id: 'temperature', entity: '[[temperature]]', icon: true },
      { id: 'door', entity: 'binary_sensor.door' },
    ],
    chips: [{ id: 'power', template: 'power', slots: { entity: '[[lights.group]]' } }],
  },
  example: { temperature: 'sensor.hall_temperature' },
};

const TEMPLATES = {
  power: {
    slots: { entity: { kind: 'entity' as const }, color: { kind: 'text' as const } },
    card: {},
  },
};

function part(key: string) {
  const card = TEMPLATE.card;
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  const found = chainTo(partOf(card, ['card'], undefined, 0), key).at(-1);
  assert.ok(found, key);
  return found;
}

test('a slot named whole in a value is the slot, and nothing else is', () => {
  assert.equal(slotIn('[[temperature]]'), 'temperature');
  assert.equal(slotIn('[[lights.group]]'), 'lights.group');
  assert.equal(slotIn('sensor.a'), undefined);
  assert.equal(slotIn('a [[b]] c'), undefined);
});

test('a slot is named by its label, or else by its name, and says whether it finds itself', () => {
  assert.equal(slotLabel(TEMPLATE, 'temperature'), 'Temperature sensor');
  assert.equal(slotLabel(TEMPLATE, 'lights.group'), 'Lights group');
  assert.equal(findsItself(TEMPLATE, 'temperature'), true);
  assert.equal(findsItself(TEMPLATE, 'lights.group'), false);
});

test('the entity fields of a part are its data, bound or not', () => {
  const bound = dataFields(part('card/state/#temperature'), TEMPLATE, TEMPLATES);
  assert.deepEqual(
    bound.map(({ key, slot, label }) => [key, slot, label]),
    [['entity', 'temperature', 'Temperature sensor']],
  );
  const fixed = dataFields(part('card/state/#door'), TEMPLATE, TEMPLATES);
  assert.deepEqual(
    fixed.map(({ key, slot, value }) => [key, slot, value]),
    [['entity', undefined, 'binary_sensor.door']],
  );
});

test("a fragment's entity slots are its data, in its slots", () => {
  const [field] = dataFields(part('card/chips/#power'), TEMPLATE, TEMPLATES);
  assert.deepEqual(
    [field?.key, field?.slot, field?.holder.join('/')],
    ['entity', 'lights.group', 'card/chips/#power/slots'],
  );
});

test('what a bound field shows is the slot as the preview fills it', () => {
  const [field] = dataFields(part('card/state/#temperature'), TEMPLATE, TEMPLATES);
  assert.ok(field);
  assert.equal(resolvedEntity({ temperature: 'sensor.x' }, field), 'sensor.x');
  assert.equal(resolvedEntity({}, field), undefined);
});

test('a preview pick lands in the example, nested for a slot of an object', () => {
  assert.deepEqual(setPreview(TEMPLATE, 'temperature', 'sensor.y').example, {
    temperature: 'sensor.y',
  });
  assert.deepEqual(setPreview(TEMPLATE, 'lights.group', 'light.a').example, {
    temperature: 'sensor.hall_temperature',
    lights: { group: 'light.a' },
  });
});

test('always this one writes the entity in place of the slot', () => {
  const [field] = dataFields(part('card/state/#temperature'), TEMPLATE, TEMPLATES);
  assert.ok(field);
  const fixed = fixField(TEMPLATE, field, 'sensor.hall_temperature');
  assert.match(JSON.stringify(fixed.card), /"entity":"sensor\.hall_temperature"/);
  assert.ok(!JSON.stringify(fixed.card).includes('[[temperature]]'));
});

test('finding it in every room makes a slot with a rule from the entity, and binds the field to it', () => {
  const [field] = dataFields(part('card/state/#door'), TEMPLATE, TEMPLATES);
  assert.ok(field);
  const hass = {
    states: { 'binary_sensor.door': { attributes: { device_class: 'door' } } },
  } as never;
  const made = automateField(TEMPLATE, field, 'binary_sensor.door', hass);
  assert.deepEqual(made.slots?.['door'], {
    kind: 'entity',
    label: 'Door',
    discover: { domain: 'binary_sensor', device_class: 'door' },
  });
  assert.equal(made.example?.['door'], 'binary_sensor.door');
  assert.match(JSON.stringify(made.card), /"entity":"\[\[door\]\]"/);
  const again = dataFields(
    (() => {
      const card = made.card;
      assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
      const found = chainTo(partOf(card, ['card'], undefined, 0), 'card/state/#door').at(-1);
      assert.ok(found);
      return found;
    })(),
    made,
    TEMPLATES,
  );
  assert.equal(again[0]?.slot, 'door');
});
