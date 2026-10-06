import assert from 'node:assert/strict';

import { test } from 'vitest';

import '../cards/register.ts';
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
