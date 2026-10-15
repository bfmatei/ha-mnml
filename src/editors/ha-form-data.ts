import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { humanise } from '../ha/format.ts';
import { filled } from '../templates/expand.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';

import { cleanField, place, starter } from './form.ts';
import type { Field, PlainForm } from './form.ts';
import { CORNERS } from './lists.ts';
import type { PopupChoice } from './popup-names.ts';

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

const RULE_PARTS = ['entity', 'attribute', 'is', 'not'];
const RULE_SELECTORS: Readonly<Record<string, Value>> = {
  entity: { entity: {} },
  attribute: { text: {} },
};
const RULE_TEXTS = new Set(['entity', 'attribute']);

const entityFilter = (field: Field): Record<string, Value> =>
  field.domains === undefined ? {} : { filter: { domain: [...field.domains] } };

function selectorOf(field: Field, popups: readonly PopupChoice[]): Value {
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
      return {
        select: {
          mode: 'dropdown',
          custom_value: true,
          options: popups.map(({ value, label }) => ({ value, label })),
        },
      };
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
    case 'corners':
    case 'rule':
    case 'summary':
    case 'words':
    case 'part':
    case 'parts': {
      return {};
    }
  }
}

function itemsOf(key: string, field: Field, popups: readonly PopupChoice[]): FormItem[] {
  const required = field.required === true;
  if (field.kind === 'corners') {
    return [
      {
        name: '',
        type: 'grid',
        flatten: true,
        schema: CORNERS.map((index) => ({
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
          const selector: Value = RULE_SELECTORS[name] ?? { text: { multiple: true } };
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
  return [{ name: key, required, selector: selectorOf(field, popups) }];
}

export function schemaOf(
  form: PlainForm,
  keys: readonly string[],
  popups: readonly PopupChoice[],
): FormItem[] {
  return keys.flatMap((key) => {
    const field = form.fields[key];
    return field === undefined || !isSimple(field) ? [] : itemsOf(key, field, popups);
  });
}

export function labelFor(form: PlainForm, name: string, words: EditorWords): string {
  const [key = name, inner] = name.split('.');
  const field = form.fields[key];
  const head = form.labels?.[key] ?? field?.label ?? humanise(key);
  if (inner === undefined) {
    return head;
  }
  if (field?.kind === 'corners') {
    return `${head}: ${words.corners[Number(inner)] ?? inner}`;
  }
  if (field?.kind === 'summary') {
    return words.sumColumn(head);
  }
  return `${head}: ${new Map(Object.entries(words.rule)).get(inner) ?? inner}`;
}

export function formData(
  form: PlainForm,
  keys: readonly string[],
  value: Record<string, Value>,
): Record<string, Value> {
  const data: Record<string, Value> = {};
  for (const key of keys) {
    const field = form.fields[key];
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
      const ids = CORNERS.map((index) => asText(data[`${key}.${index}`]) ?? '');
      return ids.every((id) => id === '') ? undefined : ids;
    }
    case 'rule': {
      const own = field.withEntity === true ? RULE_PARTS : RULE_PARTS.slice(1);
      const order = [...new Set([...(isMapping(previous) ? Object.keys(previous) : []), ...own])];
      const rule: Record<string, Value> = {};
      for (const name of order.filter((each) => own.includes(each))) {
        const inner = data[`${key}.${name}`];
        const kept = RULE_TEXTS.has(name) ? asText(inner) : asTexts(inner);
        if (kept !== undefined) {
          rule[name] = kept;
        }
      }
      return Object.keys(rule).length === 0 ? undefined : rule;
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
    case 'text':
    case 'icon':
    case 'entity':
    case 'choice':
    case 'service':
    case 'color': {
      return asText(raw);
    }
    case 'words':
    case 'part':
    case 'parts': {
      return undefined;
    }
  }
}

const entriesOf = (key: string, data: Readonly<Record<string, unknown>>): Map<string, unknown> =>
  new Map(Object.entries(data).filter(([name]) => name === key || name.startsWith(`${key}.`)));

function changed(
  form: PlainForm,
  key: string,
  data: Readonly<Record<string, unknown>>,
  value: Record<string, Value>,
): boolean {
  const before = entriesOf(key, formData(form, [key], value));
  const after = entriesOf(key, data);
  return [...new Set([...before.keys(), ...after.keys()])].some(
    (name) => JSON.stringify(before.get(name)) !== JSON.stringify(after.get(name)),
  );
}

type Finish = (field: Field, found: Value | undefined, was: Value | undefined) => Value | undefined;

function readForm(
  form: PlainForm,
  keys: readonly string[],
  data: Readonly<Record<string, unknown>>,
  value: Record<string, Value>,
  finish: Finish,
): Record<string, Value> {
  let next = value;
  for (const key of keys) {
    const field = form.fields[key];
    if (field === undefined || !isSimple(field) || !changed(form, key, data, value)) {
      continue;
    }
    const found = fieldFrom(key, field, data, next[key]);
    const kept =
      found === undefined && field.required === true && KEPT_EMPTY.has(field.kind)
        ? starter(field)
        : found;
    next = place(form, next, key, finish(field, kept, value[key]));
  }
  return next;
}

export function fromForm(
  form: PlainForm,
  keys: readonly string[],
  data: Readonly<Record<string, unknown>>,
  value: Record<string, Value>,
): Record<string, Value> {
  return readForm(form, keys, data, value, (field, found, was) =>
    found === undefined ? undefined : cleanField(field, found, was),
  );
}

export function slotsFromForm(
  form: PlainForm,
  keys: readonly string[],
  data: Readonly<Record<string, unknown>>,
  value: Record<string, Value>,
): Record<string, Value> {
  return readForm(form, keys, data, value, (field, found) => {
    if (field.required === true || filled(found)) {
      return found;
    }
    return field.default === undefined ? undefined : null;
  });
}
