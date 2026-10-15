import type { MdiIcon } from '../contract/entities.ts';
import { BASICS, isMapping, slotGroup } from '../contract/templates.ts';
import type { Rule, SlotSpec, Value } from '../contract/templates.ts';
import type { AreaEntry, EntityEntry } from '../ha/registries.ts';
import { filled } from '../templates/expand.ts';
import type { DeviceFit } from '../templates/explain.ts';
import { EDITORS_EN } from '../words/panel/editors-en.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';

import { iconFor } from './icons.ts';

export type Source = 'area' | 'device' | 'yourself' | 'home';

interface Group {
  readonly name: string;
  readonly icon: MdiIcon;
  readonly slots: readonly string[];
}

export function groupsOf(
  slots: Readonly<Record<string, SlotSpec>>,
  basics: string = EDITORS_EN.template.basics,
): Group[] {
  const named = new Map<string, string[]>();
  for (const [name, spec] of Object.entries(slots)) {
    const group = slotGroup(name, spec);
    named.set(group, [...(named.get(group) ?? []), name]);
  }
  return [...named].map(([name, members]) => ({
    name: name === BASICS ? basics : name,
    icon: iconFor(name),
    slots: members,
  }));
}

const wide = (rule: Rule | undefined): boolean =>
  Array.isArray(rule) ? rule.some(wide) : isMapping(rule) && rule['scope'] === 'all';

export function homeWide(slots: Readonly<Record<string, SlotSpec>>): boolean {
  return Object.values(slots).some(
    (spec) => wide(spec.discover) || (spec.fields !== undefined && homeWide(spec.fields)),
  );
}

export function sourceOf(config: Readonly<Record<string, Value>>): Source {
  if (typeof config['device'] === 'string') {
    return 'device';
  }
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
    Object.entries({ ...found, ...slots }).filter(
      ([name, value]) => value !== null || !Object.hasOwn(found, name),
    ),
  );
}

export const deviceWords = (device: DeviceFit, words: EditorWords = EDITORS_EN): string =>
  device.area === undefined ? device.name : words.notes.deviceIn(device.name, device.area);

export function noteOf(
  source: Source,
  name: string,
  found: Readonly<Record<string, Value>>,
  slots: Readonly<Record<string, Value>>,
  place: string,
  device?: DeviceFit,
  words: EditorWords = EDITORS_EN,
): string | undefined {
  if (source === 'yourself') {
    return undefined;
  }
  const { notes } = words;
  const own = source !== 'home' && Object.hasOwn(slots, name);
  if (device !== undefined && (own ? filled(slots[name]) : Object.hasOwn(found, name))) {
    return notes.device(own, deviceWords(device, words));
  }
  if (source === 'home') {
    return notes.inHome(Object.hasOwn(found, name));
  }
  if (place === '') {
    return undefined;
  }
  if (own) {
    return filled(slots[name]) ? notes.setByYou : notes.notSet;
  }
  if (source === 'device') {
    return notes.on(Object.hasOwn(found, name), place);
  }
  return notes.in(Object.hasOwn(found, name), place);
}

function idsIn(value: Value | undefined): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(idsIn);
  }
  return isMapping(value) ? Object.values(value).flatMap(idsIn) : [];
}

export function deviceIn(
  value: Value | undefined,
  fits: readonly DeviceFit[],
  entities: Readonly<Record<string, EntityEntry>>,
): DeviceFit | undefined {
  const held = idsIn(value).map((id) => entities[id]?.device_id);
  let best: { fit: DeviceFit; count: number } | undefined;
  for (const fit of fits) {
    const count = held.filter((device) => device === fit.id).length;
    if (count > 0 && (best === undefined || count > best.count)) {
      best = { fit, count };
    }
  }
  return best?.fit;
}
