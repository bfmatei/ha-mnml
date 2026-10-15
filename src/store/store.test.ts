import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { HassConnection } from '../ha/hass.ts';
import { nodeHash } from '../templates/changes.ts';
import { expand } from '../templates/expand.ts';
import { fakeStore } from '../test/hass.ts';
import { until } from '../test/until.ts';

import { createStore, resolvedTemplates } from './store.ts';
import type { SharedState } from './store.ts';

const on = (store: ReturnType<typeof fakeStore>): HassConnection => store.hass.connection;
const loaded = (
  read: (connection: HassConnection) => SharedState,
  store: ReturnType<typeof fakeStore>,
): Promise<void> => until(() => read(on(store)).status !== 'waiting', 'the store');
const ownOf = (state: SharedState): string[] =>
  state.status === 'ready' ? Object.keys(state.own) : [];
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
  const { knownShared } = createStore();
  assert.deepEqual(knownShared(), { status: 'waiting' });
});

test('the store is subscribed once per connection, and its templates come with each save', async () => {
  const { sharedTemplates, knownShared, onShared } = createStore();
  const store = fakeStore();
  store.kept = {
    hall: { kind: 'own', template: GARDEN },
    room: { kind: 'changes', changes: [removeLock] },
  };
  assert.deepEqual(sharedTemplates(on(store)), { status: 'waiting' });
  sharedTemplates(on(store));
  await loaded(sharedTemplates, store);
  assert.equal(store.subscribed.length, 1);
  const shared = sharedTemplates(on(store));
  assert.deepEqual(ownOf(shared), ['hall']);
  assert.deepEqual(shared.status === 'ready' ? Object.keys(shared.changes) : [], ['room']);
  assert.equal(knownShared(), shared);
  let told = 0;
  const stop = onShared(() => {
    told += 1;
  });
  store.keep({});
  stop();
  assert.equal(told, 1);
  assert.deepEqual(sharedTemplates(on(store)), {
    status: 'ready',
    own: {},
    written: {},
    changes: {},
  });
});

test('a save that changes nothing tells no one, and the state stays the one the cards hold', async () => {
  const { sharedTemplates, onShared } = createStore();
  const store = fakeStore();
  store.kept = { hall: { kind: 'own', template: GARDEN } };
  await loaded(sharedTemplates, store);
  const before = sharedTemplates(on(store));
  let told = 0;
  const stop = onShared(() => {
    told += 1;
  });
  store.keep({ hall: { kind: 'own', template: structuredClone(GARDEN) } });
  store.keep({ hall: { kind: 'own', template: GARDEN } });
  stop();
  assert.equal(told, 0);
  assert.equal(sharedTemplates(on(store)), before);
  const shipped = { garden: GARDEN };
  assert.equal(
    resolvedTemplates(before, shipped),
    resolvedTemplates(sharedTemplates(on(store)), shipped),
  );
});

test("a home without MNML's store, or one where MNML has not loaded, has an empty one, not a failure", async () => {
  const { sharedTemplates } = createStore();
  const store = fakeStore();
  const unloaded = fakeStore();
  unloaded.refuse = { code: 'not_loaded', message: 'MNML is not loaded' };
  await loaded(sharedTemplates, store);
  await loaded(sharedTemplates, unloaded);
  const empty = { status: 'ready', own: {}, written: {}, changes: {} };
  assert.deepEqual(sharedTemplates(on(store)), empty);
  assert.deepEqual(sharedTemplates(on(unloaded)), empty);
});

test('a subscription refused for another reason is a failure in words', async () => {
  const { sharedTemplates } = createStore();
  const store = fakeStore();
  store.refuse = { code: 'unauthorized', message: 'Unauthorized' };
  await loaded(sharedTemplates, store);
  assert.deepEqual(sharedTemplates(on(store)), {
    status: 'failed',
    error: 'mnml: the templates MNML keeps could not be read: Unauthorized',
  });
});

test('two connections keep their own store', async () => {
  const { sharedTemplates } = createStore();
  const one = fakeStore();
  const two = fakeStore();
  one.kept = { hall: { kind: 'own', template: GARDEN } };
  two.kept = { patio: { kind: 'own', template: TERRACE } };
  sharedTemplates(on(one));
  sharedTemplates(on(two));
  await loaded(sharedTemplates, one);
  await loaded(sharedTemplates, two);
  assert.deepEqual(ownOf(sharedTemplates(on(one))), ['hall']);
  assert.deepEqual(ownOf(sharedTemplates(on(two))), ['patio']);
});

test('a listener that throws does not keep the others from hearing, and is reported on the console', async () => {
  const { sharedTemplates, onShared } = createStore();
  const store = fakeStore();
  store.kept = {};
  await loaded(sharedTemplates, store);
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
  const { sharedTemplates } = createStore();
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
    await loaded(sharedTemplates, store);
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

test("a template of the home's own that names a shipped shape is read with it resolved, and kept as written for the panel; one naming an unknown shape is kept as written, and reported", async () => {
  const { sharedTemplates } = createStore();
  const store = fakeStore();
  const card = { type: 'custom:mnml-heading-card', title: 'Yard', icon: 'mdi:barn' };
  store.kept = {
    yard: { kind: 'own', template: { slots: { energy: { shape: 'meter' } }, card } },
    shed: { kind: 'own', template: { slots: { energy: { shape: 'metre' } }, card } },
  };
  const reported: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    reported.push(args[0]);
  };
  try {
    await loaded(sharedTemplates, store);
  } finally {
    console.error = original;
  }
  const ready = sharedTemplates(on(store));
  assert.ok(ready.status === 'ready');
  const energy = ready.own['yard']?.slots?.['energy'];
  assert.equal(energy?.kind, 'object');
  assert.deepEqual(Object.keys(energy?.fields ?? {}), ['power', 'today', 'total']);
  assert.deepEqual(ready.own['shed']?.slots, { energy: { shape: 'metre' } });
  assert.deepEqual(ready.written['yard']?.slots, { energy: { shape: 'meter' } });
  assert.deepEqual(reported, [
    'mnml: shed: the slot energy uses the shape metre, which is not known',
  ]);
});

test("one malformed template of the home's own leaves the others served, and only an expansion of it fails, naming it", async () => {
  const { sharedTemplates } = createStore();
  const store = fakeStore();
  const card = { type: 'custom:mnml-heading-card', title: 'Yard', icon: 'mdi:barn' };
  let deep: unknown = { shape: 'meter' };
  for (let level = 0; level < 20_000; level += 1) {
    deep = { kind: 'object', fields: { inner: deep } };
  }
  store.kept = {
    hall: { kind: 'own', template: GARDEN },
    typo: { kind: 'own', template: { slots: { title: null }, card } },
    yard: { kind: 'own', template: { slots: { energy: { shape: 'meter' } }, card } },
    deep: { kind: 'own', template: { slots: { energy: deep }, card } },
  };
  const reported: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    reported.push(args[0]);
  };
  try {
    await loaded(sharedTemplates, store);
  } finally {
    console.error = original;
  }
  const ready = sharedTemplates(on(store));
  assert.ok(ready.status === 'ready');
  assert.deepEqual(Object.keys(ready.own), ['hall', 'typo', 'yard', 'deep']);
  assert.deepEqual(Object.keys(ready.written), ['hall', 'typo', 'yard', 'deep']);
  assert.equal(ready.own['yard']?.slots?.['energy']?.kind, 'object');
  const all = resolvedTemplates(ready, {});
  assert.deepEqual(expand(all, { template: 'hall' }).card, GARDEN.card);
  assert.deepEqual(expand(all, { template: 'yard' }).card, card);
  assert.throws(
    () => expand(all, { template: 'typo' }),
    /^Error: typo: the slot title has the kind none, which is none of /,
  );
  assert.throws(() => expand(all, { template: 'deep' }));
  assert.equal(reported.length, 1);
  assert.match(String(reported[0]), /^mnml: deep: /);
});

test('the store is subscribed without the automatic resubscribe, and again after each reconnect', async () => {
  const { sharedTemplates } = createStore();
  const store = fakeStore();
  store.kept = { hall: { kind: 'own', template: GARDEN } };
  await loaded(sharedTemplates, store);
  store.kept = { patio: { kind: 'own', template: TERRACE } };
  store.reconnect();
  await until(() => ownOf(sharedTemplates(on(store))).includes('patio'), 'the new set');
  assert.deepEqual(ownOf(sharedTemplates(on(store))), ['patio']);
  assert.deepEqual(store.subscribed, [{ resubscribe: false }, { resubscribe: false }]);
});

test('after a reconnect that comes before MNML has loaded again, the last set stays and the subscription is tried again', async () => {
  const { sharedTemplates } = createStore();
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  try {
    const store = fakeStore();
    store.kept = { hall: { kind: 'own', template: GARDEN } };
    await loaded(sharedTemplates, store);
    store.kept = undefined;
    store.reconnect();
    await until(() => vi.getTimerCount() === 1, 'the retry');
    assert.deepEqual(ownOf(sharedTemplates(on(store))), ['hall']);
    store.kept = { patio: { kind: 'own', template: TERRACE } };
    vi.advanceTimersByTime(5000);
    await until(() => ownOf(sharedTemplates(on(store))).includes('patio'), 'the new set');
  } finally {
    vi.useRealTimers();
  }
});

test('a home that never had the store does not try it again after a reconnect', async () => {
  const { sharedTemplates } = createStore();
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  try {
    const store = fakeStore();
    await loaded(sharedTemplates, store);
    store.reconnect();
    await vi.advanceTimersByTimeAsync(60_000);
    assert.equal(store.subscribed.length, 2);
  } finally {
    vi.useRealTimers();
  }
});

test("a template of the home wins, then a shipped one with the home's changes, then the shipped one", () => {
  const own = { card: { type: 'custom:mnml-heading-card', title: 'Mine', icon: 'mdi:home' } };
  const resolved = resolvedTemplates(
    {
      status: 'ready',
      own: { hall: own },
      written: { hall: own },
      changes: { room: [removeLock] },
    },
    { room: ROOM, hall: GARDEN, garden: GARDEN },
  );
  assert.equal(resolved['hall'], own);
  assert.equal(resolved['garden'], GARDEN);
  assert.deepEqual(resolved['room'], {
    card: { type: 'custom:mnml-tile-card', 'chips?': [{ id: 'window', type: 'indicator' }] },
  });
  assert.equal(resolvedTemplates({ status: 'waiting' }, { garden: GARDEN })['garden'], GARDEN);
});

test('the templates are worked out once for the same store and shipped templates', () => {
  const shared = {
    status: 'ready' as const,
    own: { garden: GARDEN },
    written: { garden: GARDEN },
    changes: {},
  };
  const shipped = { garden: GARDEN };
  assert.equal(resolvedTemplates(shared, shipped), resolvedTemplates(shared, shipped));
  assert.notEqual(resolvedTemplates(shared, shipped), resolvedTemplates(shared, { ...shipped }));
});
