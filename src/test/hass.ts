import type { Host } from '../cards/base.ts';
import type { HassConnection, HassEntity, HomeAssistant } from '../ha/hass.ts';

export interface FakeState {
  entity_id?: string;
  state?: string;
  attributes?: Readonly<Record<string, unknown>>;
  last_changed?: string;
  last_updated?: string;
  context?: HassEntity['context'];
}

export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown> | undefined;
  target: { entity_id: string | string[] } | undefined;
}

type Given = Partial<Omit<HomeAssistant, 'states' | 'locale'>> & {
  states?: Readonly<Record<string, FakeState>>;
  language?: string;
  calls?: ServiceCall[];
};

const EPOCH = '1970-01-01T00:00:00+00:00';
const UNKNOWN_COMMAND = { code: 'unknown_command', message: 'Unknown command.' };

export function fakeState(id: string, given: FakeState = {}): HassEntity {
  return {
    entity_id: id,
    state: 'unknown',
    attributes: {},
    last_changed: EPOCH,
    last_updated: EPOCH,
    ...given,
  };
}

export function fakeHass(given: Given = {}): HomeAssistant {
  const { states = {}, language = 'en', calls, ...rest } = given;
  const recorded: Pick<HomeAssistant, 'callService'> | undefined =
    calls === undefined
      ? undefined
      : {
          callService: (domain, service, data, target) => {
            calls.push({ domain, service, data, target });
            return Promise.resolve();
          },
        };
  return {
    states: Object.fromEntries(
      Object.entries(states).map(([id, entry]) => [id, fakeState(id, entry)]),
    ),
    areas: {},
    entities: {},
    devices: {},
    locale: { language },
    config: { state: 'RUNNING' },
    localize: () => '',
    formatEntityState: (stateObj, state) => state ?? stateObj.state,
    formatEntityAttributeName: (_stateObj, attribute) => attribute,
    formatEntityAttributeValue: (stateObj, attribute, value = stateObj.attributes[attribute]) =>
      typeof value === 'string' ? value : JSON.stringify(value ?? null).replace(/^null$/, ''),
    callApi: () => Promise.reject(new Error('no API in a fake Home Assistant')),
    callService: () => Promise.resolve(),
    connection: fakeConnection(),
    ...rest,
    ...recorded,
  };
}

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

export function fakeConnection(given: Partial<FakeConnection> = {}): HassConnection {
  const connection: FakeConnection = {
    sendMessagePromise: () => Promise.reject(UNKNOWN_COMMAND),
    subscribeMessage: () => Promise.reject(UNKNOWN_COMMAND),
    subscribeEvents: () => Promise.resolve(() => Promise.resolve()),
    addEventListener: () => undefined,
    ...given,
  };
  return connection as unknown as HassConnection;
}

export function fakeHost(given: Partial<Host> = {}): Host {
  return {
    hass: undefined,
    isConnected: true,
    hold: () => () => undefined,
    register: () => () => undefined,
    notify: () => undefined,
    refresh: () => undefined,
    ...given,
  };
}

interface FakeStore {
  readonly hass: HomeAssistant;
  readonly calls: Record<string, unknown>[];
  kept: unknown;
  refuse: unknown;
  answer: (message: Record<string, unknown>) => Promise<unknown>;
  readonly subscribed: unknown[];
  keep(templates: unknown): void;
  reconnect(): void;
}

export function fakeStore(): FakeStore {
  const kept: ((message: unknown) => void)[] = [];
  const ready: (() => void)[] = [];
  const calls: Record<string, unknown>[] = [];
  const connection = fakeConnection({
    sendMessagePromise: (message) => {
      calls.push(message);
      return store.answer(message);
    },
    subscribeMessage: (callback, _message, options) => {
      store.subscribed.push(options);
      if (store.refuse !== undefined) {
        return Promise.reject(store.refuse);
      }
      if (store.kept === undefined) {
        return Promise.reject(UNKNOWN_COMMAND);
      }
      kept.push(callback);
      const first = { templates: store.kept };
      queueMicrotask(() => {
        callback(first);
      });
      return Promise.resolve(() => Promise.resolve());
    },
    addEventListener: (type, listener) => {
      if (type === 'ready') {
        ready.push(listener);
      }
    },
  });
  const store: FakeStore = {
    calls,
    kept: undefined,
    refuse: undefined,
    answer: () => Promise.reject(UNKNOWN_COMMAND),
    subscribed: [],
    hass: fakeHass({ connection }),
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
