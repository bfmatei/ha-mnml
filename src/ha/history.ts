import type { SensorId } from '../contract/entities.ts';
import { isMapping } from '../contract/templates.ts';

import type { HomeAssistant } from './hass.ts';

export const DAY = 86_400_000;

export interface Point {
  at: number;
  value: number | undefined;
}

function pointOf(entry: unknown): Point[] {
  if (!isMapping(entry)) {
    return [];
  }
  const seconds = typeof entry['lu'] === 'number' ? entry['lu'] : entry['lc'];
  if (typeof seconds !== 'number') {
    return [];
  }
  const state = entry['s'];
  const value = typeof state === 'string' && state.trim() !== '' ? Number(state) : Number.NaN;
  return [{ at: seconds * 1000, value: Number.isFinite(value) ? value : undefined }];
}

function pointsOf(message: unknown, entity: SensorId): Point[] {
  const states = isMapping(message) ? message['states'] : undefined;
  const list = isMapping(states) ? states[entity] : undefined;
  return Array.isArray(list) ? list.flatMap(pointOf) : [];
}

function trimmed(points: Point[], start: number): Point[] {
  const first = points.findIndex((point) => point.at > start);
  if (first === -1) {
    return points.slice(-1);
  }
  return first <= 1 ? points : points.slice(first - 1);
}

export function subscribeDay(
  hass: HomeAssistant,
  entity: SensorId,
  update: (points: Point[]) => void,
): () => void {
  let live = true;
  let points: Point[] = [];
  const start = Date.now() - DAY;
  const stop = hass.connection.subscribeMessage<unknown>(
    (message) => {
      if (!live) {
        return;
      }
      const fresh = pointsOf(message, entity);
      const from = isMapping(message) ? message['start_time'] : undefined;
      const whole = typeof from === 'number' && Math.round(from * 1_000_000) <= start * 1000;
      const merged = whole ? fresh : [...points, ...fresh];
      points = trimmed(
        merged.toSorted((one, other) => one.at - other.at),
        Date.now() - DAY,
      );
      update(points);
    },
    {
      type: 'history/stream',
      entity_ids: [entity],
      start_time: new Date(start).toISOString(),
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    },
  );
  void stop.catch(() => undefined);
  return () => {
    if (!live) {
      return;
    }
    live = false;
    void stop.then(
      (off) => off(),
      () => undefined,
    );
  };
}
