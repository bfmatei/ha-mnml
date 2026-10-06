import type { MdiIcon } from '../contract/entities.ts';
import { isMapping } from '../contract/templates.ts';
import type { Rule, SlotSpec, Value } from '../contract/templates.ts';
import type { AreaEntry } from '../templates/discover.ts';
import { filled } from '../templates/expand.ts';

import { iconFor } from './icons.ts';

export type Source = 'area' | 'yourself' | 'home';

interface Group {
  readonly name: string;
  readonly icon: MdiIcon;
  readonly slots: readonly string[];
}

const SIMPLE = new Set(['text', 'texts', 'number', 'icon', 'flag', 'entity', 'entities']);

export function slotLabel(name: string, spec: SlotSpec): string {
  if (spec.label !== undefined) {
    return spec.label;
  }
  const words = name.replaceAll('_', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function singular(label: string): string {
  if (label.endsWith('ies')) {
    return `${label.slice(0, -3)}y`;
  }
  return label.endsWith('s') && !label.endsWith('ss') ? label.slice(0, -1) : label;
}

export function groupsOf(slots: Readonly<Record<string, SlotSpec>>): Group[] {
  const named = new Map<string, string[]>();
  for (const [name, spec] of Object.entries(slots)) {
    const group = spec.group ?? (SIMPLE.has(spec.kind) ? 'Basics' : slotLabel(name, spec));
    named.set(group, [...(named.get(group) ?? []), name]);
  }
  return [...named].map(([name, members]) => ({ name, icon: iconFor(name), slots: members }));
}

const wide = (rule: Rule | undefined): boolean =>
  Array.isArray(rule) ? rule.some(wide) : isMapping(rule) && rule['scope'] === 'all';

export function homeWide(slots: Readonly<Record<string, SlotSpec>>): boolean {
  return Object.values(slots).some(
    (spec) => wide(spec.discover) || (spec.fields !== undefined && homeWide(spec.fields)),
  );
}

export function sourceOf(config: Readonly<Record<string, Value>>): Source {
  if (typeof config['area'] === 'string') {
    return 'area';
  }
  return config['slots'] === undefined ? 'home' : 'yourself';
}

export function defaultArea(
  config: Readonly<Record<string, Value>>,
  areas: Readonly<Record<string, AreaEntry>>,
): string | undefined {
  const slots = isMapping(config['slots']) ? config['slots'] : {};
  const hints = new Set(
    [slots['key'], slots['name']]
      .filter((hint): hint is string => typeof hint === 'string')
      .map((hint) => hint.toLowerCase()),
  );
  return Object.values(areas).find(
    (area) => hints.has(area.area_id.toLowerCase()) || hints.has(area.name.toLowerCase()),
  )?.area_id;
}

const same = (a: Value | undefined, b: Value | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function overridesOf(
  found: Readonly<Record<string, Value>>,
  values: Readonly<Record<string, Value>>,
): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [name, value] of Object.entries(values)) {
    if (!same(found[name], value)) {
      out[name] = value;
    }
  }
  for (const name of Object.keys(found)) {
    if (!Object.hasOwn(values, name)) {
      out[name] = null;
    }
  }
  return out;
}

export function valuesOf(
  source: Source,
  found: Readonly<Record<string, Value>>,
  slots: Readonly<Record<string, Value>>,
): Record<string, Value> {
  if (source === 'yourself') {
    return { ...slots };
  }
  if (source === 'home') {
    return { ...found };
  }
  return Object.fromEntries(
    Object.entries({ ...found, ...slots }).filter(([, value]) => value !== null),
  );
}

export function noteOf(
  source: Source,
  name: string,
  found: Readonly<Record<string, Value>>,
  slots: Readonly<Record<string, Value>>,
  place: string,
): string | undefined {
  if (source === 'yourself') {
    return undefined;
  }
  if (source === 'home') {
    return Object.hasOwn(found, name) ? 'Found in the home' : 'Nothing found in the home';
  }
  if (place === '') {
    return undefined;
  }
  if (Object.hasOwn(slots, name)) {
    return filled(slots[name]) ? 'Set by you' : 'Not set';
  }
  return Object.hasOwn(found, name) ? `Found in ${place}` : `Nothing found in ${place}`;
}
