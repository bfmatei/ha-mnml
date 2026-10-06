import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';

import { CORNER_NAMES } from './lists.ts';
import { cleanValue, place, starter } from './shape.ts';
import type { Field, PlainShape } from './shape.ts';

export interface FormItem {
  readonly name: string;
  readonly required?: boolean;
  readonly selector?: Value;
  readonly type?: 'grid';
  readonly flatten?: boolean;
  readonly schema?: readonly FormItem[];
}

const DRAWN_ELSEWHERE = new Set(['words', 'part', 'parts']);
const KEPT_EMPTY = new Set(['text', 'icon', 'entity', 'entities', 'texts', 'popup', 'corners']);

export const isSimple = (field: Field): boolean => !DRAWN_ELSEWHERE.has(field.kind);

const RULE_PARTS = ['entity', 'is', 'not'];
const RULE_WORDS: Readonly<Record<string, string>> = {
  entity: 'entity',
  is: 'states',
  not: 'not these states',
};

const entityFilter = (field: Field): Record<string, Value> =>
  field.domains === undefined ? {} : { filter: { domain: [...field.domains] } };

function selectorOf(field: Field, hashes: readonly string[]): Value {
  switch (field.kind) {
    case 'text': {
      return { text: {} };
    }
    case 'texts': {
      return { text: { multiple: true } };
    }
    case 'number': {
      return { number: { mode: 'box' } };
    }
    case 'share': {
      return { number: { mode: 'box', min: 0, max: 1, step: 0.01 } };
    }
    case 'flag': {
      return { boolean: {} };
    }
    case 'choice':
    case 'service':
    case 'color': {
      return { select: { mode: 'dropdown', options: [...(field.options ?? [])] } };
    }
    case 'popup': {
      return { select: { mode: 'dropdown', custom_value: true, options: [...hashes] } };
    }
    case 'entity': {
      return { entity: entityFilter(field) };
    }
    case 'entities': {
      return { entity: { ...entityFilter(field), multiple: true } };
    }
    case 'icon': {
      return { icon: {} };
    }
    default: {
      return {};
    }
  }
}

function itemsOf(key: string, field: Field, hashes: readonly string[]): FormItem[] {
  const required = field.required === true;
  if (field.kind === 'corners') {
    return [
      {
        name: '',
        type: 'grid',
        flatten: true,
        schema: CORNER_NAMES.map((_, index) => ({
          name: `${key}.${index}`,
          required,
          selector: { entity: entityFilter(field) },
        })),
      },
    ];
  }
  if (field.kind === 'rule') {
    const own = field.withEntity === true ? RULE_PARTS : RULE_PARTS.slice(1);
    return [
      {
        name: '',
        type: 'grid',
        flatten: true,
        schema: own.map((name): FormItem => {
          const selector: Value = name === 'entity' ? { entity: {} } : { text: { multiple: true } };
          return { name: `${key}.${name}`, required: false, selector };
        }),
      },
    ];
  }
  if (field.kind === 'summary') {
    return [
      {
        name: key,
        required,
        selector: { select: { mode: 'dropdown', options: ['lowest', 'highest', 'sum'] } },
      },
      { name: `${key}.sum`, required: false, selector: { number: { mode: 'box' } } },
    ];
  }
  return [{ name: key, required, selector: selectorOf(field, hashes) }];
}

export function schemaOf(
  shape: PlainShape,
  keys: readonly string[],
  hashes: readonly string[],
): FormItem[] {
  return keys.flatMap((key) => {
    const field = shape.fields[key];
    return field === undefined || !isSimple(field) ? [] : itemsOf(key, field, hashes);
  });
}

const humanize = (key: string): string => {
  const words = key.replaceAll('_', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

export function labelFor(shape: PlainShape, name: string): string {
  const [key = name, inner] = name.split('.');
  const field = shape.fields[key];
  const head = field?.label ?? humanize(key);
  if (inner === undefined) {
    return head;
  }
  if (field?.kind === 'corners') {
    return `${head}: ${CORNER_NAMES[Number(inner)] ?? inner}`;
  }
  if (field?.kind === 'summary') {
    return `${head}: the column to sum, 0 for the first value`;
  }
  return `${head}: ${RULE_WORDS[inner] ?? inner}`;
}

export function formData(
  shape: PlainShape,
  keys: readonly string[],
  value: Record<string, Value>,
): Record<string, Value> {
  const data: Record<string, Value> = {};
  for (const key of keys) {
    const field = shape.fields[key];
    const current = value[key];
    if (field === undefined || !isSimple(field) || current === undefined) {
      continue;
    }
    if (field.kind === 'flag') {
      data[key] = current === (field.writes ?? true);
    } else if (field.kind === 'corners' && Array.isArray(current)) {
      for (const [index, id] of current.entries()) {
        data[`${key}.${index}`] = id;
      }
    } else if (field.kind === 'rule' && isMapping(current)) {
      for (const [name, inner] of Object.entries(current)) {
        data[`${key}.${name}`] = inner;
      }
    } else if (field.kind === 'summary' && isMapping(current)) {
      data[key] = 'sum';
      data[`${key}.sum`] = current['sum'] ?? null;
    } else {
      data[key] = current;
    }
  }
  return data;
}

const asText = (raw: unknown): string | undefined => (typeof raw === 'string' ? raw : undefined);
const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
const asTexts = (raw: unknown): string[] | undefined =>
  Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : undefined;

function fieldFrom(
  key: string,
  field: Field,
  data: Readonly<Record<string, unknown>>,
  previous: Value | undefined,
): Value | undefined {
  const raw = data[key];
  switch (field.kind) {
    case 'flag': {
      return raw === true ? (field.writes ?? true) : undefined;
    }
    case 'number':
    case 'share': {
      return asNumber(raw);
    }
    case 'texts':
    case 'entities': {
      return asTexts(raw);
    }
    case 'corners': {
      const ids = CORNER_NAMES.map((_, index) => asText(data[`${key}.${index}`]) ?? '');
      return ids.every((id) => id === '') ? undefined : ids;
    }
    case 'rule': {
      const own = field.withEntity === true ? RULE_PARTS : RULE_PARTS.slice(1);
      const order = [...new Set([...(isMapping(previous) ? Object.keys(previous) : []), ...own])];
      const rule: Record<string, Value> = {};
      for (const name of order.filter((each) => own.includes(each))) {
        const inner = data[`${key}.${name}`];
        const kept = name === 'entity' ? asText(inner) : asTexts(inner);
        if (kept !== undefined) {
          rule[name] = kept;
        }
      }
      return rule;
    }
    case 'popup': {
      const hash = asText(raw);
      return hash === undefined || hash === '' || hash.startsWith('#') ? hash : `#${hash}`;
    }
    case 'summary': {
      if (raw === 'sum') {
        return { sum: asNumber(data[`${key}.sum`]) ?? 0 };
      }
      return raw === 'lowest' || raw === 'highest' ? raw : undefined;
    }
    default: {
      return asText(raw);
    }
  }
}

export function fromForm(
  shape: PlainShape,
  keys: readonly string[],
  data: Readonly<Record<string, unknown>>,
  value: Record<string, Value>,
): Record<string, Value> {
  let next = value;
  for (const key of keys) {
    const field = shape.fields[key];
    if (field === undefined || !isSimple(field)) {
      continue;
    }
    const found = fieldFrom(key, field, data, next[key]);
    const kept =
      found === undefined && field.required === true && KEPT_EMPTY.has(field.kind)
        ? starter(field)
        : found;
    next = place(shape, next, key, kept);
  }
  return cleanValue(shape, next);
}
