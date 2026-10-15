import type { AreaEntry, DeviceEntry, EntityEntry, Registries } from '../ha/registries.ts';

export interface Index {
  visible: readonly EntityEntry[];
  domains: ReadonlyMap<string, readonly EntityEntry[]>;
  ids: ReadonlyMap<string, EntityEntry>;
  areas: ReadonlyMap<string, readonly EntityEntry[]>;
  devices: ReadonlyMap<string, readonly EntityEntry[]>;
  labels: ReadonlyMap<string, readonly EntityEntry[]>;
  platforms: ReadonlyMap<string, ReadonlySet<string>>;
  byName: readonly AreaEntry[];
  children: ReadonlyMap<string, readonly string[]>;
  relatives: Map<string, readonly string[]>;
}

interface Indexed {
  areas: Registries['areas'];
  devices: Registries['devices'];
  index: Index;
}

const INDEXES = new WeakMap<Registries['entities'], Indexed>();

export function deviceOf(entry: EntityEntry, registries: Registries): DeviceEntry | undefined {
  return entry.device_id === undefined || entry.device_id === null
    ? undefined
    : registries.devices[entry.device_id];
}

export function areaOf(entry: EntityEntry, registries: Registries): string | undefined {
  if (entry.area_id !== undefined && entry.area_id !== null) {
    return entry.area_id;
  }
  return deviceOf(entry, registries)?.area_id ?? undefined;
}

export function deviceName(id: string, registries: Registries): string {
  const device = registries.devices[id];
  return device?.name_by_user ?? device?.name ?? id;
}

export const byDeviceName =
  (registries: Registries) =>
  (a: string, b: string): number =>
    deviceName(a, registries).localeCompare(deviceName(b, registries)) || a.localeCompare(b);

const byId = (a: EntityEntry, b: EntityEntry): number => a.entity_id.localeCompare(b.entity_id);

function grouped<T>(items: readonly T[], keysOf: (item: T) => readonly string[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    for (const key of keysOf(item)) {
      const group = groups.get(key);
      if (group === undefined) {
        groups.set(key, [item]);
      } else {
        group.push(item);
      }
    }
  }
  return groups;
}

function built(registries: Registries): Index {
  const all = Object.values(registries.entities);
  const visible = all.filter((entry) => entry.hidden !== true).toSorted(byId);
  const platforms = new Map<string, Set<string>>();
  for (const entry of all) {
    if (typeof entry.device_id === 'string' && entry.platform !== undefined) {
      platforms.set(
        entry.device_id,
        (platforms.get(entry.device_id) ?? new Set<string>()).add(entry.platform),
      );
    }
  }
  return {
    visible,
    domains: grouped(visible, (entry) => {
      const dot = entry.entity_id.indexOf('.');
      return dot > 0 ? [entry.entity_id.slice(0, dot)] : [];
    }),
    ids: new Map(visible.map((entry) => [entry.entity_id, entry])),
    areas: grouped(visible, (entry) => {
      const area = areaOf(entry, registries);
      return area === undefined ? [] : [area];
    }),
    devices: grouped(visible, (entry) =>
      typeof entry.device_id === 'string' ? [entry.device_id] : [],
    ),
    labels: grouped(visible, (entry) => [
      ...new Set([...(entry.labels ?? []), ...(deviceOf(entry, registries)?.labels ?? [])]),
    ]),
    platforms,
    byName: Object.values(registries.areas).toSorted((a, b) => a.name.localeCompare(b.name)),
    children: grouped(Object.keys(registries.devices), (id) => {
      const parent = registries.devices[id]?.via_device_id;
      return typeof parent === 'string' ? [parent] : [];
    }),
    relatives: new Map(),
  };
}

export function indexOf(registries: Registries): Index {
  const known = INDEXES.get(registries.entities);
  if (
    known !== undefined &&
    known.devices === registries.devices &&
    known.areas === registries.areas
  ) {
    return known.index;
  }
  const index = built(registries);
  INDEXES.set(registries.entities, {
    areas: registries.areas,
    devices: registries.devices,
    index,
  });
  return index;
}

export function inDomain(index: Index, domain: string | undefined): readonly EntityEntry[] {
  return domain === undefined || domain === '' || domain.includes('.')
    ? index.visible
    : (index.domains.get(domain) ?? []);
}

export function relativesOf(device: string, registries: Registries): readonly string[] {
  const index = indexOf(registries);
  const known = index.relatives.get(device);
  if (known !== undefined) {
    return known;
  }
  const parent = registries.devices[device]?.via_device_id;
  const relatives = [
    ...new Set([
      ...(typeof parent === 'string' && Object.hasOwn(registries.devices, parent) ? [parent] : []),
      ...(index.children.get(device) ?? []),
    ]),
  ]
    .filter((id) => id !== device)
    .toSorted(byDeviceName(registries));
  index.relatives.set(device, relatives);
  return relatives;
}
