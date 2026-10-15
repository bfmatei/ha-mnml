import type { HassConnection } from '../ha/hass.ts';

import { fakeConnection } from './hass.ts';

export interface Wire {
  connection: HassConnection;
  sent: unknown[];
  unsubscribed: number;
  push(message: unknown): void;
  event(): void;
}

export function notified(count: number): { type: 'current'; notifications: object } {
  return {
    type: 'current',
    notifications: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `n${index}`,
        {
          notification_id: `n${index}`,
          title: `Notification ${index}`,
          message: '',
          created_at: '2026-10-01T10:00:00+00:00',
        },
      ]),
    ),
  };
}

export function wire(answers: Record<string, unknown> = {}): Wire {
  const listeners: ((message: unknown) => void)[] = [];
  const handlers: (() => void)[] = [];
  const off = (): Promise<() => Promise<void>> =>
    Promise.resolve(() => {
      made.unsubscribed += 1;
      return Promise.resolve();
    });
  const made: Wire = {
    sent: [],
    unsubscribed: 0,
    push: (message) => {
      for (const listener of listeners) {
        listener(message);
      }
    },
    event: () => {
      for (const handler of handlers) {
        handler();
      }
    },
    connection: fakeConnection({
      subscribeMessage: (callback, message) => {
        made.sent.push(message);
        listeners.push(callback);
        return off();
      },
      sendMessagePromise: (message) => {
        made.sent.push(message);
        const type = message['type'];
        return Promise.resolve(typeof type === 'string' ? answers[type] : undefined);
      },
      subscribeEvents: (callback, type) => {
        made.sent.push({ type: 'subscribe_events', event_type: type });
        handlers.push(() => {
          callback({ data: undefined });
        });
        return off();
      },
    }),
  };
  return made;
}
