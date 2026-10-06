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
}

interface EntityEntry {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string;
  translation_key?: string | null;
  entity_category?: string | null;
  hidden?: boolean;
}

export interface Registries {
  areas: Readonly<Record<string, AreaEntry>>;
  devices: Readonly<Record<string, DeviceEntry>>;
  entities: Readonly<Record<string, EntityEntry>>;
  states: Readonly<Record<string, { attributes: Readonly<Record<string, unknown>> }>>;
}

interface Within {
  area?: string | null;
  device?: string;
}

function areaOf(entry: EntityEntry, registries: Registries): string | undefined {
  if (entry.area_id !== undefined && entry.area_id !== null) {
    return entry.area_id;
  }
  const device =
    entry.device_id === undefined || entry.device_id === null
      ? undefined
      : registries.devices[entry.device_id];
  return device?.area_id ?? undefined;
}

function matches(entry: EntityEntry, filter: Filter, registries: Registries): boolean {
  const deviceClass = registries.states[entry.entity_id]?.attributes['device_class'];
  return (
    (filter.domain === undefined || entry.entity_id.startsWith(`${filter.domain}.`)) &&
    (filter.platform === undefined || entry.platform === filter.platform) &&
    (filter.translation_key === undefined || entry.translation_key === filter.translation_key) &&
    (filter.device_class === undefined || deviceClass === filter.device_class)
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

function deviceName(id: string, registries: Registries): string {
  const device = registries.devices[id];
  return device?.name_by_user ?? device?.name ?? id;
}

function objectsOf(
  rule: ObjectsRule,
  fields: Record<string, SlotSpec>,
  within: Within,
  registries: Registries,
): Value[] {
  const scope: Within = rule.scope === 'all' ? {} : within;
  const where = rule.where;
  const groups: Within[] =
    rule.per === 'area'
      ? Object.values(registries.areas)
          .filter((area) => scope.area === undefined || area.area_id === scope.area)
          .toSorted((a, b) => a.name.localeCompare(b.name))
          .map((area) => ({ area: area.area_id }))
      : [
          ...new Set(
            entitiesWithin(scope, registries)
              .filter((entry) => where === undefined || matches(entry, where, registries))
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
      );
      if (value !== undefined) {
        object[field] = value;
        found ||= typeof fieldRule !== 'string' && filled(value);
      }
    }
    if (found) {
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
): Value | undefined {
  if (Array.isArray(rule)) {
    for (const each of rule) {
      const value = valueOf(each, kind, fields, within, registries);
      if (filled(value)) {
        return value;
      }
    }
    return undefined;
  }
  if (typeof rule === 'string') {
    return areaValue(rule, within, registries);
  }
  if ('per' in rule) {
    const objects = objectsOf(rule, fields, within, registries);
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
      );
      if (value !== undefined) {
        object[field] = value;
      }
    }
    return Object.keys(object).length > 0 ? object : undefined;
  }
  const found = entitiesWithin(rule.scope === 'all' ? {} : within, registries).filter((entry) =>
    matches(entry, rule, registries),
  );
  if (found.length === 0) {
    return undefined;
  }
  if (kind === 'entities') {
    return found.map((entry) => entry.entity_id);
  }
  return (found.find((entry) => (entry.entity_category ?? null) === null) ?? found[0])?.entity_id;
}

export function discover(
  template: Template,
  area: string | undefined,
  registries: Registries,
): Record<string, Value> {
  const found: Record<string, Value> = {};
  for (const [slot, spec] of Object.entries(template.slots ?? {})) {
    if (spec.discover === undefined) {
      continue;
    }
    const value = valueOf(
      spec.discover,
      spec.kind,
      spec.fields ?? {},
      { area: area ?? null },
      registries,
    );
    if (value !== undefined) {
      found[slot] = value;
    }
  }
  return found;
}
