import { field } from './field.ts';
import { humanise } from './format.ts';
import type { HassConnection, HomeAssistant } from './hass.ts';

export interface Message {
  id: string;
  title: string;
  message: string;
  severity?: string;
  source?: string;
  time: string;
}

export interface Repair {
  domain: string;
  issue_id: string;
  issue_domain: string | undefined;
  translation_key: string | undefined;
  placeholders: Record<string, unknown>;
  severity: string;
  created: string;
}

const SEVERITIES = ['critical', 'error', 'warning'];

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function ended(subscribed: Promise<() => Promise<void>>): () => void {
  const off = subscribed.then(
    (unsubscribe) => unsubscribe,
    () => undefined,
  );
  return () => {
    void off.then((unsubscribe) => unsubscribe?.()).catch(() => undefined);
  };
}

function notificationOf(value: unknown): Message | undefined {
  const id = textOf(field(value, 'notification_id'));
  const message = textOf(field(value, 'message'));
  const time = textOf(field(value, 'created_at'));
  if (id === undefined || message === undefined || time === undefined) {
    return undefined;
  }
  const title = textOf(field(value, 'title'));
  return title === undefined || title === ''
    ? { id, title: message, message: '', time }
    : { id, title, message, time };
}

function newestFirst(a: Message, b: Message): number {
  return Date.parse(b.time) - Date.parse(a.time);
}

export function notificationFeed(
  connection: HassConnection,
  publish: (messages: Message[]) => void,
): () => void {
  const held = new Map<string, Message>();
  return ended(
    connection.subscribeMessage<unknown>(
      (update) => {
        const kind = field(update, 'type');
        const listed = field(update, 'notifications');
        if (kind === 'current') {
          held.clear();
        }
        for (const [id, value] of Object.entries(
          typeof listed === 'object' && listed !== null ? listed : {},
        )) {
          const found = kind === 'removed' ? undefined : notificationOf(value);
          if (found === undefined) {
            held.delete(id);
          } else {
            held.set(id, found);
          }
        }
        publish([...held.values()].sort(newestFirst));
      },
      { type: 'persistent_notification/subscribe' },
    ),
  );
}

function repairOf(value: unknown): Repair | undefined {
  const domain = textOf(field(value, 'domain'));
  const issue = textOf(field(value, 'issue_id'));
  const severity = textOf(field(value, 'severity'));
  const created = textOf(field(value, 'created'));
  if (
    domain === undefined ||
    issue === undefined ||
    severity === undefined ||
    created === undefined ||
    field(value, 'ignored') === true
  ) {
    return undefined;
  }
  const placeholders = field(value, 'translation_placeholders');
  return {
    domain,
    issue_id: issue,
    issue_domain: textOf(field(value, 'issue_domain')),
    translation_key: textOf(field(value, 'translation_key')),
    placeholders:
      typeof placeholders === 'object' && placeholders !== null ? { ...placeholders } : {},
    severity,
    created,
  };
}

function rank(repair: Repair): number {
  const found = SEVERITIES.indexOf(repair.severity);
  return found === -1 ? SEVERITIES.length : found;
}

export function repairFeed(hass: HomeAssistant, publish: (repairs: Repair[]) => void): () => void {
  let live = true;
  let asked = 0;
  const list = (): void => {
    asked += 1;
    const mine = asked;
    const current = (): boolean => live && mine === asked;
    hass.connection
      .sendMessagePromise<unknown>({ type: 'repairs/list_issues' })
      .then(async (answer) => {
        const issues = field(answer, 'issues');
        const open = (Array.isArray(issues) ? issues : []).flatMap(
          (issue: unknown) => repairOf(issue) ?? [],
        );
        await hass
          .loadBackendTranslation?.('issues', [...new Set(open.map((repair) => repair.domain))])
          .then(
            () => undefined,
            () => undefined,
          );
        if (current()) {
          publish([...open].sort((a, b) => rank(a) - rank(b)));
        }
      })
      .catch(() => {
        if (current()) {
          publish([]);
        }
      });
  };
  list();
  const stop = ended(hass.connection.subscribeEvents(list, 'repairs_issue_registry_updated'));
  return () => {
    live = false;
    stop();
  };
}

function worded(
  hass: HomeAssistant,
  key: string,
  values: Record<string, unknown>,
  otherwise: string,
): string {
  const words = hass.localize(key, values);
  return words === '' ? otherwise : words;
}

export function repairMessage(hass: HomeAssistant, repair: Repair): Message {
  const key = `component.${repair.domain}.issues.${repair.translation_key ?? repair.issue_id}`;
  const integration = repair.issue_domain ?? repair.domain;
  return {
    id: `${repair.domain}.${repair.issue_id}`,
    title: worded(hass, `${key}.title`, repair.placeholders, humanise(repair.issue_id)),
    message: worded(hass, `${key}.description`, repair.placeholders, ''),
    severity: repair.severity,
    source: worded(hass, `component.${integration}.title`, {}, integration),
    time: repair.created,
  };
}
