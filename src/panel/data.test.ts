import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Templates } from '../contract/templates.ts';
import { baseOf } from '../templates/changes.ts';

import { describe, draftOf, rowsOf, usesOf } from './data.ts';
import type { Kept } from './data.ts';

const ROOM = {
  description: 'A room.',
  card: { type: 'custom:mnml-tile-card', 'chips?': [{ id: 'lock', type: 'toggle', color: 'red' }] },
};
const SHIPPED: Templates = {
  room: ROOM,
  garden: { description: 'A garden.', card: { type: 'x' } },
};
const OWNER = { room: 'room', garden: 'garden' };
const lock = ['card', 'chips?', '#lock'];

test('a template is used on the cards that name it, on whichever dashboards they are', () => {
  const uses = usesOf([
    {
      path: null,
      title: 'Overview',
      storage: true,
      config: {
        views: [
          { cards: [{ type: 'custom:mnml-template-card', template: 'room' }] },
          {
            cards: [
              {
                type: 'custom:mnml-popups-card',
                popups: [{ cards: [{ type: 'custom:mnml-template-card', template: 'room' }] }],
              },
            ],
          },
        ],
      },
    },
    {
      path: 'kiosk',
      title: 'Kiosk',
      storage: true,
      config: { views: [{ cards: [{ type: 'custom:mnml-template-card', template: 'room' }] }] },
    },
  ]);
  assert.deepEqual(uses.get('room'), { cards: 3, dashboards: ['Overview', 'Kiosk'] });
  assert.equal(uses.get('garden'), undefined);
});

test('the library lists shipped, customised, own and conflicting templates, with their family and use', () => {
  const recolour = { op: 'set', path: lock, key: 'color', value: 'amber', base: '' } as const;
  const kept: Kept = {
    own: { hall: { description: 'Mine.', card: { type: 'y' } } },
    changes: {
      room: [{ ...recolour, base: baseOf(ROOM, recolour) }],
      garden: [{ op: 'set', path: ['card'], key: 'x', value: 1, base: 'stale' }],
    },
  };
  const rows = rowsOf(
    SHIPPED,
    OWNER,
    kept,
    new Map([['room', { cards: 9, dashboards: ['A', 'B'] }]]),
  );
  assert.deepEqual(
    rows.map((row) => [row.name, row.status, row.family]),
    [
      ['garden', 'conflict', 'garden'],
      ['hall', 'own', undefined],
      ['room', 'customised', 'room'],
    ],
  );
  const room = rows.find((row) => row.name === 'room');
  assert.ok(room);
  assert.equal(describe(room), 'customised, 1 change • on 9 cards, 2 dashboards');
});

test('a customised template opens with its changes laid over, and its conflicts named', () => {
  const kept: Kept = {
    own: {},
    changes: {
      room: [
        { op: 'set', path: lock, key: 'color', value: 'amber', base: 'from-an-older-release' },
      ],
    },
  };
  const draft = draftOf('room', SHIPPED, kept);
  assert.ok(draft);
  assert.equal(draft.shipped, ROOM);
  assert.deepEqual(
    draft.conflicts.map((conflict) => conflict.reason),
    ['changed'],
  );
  assert.equal(
    (draft.template.card as { 'chips?': { color: string }[] })['chips?'][0]?.color,
    'amber',
  );
  assert.equal(draftOf('nothing', SHIPPED, kept), undefined);
});
