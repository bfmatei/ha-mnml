import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Templates } from '../contract/templates.ts';

import { expandDashboard } from './dashboard.ts';

const T: Templates = {
  room: {
    slots: { key: { kind: 'text', required: true } },
    card: { type: 'custom:mnml-tile-card', popup: '#[[key]]' },
    popups: [{ hash: '#[[key]]', cards: [] }],
  },
};

test('a dashboard is expanded in place, its pop-ups gathered into the popups card in order', () => {
  const config = {
    views: [
      {
        sections: [
          { cards: [{ type: 'custom:mnml-template-card', template: 'room', slots: { key: 'a' } }] },
          { cards: [{ type: 'custom:mnml-template-card', template: 'room', slots: { key: 'b' } }] },
          { cards: [{ type: 'custom:mnml-popups-card', width: '560px' }] },
        ],
      },
    ],
  };
  assert.deepEqual(expandDashboard(T, config), {
    views: [
      {
        sections: [
          { cards: [{ type: 'custom:mnml-tile-card', popup: '#a' }] },
          { cards: [{ type: 'custom:mnml-tile-card', popup: '#b' }] },
          {
            cards: [
              {
                type: 'custom:mnml-popups-card',
                width: '560px',
                popups: [
                  { hash: '#a', cards: [] },
                  { hash: '#b', cards: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
});
