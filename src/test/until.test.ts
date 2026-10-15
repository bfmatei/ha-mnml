import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { until } from './until.ts';

test('until() waits as long as the work takes, and no longer', async () => {
  let done = false;
  let looks = 0;
  const work = async (left: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (left > 1) {
      await work(left - 1);
    } else {
      done = true;
    }
  };
  void work(20);
  await until(() => {
    looks += 1;
    return done;
  });
  assert.equal(done, true);
  assert.ok(looks > 1, 'it looked more than once');
});

test('until() lets the work already queued run before it first looks', async () => {
  let done = false;
  const seen: boolean[] = [];
  void Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => {
      done = true;
    });
  await until(() => {
    seen.push(done);
    return true;
  });
  assert.deepEqual(seen, [true]);
});

test('until() keeps waiting while the clock is faked', async () => {
  vi.useFakeTimers();
  try {
    let done = false;
    void Promise.resolve().then(() => {
      done = true;
    });
    await until(() => done);
    assert.equal(done, true);
  } finally {
    vi.useRealTimers();
  }
});

test('until() fails, naming what it waited for, when it never comes', async () => {
  await assert.rejects(
    until(() => false, 'the dialog'),
    /the dialog never came/,
  );
});
