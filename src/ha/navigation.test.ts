import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

interface Entry {
  state: unknown;
  url: string;
}

const ROOT = '/lovelace/home';
let entries: Entry[] = [];
let index = 0;

function current(): Entry {
  const entry = entries[index];
  assert.ok(entry, 'the history has a current entry');
  return entry;
}

function resolve(url: string): string {
  return url.startsWith('#') ? `${current().url.split('#')[0]}${url}` : url;
}

function reset(first: Entry): void {
  entries = [first];
  index = 0;
}

vi.stubGlobal('location', {
  get hash(): string {
    const [, fragment] = current().url.split('#');
    return fragment === undefined || fragment === '' ? '' : `#${fragment}`;
  },
  get href(): string {
    return current().url;
  },
});
vi.stubGlobal('history', {
  get state(): unknown {
    return current().state;
  },
  pushState(state: unknown, _title: string, url: string): void {
    entries = [...entries.slice(0, index + 1), { state, url: resolve(url) }];
    index = entries.length - 1;
  },
  replaceState(state: unknown, _title: string, url: string): void {
    entries[index] = { state, url: resolve(url) };
  },
  go(delta: number): void {
    index = Math.max(0, Math.min(entries.length - 1, index + delta));
  },
  back(): void {
    index = Math.max(0, index - 1);
  },
});

const { back, closePopup, navigate } = await import('./navigation.ts');

test('closing a pop-up opened from the view returns to the view entry, adding none', () => {
  reset({ state: { root: true }, url: ROOT });
  navigate('#kitchen');
  closePopup();
  assert.equal(index, 0);
  assert.deepEqual(current(), { state: { root: true }, url: ROOT });
  navigate('#office');
  assert.equal(entries.length, 2, 'the next pop-up replaces the closed one rather than stacking');
});

test('back steps one pop-up up, and close leaves them all in one step', () => {
  reset({ state: { root: true }, url: ROOT });
  navigate('#kitchen');
  navigate('#kitchen-lights');
  back();
  assert.equal(location.hash, '#kitchen');
  navigate('#kitchen-lights');
  closePopup();
  assert.equal(index, 0);
  assert.equal(location.hash, '');
});

test('back from a pop-up opened from the view closes it', () => {
  reset({ state: { root: true }, url: ROOT });
  navigate('#kitchen');
  back();
  assert.equal(index, 0);
  assert.equal(location.hash, '');
});

test('a pop-up nothing pushed, such as a deep link, closes by replacing its entry', () => {
  reset({ state: null, url: `${ROOT}#kitchen` });
  closePopup();
  assert.deepEqual(entries, [{ state: null, url: ROOT }]);
});
