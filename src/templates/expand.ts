import { isMapping } from '../contract/templates.ts';
import type {
  Instance,
  Kind,
  SlotSpec,
  Template,
  Templates,
  Value,
} from '../contract/templates.ts';

export interface Expanded {
  card: Value;
  popups: Value[];
  missing?: string[];
}

export class TemplateError extends Error {}

type Mapping = Record<string, Value>;

const PATH = '[a-z_][a-z0-9_]*(?:\\.[a-z0-9_]+)*';
const WHOLE = new RegExp(`^\\[\\[(${PATH})\\]\\]$`);
const PART = new RegExp(`\\[\\[(${PATH})\\]\\]`, 'g');
const BRACKETS = /\[\[([^[\]]*)\]\]/g;
const SLOT_PATH = new RegExp(`^${PATH}$`);
const SLOT_NAME = /^[a-z_][a-z0-9_]*$/;
const CONTROL = new Set(['if', 'unless', 'template', 'slots']);
const DROP = Symbol('drop');

type Out = Value | typeof DROP;

interface Scope {
  template: string;
  values: ReadonlyMap<string, Value | undefined>;
  specs: ReadonlyMap<string, SlotSpec | undefined>;
}

interface Context {
  templates: Templates;
  later: ReadonlySet<string>;
  missing: Set<string>;
  stack: readonly string[];
  popups: Value[];
}

export function filled(value: Value | undefined): boolean {
  if (value === undefined || value === null || value === false || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return !isMapping(value) || Object.keys(value).length > 0;
}

function fail(template: string, where: string, problem: string): never {
  throw new TemplateError(`${template}${where === '' ? '' : ` at ${where}`}: ${problem}`);
}

const KINDS: Record<Kind, (value: Value) => boolean> = {
  text: (value) => typeof value === 'string',
  texts: (value) => Array.isArray(value) && value.every((item) => typeof item === 'string'),
  number: (value) => typeof value === 'number',
  icon: (value) => typeof value === 'string',
  flag: (value) => value === true,
  entity: (value) => typeof value === 'string' && value.includes('.'),
  entities: (value) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string' && item.includes('.')),
  object: isMapping,
  objects: (value) => Array.isArray(value) && value.every(isMapping),
};

export function fitsKind(kind: Kind, value: Value): boolean {
  return KINDS[kind](value);
}

function member(spec: SlotSpec | undefined): SlotSpec | undefined {
  if (spec?.kind === 'objects') {
    return spec.fields === undefined ? undefined : { kind: 'object', fields: spec.fields };
  }
  if (spec?.kind === 'entities') {
    return { kind: 'entity' };
  }
  return spec?.kind === 'texts' ? { kind: 'text' } : undefined;
}

function step(spec: SlotSpec | undefined, name: string, at: string, scope: Scope, where: string) {
  if (spec?.kind !== 'object') {
    return member(spec);
  }
  if (spec.fields === undefined) {
    return undefined;
  }
  if (!Object.hasOwn(spec.fields, name)) {
    fail(scope.template, where, `${at} has no field named ${name}`);
  }
  return spec.fields[name];
}

function walk(path: string, scope: Scope, where: string) {
  const [head = '', ...rest] = path.split('.');
  if (!scope.values.has(head)) {
    fail(scope.template, where, `no slot named ${head}`);
  }
  let value = scope.values.get(head);
  let spec = scope.specs.get(head);
  let at = head;
  for (const name of rest) {
    spec = step(spec, name, at, scope, where);
    at = `${at}.${name}`;
    if (Array.isArray(value)) {
      value = value[Number(name)];
    } else if (isMapping(value)) {
      value = value[name];
    } else {
      value = undefined;
    }
  }
  return { value, spec };
}

function lookup(path: string, scope: Scope, where: string): Value | undefined {
  return walk(path, scope, where).value;
}

function interpolate(text: string, scope: Scope, where: string): Out {
  const whole = WHOLE.exec(text)?.[1];
  if (whole !== undefined) {
    const value = lookup(whole, scope, where);
    return value === undefined || value === null ? DROP : value;
  }
  for (const [written, inside = ''] of text.matchAll(BRACKETS)) {
    if (!SLOT_PATH.test(inside)) {
      fail(
        scope.template,
        where,
        `${written} is not a slot path: paths are lower case letters, digits, _ and .`,
      );
    }
  }
  return text.replace(PART, (_match: string, path: string) => {
    const value = lookup(path, scope, where);
    if ((typeof value === 'string' && value !== '') || typeof value === 'number') {
      return String(value);
    }
    return fail(
      scope.template,
      where,
      `${path} is ${typeof value === 'string' || value === undefined || value === null ? 'unfilled' : 'not text'}`,
    );
  });
}

function names(node: Mapping, key: string, scope: Scope, where: string): string[] {
  const value = node[key];
  if (value === undefined) {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value) && value.every((item): item is string => typeof item === 'string')) {
    return value;
  }
  return fail(scope.template, where, `${key}: takes a slot or a list of slots`);
}

function holds(node: Mapping, scope: Scope, where: string): boolean {
  const any = names(node, 'if', scope, where);
  const none = names(node, 'unless', scope, where);
  if (any.length > 0 && !any.some((name) => filled(lookup(name, scope, where)))) {
    return false;
  }
  return !none.some((name) => filled(lookup(name, scope, where)));
}

function push(out: Value[], value: Out): void {
  if (value === DROP) {
    return;
  }
  if (Array.isArray(value)) {
    out.push(...value);
  } else {
    out.push(value);
  }
}

function renderList(
  items: readonly Value[],
  scope: Scope,
  context: Context,
  where: string,
): Value[] {
  const out: Value[] = [];
  for (const [index, item] of items.entries()) {
    const at = `${where}[${index}]`;
    if (isMapping(item) && item['each'] === undefined) {
      push(out, renderMapping(item, scope, context, at, true));
      continue;
    }
    if (!isMapping(item)) {
      push(out, render(item, scope, context, at));
      continue;
    }
    const list = item['each'];
    const alias = item['as'];
    if (typeof list !== 'string' || typeof alias !== 'string') {
      fail(scope.template, at, 'each: takes a list slot, and as: a name for its element');
    }
    if (scope.values.has(alias)) {
      fail(scope.template, at, `as: ${alias} hides a slot of the same name`);
    }
    const { value: elements, spec } = walk(list, scope, at);
    if (elements !== undefined && elements !== null && !Array.isArray(elements)) {
      fail(scope.template, at, `${list} is not a list`);
    }
    const body = Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== 'each' && key !== 'as'),
    );
    for (const element of elements ?? []) {
      const inner = {
        template: scope.template,
        values: new Map([...scope.values, [alias, element]]),
        specs: new Map([...scope.specs, [alias, member(spec)]]),
      };
      push(out, renderMapping(body, inner, context, at, true));
    }
  }
  return out;
}

function renderMapping(
  node: Mapping,
  scope: Scope,
  context: Context,
  where: string,
  item = false,
): Out {
  if (node['each'] !== undefined || node['as'] !== undefined) {
    fail(scope.template, where, 'each: belongs on an item of a list');
  }
  if (!holds(node, scope, where)) {
    return DROP;
  }
  const own: Mapping = {};
  for (const [written, value] of Object.entries(node)) {
    if (CONTROL.has(written) || (item && written === 'id')) {
      continue;
    }
    const optional = written.endsWith('?');
    const key = optional ? written.slice(0, -1) : written;
    const rendered = render(value, scope, context, where === '' ? key : `${where}.${key}`);
    if (rendered === DROP || (optional && !filled(rendered))) {
      continue;
    }
    own[key] = rendered;
  }
  const name = node['template'];
  if (name === undefined) {
    if (node['slots'] !== undefined) {
      fail(scope.template, where, 'slots: belongs beside template:');
    }
    return own;
  }
  if (typeof name !== 'string') {
    return fail(scope.template, where, 'template: takes a name');
  }
  const slots =
    node['slots'] === undefined ? {} : render(node['slots'], scope, context, `${where}.slots`);
  if (!isMapping(slots)) {
    return fail(scope.template, where, 'slots: must be a mapping');
  }
  const base = expandNamed(name, slots, {}, context, scope.template, where);
  if (base === DROP || Object.keys(own).length === 0) {
    return base;
  }
  if (!isMapping(base)) {
    return fail(scope.template, where, `${name} draws a list, so no keys can be added to it`);
  }
  return { ...base, ...own };
}

function render(node: Value, scope: Scope, context: Context, where: string): Out {
  if (typeof node === 'string') {
    return interpolate(node, scope, where);
  }
  if (Array.isArray(node)) {
    return renderList(node, scope, context, where);
  }
  if (isMapping(node)) {
    return renderMapping(node, scope, context, where);
  }
  return node;
}

function settle(
  value: Value | undefined,
  spec: SlotSpec,
  at: string,
  who: string,
): Value | undefined {
  if (spec.required && !filled(value)) {
    fail(who, '', `the slot ${at} is required`);
  }
  if (value === undefined || value === null || value === false) {
    return undefined;
  }
  if (!filled(value)) {
    return value;
  }
  if (!KINDS[spec.kind](value)) {
    fail(who, '', `${at} is not ${spec.kind === 'number' ? 'a number' : `of kind ${spec.kind}`}`);
  }
  const fields = spec.fields;
  if (fields === undefined) {
    return value;
  }
  const shape = (item: Mapping, prefix: string): Mapping => {
    for (const key of Object.keys(item)) {
      if (!Object.hasOwn(fields, key)) {
        fail(who, '', `${prefix} has no field named ${key}`);
      }
    }
    const out: Mapping = {};
    for (const [key, inner] of Object.entries(fields)) {
      const settled = settle(item[key] ?? inner.default, inner, `${prefix}.${key}`, who);
      if (settled !== undefined) {
        out[key] = settled;
      }
    }
    return out;
  };
  if (Array.isArray(value)) {
    return value.map((item, index) => shape(isMapping(item) ? item : {}, `${at}[${index}]`));
  }
  return isMapping(value) ? shape(value, at) : value;
}

const KIND_NAMES = Object.keys(KINDS).join(', ');
const CHECKED = new WeakSet<object>();

function checkSlots(who: string, slots: unknown, prefix: string): void {
  if (slots === undefined) {
    return;
  }
  if (!isMapping(slots)) {
    fail(who, '', `${prefix === '' ? 'slots' : `the fields of ${prefix}`} must be a mapping`);
  }
  for (const [name, spec] of Object.entries(slots)) {
    const at = prefix === '' ? name : `${prefix}.${name}`;
    if (!SLOT_NAME.test(name)) {
      fail(who, '', `the slot name ${at} is not lower case letters, digits and _`);
    }
    const kind = isMapping(spec) ? spec['kind'] : undefined;
    if (typeof kind !== 'string' || !Object.hasOwn(KINDS, kind)) {
      fail(
        who,
        '',
        `the slot ${at} has the kind ${kind === undefined ? 'none' : typeof kind === 'string' ? kind : JSON.stringify(kind)}, which is none of ${KIND_NAMES}`,
      );
    }
    if (isMapping(spec) && spec['required'] !== undefined && spec['required'] !== true) {
      fail(who, '', `the slot ${at} takes required: true, or no required`);
    }
    checkSlots(who, isMapping(spec) ? spec['fields'] : undefined, at);
  }
}

function resolve(
  name: string,
  who: string,
  template: Template,
  given: Mapping,
  discovered: Mapping,
): Scope {
  if (!CHECKED.has(template)) {
    checkSlots(who, template.slots, '');
    CHECKED.add(template);
  }
  const specs: Record<string, SlotSpec> = template.slots ?? {};
  for (const key of Object.keys(given)) {
    if (!Object.hasOwn(specs, key)) {
      fail(who, '', `no slot named ${key}`);
    }
  }
  const values = new Map<string, Value | undefined>();
  for (const [slot, spec] of Object.entries(specs)) {
    const value = Object.hasOwn(given, slot) ? given[slot] : (discovered[slot] ?? spec.default);
    values.set(slot, settle(value, spec, slot, who));
  }
  return { template: name, values, specs: new Map(Object.entries(specs)) };
}

function expandNamed(
  name: string,
  given: Mapping,
  discovered: Mapping,
  context: Context,
  caller: string,
  where: string,
): Out {
  const template = context.templates[name];
  if (template === undefined && context.later.has(name)) {
    context.missing.add(name);
    return DROP;
  }
  if (template === undefined) {
    return fail(caller, where, `no template named ${name}`);
  }
  if (context.stack.includes(name)) {
    return fail(caller, where, `${name} includes itself`);
  }
  const inner: Context = { ...context, stack: [...context.stack, name] };
  const who = where === '' ? name : `${caller} at ${where}: ${name}`;
  const scope = resolve(name, who, template, given, discovered);
  const card = render(template.card, scope, inner, 'card');
  context.popups.push(...renderList(template.popups ?? [], scope, inner, 'popups'));
  return card;
}

export function toValue(input: unknown): Value {
  if (
    input === null ||
    typeof input === 'string' ||
    typeof input === 'number' ||
    typeof input === 'boolean'
  ) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(toValue);
  }
  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, toValue(item)]),
    );
  }
  throw new TemplateError(`${typeof input} is not a template value`);
}

export function expand(
  templates: Templates,
  instance: Instance,
  discovered: Record<string, Value> = {},
  later: ReadonlySet<string> = new Set(),
): Expanded {
  const context: Context = { templates, later, missing: new Set(), stack: [], popups: [] };
  const waiting = (): Expanded => ({
    card: null,
    popups: [],
    missing: [...context.missing].toSorted(),
  });
  let card: Out;
  try {
    card = expandNamed(
      instance.template,
      instance.slots ?? {},
      discovered,
      context,
      instance.template,
      '',
    );
  } catch (error) {
    if (error instanceof TemplateError && context.missing.size > 0) {
      return waiting();
    }
    throw error;
  }
  if (context.missing.size > 0) {
    return waiting();
  }
  if (card === DROP) {
    throw new TemplateError(`${instance.template}: draws nothing with these slots`);
  }
  return { card, popups: context.popups };
}
