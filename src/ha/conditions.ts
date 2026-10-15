import { field } from './field.ts';
import type { HassConnection, HomeAssistant } from './hass.ts';

type Verdict = boolean | undefined;

interface Context {
  readonly hass: HomeAssistant;
  readonly entity: string | undefined;
  readonly server: (condition: object) => Verdict;
  readonly screen: (query: string) => boolean;
}

interface Answer {
  result?: unknown;
  error?: unknown;
}

const ENTITY_ID = /^\w+\.\w+$/;
const SHOWN = new Set(['time', 'location', 'view_columns']);
const LOGICAL = new Set(['and', 'or', 'not']);

function listOf(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function logical(kind: unknown): boolean {
  return typeof kind === 'string' && LOGICAL.has(kind);
}

function kindOf(condition: object): unknown {
  return Object.hasOwn(condition, 'condition') ? field(condition, 'condition') : 'state';
}

function enabled(condition: unknown): boolean {
  return field(condition, 'enabled') !== false;
}

function all(verdicts: readonly Verdict[]): Verdict {
  return verdicts.includes(false) ? false : verdicts.includes(undefined) ? undefined : true;
}

function any(verdicts: readonly Verdict[]): Verdict {
  return verdicts.includes(true) ? true : verdicts.includes(undefined) ? undefined : false;
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function stateOfId(hass: HomeAssistant, value: unknown): string | undefined {
  return typeof value === 'string' && ENTITY_ID.test(value) ? hass.states[value]?.state : undefined;
}

function subject(condition: object, context: Context): { value: unknown } | false | undefined {
  const named = field(condition, 'entity');
  const id = typeof named === 'string' && named !== '' ? named : context.entity;
  if (id === undefined) {
    return false;
  }
  const stateObj = context.hass.states[id];
  if (stateObj === undefined) {
    return undefined;
  }
  const attribute = field(condition, 'attribute');
  return typeof attribute === 'string' && attribute !== ''
    ? { value: stateObj.attributes[attribute] }
    : { value: stateObj.state };
}

function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'number' || typeof value === 'boolean'
    ? `${value}`
    : JSON.stringify(value);
}

function stateHolds(condition: object, context: Context): Verdict {
  const found = subject(condition, context);
  if (found === false || found === undefined) {
    return found;
  }
  const state = present(found.value) ? textOf(found.value) : 'unknown';
  const wanted = field(condition, 'state');
  const values = listOf(present(wanted) ? wanted : field(condition, 'state_not'));
  if (values.length === 0) {
    return false;
  }
  const named = values.map((value) => stateOfId(context.hass, value));
  const matches = [...values, ...named].includes(state);
  return present(wanted) ? matches : !matches;
}

function bound(value: unknown, context: Context): number | undefined {
  if (!present(value)) {
    return undefined;
  }
  const number = Number(stateOfId(context.hass, value) ?? value);
  return Number.isNaN(number) ? undefined : number;
}

function numericHolds(condition: object, context: Context): Verdict {
  const found = subject(condition, context);
  if (found === false || found === undefined) {
    return found;
  }
  const value = Number(found.value);
  if (Number.isNaN(value)) {
    return false;
  }
  const above = bound(field(condition, 'above'), context);
  const below = bound(field(condition, 'below'), context);
  return (above === undefined || above < value) && (below === undefined || below > value);
}

function grouped(condition: object, context: Context, kind: unknown): Verdict {
  const children = field(condition, 'conditions');
  if (!present(children)) {
    return true;
  }
  const verdicts = listOf(children)
    .filter(enabled)
    .map((child) => judged(child, context));
  if (kind === 'or') {
    return any(verdicts);
  }
  const every = all(verdicts);
  return kind === 'not' && every !== undefined ? !every : every;
}

function judged(condition: unknown, context: Context): Verdict {
  if (typeof condition !== 'object' || condition === null) {
    return false;
  }
  const switched = field(condition, 'enabled');
  if (switched !== undefined && typeof switched !== 'boolean') {
    return undefined;
  }
  const kind = kindOf(condition);
  if (logical(kind)) {
    return grouped(condition, context, kind);
  }
  if (typeof kind === 'string' && SHOWN.has(kind)) {
    return true;
  }
  switch (kind) {
    case 'state':
      return Object.hasOwn(condition, 'entity_id')
        ? context.server(condition)
        : stateHolds(condition, context);
    case 'numeric_state':
      return Object.hasOwn(condition, 'entity_id')
        ? context.server(condition)
        : numericHolds(condition, context);
    case 'screen': {
      const query = field(condition, 'media_query');
      return typeof query === 'string' && context.screen(query);
    }
    case 'user': {
      const users = field(condition, 'users');
      const id = context.hass.user?.id;
      return Array.isArray(users) && id !== undefined && users.includes(id);
    }
    default:
      return context.server(condition);
  }
}

export class Judge {
  private readonly changed: () => void;
  private readonly answers = new Map<string, Verdict>();
  private readonly failed = new Set<string>();
  private readonly queries = new Map<string, MediaQueryList>();
  private subscriptions: Promise<() => Promise<void>>[] = [];
  private connection: HassConnection | undefined;
  private generation = 0;

  constructor(changed: () => void) {
    this.changed = changed;
  }

  shown(conditions: unknown, hass: HomeAssistant, entity: unknown): boolean {
    const listed = listOf(conditions).filter(enabled);
    if (listed.length === 0) {
      return true;
    }
    if (hass.connection !== this.connection) {
      this.close();
      this.connection = hass.connection;
    }
    const asked: string[] = [];
    const context: Context = {
      hass,
      entity: typeof entity === 'string' ? entity : undefined,
      server: (condition) => {
        const key = JSON.stringify(condition);
        asked.push(key);
        return this.ask(key, condition, hass.connection);
      },
      screen: (query) => this.screen(query),
    };
    const verdict = all(listed.map((condition) => judged(condition, context)));
    return verdict === true && !asked.some((key) => this.failed.has(key));
  }

  close(): void {
    this.generation += 1;
    for (const subscription of this.subscriptions) {
      void subscription.then((unsubscribe) => unsubscribe()).catch(() => undefined);
    }
    this.subscriptions = [];
    this.answers.clear();
    this.failed.clear();
    for (const list of this.queries.values()) {
      list.removeEventListener('change', this.changed);
    }
    this.queries.clear();
    this.connection = undefined;
  }

  private ask(key: string, condition: object, connection: HassConnection): Verdict {
    if (this.answers.has(key)) {
      return this.answers.get(key);
    }
    this.answers.set(key, undefined);
    const generation = this.generation;
    const heard = (verdict: boolean, failed: boolean): void => {
      if (generation !== this.generation) {
        return;
      }
      this.answers.set(key, verdict);
      if (failed) {
        this.failed.add(key);
      } else {
        this.failed.delete(key);
      }
      this.changed();
    };
    const subscription = connection.subscribeMessage<Answer>(
      (answer) => {
        if (answer.error !== undefined) {
          heard(false, true);
        } else {
          heard(answer.result === true, false);
        }
      },
      { type: 'subscribe_condition', condition },
    );
    subscription.catch(() => {
      heard(false, true);
    });
    this.subscriptions.push(subscription);
    return undefined;
  }

  private screen(query: string): boolean {
    if (typeof matchMedia !== 'function') {
      return false;
    }
    const known = this.queries.get(query);
    if (known !== undefined) {
      return known.matches;
    }
    const list = matchMedia(query);
    list.addEventListener('change', this.changed);
    this.queries.set(query, list);
    return list.matches;
  }
}

function needs(condition: object, kind: unknown): string | undefined {
  const has = (key: string): boolean => present(field(condition, key));
  switch (kind) {
    case 'state':
      return has('state') || has('state_not')
        ? undefined
        : 'a state condition needs state or state_not';
    case 'screen':
      return has('media_query') ? undefined : 'a screen condition needs media_query';
    case 'user':
      return has('users') ? undefined : 'a user condition needs users';
    default:
      return undefined;
  }
}

export function conditionProblem(condition: unknown, where: string): string | undefined {
  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    return `${where}: a condition must be a mapping`;
  }
  const kind = kindOf(condition);
  const own = needs(condition, kind);
  if (own !== undefined) {
    return `${where}: ${own}`;
  }
  if (!logical(kind)) {
    return undefined;
  }
  return listOf(field(condition, 'conditions'))
    .map((child, index) => conditionProblem(child, `${where}.conditions[${index}]`))
    .find((problem) => problem !== undefined);
}
