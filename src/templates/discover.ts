import type {
  AreaValue,
  EnergyValue,
  Filter,
  Kind,
  ObjectRule,
  ObjectsRule,
  Rule,
  SlotSpec,
  Template,
  Value,
} from '../contract/templates.ts';
import { isMapping } from '../contract/templates.ts';
import type { EntityEntry, Registries } from '../ha/registries.ts';

import { ENERGY_WORDS, energyFind, isEnergyValue } from './energy.ts';
import {
  areaOf,
  byDeviceName,
  deviceName,
  inDomain,
  indexOf,
  relativesOf,
} from './entity-index.ts';
import type { Index } from './entity-index.ts';
import { filled } from './expand.ts';
import { describe, matches, whyNot } from './filters.ts';

export { relativesOf } from './entity-index.ts';
export { TEXT_FILTERS } from './filters.ts';

interface Within {
  area?: string | null;
  device?: string;
  lone?: string;
  relatives?: readonly string[];
  outer?: readonly string[];
  claimed?: readonly string[];
  room?: string | null;
  stands?: string;
}

interface Near {
  entity_id: string;
  why: string[];
}

export interface Step {
  field: string;
  rule: string;
  filter?: Filter;
  area: string | null | undefined;
  everywhere: boolean;
  candidates: string[];
  picked: string[];
  tied?: string[];
  devices?: string[];
  chosen?: string[];
  near: Near[];
  missing?: string;
}

interface Recorder {
  step: (step: Step) => void;
}

interface Search {
  registries: Registries;
  index: Index;
  within: Within;
  path: string;
  rec: Recorder | undefined;
}

interface Shape {
  kind: Kind;
  fields: Record<string, SlotSpec>;
}

const NEAR = 5;

const joined = (path: string, field: string): string => (path === '' ? field : `${path}.${field}`);

const at = (search: Search, within: Within): Search => ({ ...search, within });

const into = (search: Search, field: string): Search => ({
  ...search,
  path: joined(search.path, field),
});

const quiet = (search: Search, within: Within): Search => ({
  ...search,
  within,
  path: '',
  rec: undefined,
});

const shapeOf = (fields: Record<string, SlotSpec>, field: string): Shape => ({
  kind: fields[field]?.kind ?? 'entity',
  fields: fields[field]?.fields ?? {},
});

function note(
  search: Search,
  step: () => Omit<Step, 'field' | 'area'> & Partial<Pick<Step, 'area'>>,
): Step | undefined {
  if (search.rec === undefined) {
    return undefined;
  }
  const noted: Step = { field: search.path, area: search.within.area, ...step() };
  search.rec.step(noted);
  return noted;
}

function nearMisses(
  entries: readonly EntityEntry[],
  filter: Filter,
  registries: Registries,
): Near[] {
  const near: Near[] = [];
  for (const entry of entries) {
    if (near.length === NEAR) {
      break;
    }
    if (filter.domain === undefined || entry.entity_id.startsWith(`${filter.domain}.`)) {
      const why = whyNot(entry, filter, registries);
      if (why.length > 0) {
        near.push({ entity_id: entry.entity_id, why });
      }
    }
  }
  return near;
}

function stateRank(entry: EntityEntry, registries: Registries): number {
  const state = registries.states[entry.entity_id];
  if (state === undefined) {
    return 2;
  }
  return state.state === 'unknown' || state.state === 'unavailable' ? 1 : 0;
}

function rankOf(entry: EntityEntry, registries: Registries): string {
  const category = (entry.entity_category ?? null) === null ? 0 : 1;
  const named = entry.name === undefined || entry.name === null || entry.name === '' ? 0 : 1;
  return `${category}${stateRank(entry, registries)}${named}`;
}

function ranked(found: readonly EntityEntry[], registries: Registries): EntityEntry[] {
  return found.toSorted(
    (a, b) =>
      rankOf(a, registries).localeCompare(rankOf(b, registries)) ||
      a.entity_id.localeCompare(b.entity_id),
  );
}

function entitiesWithin(within: Within, search: Search, domain?: string): readonly EntityEntry[] {
  if (within.area === null) {
    return [];
  }
  const { index, registries } = search;
  const inArea = (entry: EntityEntry): boolean =>
    within.area === undefined || areaOf(entry, registries) === within.area;
  if (within.lone !== undefined) {
    const entry = index.ids.get(within.lone);
    return entry !== undefined &&
      (within.device === undefined || entry.device_id === within.device) &&
      inArea(entry)
      ? [entry]
      : [];
  }
  if (within.device !== undefined) {
    const own = index.devices.get(within.device) ?? [];
    return within.area === undefined ? own : own.filter(inArea);
  }
  return within.area === undefined ? inDomain(index, domain) : (index.areas.get(within.area) ?? []);
}

const inside = (within: Within): boolean =>
  within.device !== undefined || within.lone !== undefined;

function scoped(scope: 'area' | 'all' | undefined, within: Within): Within {
  if (scope === 'all') {
    return { room: within.room };
  }
  return scope === 'area' && inside(within)
    ? { area: within.room ?? null, room: within.room }
    : within;
}

const unclaimed = (within: Within): readonly string[] =>
  (within.relatives ?? []).filter((device) => within.claimed?.includes(device) !== true);

function kin(search: Search, relatives = search.within.relatives): readonly EntityEntry[] {
  const { within } = search;
  const devices = within.device === undefined ? [] : [within.device, ...(relatives ?? [])];
  return within.lone === undefined
    ? devices.flatMap((device) => entitiesWithin({ device }, search))
    : entitiesWithin({ lone: within.lone }, search);
}

function deviceKey(device: string, registries: Registries): string {
  return (
    deviceName(device, registries)
      .normalize('NFKD')
      .replaceAll(/\p{M}/gu, '')
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '_')
      .replaceAll(/^_+|_+$/g, '') || device
  );
}

function standIn(rule: AreaValue, device: string, registries: Registries): Value | undefined {
  if (rule === 'area.name') {
    return deviceName(device, registries);
  }
  return rule === 'area.id' ? deviceKey(device, registries) : undefined;
}

function areaValue(rule: AreaValue, search: Search): Value | undefined {
  const { within, registries } = search;
  const stood = within.stands === undefined ? undefined : standIn(rule, within.stands, registries);
  if (stood !== undefined) {
    return stood;
  }
  const id = within.room === undefined ? within.area : within.room;
  const area = id === undefined || id === null ? undefined : registries.areas[id];
  if (area === undefined) {
    return undefined;
  }
  const values: Record<AreaValue, string | null | undefined> = {
    'area.name': area.name,
    'area.icon': area.icon,
    'area.id': area.area_id,
    'area.temperature': area.temperature_entity_id,
    'area.humidity': area.humidity_entity_id,
  };
  return values[rule] ?? undefined;
}

function lacking(object: Record<string, Value>, fields: Record<string, SlotSpec>): boolean {
  return Object.entries(fields).some(
    ([field, spec]) => spec.required === true && !filled(object[field]),
  );
}

const deviceArea = (device: string, registries: Registries): string | null =>
  registries.devices[device]?.area_id ?? null;

function deviceWithin(
  device: string,
  room: string | null | undefined,
  registries: Registries,
  outer: readonly string[] = [],
): Within {
  return {
    device,
    relatives: relativesOf(device, registries).filter((relative) => !outer.includes(relative)),
    ...(outer.length === 0 ? {} : { outer }),
    room: room ?? deviceArea(device, registries),
  };
}

function loneWithin(
  entry: EntityEntry,
  room: string | null | undefined,
  registries: Registries,
): Within {
  return { lone: entry.entity_id, room: room ?? areaOf(entry, registries) ?? null };
}

function fill(
  rules: Record<string, Rule>,
  fields: Record<string, SlotSpec>,
  search: Search,
): Record<string, Value> | undefined {
  const { within } = search;
  const claims =
    within.device === undefined || (within.relatives ?? []).length === 0
      ? []
      : claimsOf(rules, fields, search);
  const own = claims.length === 0 ? search : at(search, { ...within, claimed: claims });
  const object: Record<string, Value> = {};
  let found = false;
  for (const [field, fieldRule] of Object.entries(rules)) {
    const value = valueOf(fieldRule, shapeOf(fields, field), into(own, field));
    if (value !== undefined) {
      object[field] = value;
      found ||= typeof fieldRule !== 'string' && filled(value);
    }
  }
  return found && !lacking(object, fields) ? object : undefined;
}

function objectsOf(rule: ObjectsRule, fields: Record<string, SlotSpec>, search: Search): Value[] {
  const { within, registries, index } = search;
  const scope = scoped(rule.scope, within);
  const where = rule.where;
  const inScope =
    rule.scope === undefined && inside(within)
      ? kin(search, unclaimed(within))
      : entitiesWithin(scope, search, where?.domain);
  const counted = inScope.filter(
    (entry) => where === undefined || matches(entry, where, registries),
  );
  const groups: Within[] =
    rule.per === 'area'
      ? index.byName
          .filter((area) => scope.area === undefined || area.area_id === scope.area)
          .map((area) => ({ area: area.area_id, room: area.area_id }))
      : [
          ...new Set(
            counted
              .map((entry) => entry.device_id)
              .filter((device): device is string => typeof device === 'string'),
          ),
        ]
          .toSorted(byDeviceName(registries))
          .map((device) => ({
            device,
            room:
              rule.scope === 'all'
                ? deviceArea(device, registries)
                : (within.room ?? deviceArea(device, registries)),
          }));
  note(search, () => ({
    rule: rule.per === 'area' ? 'one per area' : `one per device with ${describe(where ?? {})}`,
    filter: where,
    everywhere: rule.scope === 'all',
    candidates: counted.map((entry) => entry.entity_id),
    picked: [],
    near: where === undefined ? [] : nearMisses(inScope, where, registries),
  }));
  return groups.flatMap((group) => {
    const object = fill(rule.fields, fields, at(search, group));
    return object === undefined ? [] : [object];
  });
}

function weight(value: Value): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + weight(item), 0);
  }
  if (isMapping(value)) {
    return Object.values(value).reduce<number>((sum, item) => sum + weight(item), 0);
  }
  return filled(value) ? 1 : 0;
}

interface Group {
  key: string;
  within: Within;
}

function groupsOf(
  entries: readonly EntityEntry[],
  ordered: boolean,
  room: string | null | undefined,
  registries: Registries,
  outer: readonly string[] = [],
): Group[] {
  const devices = [
    ...new Set(
      entries
        .map((entry) => entry.device_id)
        .filter((device): device is string => typeof device === 'string'),
    ),
  ];
  const lone = entries.filter((entry) => entry.device_id === undefined || entry.device_id === null);
  return [
    ...(ordered ? devices : devices.toSorted(byDeviceName(registries))).map((device) => ({
      key: device,
      within: deviceWithin(device, room, registries, outer),
    })),
    ...lone.map((entry) => ({ key: entry.entity_id, within: loneWithin(entry, room, registries) })),
  ];
}

interface Anchoring {
  anchors: Filter[];
  candidates: string[];
  levels: Group[][];
  searched: readonly EntityEntry[];
  seen: number;
}

function anchoring(anchor: Filter | Filter[], rule: ObjectRule, search: Search): Anchoring {
  const { within, registries } = search;
  const anchors = [anchor].flat();
  const fits = (entry: EntityEntry): boolean =>
    anchors.some((each) => matches(entry, each, registries));
  const searched = entitiesWithin(scoped(rule.scope, within), search);
  const tiers: { entries: EntityEntry[]; ordered: boolean; linked: boolean }[] = inside(within)
    ? [
        { entries: kin(search).filter(fits), ordered: true, linked: true },
        ...(rule.scope === undefined
          ? []
          : [{ entries: searched.filter(fits), ordered: false, linked: false }]),
      ]
    : [{ entries: searched.filter(fits), ordered: false, linked: true }];
  const outer =
    within.device === undefined ? (within.outer ?? []) : [...(within.outer ?? []), within.device];
  const room = rule.scope === 'all' ? undefined : within.room;
  const seen = new Set<string>();
  const levels = tiers.map((tier) =>
    groupsOf(tier.entries, tier.ordered, room, registries, outer).filter((group) => {
      const fresh = !seen.has(group.key);
      seen.add(group.key);
      return fresh && (tier.linked || (group.within.relatives ?? []).length === 0);
    }),
  );
  return {
    anchors,
    candidates: tiers.flatMap((tier) => tier.entries.map((entry) => entry.entity_id)),
    levels,
    searched,
    seen: seen.size,
  };
}

function taken(
  levels: readonly Group[][],
  rule: ObjectRule,
  shape: Shape,
  search: Search,
): Group[] {
  const object = (group: Group): Record<string, Value> | undefined =>
    fill(rule.fields, shape.fields, quiet(search, group.within));
  if (shape.kind === 'objects') {
    return levels.flat().filter((group) => object(group) !== undefined);
  }
  for (const level of levels) {
    let best: { group: Group; size: number } | undefined;
    for (const group of level) {
      const found = object(group);
      const size = found === undefined ? 0 : weight(found);
      if (found !== undefined && (best === undefined || size > best.size)) {
        best = { group, size };
      }
    }
    if (best !== undefined) {
      return [best.group];
    }
  }
  return [];
}

function claimsIn(rule: Rule, shape: Shape, search: Search): string[] {
  if (Array.isArray(rule)) {
    return rule.flatMap((each) => claimsIn(each, shape, search));
  }
  if (typeof rule === 'string' || 'per' in rule || !('fields' in rule)) {
    return [];
  }
  if (rule.device === undefined) {
    return claimsOf(rule.fields, shape.fields, search);
  }
  const { levels } = anchoring(rule.device, rule, search);
  return taken(levels, rule, shape, search).map((group) => group.key);
}

function claimsOf(
  rules: Record<string, Rule>,
  fields: Record<string, SlotSpec>,
  search: Search,
): string[] {
  return Object.entries(rules).flatMap(([field, rule]) =>
    claimsIn(rule, shapeOf(fields, field), search),
  );
}

function anchored(
  anchor: Filter | Filter[],
  rule: ObjectRule,
  shape: Shape,
  search: Search,
): Value | undefined {
  const { anchors, candidates, levels, searched, seen } = anchoring(anchor, rule, search);
  const step = note(search, () => ({
    rule: `device with ${anchors.map(describe).join(' or ')}`,
    ...(anchors[0] === undefined ? {} : { filter: anchors[0] }),
    everywhere: rule.scope === 'all',
    candidates,
    picked: [],
    devices: levels.flat().map((group) => group.key),
    chosen: [],
    near:
      anchors[0] === undefined || seen > 0
        ? []
        : nearMisses(searched, anchors[0], search.registries),
  }));
  if (shape.kind === 'objects') {
    const objects = levels.flat().flatMap((group) => {
      const object = fill(rule.fields, shape.fields, at(search, group.within));
      return object === undefined ? [] : [{ group, object }];
    });
    if (step !== undefined) {
      step.chosen = objects.map((each) => each.group.key);
    }
    return objects.length === 0 ? undefined : objects.map((each) => each.object);
  }
  const [best] = taken(levels, rule, shape, search);
  if (best === undefined) {
    return undefined;
  }
  if (step !== undefined) {
    step.chosen = [best.key];
  }
  return fill(rule.fields, shape.fields, at(search, best.within));
}

function searchedFor(
  rule: Filter & { scope?: 'area' | 'all' },
  search: Search,
): { inScope: readonly EntityEntry[]; found: readonly EntityEntry[] } {
  const { within, registries } = search;
  const own = entitiesWithin(scoped(rule.scope, within), search, rule.domain);
  const found = own.filter((entry) => matches(entry, rule, registries));
  const relatives = rule.scope === undefined ? unclaimed(within) : [];
  if (found.length > 0 || relatives.length === 0) {
    return { inScope: own, found };
  }
  const theirs = relatives.flatMap((device) => entitiesWithin({ device }, search));
  return {
    inScope: [...own, ...theirs],
    found: theirs.filter((entry) => matches(entry, rule, registries)),
  };
}

function energyValue(rule: EnergyValue, shape: Shape, search: Search): Value | undefined {
  const found = energyFind(rule, shape.kind, shape.fields, search.registries);
  note(search, () => ({
    rule: ENERGY_WORDS[rule],
    everywhere: true,
    candidates: found.candidates,
    picked: found.picked,
    near: [],
    ...(found.missing === undefined ? {} : { missing: found.missing }),
  }));
  return found.value;
}

function valueOf(rule: Rule, shape: Shape, search: Search): Value | undefined {
  if (Array.isArray(rule)) {
    for (const each of rule) {
      const value = valueOf(each, shape, search);
      if (filled(value)) {
        return value;
      }
    }
    return undefined;
  }
  if (typeof rule === 'string' && isEnergyValue(rule)) {
    return energyValue(rule, shape, search);
  }
  if (typeof rule === 'string') {
    const value = areaValue(rule, search);
    note(search, () => ({
      rule: AREA_WORDS[rule],
      everywhere: false,
      candidates: [],
      picked:
        (rule === 'area.temperature' || rule === 'area.humidity') && typeof value === 'string'
          ? [value]
          : [],
      near: [],
    }));
    return value;
  }
  if ('per' in rule) {
    const objects = objectsOf(rule, shape.fields, search);
    return objects.length > 0 ? objects : undefined;
  }
  if ('fields' in rule) {
    if (rule.device !== undefined) {
      return anchored(rule.device, rule, shape, search);
    }
    const object: Record<string, Value> = {};
    for (const [field, fieldRule] of Object.entries(rule.fields)) {
      const value = valueOf(fieldRule, shapeOf(shape.fields, field), into(search, field));
      if (value !== undefined) {
        object[field] = value;
      }
    }
    return Object.keys(object).length > 0 && !lacking(object, shape.fields) ? object : undefined;
  }
  const { registries } = search;
  const { inScope, found } = searchedFor(rule, search);
  const entities = shape.kind === 'entities';
  const order = entities ? found : ranked(found, registries);
  const best = order[0];
  note(search, () => {
    const chosen = best === undefined ? [] : entities ? found : [best];
    const tied =
      best === undefined || entities
        ? []
        : order.filter((entry) => rankOf(entry, registries) === rankOf(best, registries));
    return {
      area: scoped(rule.scope, search.within).area,
      rule: describe(rule),
      filter: rule,
      everywhere: rule.scope === 'all',
      candidates: order.map((entry) => entry.entity_id),
      picked: chosen.map((entry) => entry.entity_id),
      ...(tied.length > 1 ? { tied: tied.map((entry) => entry.entity_id) } : {}),
      near: nearMisses(inScope, rule, registries),
    };
  });
  if (found.length === 0) {
    return undefined;
  }
  if (entities) {
    return found.map((entry) => entry.entity_id);
  }
  return best?.entity_id;
}

export const AREA_WORDS: Readonly<Record<AreaValue, string>> = {
  'area.name': "the area's name",
  'area.icon': "the area's icon",
  'area.id': "the area's id",
  'area.temperature': 'the area temperature sensor',
  'area.humidity': 'the area humidity sensor',
};

const OVERRIDE = 'mnml_';

function filtersOf(rule: Rule): Filter[] {
  if (Array.isArray(rule)) {
    return rule.flatMap(filtersOf);
  }
  return typeof rule === 'string' || 'per' in rule || 'fields' in rule ? [] : [rule];
}

function labelledIn(label: string, area: string | undefined, search: Search): EntityEntry[] {
  const { within, registries } = search;
  const kept =
    within.stands === undefined
      ? (entry: EntityEntry): boolean => area === undefined || areaOf(entry, registries) === area
      : (entry: EntityEntry): boolean =>
          entry.device_id === within.device ||
          (typeof entry.device_id === 'string' &&
            (within.relatives ?? []).includes(entry.device_id));
  return (search.index.labels.get(label) ?? []).filter(kept);
}

const homeWide = (area: string | undefined, search: Search): boolean =>
  area === undefined && search.within.stands === undefined;

function labelled(
  slot: string,
  kind: Kind,
  rule: Rule,
  area: string | undefined,
  search: Search,
): Value | undefined {
  const label = `${OVERRIDE}${slot}`;
  const filters = filtersOf(rule);
  const found = labelledIn(label, area, search).filter(
    (entry) =>
      entry.labels?.includes(label) === true ||
      filters.some((filter) => matches(entry, filter, search.registries)),
  );
  if (found.length === 0) {
    return undefined;
  }
  const picked = kind === 'entities' ? found : found.slice(0, 1);
  note(search, () => ({
    rule: `labelled ${label}`,
    filter: { label },
    everywhere: homeWide(area, search),
    candidates: found.map((entry) => entry.entity_id),
    picked: picked.map((entry) => entry.entity_id),
    near: [],
  }));
  return kind === 'entities' ? picked.map((entry) => entry.entity_id) : picked[0]?.entity_id;
}

function fieldRulesOf(rule: Rule): Record<string, Rule> | undefined {
  if (Array.isArray(rule)) {
    return rule.map(fieldRulesOf).find((found) => found !== undefined);
  }
  if (typeof rule === 'string') {
    return undefined;
  }
  if ('per' in rule) {
    return rule.per === 'device' ? rule.fields : undefined;
  }
  return 'fields' in rule ? rule.fields : undefined;
}

function labelledDevices(
  slot: string,
  spec: SlotSpec,
  rule: Rule,
  area: string | undefined,
  search: Search,
): Value | undefined {
  const rules = fieldRulesOf(rule);
  if (rules === undefined) {
    return undefined;
  }
  const label = `${OVERRIDE}${slot}`;
  const marked = labelledIn(label, area, search);
  if (marked.length === 0) {
    return undefined;
  }
  const groups = groupsOf(marked, false, search.within.room, search.registries);
  const step = note(search, () => ({
    rule: `labelled ${label}`,
    filter: { label },
    everywhere: homeWide(area, search),
    candidates: marked.map((entry) => entry.entity_id),
    picked: [],
    devices: groups.map((group) => group.key),
    chosen: [],
    near: [],
  }));
  const objects = groups.flatMap((group) => {
    const object = fill(rules, spec.fields ?? {}, at(search, group.within));
    return object === undefined ? [] : [{ group, object }];
  });
  const chosen = spec.kind === 'objects' ? objects : objects.slice(0, 1);
  if (step !== undefined) {
    step.chosen = chosen.map((each) => each.group.key);
  }
  if (chosen.length === 0) {
    return undefined;
  }
  return spec.kind === 'objects' ? chosen.map((each) => each.object) : chosen[0]?.object;
}

function searchOf(registries: Registries, within: Within, rec?: Recorder): Search {
  return { registries, index: indexOf(registries), within, path: '', rec };
}

export function fromDevice(
  spec: SlotSpec,
  device: string,
  area: string | undefined,
  registries: Registries,
): Value | undefined {
  const rules = spec.discover === undefined ? undefined : fieldRulesOf(spec.discover);
  return rules === undefined
    ? undefined
    : fill(rules, spec.fields ?? {}, searchOf(registries, deviceWithin(device, area, registries)));
}

function topWithin(
  area: string | undefined,
  device: string | undefined,
  registries: Registries,
): Within | undefined {
  if (device === undefined) {
    return { area: area ?? null, room: area ?? null };
  }
  return Object.hasOwn(registries.devices, device)
    ? { ...deviceWithin(device, area, registries), stands: device }
    : undefined;
}

export function discoverSlot(
  slot: string,
  spec: SlotSpec,
  area: string | undefined,
  registries: Registries,
  rec?: Recorder,
  device?: string,
): Value | undefined {
  const within = topWithin(area, device, registries);
  if (spec.discover === undefined || within === undefined) {
    return undefined;
  }
  const search = searchOf(registries, within, rec);
  if (spec.kind === 'entity' || spec.kind === 'entities') {
    const chosen = labelled(slot, spec.kind, spec.discover, area, search);
    if (chosen !== undefined) {
      return chosen;
    }
  }
  if (spec.kind === 'object' || spec.kind === 'objects') {
    const chosen = labelledDevices(slot, spec, spec.discover, area, search);
    if (chosen !== undefined) {
      return chosen;
    }
  }
  return valueOf(spec.discover, { kind: spec.kind, fields: spec.fields ?? {} }, search);
}

export function discover(
  template: Template,
  area: string | undefined,
  registries: Registries,
  device?: string,
): Record<string, Value> {
  const found: Record<string, Value> = {};
  for (const [slot, spec] of Object.entries(template.slots ?? {})) {
    const value = discoverSlot(slot, spec, area, registries, undefined, device);
    if (value !== undefined) {
      found[slot] = value;
    }
  }
  return found;
}
