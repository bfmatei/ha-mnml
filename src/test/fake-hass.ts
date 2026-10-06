interface FakeConnection {
  sendMessagePromise(message: Record<string, unknown>): Promise<unknown>;
  subscribeMessage(
    callback: (message: unknown) => void,
    message: Record<string, unknown>,
    options?: { resubscribe?: boolean },
  ): Promise<() => Promise<void>>;
  subscribeEvents(
    callback: (event: { data: unknown }) => void,
    eventType: string,
  ): Promise<() => Promise<void>>;
  addEventListener(type: string, listener: () => void): void;
}

interface FakeStore {
  readonly hass: { connection: FakeConnection };
  readonly calls: Record<string, unknown>[];
  kept: unknown;
  refuse: unknown;
  readonly subscribed: unknown[];
  keep(templates: unknown): void;
  reconnect(): void;
}

export function fakeStore(): FakeStore {
  const kept: ((message: unknown) => void)[] = [];
  const ready: (() => void)[] = [];
  const calls: Record<string, unknown>[] = [];
  const store: FakeStore = {
    calls,
    kept: undefined,
    refuse: undefined,
    subscribed: [],
    hass: {
      connection: {
        sendMessagePromise: (message) => {
          calls.push(message);
          return Promise.reject({ code: 'unknown_command', message: 'Unknown command.' });
        },
        subscribeMessage: (callback, _message, options) => {
          store.subscribed.push(options);
          if (store.refuse !== undefined) {
            return Promise.reject(store.refuse);
          }
          if (store.kept === undefined) {
            return Promise.reject({ code: 'unknown_command', message: 'Unknown command.' });
          }
          kept.push(callback);
          const first = { templates: store.kept };
          queueMicrotask(() => {
            callback(first);
          });
          return Promise.resolve(() => Promise.resolve());
        },
        subscribeEvents: () => Promise.resolve(() => Promise.resolve()),
        addEventListener: (type, listener) => {
          if (type === 'ready') {
            ready.push(listener);
          }
        },
      },
    },
    keep: (templates) => {
      store.kept = templates;
      for (const callback of kept) {
        callback({ templates });
      }
    },
    reconnect: () => {
      kept.length = 0;
      for (const listener of ready) {
        listener();
      }
    },
  };
  return store;
}
