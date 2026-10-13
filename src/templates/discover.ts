import type {
  AreaValue,
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

import { filled } from './expand.ts';

export interface AreaEntry {
  area_id: string;
  name: string;
  icon?: string | null;
  temperature_entity_id?: string | null;
  humidity_entity_id?: string | null;
}

interface DeviceEntry {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  entry_type?: string | null;
  via_device_id?: string | null;
  labels?: string[];
}

export interface EntityEntry {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string;
  translation_key?: string | null;
  name?: string | null;
  entity_category?: string | null;
  hidden?: boolean;
  labels?: string[];
}

export interface Registries {
  areas: Readonly<Record<string, AreaEntry>>;
  devices: Readonly<Record<string, DeviceEntry>>;
  entities: Readonly<Record<string, EntityEntry>>;
  states: Readonly<
    Record<string, { state?: string; attributes: Readonly<Record<string, unknown>> }>
  >;
}

interface Within {
  area?: string | null;
  device?: string;
  lone?: string;
  relatives?: readonly string[];
  outer?: readonly string[];
  claimed?: readonly string[];
  room?: string | null;
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
}

export interface Recorder {
  step: (step: Step) => void;
}

const NEAR = 5;

const WORDED = [
  'device_class',
  'platform',
  'translation_key',
  'entity_category',
  'unit',
  'state_class',
  'attribute',
  'name',
  'manufacturer',
  'model',
  'entry_type',
  'integration',
  'label',
  'exclude',
] as const;

type Worded = (typeof WORDED)[number];

export const TEXT_FILTERS = WORDED.filter(
  (key): key is Exclude<Worded, 'attribute' | 'exclude'> =>
    key !== 'attribute' && key !== 'exclude',
);

const NOUNS = {
  device_class: 'device class',
  translation_key: 'translation key',
  unit: 'unit',
  state_class: 'state class',
} as const;

const WORDS: Record<Worded, string> = {
  device_class: `with ${NOUNS.device_class}`,
  platform: 'from the integration',
  translation_key: `with ${NOUNS.translation_key}`,
  entity_category: 'in the category',
  unit: `with ${NOUNS.unit}`,
  state_class: `with ${NOUNS.state_class}`,
  attribute: 'with attribute',
  name: 'named like',
  manufacturer: 'made by',
  model: 'of model',
  entry_type: 'on a device of type',
  integration: 'on a device of the integration',
  label: 'labelled',
  exclude: 'but not',
};

export function filterWords(key: Worded): string {
  return WORDS[key];
}

const category = (value: string): string => (value === 'none' ? 'primary' : value);

function shown(filter: Filter, key: Worded): string | undefined {
  switch (key) {
    case 'attribute': {
      return filter.attribute === undefined
        ? undefined
        : Object.entries(filter.attribute)
            .map(([name, value]) => `${name} ${value}`)
            .join(' and ');
    }
    case 'exclude': {
      return filter.exclude === undefined ? undefined : spoken(filter.exclude);
    }
    case 'name': {
      return filter.name === undefined ? undefined : `"${filter.name}"`;
    }
    case 'entity_category': {
      return filter.entity_category === undefined ? undefined : category(filter.entity_category);
    }
    default: {
      return filter[key];
    }
  }
}

function phrases(filter: Filter): string[] {
  return WORDED.flatMap((key) => {
    const value = shown(filter, key);
    return value === undefined ? [] : [`${WORDS[key]} ${value}`];
  });
}

function spoken(filter: Filter): string {
  return filter.domain === undefined ? phrases(filter).join(', ') : describe(filter);
}

export function describe(filter: Filter): string {
  return [filter.domain ?? 'any entity', phrases(filter).join(', ')]
    .filter((part) => part !== '')
    .join(' ');
}

const scalar = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : undefined;

function same(actual: unknown, wanted: unknown): boolean {
  const given = scalar(wanted);
  if (given === undefined) {
    return false;
  }
  return typeof actual === 'number'
    ? given.trim() !== '' && Number(given) === actual
    : scalar(actual) === given;
}

function holds(actual: unknown, wanted: unknown): boolean {
  return Array.isArray(actual)
    ? actual.some((item: unknown) => same(item, wanted))
    : same(actual, wanted);
}

function said(actual: unknown): string | undefined {
  if (!Array.isArray(actual)) {
    return scalar(actual);
  }
  return actual.length === 0
    ? 'none'
    : actual.map((item: unknown) => scalar(item) ?? '?').join(', ');
}

function whyNot(entry: EntityEntry, filter: Filter, registries: Registries): string[] {
  const why: string[] = [];
  const device = deviceOf(entry, registries);
  if (filter.platform !== undefined && entry.platform !== filter.platform) {
    why.push(`is from the integration ${entry.platform ?? 'none'}, not ${filter.platform}`);
  }
  if (filter.translation_key !== undefined && entry.translation_key !== filter.translation_key) {
    why.push(
      `has ${NOUNS.translation_key} ${entry.translation_key ?? 'none'}, not ${filter.translation_key}`,
    );
  }
  const reading = (key: string, wanted: string | undefined, noun: string): void => {
    if (wanted === undefined) {
      return;
    }
    const actual = attribute(entry, registries, key);
    if (actual === undefined) {
      why.push(`has no ${noun}`);
    } else if (actual !== wanted) {
      why.push(`has ${noun} ${actual}, not ${wanted}`);
    }
  };
  reading('device_class', filter.device_class, NOUNS.device_class);
  reading('unit_of_measurement', filter.unit, NOUNS.unit);
  reading('state_class', filter.state_class, NOUNS.state_class);
  if (
    filter.entity_category !== undefined &&
    (entry.entity_category ?? 'none') !== filter.entity_category
  ) {
    why.push(
      `is in the category ${category(entry.entity_category ?? 'none')}, not ${category(filter.entity_category)}`,
    );
  }
  for (const [name, wanted] of Object.entries(filter.attribute ?? {})) {
    const value = registries.states[entry.entity_id]?.attributes[name];
    const actual = said(value);
    if (actual === undefined) {
      why.push(`has no attribute ${name}`);
    } else if (!holds(value, wanted)) {
      why.push(`has ${name} ${actual}, ${Array.isArray(value) ? 'without' : 'not'} ${wanted}`);
    }
  }
  if (
    filter.name !== undefined &&
    !words(filter.name).every((word) => textOf(entry, registries).includes(word))
  ) {
    why.push(`is named "${attribute(entry, registries, 'friendly_name') ?? entry.entity_id}"`);
  }
  if (
    filter.manufacturer !== undefined &&
    !(device?.manufacturer ?? '').toLowerCase().includes(filter.manufacturer.toLowerCase())
  ) {
    why.push(`is made by ${device?.manufacturer ?? 'nobody known'}, not ${filter.manufacturer}`);
  }
  if (
    filter.model !== undefined &&
    !(device?.model ?? '').toLowerCase().includes(filter.model.toLowerCase())
  ) {
    why.push(`is of model ${device?.model ?? 'unknown'}, not ${filter.model}`);
  }
  if (filter.entry_type !== undefined && (device?.entry_type ?? 'none') !== filter.entry_type) {
    why.push(`is on a device of type ${device?.entry_type ?? 'none'}, not ${filter.entry_type}`);
  }
  if (filter.integration !== undefined && !fromIntegration(entry, filter.integration, registries)) {
    why.push(`is not on a device of the integration ${filter.integration}`);
  }
  if (filter.label !== undefined && !hasLabel(entry, filter.label, registries)) {
    why.push(`lacks the label ${filter.label}`);
  }
  if (filter.exclude !== undefined && matches(entry, filter.exclude, registries)) {
    why.push(`is excluded: it is ${spoken(filter.exclude)}`);
  }
  return why;
}

function nearMisses(within: EntityEntry[], filter: Filter, registries: Registries): Near[] {
  return within
    .filter((entry) => !matches(entry, filter, registries))
    .filter(
      (entry) => filter.domain === undefined || entry.entity_id.startsWith(`${filter.domain}.`),
    )
    .map((entry) => ({ entity_id: entry.entity_id, why: whyNot(entry, filter, registries) }))
    .filter((near) => near.why.length > 0)
    .slice(0, NEAR);
}

export function areaOf(entry: EntityEntry, registries: Registries): string | undefined {
  if (entry.area_id !== undefined && entry.area_id !== null) {
    return entry.area_id;
  }
  const device =
    entry.device_id === undefined || entry.device_id === null
      ? undefined
      : registries.devices[entry.device_id];
  return device?.area_id ?? undefined;
}

function attribute(entry: EntityEntry, registries: Registries, key: string): string | undefined {
  const value = registries.states[entry.entity_id]?.attributes[key];
  return typeof value === 'string' ? value : undefined;
}

function textOf(entry: EntityEntry, registries: Registries): string {
  return (attribute(entry, registries, 'friendly_name') ?? entry.entity_id).toLowerCase();
}

function deviceOf(entry: EntityEntry, registries: Registries): DeviceEntry | undefined {
  return entry.device_id === undefined || entry.device_id === null
    ? undefined
    : registries.devices[entry.device_id];
}

function hasLabel(entry: EntityEntry, label: string, registries: Registries): boolean {
  return (
    entry.labels?.includes(label) === true ||
    deviceOf(entry, registries)?.labels?.includes(label) === true
  );
}

function fromIntegration(entry: EntityEntry, integration: string, registries: Registries): boolean {
  const device = entry.device_id;
  return device === undefined || device === null
    ? entry.platform === integration
    : Object.values(registries.entities).some(
        (other) => other.device_id === device && other.platform === integration,
      );
}

function words(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
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

function ranked(found: EntityEntry[], registries: Registries): EntityEntry[] {
  return found.toSorted(
    (a, b) =>
      rankOf(a, registries).localeCompare(rankOf(b, registries)) ||
      a.entity_id.localeCompare(b.entity_id),
  );
}

export function matches(entry: EntityEntry, filter: Filter, registries: Registries): boolean {
  const device = deviceOf(entry, registries);
  const text = textOf(entry, registries);
  const attributes = registries.states[entry.entity_id]?.attributes;
  return (
    (filter.domain === undefined || entry.entity_id.startsWith(`${filter.domain}.`)) &&
    (filter.platform === undefined || entry.platform === filter.platform) &&
    (filter.translation_key === undefined || entry.translation_key === filter.translation_key) &&
    (filter.device_class === undefined ||
      attribute(entry, registries, 'device_class') === filter.device_class) &&
    (filter.entity_category === undefined ||
      (entry.entity_category ?? 'none') === filter.entity_category) &&
    (filter.unit === undefined ||
      attribute(entry, registries, 'unit_of_measurement') === filter.unit) &&
    (filter.state_class === undefined ||
      attribute(entry, registries, 'state_class') === filter.state_class) &&
    Object.entries(filter.attribute ?? {}).every(([name, wanted]) =>
      holds(attributes?.[name], wanted),
    ) &&
    (filter.name === undefined || words(filter.name).every((word) => text.includes(word))) &&
    (filter.manufacturer === undefined ||
      (device?.manufacturer ?? '').toLowerCase().includes(filter.manufacturer.toLowerCase())) &&
    (filter.model === undefined ||
      (device?.model ?? '').toLowerCase().includes(filter.model.toLowerCase())) &&
    (filter.entry_type === undefined || (device?.entry_type ?? 'none') === filter.entry_type) &&
    (filter.integration === undefined || fromIntegration(entry, filter.integration, registries)) &&
    (filter.label === undefined || hasLabel(entry, filter.label, registries)) &&
    (filter.exclude === undefined || !matches(entry, filter.exclude, registries))
  );
}

const byId = (a: EntityEntry, b: EntityEntry): number => a.entity_id.localeCompare(b.entity_id);

function entitiesWithin(within: Within, registries: Registries): EntityEntry[] {
  if (within.area === null) {
    return [];
  }
  return Object.values(registries.entities)
    .filter((entry) => entry.hidden !== true)
    .filter((entry) => within.lone === undefined || entry.entity_id === within.lone)
    .filter((entry) => within.device === undefined || entry.device_id === within.device)
    .filter((entry) => within.area === undefined || areaOf(entry, registries) === within.area)
    .toSorted(byId);
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

export function relativesOf(device: string, registries: Registries): string[] {
  const parent = registries.devices[device]?.via_device_id;
  return Object.entries(registries.devices)
    .filter(([id, other]) => id !== device && (id === parent || other.via_device_id === device))
    .map(([id]) => id)
    .toSorted(byDevice(registries));
}

const unclaimed = (within: Within): readonly string[] =>
  (within.relatives ?? []).filter((device) => within.claimed?.includes(device) !== true);

function kin(within: Within, registries: Registries, relatives = within.relatives): EntityEntry[] {
  const devices = within.device === undefined ? [] : [within.device, ...(relatives ?? [])];
  return within.lone === undefined
    ? devices.flatMap((device) => entitiesWithin({ device }, registries))
    : entitiesWithin({ lone: within.lone }, registries);
}

function areaValue(rule: AreaValue, within: Within, registries: Registries): Value | undefined {
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

export function deviceName(id: string, registries: Registries): string {
  const device = registries.devices[id];
  return device?.name_by_user ?? device?.name ?? id;
}

const byDevice =
  (registries: Registries) =>
  (a: string, b: string): number =>
    deviceName(a, registries).localeCompare(deviceName(b, registries)) || a.localeCompare(b);

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

const joined = (path: string, field: string): string => (path === '' ? field : `${path}.${field}`);

function fill(
  rules: Record<string, Rule>,
  fields: Record<string, SlotSpec>,
  within: Within,
  registries: Registries,
  rec: Recorder | undefined,
  path: string,
): Record<string, Value> | undefined {
  const claims =
    within.device === undefined || (within.relatives ?? []).length === 0
      ? []
      : claimsOf(rules, fields, within, registries);
  const own: Within = claims.length === 0 ? within : { ...within, claimed: claims };
  const object: Record<string, Value> = {};
  let found = false;
  for (const [field, fieldRule] of Object.entries(rules)) {
    const value = valueOf(
      fieldRule,
      fields[field]?.kind ?? 'entity',
      fields[field]?.fields ?? {},
      own,
      registries,
      rec,
      joined(path, field),
    );
    if (value !== undefined) {
      object[field] = value;
      found ||= typeof fieldRule !== 'string' && filled(value);
    }
  }
  return found && !lacking(object, fields) ? object : undefined;
}

function objectsOf(
  rule: ObjectsRule,
  fields: Record<string, SlotSpec>,
  within: Within,
  registries: Registries,
  rec: Recorder | undefined,
  path: string,
): Value[] {
  const scope = scoped(rule.scope, within);
  const where = rule.where;
  const inScope =
    rule.scope === undefined && inside(within)
      ? kin(within, registries, unclaimed(within))
      : entitiesWithin(scope, registries);
  const counted = inScope.filter(
    (entry) => where === undefined || matches(entry, where, registries),
  );
  const groups: Within[] =
    rule.per === 'area'
      ? Object.values(registries.areas)
          .filter((area) => scope.area === undefined || area.area_id === scope.area)
          .toSorted((a, b) => a.name.localeCompare(b.name))
          .map((area) => ({ area: area.area_id, room: area.area_id }))
      : [
          ...new Set(
            counted
              .map((entry) => entry.device_id)
              .filter((device): device is string => typeof device === 'string'),
          ),
        ]
          .toSorted(byDevice(registries))
          .map((device) => ({
            device,
            room:
              rule.scope === 'all'
                ? deviceArea(device, registries)
                : (within.room ?? deviceArea(device, registries)),
          }));
  rec?.step({
    field: path,
    rule: rule.per === 'area' ? 'one per area' : `one per device with ${describe(where ?? {})}`,
    filter: where,
    area: within.area,
    everywhere: rule.scope === 'all',
    candidates: counted.map((entry) => entry.entity_id),
    picked: [],
    near: where === undefined ? [] : nearMisses(inScope, where, registries),
  });
  return groups.flatMap((group) => {
    const object = fill(rule.fields, fields, group, registries, rec, path);
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
    ...(ordered ? devices : devices.toSorted(byDevice(registries))).map((device) => ({
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
  searched: EntityEntry[];
  seen: number;
}

function anchoring(
  anchor: Filter | Filter[],
  rule: ObjectRule,
  within: Within,
  registries: Registries,
): Anchoring {
  const anchors = [anchor].flat();
  const fits = (entry: EntityEntry): boolean =>
    anchors.some((each) => matches(entry, each, registries));
  const searched = entitiesWithin(scoped(rule.scope, within), registries);
  const nested = inside(within);
  const tiers: { entries: EntityEntry[]; ordered: boolean; linked: boolean }[] = nested
    ? [
        { entries: kin(within, registries).filter(fits), ordered: true, linked: true },
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
  kind: Kind,
  fields: Record<string, SlotSpec>,
  registries: Registries,
): Group[] {
  const object = (group: Group): Record<string, Value> | undefined =>
    fill(rule.fields, fields, group.within, registries, undefined, '');
  if (kind === 'objects') {
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

function claimsIn(
  rule: Rule,
  kind: Kind,
  fields: Record<string, SlotSpec>,
  within: Within,
  registries: Registries,
): string[] {
  if (Array.isArray(rule)) {
    return rule.flatMap((each) => claimsIn(each, kind, fields, within, registries));
  }
  if (typeof rule === 'string' || 'per' in rule || !('fields' in rule)) {
    return [];
  }
  if (rule.device === undefined) {
    return claimsOf(rule.fields, fields, within, registries);
  }
  const { levels } = anchoring(rule.device, rule, within, registries);
  return taken(levels, rule, kind, fields, registries).map((group) => group.key);
}

function claimsOf(
  rules: Record<string, Rule>,
  fields: Record<string, SlotSpec>,
  within: Within,
  registries: Registries,
): string[] {
  return Object.entries(rules).flatMap(([field, rule]) =>
    claimsIn(
      rule,
      fields[field]?.kind ?? 'entity',
      fields[field]?.fields ?? {},
      within,
      registries,
    ),
  );
}

function anchored(
  anchor: Filter | Filter[],
  rule: ObjectRule,
  kind: Kind,
  fields: Record<string, SlotSpec>,
  within: Within,
  registries: Registries,
  rec: Recorder | undefined,
  path: string,
): Value | undefined {
  const { anchors, candidates, levels, searched, seen } = anchoring(
    anchor,
    rule,
    within,
    registries,
  );
  const step: Step = {
    field: path,
    rule: `device with ${anchors.map(describe).join(' or ')}`,
    ...(anchors[0] === undefined ? {} : { filter: anchors[0] }),
    area: within.area,
    everywhere: rule.scope === 'all',
    candidates,
    picked: [],
    devices: levels.flat().map((group) => group.key),
    chosen: [],
    near: anchors[0] === undefined || seen > 0 ? [] : nearMisses(searched, anchors[0], registries),
  };
  rec?.step(step);
  if (kind === 'objects') {
    const objects = levels.flat().flatMap((group) => {
      const object = fill(rule.fields, fields, group.within, registries, rec, path);
      return object === undefined ? [] : [{ group, object }];
    });
    step.chosen = objects.map((each) => each.group.key);
    return objects.length === 0 ? undefined : objects.map((each) => each.object);
  }
  const [best] = taken(levels, rule, kind, fields, registries);
  if (best === undefined) {
    return undefined;
  }
  step.chosen = [best.key];
  return fill(rule.fields, fields, best.within, registries, rec, path);
}

function searchedFor(
  rule: Filter & { scope?: 'area' | 'all' },
  within: Within,
  registries: Registries,
): { inScope: EntityEntry[]; found: EntityEntry[] } {
  const own = entitiesWithin(scoped(rule.scope, within), registries);
  const found = own.filter((entry) => matches(entry, rule, registries));
  const relatives = rule.scope === undefined ? unclaimed(within) : [];
  if (found.length > 0 || relatives.length === 0) {
    return { inScope: own, found };
  }
  const theirs = relatives.flatMap((device) => entitiesWithin({ device }, registries));
  return {
    inScope: [...own, ...theirs],
    found: theirs.filter((entry) => matches(entry, rule, registries)),
  };
}

function valueOf(
  rule: Rule,
  kind: Kind,
  fields: Record<string, SlotSpec>,
  within: Within,
  registries: Registries,
  rec?: Recorder,
  path = '',
): Value | undefined {
  if (Array.isArray(rule)) {
    for (const each of rule) {
      const value = valueOf(each, kind, fields, within, registries, rec, path);
      if (filled(value)) {
        return value;
      }
    }
    return undefined;
  }
  if (typeof rule === 'string') {
    const value = areaValue(rule, within, registries);
    rec?.step({
      field: path,
      rule: AREA_WORDS[rule],
      area: within.area,
      everywhere: false,
      candidates: [],
      picked:
        (rule === 'area.temperature' || rule === 'area.humidity') && typeof value === 'string'
          ? [value]
          : [],
      near: [],
    });
    return value;
  }
  if ('per' in rule) {
    const objects = objectsOf(rule, fields, within, registries, rec, path);
    return objects.length > 0 ? objects : undefined;
  }
  if ('fields' in rule) {
    if (rule.device !== undefined) {
      return anchored(rule.device, rule, kind, fields, within, registries, rec, path);
    }
    const object: Record<string, Value> = {};
    for (const [field, fieldRule] of Object.entries(rule.fields)) {
      const value = valueOf(
        fieldRule,
        fields[field]?.kind ?? 'entity',
        fields[field]?.fields ?? {},
        within,
        registries,
        rec,
        joined(path, field),
      );
      if (value !== undefined) {
        object[field] = value;
      }
    }
    return Object.keys(object).length > 0 && !lacking(object, fields) ? object : undefined;
  }
  const { inScope, found } = searchedFor(rule, within, registries);
  const order = kind === 'entities' ? found : ranked(found, registries);
  const best = order[0];
  const chosen = best === undefined ? [] : kind === 'entities' ? found : [best];
  const tied =
    best === undefined || kind === 'entities'
      ? []
      : order.filter((entry) => rankOf(entry, registries) === rankOf(best, registries));
  rec?.step({
    field: path,
    rule: describe(rule),
    filter: rule,
    area: within.area,
    everywhere: rule.scope === 'all',
    candidates: order.map((entry) => entry.entity_id),
    picked: chosen.map((entry) => entry.entity_id),
    ...(tied.length > 1 ? { tied: tied.map((entry) => entry.entity_id) } : {}),
    near: nearMisses(inScope, rule, registries),
  });
  if (found.length === 0) {
    return undefined;
  }
  if (kind === 'entities') {
    return found.map((entry) => entry.entity_id);
  }
  return best?.entity_id;
}

const AREA_WORDS: Record<AreaValue, string> = {
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

function labelled(
  slot: string,
  kind: Kind,
  rule: Rule,
  area: string | undefined,
  registries: Registries,
  rec: Recorder | undefined,
): Value | undefined {
  const label = `${OVERRIDE}${slot}`;
  const scope: Within = area === undefined ? {} : { area };
  const filters = filtersOf(rule);
  const found = entitiesWithin(scope, registries).filter(
    (entry) =>
      entry.labels?.includes(label) === true ||
      (deviceOf(entry, registries)?.labels?.includes(label) === true &&
        filters.some((filter) => matches(entry, filter, registries))),
  );
  if (found.length === 0) {
    return undefined;
  }
  const picked = kind === 'entities' ? found : found.slice(0, 1);
  rec?.step({
    field: '',
    rule: `labelled ${label}`,
    filter: { label },
    area: area ?? null,
    everywhere: area === undefined,
    candidates: found.map((entry) => entry.entity_id),
    picked: picked.map((entry) => entry.entity_id),
    near: [],
  });
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
  registries: Registries,
  rec: Recorder | undefined,
): Value | undefined {
  const rules = fieldRulesOf(rule);
  if (rules === undefined) {
    return undefined;
  }
  const label = `${OVERRIDE}${slot}`;
  const marked = entitiesWithin(area === undefined ? {} : { area }, registries).filter((entry) =>
    hasLabel(entry, label, registries),
  );
  if (marked.length === 0) {
    return undefined;
  }
  const groups = groupsOf(marked, false, area, registries);
  const step: Step = {
    field: '',
    rule: `labelled ${label}`,
    filter: { label },
    area: area ?? null,
    everywhere: area === undefined,
    candidates: marked.map((entry) => entry.entity_id),
    picked: [],
    devices: groups.map((group) => group.key),
    chosen: [],
    near: [],
  };
  rec?.step(step);
  const objects = groups.flatMap((group) => {
    const object = fill(rules, spec.fields ?? {}, group.within, registries, rec, '');
    return object === undefined ? [] : [{ group, object }];
  });
  const taken = spec.kind === 'objects' ? objects : objects.slice(0, 1);
  step.chosen = taken.map((each) => each.group.key);
  if (taken.length === 0) {
    return undefined;
  }
  return spec.kind === 'objects' ? taken.map((each) => each.object) : taken[0]?.object;
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
    : fill(
        rules,
        spec.fields ?? {},
        deviceWithin(device, area, registries),
        registries,
        undefined,
        '',
      );
}

export function discoverSlot(
  slot: string,
  spec: SlotSpec,
  area: string | undefined,
  registries: Registries,
  rec?: Recorder,
): Value | undefined {
  if (spec.discover === undefined) {
    return undefined;
  }
  if (spec.kind === 'entity' || spec.kind === 'entities') {
    const chosen = labelled(slot, spec.kind, spec.discover, area, registries, rec);
    if (chosen !== undefined) {
      return chosen;
    }
  }
  if (spec.kind === 'object' || spec.kind === 'objects') {
    const chosen = labelledDevices(slot, spec, spec.discover, area, registries, rec);
    if (chosen !== undefined) {
      return chosen;
    }
  }
  return valueOf(
    spec.discover,
    spec.kind,
    spec.fields ?? {},
    { area: area ?? null, room: area ?? null },
    registries,
    rec,
  );
}

export function discover(
  template: Template,
  area: string | undefined,
  registries: Registries,
): Record<string, Value> {
  const found: Record<string, Value> = {};
  for (const [slot, spec] of Object.entries(template.slots ?? {})) {
    const value = discoverSlot(slot, spec, area, registries);
    if (value !== undefined) {
      found[slot] = value;
    }
  }
  return found;
}
