import type { PersonId } from '../contract/entities.ts';
import { SECTION_LOOKS, SYSTEM_TEMPLATES, isPersonId } from '../contract/plan.ts';
import type {
  Plan,
  DashboardTemplate,
  RoomChoice,
  SectionKey,
  SectionLook,
} from '../contract/plan.ts';
import { isMapping } from '../contract/templates.ts';
import type { Filter, Instance, Templates, Value } from '../contract/templates.ts';
import type { EntityEntry, Registries } from '../ha/registries.ts';
import { discover } from '../templates/discover.ts';
import { areaOf } from '../templates/entity-index.ts';
import { expand, filled } from '../templates/expand.ts';
import { matches } from '../templates/filters.ts';

const NAMING = new Set(['key', 'name', 'icon']);

type Sign = 'tracker' | 'system' | 'room';

interface Mark {
  filter: Filter;
  measured?: true;
  plug?: true;
  sign: Sign;
}

const MARKS: readonly Mark[] = [
  { filter: { platform: 'mobile_app' }, sign: 'tracker' },
  { filter: { domain: 'device_tracker', attribute: { source_type: 'gps' } }, sign: 'tracker' },
  { filter: { entity_category: 'diagnostic' }, sign: 'system' },
  { filter: { entity_category: 'config' }, sign: 'system' },
  { filter: { domain: 'update' }, sign: 'system' },
  { filter: { domain: 'light' }, sign: 'room' },
  { filter: { domain: 'climate' }, sign: 'room' },
  { filter: { domain: 'sensor', device_class: 'temperature' }, measured: true, sign: 'room' },
  { filter: { domain: 'sensor', device_class: 'humidity' }, measured: true, sign: 'room' },
  { filter: { domain: 'switch', device_class: 'outlet' }, sign: 'room' },
  { filter: { domain: 'sensor', device_class: 'power' }, plug: true, sign: 'room' },
  { filter: { domain: 'cover' }, sign: 'room' },
  { filter: { domain: 'lock' }, sign: 'room' },
  { filter: { domain: 'binary_sensor', device_class: 'window' }, sign: 'room' },
  { filter: { domain: 'binary_sensor', device_class: 'door' }, sign: 'room' },
  { filter: { domain: 'binary_sensor', device_class: 'moisture' }, sign: 'room' },
  { filter: { domain: 'media_player' }, sign: 'room' },
  { filter: { domain: 'camera' }, sign: 'room' },
  { filter: { domain: 'fan' }, sign: 'room' },
  { filter: { domain: 'humidifier' }, sign: 'room' },
  { filter: { domain: 'vacuum' }, sign: 'room' },
  { filter: { platform: 'prusalink' }, sign: 'room' },
  {
    filter: { domain: 'sensor', platform: 'smartthings', translation_key: 'washer_machine_state' },
    sign: 'room',
  },
  {
    filter: { domain: 'sensor', platform: 'smartthings', translation_key: 'dryer_machine_state' },
    sign: 'room',
  },
  {
    filter: {
      domain: 'sensor',
      platform: 'smartthings',
      translation_key: 'dishwasher_machine_state',
    },
    sign: 'room',
  },
  {
    filter: { domain: 'sensor', platform: 'home_connect', translation_key: 'operation_state' },
    sign: 'room',
  },
];

export type AreaKind = 'room' | 'phones' | 'system' | 'empty';

function deviceId(entry: EntityEntry): string | undefined {
  return entry.device_id ?? undefined;
}

function measured(entry: EntityEntry, registries: Registries): boolean {
  const device = deviceId(entry);
  if (device !== undefined && registries.devices[device]?.entry_type !== 'service') {
    return true;
  }
  const id = areaOf(entry, registries);
  const area = id === undefined ? undefined : registries.areas[id];
  return (
    area !== undefined &&
    (area.temperature_entity_id === entry.entity_id || area.humidity_entity_id === entry.entity_id)
  );
}

function signOf(
  entry: EntityEntry,
  registries: Registries,
  plugs: ReadonlySet<string>,
): Sign | undefined {
  const device = deviceId(entry);
  return MARKS.find(
    (mark) =>
      matches(entry, mark.filter, registries) &&
      (mark.measured !== true || measured(entry, registries)) &&
      (mark.plug !== true || (device !== undefined && plugs.has(device))),
  )?.sign;
}

interface Held {
  area: string | undefined;
  device: string | undefined;
  shown: boolean;
}

function holdings(registries: Registries): { held: Held[]; trackers: ReadonlySet<string> } {
  const entries = Object.values(registries.entities);
  const plugs = new Set(
    entries.flatMap((entry) =>
      entry.entity_id.startsWith('switch.') ? (deviceId(entry) ?? []) : [],
    ),
  );
  const signed = entries.map((entry) => ({
    entry,
    device: deviceId(entry),
    sign: signOf(entry, registries, plugs),
  }));
  const trackers = new Set(
    signed.flatMap(({ device, sign }) => (sign === 'tracker' ? (device ?? []) : [])),
  );
  return {
    held: signed.map(({ entry, device, sign }) => ({
      area: areaOf(entry, registries),
      device,
      shown: sign === 'room' && (device === undefined || !trackers.has(device)),
    })),
    trackers,
  };
}

export function areaKinds(registries: Registries): Readonly<Record<string, AreaKind>> {
  const { held, trackers } = holdings(registries);
  const kindOf = (area: string): AreaKind => {
    const inside = held.filter((each) => each.area === area);
    if (inside.some((each) => each.shown)) {
      return 'room';
    }
    const devices = new Set(inside.flatMap((each) => each.device ?? []));
    if (devices.size === 0) {
      return 'empty';
    }
    return [...devices].every((device) => trackers.has(device)) ? 'phones' : 'system';
  };
  return Object.fromEntries(Object.keys(registries.areas).map((area) => [area, kindOf(area)]));
}

export interface Unplaced {
  devices: number;
  entities: number;
  share: number;
}

export function unplaced(registries: Registries): Unplaced {
  const shown = holdings(registries).held.filter((each) => each.shown);
  const away = shown.filter((each) => each.area === undefined);
  const known = (device: string | undefined): device is string =>
    device !== undefined && registries.devices[device] !== undefined;
  return {
    devices: new Set(away.flatMap(({ device }) => (known(device) ? [device] : []))).size,
    entities: away.filter(({ device }) => !known(device)).length,
    share: shown.length === 0 ? 0 : away.length / shown.length,
  };
}

function draws(templates: Templates, instance: Instance, found: Record<string, Value>): boolean {
  try {
    return expand(templates, instance, found).missing === undefined;
  } catch {
    return false;
  }
}

export function roomShows(
  registries: Registries,
  templates: Templates,
  area: string,
  template = 'room',
): boolean {
  const room = templates[template];
  if (room === undefined) {
    return false;
  }
  const found = discover(room, area, registries);
  return (
    Object.keys(found).some((slot) => !NAMING.has(slot)) && draws(templates, { template }, found)
  );
}

export function systemFills(registries: Registries, templates: Templates, name: string): boolean {
  const template = templates[name];
  if (template === undefined) {
    return false;
  }
  const found = discover(template, undefined, registries);
  if (!Object.values(found).some((value) => filled(value))) {
    return false;
  }
  try {
    const card = expand(templates, { template: name }, found).card;
    const state = isMapping(card) ? card['state'] : undefined;
    return (
      isMapping(card) &&
      (typeof card['entity'] === 'string' || (Array.isArray(state) && state.length > 0))
    );
  } catch {
    return false;
  }
}

function roomsIn(registries: Registries, templates: Templates, template: string): RoomChoice[] {
  const kinds = areaKinds(registries);
  return Object.values(registries.areas)
    .filter(
      (area) =>
        kinds[area.area_id] === 'room' && roomShows(registries, templates, area.area_id, template),
    )
    .map((area) => ({ area: area.area_id }));
}

export function peopleIn(registries: Registries): PersonId[] {
  return [
    ...new Set([...Object.keys(registries.entities), ...Object.keys(registries.states)]),
  ].filter(isPersonId);
}

export const DEFAULT_DASHBOARD_TEMPLATE: DashboardTemplate = {
  title: 'Home',
  icon: 'mdi:home-variant',
  open: { tablet: 'unfold', desktop: 'unfold' },
  sections: { rooms: {}, people: {}, system: {} },
  templates: {},
};

const KEYS: readonly SectionKey[] = ['rooms', 'people', 'garage', 'system'];

function lookIn(dashboardTemplate: DashboardTemplate, key: SectionKey): SectionLook {
  const given = dashboardTemplate.sections[key];
  const fallback = SECTION_LOOKS[key];
  if (given === undefined) {
    return {};
  }
  return {
    ...(given.title === undefined ? {} : { title: given.title }),
    ...(given.icon === undefined || given.icon === fallback.icon ? {} : { icon: given.icon }),
    ...(given.template === undefined || given.template === fallback.template
      ? {}
      : { template: given.template }),
  };
}

export function planFrom(
  dashboardTemplate: DashboardTemplate,
  registries: Registries,
  templates: Templates,
): Plan {
  const looks = Object.fromEntries(
    KEYS.flatMap((key) => {
      const look = lookIn(dashboardTemplate, key);
      return Object.keys(look).length === 0 ? [] : [[key, look]];
    }),
  );
  const { rooms, people, system } = dashboardTemplate.sections;
  const roomTemplate = rooms?.template ?? 'room';
  return {
    title: dashboardTemplate.title,
    icon: dashboardTemplate.icon,
    ...(dashboardTemplate.glances === true ? { glances: {} } : {}),
    rooms: rooms === undefined ? [] : roomsIn(registries, templates, roomTemplate),
    people: people === undefined ? [] : peopleIn(registries).map((entity) => ({ entity })),
    cars: [],
    system:
      system === undefined
        ? []
        : (system.templates ?? SYSTEM_TEMPLATES)
            .filter((name) => systemFills(registries, templates, name))
            .map((template) => ({ template })),
    open: { ...dashboardTemplate.open },
    ...(Object.keys(looks).length === 0 ? {} : { sections: looks }),
    ...(dashboardTemplate.order === undefined ? {} : { order: [...dashboardTemplate.order] }),
  };
}

export function defaultPlan(registries: Registries, templates: Templates): Plan {
  return planFrom(DEFAULT_DASHBOARD_TEMPLATE, registries, templates);
}
