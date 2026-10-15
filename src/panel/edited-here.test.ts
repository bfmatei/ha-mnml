import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Templates, Value, WrittenTemplate } from '../contract/templates.ts';

import { withEditedHere } from './edited-here.ts';
import { outlinePart } from './outline.ts';
import type { Path } from './tree.ts';

const TEMPLATES: Templates = {
  badge: {
    slots: { entity: { kind: 'entity', required: true } },
    card: { type: 'custom:mnml-tile-card', entity: '[[entity]]', popup: '#badge' },
    popups: [{ id: 'badge', hash: '#badge', card: { type: 'tile', entity: '[[entity]]' } }],
  },
  pair: {
    card: [
      { id: 'one', type: 'a' },
      { id: 'two', type: 'b' },
    ],
  },
};

function editedHere(template: WrittenTemplate, path: Path, use: Record<string, Value>) {
  return withEditedHere(template, [outlinePart(use, path, undefined, 0)], TEMPLATES);
}

test('a single part edited here stays a single part, and brings the pop-ups of its template', () => {
  const use = { template: 'badge', slots: { entity: 'light.a' } };
  const template: WrittenTemplate = {
    card: { type: 'custom:mnml-heading-card', header: use },
    popups: [{ id: 'my-badge', hash: '#other' }],
  };
  const next = editedHere(template, ['card', 'header'], use);
  assert.deepEqual(next?.card, {
    type: 'custom:mnml-heading-card',
    header: { type: 'custom:mnml-tile-card', entity: 'light.a', popup: '#badge' },
  });
  assert.deepEqual(next.popups, [
    { id: 'my-badge', hash: '#other' },
    { id: 'my-badge-2', hash: '#badge', card: { type: 'tile', entity: 'light.a' } },
  ]);
});

test('a list item edited here as several parts takes their place in the list, each id its own', () => {
  const use = { id: 'both', template: 'pair' };
  const template: WrittenTemplate = {
    card: { type: 'vertical-stack', cards: [{ id: 'first', type: 'x' }, use] },
  };
  const next = editedHere(template, ['card', 'cards', '#both'], use);
  assert.deepEqual(next?.card, {
    type: 'vertical-stack',
    cards: [
      { id: 'first', type: 'x' },
      { id: 'my-both-one', type: 'a' },
      { id: 'my-both-two', type: 'b' },
    ],
  });
  assert.equal(next.popups, undefined, 'a template without pop-ups adds none');
});
