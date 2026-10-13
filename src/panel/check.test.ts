import assert from 'node:assert/strict';

import { test } from 'vitest';

import '../cards/register.ts';
import type { WrittenTemplate } from '../contract/templates.ts';
import { SHIPPED } from '../templates/shipped.ts';

import { problemOf } from './check.ts';

test('a shipped template, from its example, passes the check before a save', () => {
  const room = SHIPPED['room'];
  assert.ok(room);
  assert.equal(problemOf(SHIPPED, 'room', room), undefined);
});

test('a draft that does not expand with its example is refused with the reason', () => {
  const problem = problemOf(SHIPPED, 'garden', {
    slots: { title: { kind: 'text', required: true } },
    card: { type: 'custom:mnml-heading-card', title: '[[title]]', icon: 'mdi:flower' },
  });
  assert.match(problem ?? '', /^With the example: .*title is required/);
});

test('a draft whose card refuses its own configuration is refused with the card and the reason', () => {
  const problem = problemOf(SHIPPED, 'garden', {
    card: { type: 'custom:mnml-heading-card', title: 'Garden', icon: 'mdi:flower', colour: 'red' },
    example: {},
  });
  assert.match(problem ?? '', /^mnml-heading-card: /);
});

test("a slot's default of another kind than the slot's is refused, in a field too", () => {
  const card = { type: 'custom:mnml-heading-card', title: 'Garden', icon: 'mdi:flower' };
  assert.equal(
    problemOf(SHIPPED, 'garden', { slots: { size: { kind: 'number', default: 'big' } }, card }),
    'the default of size is not of kind number',
  );
  assert.equal(
    problemOf(SHIPPED, 'garden', {
      slots: {
        nozzle: { kind: 'object', fields: { lights: { kind: 'entities', default: 'light.a' } } },
      },
      card,
    }),
    'the default of nozzle.lights is not of kind entities',
  );
});

test('a draft that reads a slot it does not declare is refused, even where another slot gates the reading', () => {
  for (const [name, template] of Object.entries(SHIPPED)) {
    assert.equal(problemOf(SHIPPED, name, template), undefined, name);
  }
  const problem = problemOf(SHIPPED, 'garden', {
    slots: { title: { kind: 'text', required: true }, scenes: { kind: 'entities' } },
    card: {
      type: 'custom:mnml-heading-card',
      title: '[[title]]',
      icon: 'mdi:flower',
      controls: [{ id: 'scene', if: 'scenes', type: 'select', entity: '[[active_scene]]' }],
    },
    example: { title: 'Garden' },
  });
  assert.equal(
    problem,
    'card.controls[0].entity: [[active_scene]] reads a slot the template does not declare',
  );
});

const tailnet = (read: string): WrittenTemplate => ({
  slots: {
    devices: {
      kind: 'objects',
      fields: { update: { kind: 'entity' }, essential: { kind: 'flag' } },
    },
  },
  card: {
    type: 'custom:mnml-tile-card',
    name: 'Tailnet',
    icon: 'mdi:vpn',
    popup: '#tailnet',
    chips: [
      {
        id: 'update',
        if: 'devices.*.update',
        type: 'status',
        name: 'Update',
        icon: 'mdi:package-up',
        rules: [{ id: 'update', entities: [read], color: 'amber', is: ['on'] }],
      },
    ],
  },
  example: { devices: [{ update: 'binary_sensor.router_update', essential: true }] },
});

test('a draft that reads a slot it does not declare through a projection is refused', () => {
  for (const read of [
    '[[devices.*.update]]',
    '[[devices.?essential.update]]',
    '[[devices.!essential.update]]',
  ]) {
    assert.equal(problemOf(SHIPPED, 'tailnet', tailnet(read)), undefined, read);
  }
  for (const read of [
    '[[devicez.*.update]]',
    '[[devicez.?essential.update]]',
    '[[devicez.!essential.update]]',
  ]) {
    assert.equal(
      problemOf(SHIPPED, 'tailnet', tailnet(read)),
      `card.chips[0].rules[0].entities[0]: ${read} reads a slot the template does not declare`,
    );
  }
});

test('two parts of one list with the same id are refused', () => {
  const problem = problemOf(SHIPPED, 'garden', {
    card: {
      type: 'custom:mnml-heading-card',
      title: 'Garden',
      icon: 'mdi:flower',
      controls: [
        { id: 'lock', type: 'toggle', entity: 'lock.a' },
        { id: 'lock', type: 'toggle', entity: 'lock.b' },
      ],
    },
    example: {},
  });
  assert.equal(problem, 'card.controls: two parts share the id lock');
});

test('a draft whose slots name shapes passes the check, and one naming an unknown shape is refused with the reason', () => {
  const card = { type: 'custom:mnml-heading-card', title: '[[energy.power]]', icon: 'mdi:barn' };
  const example = { energy: { power: 'sensor.yard_power' } };
  assert.equal(
    problemOf(SHIPPED, 'yard', {
      slots: { energy: { shape: 'meter', fields: { power: { required: true } } } },
      card,
      example,
    }),
    undefined,
  );
  assert.equal(
    problemOf(SHIPPED, 'yard', { slots: { energy: { shape: 'metre' } }, card, example }),
    'yard: the slot energy uses the shape metre, which is not known',
  );
});
