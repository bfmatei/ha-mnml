import { LAYOUT } from '../cards/keys.ts';
import { chooseVariant } from '../contract/structure.ts';
import type { KeyKind } from '../contract/structure.ts';
import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';

type FieldKind = Exclude<KeyKind, 'cards' | 'slots'>;

export interface Field {
  readonly kind: FieldKind;
  readonly required?: true;
  readonly label?: string;
  readonly default?: Value;
  readonly options?: readonly string[];
  readonly domains?: readonly string[];
  readonly writes?: string;
  readonly withEntity?: true;
  readonly of?: Shape;
}

export interface Section {
  readonly title: string;
  readonly keys: readonly string[];
}

export interface PlainShape {
  readonly kind: 'plain';
  readonly id: string;
  readonly label: string;
  readonly fields: Readonly<Record<string, Field>>;
  readonly sections: readonly Section[];
  readonly labels?: Readonly<Record<string, string>>;
  readonly help?: Readonly<Record<string, string>>;
  readonly variants?: never;
}

interface Variant {
  readonly when: string | undefined;
  readonly shape: PlainShape;
}

export interface ChoiceShape {
  readonly kind: 'tagged' | 'marked';
  readonly id: string;
  readonly label: string;
  readonly fields?: never;
  readonly sections?: never;
  readonly variants: readonly Variant[];
}

export type Shape = PlainShape | ChoiceShape;

export class Unsupported extends Error {}

const ENTITY_ID = /^[a-z_]+\.[a-z0-9_]+$/;

const at = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

export function variantOf(shape: Shape, value: Record<string, Value>, path = ''): PlainShape {
  if (shape.kind === 'plain') {
    return shape;
  }
  const found = chooseVariant(shape, (key) => Object.hasOwn(value, key), value['type']);
  if (found !== undefined) {
    return found.shape;
  }
  if (shape.kind === 'tagged') {
    const known = shape.variants.map((variant) => variant.when).join(', ');
    throw new Unsupported(`${at(path, 'type')} is not one of ${known}`);
  }
  throw new Unsupported(
    `${path === '' ? 'the card' : path} is none of the kinds of ${shape.label}`,
  );
}

function isEntityOf(value: unknown, domains: readonly string[] | undefined): boolean {
  if (value === '') {
    return true;
  }
  if (typeof value !== 'string' || !ENTITY_ID.test(value)) {
    return false;
  }
  return domains === undefined || domains.includes(value.split('.')[0] ?? '');
}

const entityWords = (domains: readonly string[] | undefined): string =>
  domains === undefined ? 'an entity' : `an entity of ${domains.join(' or ')}`;

const isTexts = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function fail(where: string, what: string): never {
  throw new Unsupported(`${where} is not ${what}`);
}

function shapeOf(spec: Field, where: string): Shape {
  if (spec.of === undefined) {
    throw new Error(`${where}: the description gives no shape`);
  }
  return spec.of;
}

function checkRule(spec: Field, value: Value, where: string): void {
  if (!isMapping(value)) {
    fail(where, 'a rule');
  }
  for (const [key, inner] of Object.entries(value)) {
    if (key === 'entity' && spec.withEntity === true) {
      if (!isEntityOf(inner, undefined)) {
        fail(at(where, key), 'an entity');
      }
    } else if (key === 'is' || key === 'not') {
      if (!isTexts(inner)) {
        fail(at(where, key), 'a list of states');
      }
    } else {
      throw new Unsupported(`${at(where, key)} is not a key the editor knows`);
    }
  }
}

function checkField(spec: Field, value: Value, where: string): void {
  switch (spec.kind) {
    case 'text':
    case 'icon': {
      if (typeof value !== 'string') {
        fail(where, spec.kind === 'icon' ? 'an icon' : 'a text');
      }
      return;
    }
    case 'texts': {
      if (!isTexts(value)) {
        fail(where, 'a list of texts');
      }
      return;
    }
    case 'number':
    case 'share': {
      if (typeof value !== 'number') {
        fail(where, 'a number');
      }
      return;
    }
    case 'flag': {
      if (value !== (spec.writes ?? true)) {
        fail(where, spec.writes === undefined ? 'true' : `'${spec.writes}'`);
      }
      return;
    }
    case 'choice':
    case 'service':
    case 'color': {
      const options = spec.options ?? [];
      if (typeof value !== 'string' || !options.includes(value)) {
        fail(where, `one of ${options.join(', ')}`);
      }
      return;
    }
    case 'entity': {
      if (!isEntityOf(value, spec.domains)) {
        fail(where, entityWords(spec.domains));
      }
      return;
    }
    case 'entities': {
      if (!Array.isArray(value) || !value.every((item) => isEntityOf(item, spec.domains))) {
        fail(where, `a list, each ${entityWords(spec.domains)}`);
      }
      return;
    }
    case 'popup': {
      if (typeof value !== 'string' || !(value === '' || value.startsWith('#'))) {
        fail(where, 'a pop-up hash');
      }
      return;
    }
    case 'words': {
      const options = spec.options;
      const fits = (word: Value): boolean =>
        typeof word === 'string' && (options === undefined || options.includes(word));
      if (!isMapping(value) || !Object.values(value).every(fits)) {
        fail(
          where,
          options === undefined
            ? 'a mapping of states to words'
            : `a mapping of words to one of ${options.join(', ')}`,
        );
      }
      return;
    }
    case 'corners': {
      if (
        !Array.isArray(value) ||
        value.length !== 4 ||
        !value.every((item) => isEntityOf(item, spec.domains))
      ) {
        fail(
          where,
          `four of ${entityWords(spec.domains)}: front left, front right, rear left, rear right`,
        );
      }
      return;
    }
    case 'rule': {
      checkRule(spec, value, where);
      return;
    }
    case 'summary': {
      const sum =
        isMapping(value) && Object.keys(value).length === 1 && typeof value['sum'] === 'number';
      if (value !== 'lowest' && value !== 'highest' && !sum) {
        fail(where, "'lowest', 'highest' or a sum");
      }
      return;
    }
    case 'part': {
      checkValue(shapeOf(spec, where), value, where);
      return;
    }
    case 'parts': {
      const of = shapeOf(spec, where);
      if (!Array.isArray(value)) {
        fail(where, 'a list');
      }
      for (const [index, item] of value.entries()) {
        checkValue(of, item, `${where}[${index}]`);
      }
    }
  }
}

export function checkValue(shape: Shape, value: unknown, path = ''): void {
  if (!isMapping(value)) {
    throw new Unsupported(`${path === '' ? 'the card' : path} is not a mapping`);
  }
  const chosen = variantOf(shape, value, path);
  for (const [key, inner] of Object.entries(value)) {
    const skipped = path === '' ? LAYOUT.has(key) : key === 'type' && shape.kind === 'tagged';
    if (skipped) {
      continue;
    }
    const spec = chosen.fields[key];
    if (spec === undefined) {
      throw new Unsupported(`${at(path, key)} is not a key the editor knows`);
    }
    checkField(spec, inner, at(path, key));
  }
}

const emptied = (value: Value): boolean =>
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (isMapping(value) && Object.keys(value).length === 0);

const same = (a: Value | undefined, b: Value | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

function cleanItems(of: Shape, items: readonly Value[], before: Value | undefined): Value[] {
  const old = Array.isArray(before) ? before : [];
  return items.map((item, index) => {
    if (!isMapping(item) || old.some((each) => same(each, item))) {
      return item;
    }
    const was = old[index];
    return cleanValue(of, item, isMapping(was) ? was : undefined);
  });
}

export function cleanField(spec: Field, value: Value, before?: Value): Value | undefined {
  if (spec.kind === 'flag' && value !== (spec.writes ?? true)) {
    return undefined;
  }
  let kept = value;
  if (spec.kind === 'part' && spec.of !== undefined && isMapping(value)) {
    kept = cleanValue(spec.of, value, isMapping(before) ? before : undefined);
  } else if (spec.kind === 'parts' && spec.of !== undefined && Array.isArray(value)) {
    kept = cleanItems(spec.of, value, before);
  } else if (spec.kind === 'rule' && isMapping(value)) {
    kept = Object.fromEntries(Object.entries(value).filter(([, inner]) => !emptied(inner)));
  }
  if (spec.required === true) {
    return kept;
  }
  if (emptied(kept)) {
    return spec.default !== undefined && (spec.kind === 'texts' || spec.kind === 'entities')
      ? kept
      : undefined;
  }
  if (spec.default !== undefined && same(kept, spec.default)) {
    return undefined;
  }
  return kept;
}

export function cleanValue(
  shape: Shape,
  value: Record<string, Value>,
  before?: Readonly<Record<string, Value>>,
): Record<string, Value> {
  const chosen = variantOf(shape, value);
  const out: Record<string, Value> = {};
  for (const [key, inner] of Object.entries(value)) {
    const spec = chosen.fields[key];
    const unchanged = before !== undefined && same(inner, before[key]);
    const kept = spec === undefined || unchanged ? inner : cleanField(spec, inner, before?.[key]);
    if (kept !== undefined) {
      out[key] = kept;
    }
  }
  return out;
}

export function place(
  shape: PlainShape,
  value: Record<string, Value>,
  key: string,
  next: Value | undefined,
): Record<string, Value> {
  const entries = Object.entries(value);
  if (next === undefined) {
    return Object.fromEntries(entries.filter(([name]) => name !== key));
  }
  if (Object.hasOwn(value, key)) {
    return Object.fromEntries(entries.map(([name, old]) => [name, name === key ? next : old]));
  }
  const order = Object.keys(shape.fields);
  const earlier = new Set(order.slice(0, Math.max(order.indexOf(key), 0)));
  let index = Object.hasOwn(shape.fields, 'type')
    ? 0
    : entries.findIndex(([name]) => name === 'type') + 1;
  for (const [position, [name]] of entries.entries()) {
    if (earlier.has(name)) {
      index = position + 1;
    }
  }
  return Object.fromEntries([...entries.slice(0, index), [key, next], ...entries.slice(index)]);
}

export function starter(spec: Field): Value {
  if (spec.kind === 'flag') {
    return spec.writes ?? true;
  }
  if (spec.kind === 'corners') {
    return ['', '', '', ''];
  }
  return spec.kind === 'entities' || spec.kind === 'texts' || spec.kind === 'parts' ? [] : '';
}

export function switchVariant(
  shape: ChoiceShape,
  value: Record<string, Value>,
  when: string | undefined,
): Record<string, Value> {
  const target = shape.variants.find((variant) => variant.when === when);
  if (target === undefined) {
    throw new Error(`${shape.id} has no kind ${String(when)}`);
  }
  if (variantOf(shape, value) === target.shape) {
    return value;
  }
  const markers = new Set(shape.variants.flatMap((variant) => variant.when ?? []));
  const fits = (key: string, inner: Value): boolean => {
    const spec = target.shape.fields[key];
    if (spec === undefined) {
      return false;
    }
    try {
      checkField(spec, inner, key);
      return true;
    } catch {
      return false;
    }
  };
  if (shape.kind === 'tagged') {
    const kept = Object.entries(value).filter(([key, inner]) => key !== 'type' && fits(key, inner));
    return Object.fromEntries([['type', when ?? ''], ...kept]);
  }
  const base = Object.fromEntries(
    Object.entries(value).filter(
      ([key, inner]) => LAYOUT.has(key) || (fits(key, inner) && !markers.has(key)),
    ),
  );
  if (when === undefined) {
    return base;
  }
  const marker = target.shape.fields[when];
  return place(target.shape, base, when, marker === undefined ? '' : starter(marker));
}

const LABEL_KEYS = ['name', 'title', 'text', 'attribute', 'source', 'subnet'];

export function labelOf(
  shape: Shape,
  value: Value,
  index: number,
  named: (id: string) => string = (id) => id,
): string {
  const kind = isMapping(value) ? variantOf(shape, value).label : shape.label;
  const own = isMapping(value)
    ? LABEL_KEYS.map((key) => value[key]).find((found) => typeof found === 'string' && found !== '')
    : undefined;
  const entity = isMapping(value) ? (value['entity'] ?? value['group']) : undefined;
  const main =
    typeof own === 'string'
      ? own
      : typeof entity === 'string' && entity !== ''
        ? named(entity)
        : undefined;
  if (main === undefined) {
    return `${kind} ${index + 1}`;
  }
  return shape.kind === 'plain' ? main : `${kind}: ${main}`;
}
