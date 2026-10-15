import assert from 'node:assert/strict';

import { afterEach, test } from 'vitest';

import { rightToLeft } from './direction.ts';

afterEach(() => {
  document.documentElement.removeAttribute('dir');
  document.body.replaceChildren();
});

function nested(): { host: HTMLElement; inner: HTMLElement } {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  const inner = document.createElement('span');
  root.append(inner);
  document.body.append(host);
  return { host, inner };
}

test('the reading direction is the nearest dir, read through shadow roots up to the page', () => {
  const { host, inner } = nested();
  assert.equal(rightToLeft(inner), false, 'a page with no dir reads left to right');
  document.documentElement.setAttribute('dir', 'rtl');
  assert.equal(rightToLeft(inner), true, "Home Assistant's dir on the page reaches a card");
  host.setAttribute('dir', 'ltr');
  assert.equal(rightToLeft(inner), false, 'a nearer dir wins');
  inner.setAttribute('dir', 'RTL');
  assert.equal(rightToLeft(inner), true);
});

test('an element not yet on the page reads left to right', () => {
  document.documentElement.setAttribute('dir', 'rtl');
  assert.equal(rightToLeft(document.createElement('div')), false);
});
