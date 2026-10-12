import type {
  AreaValue,
  Filter,
  Kind,
  ObjectsRule,
  Rule,
  SlotSpec,
  Template,
  Value,
} from '../contract/templates.ts';

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
  near: Near[];
}

export interface Recorder {
  step: (step: Step) => void;
}

const NEAR = 5;

export function describe(filter: Filter): string {
  const parts = [
    filter.domain,
    filter.platform === undefined ? undefined : `from ${filter.platform}`,
    filter.device_class === undefined ? undefined : `device class ${filter.device_class}`,
    filter.translation_key === undefined ? undefined : `kind ${filter.translation_key}`,
    filter.entity_category === undefined
      ? undefined
      : filter.entity_category === 'none'
        ? 'primary'
        : filter.entity_category,
    filter.unit === undefined ? undefined : `unit ${filter.unit}`,
    filter.state_class === undefined ? undefined : `state class ${filter.state_class}`,
    filter.name === undefined ? undefined : `named like "${filter.name}"`,
    filter.manufacturer === undefined ? undefined : `made by ${filter.manufacturer}`,
    filter.model === undefined ? undefined : `model ${filter.model}`,
    filter.label === undefined ? undefined : `labelled ${filter.label}`,
    filter.exclude === undefined ? undefined : `but not ${describe(filter.exclude)}`,
  ].filter((part) => part !== undefined);
  return parts.length === 0 ? 'any entity' : parts.join(', ');
}

function whyNot(entry: EntityEntry, filter: Filter, registries: Registries): string[] {
  const why: string[] = [];
  const device = deviceOf(entry, registries);
  if (filter.platform !== undefined && entry.platform !== filter.platform) {
    why.push(`is from ${entry.platform ?? 'no integration'}, not ${filter.platform}`);
  }
  if (filter.translation_key !== undefined && entry.translation_key !== filter.translation_key) {
    why.push(`has kind ${entry.translation_key ?? 'none'}, not ${filter.translation_key}`);
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
  reading('device_class', filter.device_class, 'device class');
  reading('unit_of_measurement', filter.unit, 'unit');
  reading('state_class', filter.state_class, 'state class');
  if (
    filter.entity_category !== undefined &&
    (entry.entity_category ?? 'none') !== filter.entity_category
  ) {
    const actual = entry.entity_category ?? 'none';
    why.push(
      `is ${actual === 'none' ? 'primary' : actual}, not ${filter.entity_category === 'none' ? 'primary' : filter.entity_category}`,
    );
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
    why.push(`is model ${device?.model ?? 'unknown'}, not ${filter.model}`);
  }
  if (filter.label !== undefined && !hasLabel(entry, filter.label, registries)) {
    why.push(`lacks the label ${filter.label}`);
  }
  if (filter.exclude !== undefined && matches(entry, filter.exclude, registries)) {
    why.push(`is excluded: it is ${describe(filter.exclude)}`);
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
    (filter.name === undefined || words(filter.name).every((word) => text.includes(word))) &&
    (filter.manufacturer === undefined ||
      (device?.manufacturer ?? '').toLowerCase().includes(filter.manufacturer.toLowerCase())) &&
    (filter.model === undefined ||
      (device?.model ?? '').toLowerCase().includes(filter.model.toLowerCase())) &&
    (filter.label === undefined || hasLabel(entry, filter.label, registries)) &&
    (filter.exclude === undefined || !matches(entry, filter.exclude, registries))
  );
}

function entitiesWithin(within: Within, registries: Registries): EntityEntry[] {
  if (within.area === null) {
    return [];
  }
  return Object.values(registries.entities)
    .filter((entry) => entry.hidden !== true)
    .filter((entry) => within.device === undefined || entry.device_id === within.device)
    .filter((entry) => within.area === undefined || areaOf(entry, registries) === within.area)
    .toSorted((a, b) => a.entity_id.localeCompare(b.entity_id));
}

function areaValue(rule: AreaValue, within: Within, registries: Registries): Value | undefined {
  const area =
    within.area === undefined || within.area === null ? undefined : registries.areas[within.area];
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

function deviceName(id: string, registries: Registries): string {
  const device = registries.devices[id];
  return device?.name_by_user ?? device?.name ?? id;
}

function objectsOf(
  rule: ObjectsRule,
  fields: Record<string, SlotSpec>,
  within: Within,
  registries: Registries,
  rec: Recorder | undefined,
  path: string,
): Value[] {
  const scope: Within = rule.scope === 'all' ? {} : within;
  const where = rule.where;
  const inScope = entitiesWithin(scope, registries);
  const counted = inScope.filter(
    (entry) => where === undefined || matches(entry, where, registries),
  );
  const groups: Within[] =
    rule.per === 'area'
      ? Object.values(registries.areas)
          .filter((area) => scope.area === undefined || area.area_id === scope.area)
          .toSorted((a, b) => a.name.localeCompare(b.name))
          .map((area) => ({ area: area.area_id }))
      : [
          ...new Set(
            counted
              .map((entry) => entry.device_id)
              .filter((device): device is string => typeof device === 'string'),
          ),
        ]
          .toSorted(
            (a, b) =>
              deviceName(a, registries).localeCompare(deviceName(b, registries)) ||
              a.localeCompare(b),
          )
          .map((device) => ({ device }));
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
  const objects: Value[] = [];
  for (const group of groups) {
    const object: Record<string, Value> = {};
    let found = false;
    for (const [field, fieldRule] of Object.entries(rule.fields)) {
      const value = valueOf(
        fieldRule,
        fields[field]?.kind ?? 'entity',
        fields[field]?.fields ?? {},
        group,
        registries,
        rec,
        `${path}.${field}`,
      );
      if (value !== undefined) {
        object[field] = value;
        found ||= typeof fieldRule !== 'string' && filled(value);
      }
    }
    if (found && !lacking(object, fields)) {
      objects.push(object);
    }
  }
  return objects;
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
    const object: Record<string, Value> = {};
    for (const [field, fieldRule] of Object.entries(rule.fields)) {
      const value = valueOf(
        fieldRule,
        fields[field]?.kind ?? 'entity',
        fields[field]?.fields ?? {},
        within,
        registries,
        rec,
        path === '' ? field : `${path}.${field}`,
      );
      if (value !== undefined) {
        object[field] = value;
      }
    }
    return Object.keys(object).length > 0 && !lacking(object, fields) ? object : undefined;
  }
  const inScope = entitiesWithin(rule.scope === 'all' ? {} : within, registries);
  const found = inScope.filter((entry) => matches(entry, rule, registries));
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

function labelled(
  slot: string,
  kind: Kind,
  area: string | undefined,
  registries: Registries,
  rec: Recorder | undefined,
): Value | undefined {
  const label = `${OVERRIDE}${slot}`;
  const scope: Within = area === undefined ? {} : { area };
  const found = entitiesWithin(scope, registries).filter((entry) =>
    hasLabel(entry, label, registries),
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
    const chosen = labelled(slot, spec.kind, area, registries, rec);
    if (chosen !== undefined) {
      return chosen;
    }
  }
  return valueOf(
    spec.discover,
    spec.kind,
    spec.fields ?? {},
    { area: area ?? null },
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
