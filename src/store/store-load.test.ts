import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { HassConnection } from '../ha/hass.ts';

import { resolvedTemplates, sharedTemplates } from './store.ts';

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const GARDEN = { card: { type: 'custom:mnml-heading-card', title: 'Garden', icon: 'mdi:flower' } };

function refusing(code: string): HassConnection {
  return {
    sendMessagePromise: () => Promise.reject({ code: 'unknown_command' }),
    subscribeMessage: () => Promise.reject({ code, message: 'MNML is not loaded' }),
    subscribeEvents: () => Promise.resolve(() => Promise.resolve()),
    addEventListener: () => {},
  } as unknown as HassConnection;
}

test('a store the integration could not read is an empty one, so the cards draw the shipped templates', async () => {
  const connection = refusing('not_loaded');
  sharedTemplates(connection);
  await settle();
  assert.deepEqual(sharedTemplates(connection), { status: 'ready', own: {}, changes: {} });
});

test('the templates are worked out once for the same store and shipped templates', () => {
  const shared = { status: 'ready' as const, own: { garden: GARDEN }, changes: {} };
  const shipped = { garden: GARDEN };
  assert.equal(resolvedTemplates(shared, shipped), resolvedTemplates(shared, shipped));
  assert.notEqual(resolvedTemplates(shared, shipped), resolvedTemplates(shared, { ...shipped }));
});
