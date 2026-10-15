import type { HassConnection, HomeAssistant } from './hass.ts';
import { notificationFeed, repairFeed } from './messages.ts';

interface Listener {
  readonly isConnected: boolean;
  register(teardown: () => void): () => void;
  refresh(): void;
}

export interface MessageCount {
  all: number;
  notifications: number;
}

interface Feed {
  connection: HassConnection;
  admin: boolean;
  notifications: number | undefined;
  repairs: number | undefined;
  stop: () => void;
}

const listeners = new Set<Listener>();

let feed: Feed | undefined;

function publish(): void {
  for (const listener of listeners) {
    listener.refresh();
  }
}

function start(hass: HomeAssistant, admin: boolean): Feed {
  const started: Feed = {
    connection: hass.connection,
    admin,
    notifications: undefined,
    repairs: admin ? undefined : 0,
    stop: () => undefined,
  };
  const notified = notificationFeed(hass.connection, (messages) => {
    started.notifications = messages.length;
    publish();
  });
  const repaired = admin
    ? repairFeed(hass, (repairs) => {
        started.repairs = repairs.length;
        publish();
      })
    : undefined;
  started.stop = () => {
    notified();
    repaired?.();
  };
  return started;
}

function leave(listener: Listener): void {
  listeners.delete(listener);
  if (listeners.size === 0) {
    feed?.stop();
    feed = undefined;
  }
}

export function messageCount(listener: Listener, hass: HomeAssistant): MessageCount | undefined {
  if (!listener.isConnected) {
    return undefined;
  }
  const admin = hass.user?.is_admin === true;
  if (feed?.connection !== hass.connection || feed.admin !== admin) {
    feed?.stop();
    feed = start(hass, admin);
  }
  if (!listeners.has(listener)) {
    listeners.add(listener);
    listener.register(() => {
      leave(listener);
    });
  }
  const { notifications, repairs } = feed;
  return notifications === undefined || repairs === undefined
    ? undefined
    : { all: notifications + repairs, notifications };
}
