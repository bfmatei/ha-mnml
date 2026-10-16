import assert from 'node:assert/strict';

import { afterEach, beforeEach, test, vi } from 'vitest';

import { fakeHost } from '../../test/hass.ts';

import { closeButton, dismissable, openOverlay } from './overlay.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

function surface(): HTMLElement {
  const made = document.createElement('div');
  document.body.append(made);
  return made;
}

test('an overlay holds its card while open, and closes after 3 s without a touch, telling its opener', async () => {
  let holds = 0;
  let closed = 0;
  const host = fakeHost({
    hold: () => {
      holds += 1;
      return () => {
        holds -= 1;
      };
    },
  });
  const { overlay } = openOverlay(
    surface(),
    host,
    'options',
    ({ close }) => closeButton('Close', close),
    {
      closed: () => {
        closed += 1;
      },
    },
  );
  assert.equal(overlay.className, 'options');
  assert.equal(holds, 1);
  await vi.advanceTimersByTimeAsync(2999);
  assert.ok(overlay.isConnected);
  await vi.advanceTimersByTimeAsync(1);
  assert.equal(overlay.isConnected, false);
  assert.equal(holds, 0);
  assert.equal(closed, 1);
});

test('a live dismissable leaves its card drawing', () => {
  let holds = 0;
  const host = fakeHost({
    hold: () => {
      holds += 1;
      return () => {
        holds -= 1;
      };
    },
  });
  const close = dismissable(surface(), host, { live: true, closed: () => undefined });
  assert.equal(holds, 0);
  close();
  assert.equal(holds, 0);
});

test('a touch inside restarts the wait and reaches no card under it, and its close button closes it', async () => {
  const under = surface();
  let opened = 0;
  under.addEventListener('click', () => {
    opened += 1;
  });
  const { overlay, schedule } = openOverlay(under, fakeHost(), 'overlay', ({ close }) =>
    closeButton('Close', close),
  );
  await vi.advanceTimersByTimeAsync(2000);
  schedule();
  await vi.advanceTimersByTimeAsync(2000);
  assert.ok(overlay.isConnected, 'the wait started again');
  overlay.click();
  assert.equal(opened, 0);
  overlay.querySelector<HTMLElement>('[aria-label="Close"]')?.click();
  assert.equal(overlay.isConnected, false);
});
