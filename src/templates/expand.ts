import { isLooseEntityId } from '../contract/entities.ts';
import {
  PART_KEY,
  TEMPLATE_KEYS,
  isMapping,
  plainKey,
  lookProblem,
  slotLabel,
  templateTitle,
} from '../contract/templates.ts';
import type {
  Instance,
  Kind,
  SlotSpec,
  Template,
  Templates,
  Value,
} from '../contract/templates.ts';
import { EN } from '../words/en.ts';

export interface Expanded {
  card: Value;
  popups: Value[];
  missing?: string[];
}

export class TemplateError extends Error {
  readonly said: string;

  constructor(message: string, said: string = message) {
    super(message);
    this.said = said;
  }
}

type Mapping = Record<string, Value>;
type WordTable = Readonly<Record<string, string>>;

export const PATH = '[a-z_][a-z0-9_]*(?:\\.(?:[a-z0-9_]+|\\*|[?!][a-z_][a-z0-9_]*))*';
export const OVER = /^(?:\*|([?!])([a-z_][a-z0-9_]*))$/;
const LISTS: ReadonlySet<Kind> = new Set(['entities', 'texts', 'objects']);
const LIST_OF: Readonly<Partial<Record<Kind, Kind>>> = {
  entity: 'entities',
  entities: 'entities',
  text: 'texts',
  icon: 'texts',
  texts: 'texts',
  object: 'objects',
  objects: 'objects',
};
const WHOLE = new RegExp(`^\\[\\[(${PATH})\\]\\]$`);
const PART = new RegExp(`\\[\\[(${PATH})\\]\\]`, 'g');
const BRACKETS = /\[\[([^[\]]*)\]\]/g;
const SLOT_PATH = new RegExp(`^${PATH}$`);
const SLOT_NAME = /^[a-z_][a-z0-9_]*$/;
const RETIRED_PATH = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/;
const DROP = Symbol('drop');
export const WORDS = 'words';
const RESERVED = `is reserved for the words of the card's language`;

type Out = Value | typeof DROP;

interface Scope {
  template: string;
  values: ReadonlyMap<string, Value | undefined>;
  specs: ReadonlyMap<string, SlotSpec | undefined>;
  words: WordTable;
}

export interface Marking {
  singles: ReadonlySet<string>;
}

interface Context {
  templates: Templates;
  later: ReadonlySet<string>;
  missing: Set<string>;
  stack: readonly string[];
  popups: Value[];
  marking?: Marking | undefined;
  trail: readonly string[];
  words: WordTable;
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

function fail(template: string, where: string, problem: string, said?: string): never {
  const message = `${template}${where === '' ? '' : ` at ${where}`}: ${problem}`;
  throw new TemplateError(message, said ?? message);
}

const KIND_WORDS: Readonly<Record<Kind, string>> = {
  text: 'a text',
  texts: 'a list of texts',
  number: 'a number',
  icon: 'an icon',
  flag: 'true, or nothing',
  entity: 'an entity',
  entities: 'a list of entities',
  object: 'its fields',
  objects: 'a list of items',
};

const KINDS: Record<Kind, (value: Value) => boolean> = {
  text: (value) => typeof value === 'string',
  texts: (value) => Array.isArray(value) && value.every((item) => typeof item === 'string'),
  number: (value) => typeof value === 'number',
  icon: (value) => typeof value === 'string',
  flag: (value) => value === true,
  entity: isLooseEntityId,
  entities: (value) => Array.isArray(value) && value.every(isLooseEntityId),
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

interface Walked {
  value: Value | undefined;
  spec: SlotSpec | undefined;
}

function listed(spec: SlotSpec | undefined): SlotSpec | undefined {
  const kind = spec === undefined ? undefined : LIST_OF[spec.kind];
  if (kind === undefined) {
    return undefined;
  }
  return spec?.fields === undefined ? { kind } : { kind, fields: spec.fields };
}

function child(value: Value | undefined, name: string): Value | undefined {
  if (Array.isArray(value)) {
    return value[Number(name)];
  }
  return isMapping(value) ? value[name] : undefined;
}

function follow(
  value: Value | undefined,
  spec: SlotSpec | undefined,
  rest: readonly string[],
  at: string,
  scope: Scope,
  where: string,
): Walked {
  const [name, ...more] = rest;
  if (name === undefined) {
    return { value, spec };
  }
  const over = OVER.exec(name);
  if (over === null) {
    return follow(
      child(value, name),
      step(spec, name, at, scope, where),
      more,
      `${at}.${name}`,
      scope,
      where,
    );
  }
  if (spec !== undefined && !LISTS.has(spec.kind)) {
    fail(scope.template, where, `${at} is not a list`);
  }
  const element = member(spec);
  const [, sign, field] = over;
  if (field !== undefined && spec !== undefined && spec.kind !== 'objects') {
    fail(
      scope.template,
      where,
      `${at} is of kind ${spec.kind}, whose elements have no field ${field}`,
    );
  }
  if (
    field !== undefined &&
    element?.fields !== undefined &&
    !Object.hasOwn(element.fields, field)
  ) {
    fail(scope.template, where, `${at} has no field named ${field}`);
  }
  const into = `${at}.${name}`;
  const shape = listed(follow(undefined, element, more, into, scope, where).spec);
  if (value === undefined || value === null) {
    return { value: undefined, spec: shape };
  }
  if (!Array.isArray(value)) {
    return fail(scope.template, where, `${at} is not a list`);
  }
  const found: Value[] = [];
  for (const item of value) {
    if (field !== undefined && !isMapping(item)) {
      fail(
        scope.template,
        where,
        `${at} holds an element that is not an object, so it has no field ${field}`,
      );
    }
    if (field !== undefined && filled(child(item, field)) !== (sign === '?')) {
      continue;
    }
    const reached = follow(item, element, more, into, scope, where).value;
    if (Array.isArray(reached)) {
      found.push(...reached);
    } else if (reached !== undefined && reached !== null) {
      found.push(reached);
    }
  }
  return { value: found, spec: shape };
}

function word(path: readonly string[], words: WordTable, template: string, where: string): string {
  const [name = '', ...more] = path;
  if (more.length > 0 || !SLOT_NAME.test(name)) {
    return fail(template, where, `${WORDS} takes the name of one word, as [[${WORDS}.lights]]`);
  }
  return (
    (Object.hasOwn(words, name) ? words[name] : undefined) ??
    fail(template, where, `no word named ${name}`)
  );
}

function checkWords(who: string, node: Value | undefined, where: string, words: WordTable): void {
  if (typeof node === 'string') {
    for (const [, path = ''] of node.matchAll(PART)) {
      const [head, ...rest] = path.split('.');
      if (head === WORDS) {
        word(rest, words, who, where);
      }
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) {
      checkWords(who, item, `${where}[${index}]`, words);
    }
    return;
  }
  if (!isMapping(node)) {
    return;
  }
  if (node['as'] === WORDS) {
    fail(who, where, `as: ${WORDS} ${RESERVED}`);
  }
  for (const [written, value] of Object.entries(node)) {
    const key = plainKey(written);
    checkWords(who, value, `${where}.${key}`, words);
  }
}

function walk(path: string, scope: Scope, where: string): Walked {
  const [head = '', ...rest] = path.split('.');
  if (head === WORDS) {
    return { value: word(rest, scope.words, scope.template, where), spec: { kind: 'text' } };
  }
  if (!scope.values.has(head)) {
    fail(scope.template, where, `no slot named ${head}`);
  }
  return follow(scope.values.get(head), scope.specs.get(head), rest, head, scope, where);
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
        `${written} is not a slot path: paths are lower case letters, digits, _ and ., with * over a list`,
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

function entered(context: Context, item: Mapping): Context {
  const id = item['id'];
  return context.marking === undefined || typeof id !== 'string'
    ? context
    : { ...context, trail: [...context.trail, `#${id}`] };
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
      push(out, renderMapping(item, scope, entered(context, item), at, true));
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
        words: scope.words,
      };
      push(out, renderMapping(body, inner, entered(context, item), at, true));
    }
  }
  return out;
}

function renderPlaces(node: Value, scope: Scope, context: Context, where: string): Value[] {
  if (!Array.isArray(node)) {
    return fail(scope.template, where, 'a key ending in ! takes a list written out');
  }
  return node.map((item, index) => {
    const out = render(item, scope, context, `${where}[${index}]`);
    return out === DROP ? null : out;
  });
}

function marked(context: Context, node: Mapping, item: boolean): boolean {
  if (context.marking === undefined) {
    return false;
  }
  if (item) {
    return typeof node['id'] === 'string';
  }
  return context.marking.singles.has(context.trail.join('/'));
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
    if (TEMPLATE_KEYS.has(written) && (item || written !== 'id')) {
      continue;
    }
    const optional = written.endsWith('?');
    const placed = written.endsWith('!');
    const key = plainKey(written);
    const inner =
      context.marking === undefined ? context : { ...context, trail: [...context.trail, written] };
    const at = where === '' ? key : `${where}.${key}`;
    const rendered = placed
      ? renderPlaces(value, scope, inner, at)
      : render(value, scope, inner, at);
    if (rendered === DROP || (optional && !filled(rendered))) {
      continue;
    }
    own[key] = rendered;
  }
  const name = node['template'];
  const mark: Mapping = marked(context, node, item) ? { [PART_KEY]: context.trail.join('/') } : {};
  if (name === undefined) {
    if (node['slots'] !== undefined) {
      fail(scope.template, where, 'slots: belongs beside template:');
    }
    return { ...own, ...mark };
  }
  if (typeof name !== 'string') {
    return fail(scope.template, where, 'template: takes a name');
  }
  const slots =
    node['slots'] === undefined
      ? {}
      : passed(node['slots'], scope, { ...context, marking: undefined }, `${where}.slots`);
  if (!isMapping(slots)) {
    return fail(scope.template, where, 'slots: must be a mapping');
  }
  const base = expandNamed(
    name,
    slots,
    {},
    { ...context, marking: undefined },
    scope.template,
    where,
  );
  if (base === DROP) {
    return base;
  }
  if (Array.isArray(base) && Object.keys(own).length === 0) {
    return Object.keys(mark).length === 0
      ? base
      : base.map((each) => (isMapping(each) ? { ...each, ...mark } : each));
  }
  if (!isMapping(base)) {
    return Object.keys(own).length === 0
      ? base
      : fail(scope.template, where, `${name} draws a list, so no keys can be added to it`);
  }
  return { ...base, ...own, ...mark };
}

function passed(node: Value, scope: Scope, context: Context, where: string): Out {
  const rendered = render(node, scope, context, where);
  if (!isMapping(node) || !isMapping(rendered)) {
    return rendered;
  }
  const none = Object.entries(node).flatMap(([key, value]) => {
    const path = typeof value === 'string' ? WHOLE.exec(value)?.[1] : undefined;
    return path !== undefined && !key.endsWith('?') && lookup(path, scope, where) === null
      ? [key]
      : [];
  });
  return { ...rendered, ...Object.fromEntries(none.map((key) => [key, null])) };
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
  path: string,
  label: string,
  retired: ReadonlySet<string>,
  who: string,
): Value | undefined {
  if (spec.required && !filled(value)) {
    fail(who, '', `the slot ${at} is required`, `${label} is needed`);
  }
  if (value === undefined || value === null || value === false) {
    return undefined;
  }
  if (!filled(value)) {
    return value;
  }
  if (!KINDS[spec.kind](value)) {
    fail(
      who,
      '',
      `${at} is not ${spec.kind === 'number' ? 'a number' : `of kind ${spec.kind}`}`,
      `${label} takes ${KIND_WORDS[spec.kind]}`,
    );
  }
  const fields = spec.fields;
  if (fields === undefined) {
    return value;
  }
  const shape = (item: Mapping, prefix: string): Mapping => {
    for (const key of Object.keys(item)) {
      if (!Object.hasOwn(fields, key) && !retired.has(`${path}.${key}`)) {
        fail(who, '', `${prefix} has no field named ${key}`);
      }
    }
    const out: Mapping = {};
    for (const [key, inner] of Object.entries(fields)) {
      const settled = settle(
        item[key] ?? inner.default,
        inner,
        `${prefix}.${key}`,
        `${path}.${key}`,
        `${label}: ${slotLabel(key, inner)}`,
        retired,
        who,
      );
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
    if (prefix === '' && name === WORDS) {
      fail(who, '', `the slot name ${WORDS} ${RESERVED}`);
    }
    const shape = isMapping(spec) ? spec['shape'] : undefined;
    if (shape !== undefined) {
      fail(
        who,
        '',
        `the slot ${at} uses the shape ${typeof shape === 'string' ? shape : JSON.stringify(shape)}, which could not be resolved`,
      );
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

function declares(slots: Record<string, SlotSpec> | undefined, path: readonly string[]): boolean {
  const [name = '', ...rest] = path;
  const spec = slots !== undefined && Object.hasOwn(slots, name) ? slots[name] : undefined;
  return spec !== undefined && (rest.length === 0 || declares(spec.fields, rest));
}

function checkRetired(who: string, template: Template): void {
  const retired: unknown = template.retired;
  if (retired === undefined) {
    return;
  }
  if (
    !Array.isArray(retired) ||
    !retired.every((path) => typeof path === 'string' && RETIRED_PATH.test(path))
  ) {
    fail(who, '', 'retired: takes a list of slot paths, dotted for a field: heating.batteries');
  }
  for (const path of template.retired ?? []) {
    if (declares(template.slots, path.split('.'))) {
      fail(who, '', `the retired path ${path} names a slot the template declares`);
    }
  }
}

function resolve(
  name: string,
  who: string,
  voice: string,
  template: Template,
  given: Mapping,
  discovered: Mapping,
  words: WordTable,
): Scope {
  if (!CHECKED.has(template)) {
    checkSlots(who, template.slots, '');
    checkRetired(who, template);
    const look = lookProblem(template);
    if (look !== undefined) {
      fail(who, '', look);
    }
    checkWords(who, template.card, 'card', words);
    checkWords(who, template.popups ?? [], 'popups', words);
    CHECKED.add(template);
  }
  const specs: Record<string, SlotSpec> = template.slots ?? {};
  const retired = new Set(template.retired);
  for (const key of Object.keys(given)) {
    if (!Object.hasOwn(specs, key) && !retired.has(key)) {
      fail(who, '', `no slot named ${key}`);
    }
  }
  const values = new Map<string, Value | undefined>();
  for (const [slot, spec] of Object.entries(specs)) {
    const value = Object.hasOwn(given, slot) ? given[slot] : (discovered[slot] ?? spec.default);
    values.set(
      slot,
      value === null && spec.required !== true
        ? null
        : settle(value, spec, slot, slot, `${voice}${slotLabel(slot, spec)}`, retired, who),
    );
  }
  return { template: name, values, specs: new Map(Object.entries(specs)), words };
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
  const inner: Context = { ...context, stack: [...context.stack, name], trail: [] };
  const who = where === '' ? name : `${caller} at ${where}: ${name}`;
  const voice = where === '' ? '' : `${templateTitle(template, name)}: `;
  const scope = resolve(name, who, voice, template, given, discovered, context.words);
  const card = render(template.card, scope, { ...inner, trail: ['card'] }, 'card');
  const nested: Value[] = [];
  const own = renderList(
    template.popups ?? [],
    scope,
    { ...inner, popups: nested, trail: ['popups'] },
    'popups',
  );
  context.popups.push(...own, ...nested);
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
  marking?: Marking,
  words: WordTable = EN.templates,
): Expanded {
  const context: Context = {
    templates,
    later,
    missing: new Set(),
    stack: [],
    popups: [],
    marking,
    trail: [],
    words,
  };
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
