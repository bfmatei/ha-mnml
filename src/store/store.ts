import { isMapping, isTemplate } from '../contract/templates.ts';
import type { Template, Templates } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HassConnection } from '../ha/hass.ts';
import { applyChanges, isChange } from '../templates/changes.ts';
import type { Change } from '../templates/changes.ts';

type Changes = Readonly<Record<string, readonly Change[]>>;

export type SharedState =
  | { status: 'waiting' }
  | { status: 'ready'; own: Templates; changes: Changes }
  | { status: 'failed'; error: string };

const WAITING: SharedState = { status: 'waiting' };
const EMPTY: SharedState = { status: 'ready', own: {}, changes: {} };
const CONNECTION_LOST = 3;
const RETRY = 5000;
const RETRIES = 60;

interface Entry {
  state: SharedState;
  subscriptions: number;
  subscribed: boolean;
}

const entries = new WeakMap<HassConnection, Entry>();
let latest: Entry | undefined;
const listeners = new Set<() => void>();

function lost(error: unknown): boolean {
  return error === CONNECTION_LOST || field(field(error, 'error'), 'code') === CONNECTION_LOST;
}

function reason(error: unknown): string {
  const message = field(error, 'message') ?? field(field(error, 'error'), 'message');
  if (typeof message === 'string') {
    return message;
  }
  return error === CONNECTION_LOST ? 'the connection was lost' : String(error);
}

function storeOf(message: unknown): SharedState {
  const kept = field(message, 'templates');
  const own: Record<string, Template> = {};
  const changes: Record<string, Change[]> = {};
  for (const [name, entry] of Object.entries(isMapping(kept) ? kept : {})) {
    const template = field(entry, 'template');
    const list = field(entry, 'changes');
    if (field(entry, 'kind') === 'own' && isTemplate(template)) {
      own[name] = template;
    } else if (field(entry, 'kind') === 'changes' && Array.isArray(list)) {
      if (list.every(isChange)) {
        changes[name] = list;
      } else {
        console.error(
          `mnml: the changes kept for ${name} are not all of a known shape, so ${name} draws as shipped`,
        );
      }
    }
  }
  return { status: 'ready', own, changes };
}

function settle(entry: Entry, next: SharedState): void {
  if (JSON.stringify(next) === JSON.stringify(entry.state)) {
    return;
  }
  entry.state = next;
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error(error);
    }
  }
}

function subscribe(connection: HassConnection, entry: Entry, tries: number): void {
  entry.subscriptions += 1;
  const mine = entry.subscriptions;
  connection
    .subscribeMessage(
      (message: unknown) => {
        if (mine === entry.subscriptions) {
          entry.subscribed = true;
          settle(entry, storeOf(message));
        }
      },
      { type: 'mnml/templates/subscribe' },
      { resubscribe: false },
    )
    .catch((error: unknown) => {
      if (mine !== entry.subscriptions) {
        return;
      }
      const code = field(error, 'code');
      const unknown = code === 'unknown_command';
      if (unknown && entry.subscribed) {
        if (tries < RETRIES) {
          setTimeout(() => {
            if (mine === entry.subscriptions) {
              subscribe(connection, entry, tries + 1);
            }
          }, RETRY);
        }
        return;
      }
      if (lost(error) && entry.state.status === 'ready') {
        return;
      }
      settle(
        entry,
        unknown || code === 'not_loaded'
          ? EMPTY
          : {
              status: 'failed',
              error: `mnml: the templates MNML keeps could not be read: ${reason(error)}`,
            },
      );
    });
}

export function sharedTemplates(connection: HassConnection): SharedState {
  const known = entries.get(connection);
  if (known !== undefined) {
    latest = known;
    return known.state;
  }
  const entry: Entry = { state: WAITING, subscriptions: 0, subscribed: false };
  entries.set(connection, entry);
  latest = entry;
  subscribe(connection, entry, 0);
  connection.addEventListener('ready', () => {
    subscribe(connection, entry, 0);
  });
  return entry.state;
}

export function knownShared(): SharedState {
  return latest?.state ?? WAITING;
}

export function onShared(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const resolved = new WeakMap<SharedState, WeakMap<Templates, Templates>>();

export function resolvedTemplates(shared: SharedState, shipped: Templates): Templates {
  if (shared.status !== 'ready') {
    return shipped;
  }
  const known = resolved.get(shared)?.get(shipped);
  if (known !== undefined) {
    return known;
  }
  const changed = Object.fromEntries(
    Object.entries(shared.changes).flatMap(([name, changes]) => {
      const base = shipped[name];
      return base === undefined ? [] : [[name, applyChanges(base, changes).template]];
    }),
  );
  const made = { ...shipped, ...changed, ...shared.own };
  const byShipped = resolved.get(shared) ?? new WeakMap<Templates, Templates>();
  byShipped.set(shipped, made);
  resolved.set(shared, byShipped);
  return made;
}
