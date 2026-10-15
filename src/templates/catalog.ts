import { resolve } from 'node:path';

import { isMapping, sameValue } from '../contract/templates.ts';
import type {
  Rule,
  Shapes,
  SlotSpec,
  Template,
  Templates,
  Value,
  WrittenSlot,
} from '../contract/templates.ts';

import { AREA_WORDS } from './discover.ts';
import { ENERGY_WORDS, isEnergyValue } from './energy.ts';
import { COMMON_FAMILY } from './families.ts';
import { familyTitle } from './family-titles.ts';
import { describe } from './filters.ts';
import { familyNames, readFamily, readShapes } from './shipped.ts';

export const CATALOG_FILE = resolve(import.meta.dirname, '../../docs/catalog.md');

const INTRO = `# The shipped templates

Each shipped template's title, icon and description, its slots, the rules that find them, and the pop-ups it brings, as \`templates/*.yaml\` has them. \`pnpm run fix:docs\` writes this page from those files, and a test fails while it is stale: change the YAML, never this page. [templates.md](templates.md) describes the language, and its [notes](templates.md#notes-on-the-shipped-templates) what a template does beyond its description.

A slot without a rule is set by hand. A field's row reads \`slot.field\`, and for an \`objects\` slot names the field of each element. A slot passed whole to a card's or a control's key takes that key's shape, in [keys.md](keys.md).`;

const SHAPES_INTRO = `From \`templates/shapes.yaml\`. Every shape is an \`object\`; a slot takes a list of one with \`kind: objects\`. A field that names a shape is listed by that shape. A shape written over another names it, then what it changes.`;

type Row = readonly string[];

function cell(text: string): string {
  return text.replaceAll('|', '\\|');
}

function table(head: Row, rows: readonly Row[]): string {
  const all = [head, ...rows].map((row) => row.map(cell));
  const widths = head.map((_, column) =>
    Math.max(3, ...all.map((row) => (row[column] ?? '').length)),
  );
  const line = (row: Row): string =>
    `| ${row.map((text, column) => text + ' '.repeat((widths[column] ?? 0) - text.length)).join(' | ')} |`;
  return [
    line(all[0] ?? []),
    line(widths.map((width) => '-'.repeat(width))),
    ...all.slice(1).map(line),
  ].join('\n');
}

function code(text: string): string {
  return `\`${text}\``;
}

function listed(items: readonly string[], last = 'and'): string {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1) ?? ''}`;
}

function written(value: Value): string {
  if (typeof value === 'string') {
    return `'${value}'`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(written).join(', ')}]`;
  }
  if (isMapping(value)) {
    return `{ ${Object.entries(value)
      .map(([key, inner]) => `${key}: ${written(inner)}`)
      .join(', ')} }`;
  }
  return String(value);
}

function scopeWords(scope: unknown): string {
  if (scope === 'all') {
    return ', anywhere in the home';
  }
  return scope === 'area' ? ', in the area' : '';
}

function inline(rule: Rule): string | undefined {
  if (typeof rule === 'string') {
    return isEnergyValue(rule) ? ENERGY_WORDS[rule] : AREA_WORDS[rule];
  }
  if (Array.isArray(rule)) {
    const words = rule.map(inline);
    return words.every((word) => word !== undefined) ? words.join(', then ') : undefined;
  }
  return 'fields' in rule ? undefined : `${describe(rule)}${scopeWords(rule.scope)}`;
}

function ruleLines(label: string, rule: Rule, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const words = inline(rule);
  if (words !== undefined) {
    return [`${pad}- ${label === '' ? '' : `${label}: `}${words}`];
  }
  if (typeof rule === 'string') {
    return [];
  }
  if (Array.isArray(rule)) {
    return [
      `${pad}- ${label === '' ? 'tried in turn' : `${label}, tried in turn`}:`,
      ...rule.flatMap((alternative) => ruleLines('', alternative, depth + 1)),
    ];
  }
  if (!('fields' in rule)) {
    return [];
  }
  const devices = 'per' in rule || rule.device === undefined ? [] : [rule.device].flat();
  const head =
    'per' in rule
      ? `${rule.per === 'area' ? 'one per area' : `one per device with ${describe(rule.where ?? {})}`}${scopeWords(rule.scope)}`
      : devices.length === 0
        ? 'field by field'
        : `device with ${devices.map(describe).join(' or ')}${scopeWords(rule.scope)}`;
  return [
    `${pad}- ${label === '' ? head : `${label}: ${head}`}:`,
    ...Object.entries(rule.fields).flatMap(([field, inner]) =>
      ruleLines(code(field), inner, depth + 1),
    ),
  ];
}

function slotRows(spec: SlotSpec, path: string): Row[] {
  const given =
    spec.required === true
      ? 'required'
      : spec.default === undefined
        ? ''
        : code(written(spec.default));
  return [
    [code(path), spec.kind, given],
    ...Object.entries(spec.fields ?? {}).flatMap(([field, inner]) =>
      slotRows(inner, `${path}.${field}`),
    ),
  ];
}

function names(value: Value | undefined): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

interface Brought {
  template: string;
  when: string;
}

function condition(node: Record<string, Value>, outer: string): string {
  const each = typeof node['each'] === 'string' ? `one per ${code(node['each'])}` : '';
  const any = names(node['if']).map(code);
  const none = names(node['unless']).map(code);
  const words = [
    outer,
    each,
    any.length === 0 ? '' : `with ${listed(any, 'or')}`,
    none.length === 0 ? '' : `without ${listed(none, 'or')}`,
  ].filter((word) => word !== '');
  return words.join(', ');
}

function instances(value: Value | undefined, when: string, found: Brought[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      instances(item, when, found);
    }
    return;
  }
  if (!isMapping(value)) {
    return;
  }
  const inner = condition(value, when);
  if (typeof value['template'] === 'string') {
    found.push({ template: value['template'], when: inner });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'if' && key !== 'unless' && key !== 'each') {
      instances(child, inner, found);
    }
  }
}

function direct(template: Template): Brought[] {
  const found: Brought[] = [];
  instances(template.popups, '', found);
  return found;
}

function throughCards(template: Template, all: Templates, seen: Set<string>): Brought[] {
  const placed: Brought[] = [];
  instances(template.card, '', placed);
  return placed.flatMap(({ template: name, when }) => {
    const inner = all[name];
    if (inner === undefined || seen.has(name)) {
      return [];
    }
    const deeper = new Set([...seen, name]);
    return [...direct(inner), ...throughCards(inner, all, deeper)].map((brought) => ({
      template: brought.template,
      when: [when, brought.when].filter((word) => word !== '').join(', '),
    }));
  });
}

function broughtWords(list: readonly Brought[]): string {
  const unique = list.filter(
    (brought, index) =>
      list.findIndex(
        (other) => other.template === brought.template && other.when === brought.when,
      ) === index,
  );
  return listed(
    unique.map(({ template, when }) => `${code(template)}${when === '' ? '' : ` (${when})`}`),
  );
}

function brings(name: string, template: Template, all: Templates): string[] {
  const own = direct(template);
  const lines: string[] = [];
  if (own.length > 0) {
    lines.push(`Brings ${broughtWords(own)}.`);
  }
  const cards = throughCards(template, all, new Set([name]));
  if (cards.length > 0) {
    lines.push(`Through its cards, it brings ${broughtWords(cards)}.`);
  }
  for (const { template: popup } of own) {
    const inner = all[popup];
    const via = inner === undefined ? [] : throughCards(inner, all, new Set([name, popup]));
    if (via.length > 0) {
      lines.push(`Through the cards of ${code(popup)}, it brings ${broughtWords(via)}.`);
    }
  }
  return lines;
}

function rules(template: Template, shapes: Shapes): string {
  const found = Object.entries(template.slots ?? {}).flatMap(([slot, spec]) => {
    if (spec.discover === undefined) {
      return [];
    }
    const discover = spec.discover;
    const shape = Object.entries(shapes).find(
      ([, written]) => written.discover !== undefined && sameValue(written.discover, discover),
    );
    return shape === undefined
      ? ruleLines(code(slot), discover, 0)
      : [`- ${code(slot)}: the rule of the shape ${code(shape[0])}, under [Shapes](#shapes)`];
  });
  return found.length === 0 ? '' : `Found by:\n\n${found.join('\n')}`;
}

function entry(name: string, template: Template, all: Templates, shapes: Shapes): string {
  const head = `**${template.title ?? name}**, ${code(template.icon ?? 'no icon')}: ${template.description ?? ''}`;
  const slots = Object.entries(template.slots ?? {}).flatMap(([slot, spec]) =>
    slotRows(spec, slot),
  );
  const retired = template.retired ?? [];
  return [
    `### ${code(name)}`,
    head.trimEnd(),
    slots.length === 0
      ? 'It takes no slots.'
      : table(['Slot', 'Kind', 'Required or default'], slots),
    rules(template, shapes),
    retired.length === 0
      ? ''
      : `Retired ([retired slots](templates.md#writing-a-template)): ${listed(retired.map(code))}.`,
    ...brings(name, template, all),
  ]
    .filter((part) => part !== '')
    .join('\n\n');
}

function shapeField(name: string, slot: WrittenSlot): string {
  const notes = [
    slot.required === true ? 'required' : '',
    slot.shape === undefined
      ? ''
      : `${code(slot.shape)}${slot.kind === 'objects' ? ', a list' : ''}`,
    slot.default === undefined ? '' : `by default ${code(written(slot.default))}`,
  ].filter((note) => note !== '');
  return `${code(name)}${notes.length === 0 ? '' : ` (${notes.join('; ')})`}`;
}

function requiredPaths(fields: Record<string, WrittenSlot>, at: string): string[] {
  const found: string[] = [];
  for (const [field, slot] of Object.entries(fields)) {
    if (slot.required === true) {
      found.push(`${at}${field}`);
    }
    found.push(...requiredPaths(slot.fields ?? {}, `${at}${field}.`));
  }
  return found;
}

function shapeLines(name: string, shape: WrittenSlot): string[] {
  const fields = shape.fields ?? {};
  const base =
    shape.shape === undefined
      ? Object.entries(fields)
          .map(([field, slot]) => shapeField(field, slot))
          .join(', ')
      : `${code(shape.shape)}, with ${listed(requiredPaths(fields, '').map(code))} required`;
  const fallback =
    shape.default === undefined ? '' : `; by default ${code(written(shape.default))}`;
  const line = `- ${code(name)}: ${base}${fallback}`;
  return shape.discover === undefined
    ? [line]
    : [`${line}; found by:`, ...ruleLines('', shape.discover, 1)];
}

function shapesSection(shapes: Shapes): string {
  return [
    '## Shapes',
    SHAPES_INTRO,
    Object.entries(shapes)
      .flatMap(([name, shape]) => shapeLines(name, shape))
      .join('\n'),
  ].join('\n\n');
}

export function catalogText(): string {
  const families = familyNames();
  const ordered = [COMMON_FAMILY, ...families.filter((family) => family !== COMMON_FAMILY)];
  const read = ordered.map((family) => ({ family, templates: readFamily(family) }));
  const all: Templates = Object.assign({}, ...read.map(({ templates }) => templates));
  const shapes = readShapes();
  const sections = read.map(({ family, templates }) =>
    [
      `## ${familyTitle(family)}`,
      `From ${code(`templates/${family}.yaml`)}.`,
      ...Object.entries(templates).map(([name, template]) => entry(name, template, all, shapes)),
    ].join('\n\n'),
  );
  return `${[INTRO, shapesSection(shapes), ...sections].join('\n\n')}\n`;
}
