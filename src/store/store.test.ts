import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { HassConnection } from '../ha/hass.ts';
import { nodeHash } from '../templates/changes.ts';
import { fakeStore } from '../test/fake-hass.ts';

import { knownShared, onShared, resolvedTemplates, sharedTemplates } from './store.ts';

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const on = (store: { hass: { connection: unknown } }): HassConnection =>
  store.hass.connection as HassConnection;
const GARDEN = { card: { type: 'custom:mnml-heading-card', title: 'Garden', icon: 'mdi:flower' } };
const TERRACE = { card: { type: 'custom:mnml-heading-card', title: 'Terrace', icon: 'mdi:table' } };
const ROOM = {
  card: {
    type: 'custom:mnml-tile-card',
    'chips?': [
      { id: 'window', type: 'indicator' },
      { id: 'lock', type: 'toggle' },
    ],
  },
};
const lock = ['card', 'chips?', '#lock'];
const removeLock = { op: 'remove', path: lock, base: nodeHash(ROOM.card['chips?'][1]) } as const;

test('before any connection the store is waiting', () => {
  assert.deepEqual(knownShared(), { status: 'waiting' });
});

test('the store is subscribed once per connection, and its templates come with each save', async () => {
  const store = fakeStore();
  store.kept = {
    hall: { kind: 'own', template: GARDEN },
    room: { kind: 'changes', changes: [removeLock] },
  };
  assert.deepEqual(sharedTemplates(on(store)), { status: 'waiting' });
  sharedTemplates(on(store));
  await settle();
  assert.equal(store.subscribed.length, 1);
  const ready = sharedTemplates(on(store));
  assert.deepEqual(ready.status === 'ready' ? Object.keys(ready.own) : [], ['hall']);
  assert.deepEqual(ready.status === 'ready' ? Object.keys(ready.changes) : [], ['room']);
  assert.equal(knownShared(), ready);
  let told = 0;
  const stop = onShared(() => {
    told += 1;
  });
  store.keep({});
  stop();
  assert.equal(told, 1);
  assert.deepEqual(sharedTemplates(on(store)), { status: 'ready', own: {}, changes: {} });
});

test("a home without MNML's store has an empty one, not a failure", async () => {
  const store = fakeStore();
  sharedTemplates(on(store));
  await settle();
  assert.deepEqual(sharedTemplates(on(store)), { status: 'ready', own: {}, changes: {} });
});

test('a subscription refused for another reason is a failure in words', async () => {
  const store = fakeStore();
  store.refuse = { code: 'unauthorized', message: 'Unauthorized' };
  sharedTemplates(on(store));
  await settle();
  assert.deepEqual(sharedTemplates(on(store)), {
    status: 'failed',
    error: 'mnml: the templates MNML keeps could not be read: Unauthorized',
  });
});

test('two connections keep their own store', async () => {
  const one = fakeStore();
  const two = fakeStore();
  one.kept = { hall: { kind: 'own', template: GARDEN } };
  two.kept = { patio: { kind: 'own', template: TERRACE } };
  sharedTemplates(on(one));
  sharedTemplates(on(two));
  await settle();
  const first = sharedTemplates(on(one));
  const second = sharedTemplates(on(two));
  assert.deepEqual(first.status === 'ready' ? Object.keys(first.own) : [], ['hall']);
  assert.deepEqual(second.status === 'ready' ? Object.keys(second.own) : [], ['patio']);
});

test('a listener that throws does not keep the others from hearing, and is reported on the console', async () => {
  const store = fakeStore();
  store.kept = {};
  sharedTemplates(on(store));
  await settle();
  const reported: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    reported.push(args[0]);
  };
  let heard = 0;
  const first = onShared(() => {
    throw new Error('a card broke');
  });
  const second = onShared(() => {
    heard += 1;
  });
  try {
    store.keep({ hall: { kind: 'own', template: GARDEN } });
  } finally {
    console.error = original;
    first();
    second();
  }
  assert.equal(heard, 1);
  assert.equal(reported.length, 1);
  assert.match(String(reported[0]), /a card broke/);
});

test('a store entry with one change of the wrong shape is left out whole, and is reported; the rest still draws', async () => {
  const store = fakeStore();
  store.kept = {
    hall: { kind: 'own', template: GARDEN },
    room: { kind: 'changes', changes: [removeLock, { op: 'set', path: ['card'], base: 'x' }] },
  };
  const reported: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    reported.push(args[0]);
  };
  try {
    sharedTemplates(on(store));
    await settle();
  } finally {
    console.error = original;
  }
  const ready = sharedTemplates(on(store));
  assert.deepEqual(ready.status === 'ready' ? Object.keys(ready.own) : [], ['hall']);
  assert.deepEqual(ready.status === 'ready' ? ready.changes : undefined, {});
  assert.deepEqual(reported, [
    'mnml: the changes kept for room are not all of a known shape, so room draws as shipped',
  ]);
});

test('the store is subscribed without the automatic resubscribe, and again after each reconnect', async () => {
  const store = fakeStore();
  store.kept = { hall: { kind: 'own', template: GARDEN } };
  sharedTemplates(on(store));
  await settle();
  store.kept = { patio: { kind: 'own', template: TERRACE } };
  store.reconnect();
  await settle();
  const after = sharedTemplates(on(store));
  assert.deepEqual(after.status === 'ready' ? Object.keys(after.own) : [], ['patio']);
  assert.deepEqual(store.subscribed, [{ resubscribe: false }, { resubscribe: false }]);
});

test('after a reconnect that comes before MNML has loaded again, the last set stays and the subscription is tried again', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  try {
    const store = fakeStore();
    store.kept = { hall: { kind: 'own', template: GARDEN } };
    sharedTemplates(on(store));
    await settle();
    store.kept = undefined;
    store.reconnect();
    await settle();
    const waiting = sharedTemplates(on(store));
    assert.deepEqual(waiting.status === 'ready' ? Object.keys(waiting.own) : [], ['hall']);
    store.kept = { patio: { kind: 'own', template: TERRACE } };
    vi.advanceTimersByTime(5000);
    await settle();
    const back = sharedTemplates(on(store));
    assert.deepEqual(back.status === 'ready' ? Object.keys(back.own) : [], ['patio']);
  } finally {
    vi.useRealTimers();
  }
});

test('a home that never had the store does not try it again after a reconnect', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  try {
    const store = fakeStore();
    sharedTemplates(on(store));
    await settle();
    store.reconnect();
    await settle();
    vi.advanceTimersByTime(60_000);
    await settle();
    assert.equal(store.subscribed.length, 2);
  } finally {
    vi.useRealTimers();
  }
});

test("a template of the home wins, then a shipped one with the home's changes, then the shipped one", () => {
  const own = { card: { type: 'custom:mnml-heading-card', title: 'Mine', icon: 'mdi:home' } };
  const resolved = resolvedTemplates(
    { status: 'ready', own: { hall: own }, changes: { room: [removeLock] } },
    { room: ROOM, hall: GARDEN, garden: GARDEN },
  );
  assert.equal(resolved['hall'], own);
  assert.equal(resolved['garden'], GARDEN);
  assert.deepEqual(resolved['room'], {
    card: { type: 'custom:mnml-tile-card', 'chips?': [{ id: 'window', type: 'indicator' }] },
  });
  assert.equal(resolvedTemplates({ status: 'waiting' }, { garden: GARDEN })['garden'], GARDEN);
});
