import assert from 'node:assert/strict';

import { afterEach, beforeEach, test, vi } from 'vitest';

import { fakeConnection, fakeHass } from '../test/hass.ts';
import { until } from '../test/until.ts';

import type { HomeAssistant } from './hass.ts';
import { subscribeDay } from './history.ts';
import type { Point } from './history.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const HOUR = 3_600_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

interface Stream {
  hass: HomeAssistant;
  push: (message: unknown) => void;
  asked: unknown[];
  stops: () => number;
}

function streamed(): Stream {
  let pushed: ((message: unknown) => void) | undefined;
  const asked: unknown[] = [];
  let stops = 0;
  const hass = fakeHass({
    connection: fakeConnection({
      subscribeMessage: (callback, message) => {
        pushed = callback;
        asked.push(message);
        return Promise.resolve(() => {
          stops += 1;
          return Promise.resolve();
        });
      },
    }),
  });
  return {
    hass,
    push: (message) => {
      pushed?.(message);
    },
    asked,
    stops: () => stops,
  };
}

const at = (hours: number): number => (NOW - hours * HOUR) / 1000;

test("a sensor's day comes from the history stream: its first message whole, the next ones added, a word a gap", () => {
  const { hass, push, asked } = streamed();
  const seen: Point[][] = [];
  subscribeDay(hass, 'sensor.hall_temperature', (points) => {
    seen.push(points);
  });
  assert.deepEqual(asked, [
    {
      type: 'history/stream',
      entity_ids: ['sensor.hall_temperature'],
      start_time: '2026-10-14T12:00:00.000Z',
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    },
  ]);
  push({
    start_time: at(24),
    end_time: at(0),
    states: {
      'sensor.hall_temperature': [
        { s: '20.5', lu: at(25) },
        { s: 'unavailable', lu: at(12) },
        { s: '21', lu: at(6) },
      ],
    },
  });
  push({ states: { 'sensor.hall_temperature': [{ s: '21.5', lu: at(0) }] } });
  assert.deepEqual(seen.at(-1), [
    { at: NOW - 25 * HOUR, value: 20.5 },
    { at: NOW - 12 * HOUR, value: undefined },
    { at: NOW - 6 * HOUR, value: 21 },
    { at: NOW, value: 21.5 },
  ]);
});

test('the points the day leaves behind are dropped, but for the one it starts in', () => {
  const { hass, push } = streamed();
  const seen: Point[][] = [];
  subscribeDay(hass, 'sensor.hall_temperature', (points) => {
    seen.push(points);
  });
  push({
    start_time: at(24),
    states: {
      'sensor.hall_temperature': [
        { s: '19', lu: at(30) },
        { s: '20', lu: at(26) },
        { s: '21', lu: at(2) },
      ],
    },
  });
  assert.deepEqual(seen.at(-1), [
    { at: NOW - 26 * HOUR, value: 20 },
    { at: NOW - 2 * HOUR, value: 21 },
  ]);
});

test('a catch-up message the stream sends after the day keeps every earlier point and slots its own in time', () => {
  const { hass, push } = streamed();
  const seen: Point[][] = [];
  subscribeDay(hass, 'sensor.hall_temperature', (points) => {
    seen.push(points);
  });
  push({
    start_time: at(24),
    end_time: at(2),
    states: {
      'sensor.hall_temperature': [
        { s: '20', lu: at(24) },
        { s: '21', lu: at(2) },
      ],
    },
  });
  push({ states: { 'sensor.hall_temperature': [{ s: '23', lu: at(0) }] } });
  push({
    start_time: at(1),
    end_time: at(0.5),
    states: { 'sensor.hall_temperature': [{ s: '22', lu: at(0.5) }] },
  });
  assert.deepEqual(seen.at(-1), [
    { at: NOW - 24 * HOUR, value: 20 },
    { at: NOW - 2 * HOUR, value: 21 },
    { at: NOW - 0.5 * HOUR, value: 22 },
    { at: NOW, value: 23 },
  ]);
});

test('a catch-up message a microsecond after the asked start still keeps the day', () => {
  const { hass, push } = streamed();
  const seen: Point[][] = [];
  subscribeDay(hass, 'sensor.hall_temperature', (points) => {
    seen.push(points);
  });
  push({ start_time: at(24), states: { 'sensor.hall_temperature': [{ s: '20', lu: at(24) }] } });
  push({ states: { 'sensor.hall_temperature': [{ s: '23', lu: at(0) }] } });
  push({
    start_time: at(24) + 1e-6,
    states: { 'sensor.hall_temperature': [{ s: '22', lu: at(0.01) }] },
  });
  assert.deepEqual(seen.at(-1), [
    { at: NOW - 24 * HOUR, value: 20 },
    { at: NOW - 0.01 * HOUR, value: 22 },
    { at: NOW, value: 23 },
  ]);
});

test('a stream Home Assistant refuses draws nothing, and stopping one unsubscribes once and hears no more', async () => {
  const refused: Point[][] = [];
  subscribeDay(fakeHass(), 'sensor.hall_temperature', (points) => {
    refused.push(points);
  });
  const { hass, push, stops } = streamed();
  const seen: Point[][] = [];
  const stop = subscribeDay(hass, 'sensor.hall_temperature', (points) => {
    seen.push(points);
  });
  stop();
  stop();
  await until(() => stops() === 1, 'the unsubscribe');
  push({ start_time: at(24), states: { 'sensor.hall_temperature': [{ s: '20', lu: at(1) }] } });
  assert.deepEqual(seen, []);
  assert.deepEqual(refused, []);
  assert.equal(stops(), 1);
});
