import assert from 'node:assert/strict';

import { html, nothing, render } from 'lit';
import { afterEach, test, vi } from 'vitest';

import { fakeHass } from '../test/hass.ts';
import { text } from '../test/render.ts';

import { stateLine } from './format.ts';
import type { HomeAssistant } from './hass.ts';

function timer(state: string, attributes: Record<string, unknown>): HomeAssistant {
  return fakeHass({
    states: { 'timer.tea': { state, attributes } },
    formatEntityState: (stateObj) =>
      stateObj.state.charAt(0).toUpperCase() + stateObj.state.slice(1),
  });
}

function line(hass: HomeAssistant): HTMLElement {
  const box = document.createElement('div');
  document.body.append(box);
  render(html`${stateLine(hass, 'timer.tea', [{ remaining: true }])}`, box);
  return box;
}

afterEach(() => {
  vi.useRealTimers();
});

test('the time left on an active timer counts down from finishes_at, a second at a time, to 0:00', async () => {
  vi.useFakeTimers({ now: new Date('2026-10-14T12:00:00.000Z') });
  const box = line(
    timer('active', {
      duration: '0:03:00',
      remaining: '0:03:00',
      finishes_at: '2026-10-14T12:01:05.000Z',
    }),
  );
  assert.equal(text(box), '1:05');
  await vi.advanceTimersByTimeAsync(1_000);
  assert.equal(text(box), '1:04');
  await vi.advanceTimersByTimeAsync(64_000);
  assert.equal(text(box), '0:00');
  assert.equal(vi.getTimerCount(), 0, 'nothing ticks once the time is up');
  box.remove();
});

test('a countdown that leaves the page stops ticking', async () => {
  vi.useFakeTimers({ now: new Date('2026-10-14T12:00:00.000Z') });
  const box = line(timer('active', { finishes_at: '2026-10-14T13:00:00.000Z' }));
  assert.equal(text(box), '1:00:00');
  assert.equal(vi.getTimerCount(), 1);
  render(nothing, box);
  assert.equal(vi.getTimerCount(), 0);
  box.remove();
});

test("a paused timer shows the time it has left, and an idle one Home Assistant's word for its state", () => {
  assert.equal(text(line(timer('paused', { remaining: '1:02:03' }))), '1:02:03');
  assert.equal(text(line(timer('paused', { remaining: '0:00:45' }))), '0:45');
  assert.equal(text(line(timer('paused', { remaining: '1 day, 0:00:05' }))), '24:00:05');
  assert.equal(text(line(timer('idle', { remaining: '0:03:00' }))), 'Idle');
});
