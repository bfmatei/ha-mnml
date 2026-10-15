import { ITEM_KEYS, TEMPLATE_KEYS, isMapping } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';

import { OVER, PATH, WORDS, filled } from './expand.ts';

type Mapping = Record<string, Value>;

const WHOLE = new RegExp(`^\\[\\[(${PATH})\\]\\]$`);
const PART = new RegExp(`\\[\\[(${PATH})\\]\\]`, 'g');
const DROP = Symbol('drop');

class NotCopyable extends Error {}

type Resolved = { kind: 'unset' } | { kind: 'ref'; path: string } | { kind: 'value'; value: Value };

interface Scope {
  given: ReadonlyMap<string, Value | undefined>;
  aliases: ReadonlySet<string>;
  taken: ReadonlySet<string>;
}

export interface EditedHere {
  items: Value[];
  list: boolean;
  popups: Value[];
}

const head = (path: string): string => path.split('.')[0] ?? path;

function resolve(path: string, scope: Scope): Resolved {
  const first = head(path);
  if (scope.aliases.has(first) || first === WORDS) {
    return { kind: 'ref', path };
  }
  if (!scope.given.has(first)) {
    throw new NotCopyable(`no slot named ${first}`);
  }
  let value: Value | undefined = scope.given.get(first);
  for (const name of path.split('.').slice(1)) {
    const outer = typeof value === 'string' ? WHOLE.exec(value)?.[1] : undefined;
    if (outer !== undefined) {
      value = `[[${outer}.${name}]]`;
    } else if (OVER.test(name) && value !== undefined && value !== null) {
      throw new NotCopyable('a projection over a list written out');
    } else if (Array.isArray(value)) {
      value = value[Number(name)];
    } else {
      value = isMapping(value) ? value[name] : undefined;
    }
  }
  if (value === undefined || value === null) {
    return { kind: 'unset' };
  }
  const outer = typeof value === 'string' ? WHOLE.exec(value)?.[1] : undefined;
  return outer === undefined ? { kind: 'value', value } : { kind: 'ref', path: outer };
}

function guard(path: string, scope: Scope, inside: ReadonlySet<string>): string {
  if (inside.has(head(path)) && !scope.aliases.has(head(path))) {
    throw new NotCopyable(`${head(path)} would be captured by a name inside`);
  }
  return path;
}

function text(value: string, scope: Scope, inside: ReadonlySet<string>): Value | typeof DROP {
  const whole = WHOLE.exec(value)?.[1];
  if (whole !== undefined) {
    const found = resolve(whole, scope);
    if (found.kind === 'unset') {
      return DROP;
    }
    return found.kind === 'ref' ? `[[${guard(found.path, scope, inside)}]]` : found.value;
  }
  return value.replace(PART, (_match: string, path: string) => {
    const found = resolve(path, scope);
    if (found.kind === 'ref') {
      return `[[${guard(found.path, scope, inside)}]]`;
    }
    if (
      found.kind === 'value' &&
      ((typeof found.value === 'string' && found.value !== '') || typeof found.value === 'number')
    ) {
      return String(found.value);
    }
    throw new NotCopyable(`${path} has nothing to write in text`);
  });
}

function names(value: Value | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value) && value.every((each): each is string => typeof each === 'string')) {
    return value;
  }
  throw new NotCopyable('if and unless take slots');
}

interface Condition {
  keep: boolean;
  names: string[];
}

function condition(
  value: Value | undefined,
  scope: Scope,
  inside: ReadonlySet<string>,
  any: boolean,
): Condition | undefined {
  if (value === undefined) {
    return undefined;
  }
  const symbolic: string[] = [];
  let constant = false;
  for (const name of names(value)) {
    const found = resolve(name, scope);
    if (found.kind === 'ref') {
      symbolic.push(guard(found.path, scope, inside));
    } else if (found.kind === 'value' && filled(found.value)) {
      constant = true;
    }
  }
  if (any) {
    return constant ? { keep: true, names: [] } : { keep: symbolic.length > 0, names: symbolic };
  }
  return constant ? { keep: false, names: [] } : { keep: true, names: symbolic };
}

const own = (names: readonly string[]): Value | undefined =>
  names.length === 0 ? undefined : names.length === 1 ? names[0] : [...names];

function mapping(node: Mapping, scope: Scope, inside: ReadonlySet<string>): Mapping | typeof DROP {
  const shown = condition(node['if'], scope, inside, true);
  const hidden = condition(node['unless'], scope, inside, false);
  if (shown?.keep === false || hidden?.keep === false) {
    return DROP;
  }
  const out: Mapping = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'if') {
      const kept = own(shown?.names ?? []);
      if (kept !== undefined) {
        out[key] = kept;
      }
    } else if (key === 'unless') {
      const kept = own(hidden?.names ?? []);
      if (kept !== undefined) {
        out[key] = kept;
      }
    } else if (key === 'each' || key === 'as') {
      throw new NotCopyable('each belongs on an item of a list');
    } else if (key === 'id') {
      out[key] = value;
    } else if (key.endsWith('!') && Array.isArray(value)) {
      out[key] = value.map((item) => {
        const done = walk(item, scope, inside);
        return done === DROP ? null : done;
      });
    } else {
      const done = walk(value, scope, inside);
      if (done !== DROP) {
        out[key] = done;
      }
    }
  }
  return out;
}

function listed(items: readonly Value[], scope: Scope, inside: ReadonlySet<string>): Value[] {
  const out: Value[] = [];
  for (const item of items) {
    if (!isMapping(item)) {
      const done = walk(item, scope, inside);
      if (done !== DROP) {
        out.push(done);
      }
      continue;
    }
    const over = item['each'];
    const alias = item['as'];
    if (over === undefined) {
      const done = mapping(item, scope, inside);
      if (done !== DROP) {
        out.push(done);
      }
      continue;
    }
    if (typeof over !== 'string' || typeof alias !== 'string') {
      throw new NotCopyable('each takes a list slot and as a name');
    }
    if (scope.taken.has(alias)) {
      throw new NotCopyable(`${alias} is a name of the template around`);
    }
    const found = resolve(over, scope);
    if (found.kind === 'unset') {
      continue;
    }
    if (found.kind === 'value') {
      throw new NotCopyable('each over a list written out');
    }
    const body = Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== 'each' && key !== 'as'),
    );
    const inner = { ...scope, aliases: new Set([...scope.aliases, alias]) };
    const done = mapping(body, inner, new Set([...inside, alias]));
    if (done === DROP) {
      continue;
    }
    const { id, ...rest } = done;
    out.push({
      ...(id === undefined ? {} : { id }),
      each: guard(found.path, scope, inside),
      as: alias,
      ...rest,
    });
  }
  return out;
}

function walk(value: Value, scope: Scope, inside: ReadonlySet<string>): Value | typeof DROP {
  if (typeof value === 'string') {
    return text(value, scope, inside);
  }
  if (Array.isArray(value)) {
    return listed(value, scope, inside);
  }
  if (isMapping(value)) {
    return mapping(value, scope, inside);
  }
  return value;
}

export function editHere(
  use: Mapping,
  templates: Templates,
  taken: ReadonlySet<string> = new Set(),
): EditedHere | undefined {
  const name = use['template'];
  const inner = typeof name === 'string' ? templates[name] : undefined;
  const given = isMapping(use['slots']) ? use['slots'] : {};
  if (inner === undefined) {
    return undefined;
  }
  const popups = inner.popups ?? [];
  const conditional = ['if', 'unless', 'each'].some((key) => use[key] !== undefined);
  if (popups.length > 0 && conditional) {
    return undefined;
  }
  const slots = new Map<string, Value | undefined>(
    Object.entries(inner.slots ?? {}).map(([slot, spec]) => [
      slot,
      Object.hasOwn(given, slot) ? given[slot] : spec.default,
    ]),
  );
  const scope: Scope = { given: slots, aliases: new Set(), taken };
  const id = use['id'];
  const mine = Object.fromEntries(Object.entries(use).filter(([key]) => !TEMPLATE_KEYS.has(key)));
  const lead: Mapping = {};
  for (const key of ITEM_KEYS) {
    const value = use[key];
    if (value !== undefined) {
      lead[key] = value;
    }
  }
  try {
    const made = walk(inner.card, scope, new Set());
    const built = walk(popups, scope, new Set());
    if (made === DROP) {
      return undefined;
    }
    if (Array.isArray(made)) {
      if (conditional || Object.keys(mine).length > 0) {
        return undefined;
      }
      const prefix = typeof id === 'string' ? id : 'part';
      const items = made.map((each, index) =>
        isMapping(each)
          ? {
              ...each,
              id: `${prefix}-${typeof each['id'] === 'string' ? each['id'] : index + 1}`,
            }
          : each,
      );
      return { items, list: true, popups: Array.isArray(built) ? built : [] };
    }
    if (
      !isMapping(made) ||
      ['if', 'unless'].some((key) => lead[key] !== undefined && made[key] !== undefined)
    ) {
      return undefined;
    }
    const body = Object.fromEntries(Object.entries(made).filter(([key]) => key !== 'id'));
    const items: Value[] = [{ ...lead, ...body, ...mine }];
    return { items, list: false, popups: Array.isArray(built) ? built : [] };
  } catch (error) {
    if (error instanceof NotCopyable) {
      return undefined;
    }
    throw error;
  }
}
