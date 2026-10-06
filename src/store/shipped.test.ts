import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Templates } from '../contract/templates.ts';

import { createShipped } from './shipped.ts';

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const card = (title: string): Templates[string] => ({
  card: { type: 'custom:mnml-heading-card', title, icon: 'mdi:home' },
});
const OWNER = { room: 'room', 'room-popup': 'room', car: 'car' };
const FAMILIES: Record<string, Templates> = {
  room: { room: card('Room'), 'room-popup': card('Room pop-up') },
  car: { car: card('Car') },
};

function counting(fail: ReadonlySet<string> = new Set()): {
  calls: string[];
  load: (family: string) => Promise<Templates>;
} {
  const calls: string[] = [];
  return {
    calls,
    load: (family) => {
      calls.push(family);
      return fail.has(family)
        ? Promise.reject(new Error(`mnml-cards-${family}.json: 404 Not Found`))
        : Promise.resolve(FAMILIES[family] ?? {});
    },
  };
}

test('the common templates are there at once, and a family loads once however many ask', async () => {
  const { calls, load } = counting();
  const shipped = createShipped(load, OWNER, { heading: card('Heading') });
  assert.deepEqual(Object.keys(shipped.templates()), ['heading']);
  assert.deepEqual([...shipped.later()].toSorted(), ['car', 'room', 'room-popup']);
  await Promise.all([shipped.need(['room']), shipped.need(['room-popup'])]);
  assert.deepEqual(calls, ['room']);
  assert.deepEqual(Object.keys(shipped.templates()).toSorted(), ['heading', 'room', 'room-popup']);
  assert.deepEqual([...shipped.later()], ['car']);
});

test('the families of several names load together', async () => {
  const { calls, load } = counting();
  const shipped = createShipped(load, OWNER, {});
  const done = shipped.need(['room', 'car']);
  assert.deepEqual(calls.toSorted(), ['car', 'room']);
  await done;
  assert.deepEqual([...shipped.later()], []);
});

test('a family that fails stays failed, says why, and is not fetched again', async () => {
  const { calls, load } = counting(new Set(['car']));
  const shipped = createShipped(load, OWNER, {});
  await shipped.need(['car']);
  assert.equal(
    shipped.failure(['car']),
    'mnml: the shipped templates could not be loaded: mnml-cards-car.json: 404 Not Found',
  );
  assert.equal(shipped.failure(['room']), undefined);
  await shipped.need(['car']);
  await settle();
  assert.deepEqual(calls, ['car']);
  assert.ok(shipped.later().has('car'), 'a failed family is still not loaded');
});

test('a name no family owns needs nothing', async () => {
  const { calls, load } = counting();
  const shipped = createShipped(load, OWNER, {});
  await shipped.need(['nope']);
  assert.deepEqual(calls, []);
});

test('a family that fails is reported on the console once', async () => {
  const { load } = counting(new Set(['car']));
  const shipped = createShipped(load, OWNER, {});
  const reported: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    reported.push(args[0]);
  };
  try {
    await shipped.need(['car']);
    await shipped.need(['car']);
  } finally {
    console.error = original;
  }
  assert.deepEqual(reported, [
    'mnml: the shipped templates could not be loaded: mnml-cards-car.json: 404 Not Found',
  ]);
});

test('a family that failed for a passing reason is fetched again after 30 seconds, and a missing one is not', async () => {
  let time = 0;
  const calls: string[] = [];
  const shipped = createShipped(
    (family) => {
      calls.push(family);
      return family === 'car'
        ? Promise.reject(
            Object.assign(new Error('mnml-cards-car.json: 404 Not Found'), { status: 404 }),
          )
        : Promise.reject(new Error('mnml-cards-room.json: Failed to fetch'));
    },
    OWNER,
    {},
    () => time,
  );
  const original = console.error;
  console.error = (): void => undefined;
  try {
    await shipped.need(['room', 'car']);
    time = 29_000;
    assert.match(shipped.failure(['room']) ?? '', /Failed to fetch/);
    time = 31_000;
    assert.equal(shipped.failure(['room']), undefined, 'room may be fetched again');
    assert.match(shipped.failure(['car']) ?? '', /404 Not Found/, 'a missing file stays failed');
    await shipped.need(['room', 'car']);
  } finally {
    console.error = original;
  }
  assert.deepEqual(calls.toSorted(), ['car', 'room', 'room']);
});
