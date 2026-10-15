import type { EnergyValue, Kind, SlotSpec, Value } from '../contract/templates.ts';
import type { EnergyDevice, EnergyPrefs, Registries } from '../ha/registries.ts';

interface Role {
  type: string;
  stat: 'stat_rate' | 'stat_soc';
}

const SOURCES: Readonly<Record<Exclude<EnergyValue, 'energy.devices'>, Role>> = {
  'energy.grid_power': { type: 'grid', stat: 'stat_rate' },
  'energy.solar_power': { type: 'solar', stat: 'stat_rate' },
  'energy.battery_power': { type: 'battery', stat: 'stat_rate' },
  'energy.battery_charge': { type: 'battery', stat: 'stat_soc' },
};

const NAMES: Readonly<Record<EnergyValue, string>> = {
  'energy.grid_power': 'grid power',
  'energy.solar_power': 'solar power',
  'energy.battery_power': 'battery power',
  'energy.battery_charge': 'battery charge',
  'energy.devices': 'device power',
};

export const ENERGY_WORDS: Readonly<Record<EnergyValue, string>> = {
  'energy.grid_power': "the grid's power in the energy settings",
  'energy.solar_power': 'the solar power in the energy settings',
  'energy.battery_power': "the battery's power in the energy settings",
  'energy.battery_charge': "the battery's charge in the energy settings",
  'energy.devices': 'the devices of the energy settings',
};

interface EnergyFind {
  candidates: string[];
  picked: string[];
  value: Value | undefined;
  missing?: string;
}

export function isEnergyValue(rule: string): rule is EnergyValue {
  return Object.hasOwn(ENERGY_WORDS, rule);
}

const known = (id: string | undefined, registries: Registries): id is string =>
  id !== undefined && Object.hasOwn(registries.states, id);

function inside(device: EnergyDevice, listed: ReadonlySet<string>, prefs: EnergyPrefs): boolean {
  const parents = new Map(
    prefs.device_consumption.map((each) => [each.stat_consumption, each.included_in_stat]),
  );
  const seen = new Set<string>();
  let parent = device.included_in_stat;
  while (parent !== undefined && !seen.has(parent)) {
    if (listed.has(parent)) {
      return true;
    }
    seen.add(parent);
    parent = parents.get(parent);
  }
  return false;
}

function metered(prefs: EnergyPrefs, registries: Registries): EnergyDevice[] {
  const powered = prefs.device_consumption.filter((device) => known(device.stat_rate, registries));
  const listed = new Set(powered.map((device) => device.stat_consumption));
  return powered.filter((device) => !inside(device, listed, prefs));
}

function meterOf(
  device: EnergyDevice,
  fields: Readonly<Record<string, SlotSpec>>,
  registries: Registries,
): Record<string, Value> | undefined {
  const values: Record<string, string | undefined> = {
    power: device.stat_rate,
    total: known(device.stat_consumption, registries) ? device.stat_consumption : undefined,
  };
  const meter = Object.fromEntries(
    Object.entries(values).flatMap(([field, id]) =>
      id !== undefined && Object.hasOwn(fields, field) ? [[field, id]] : [],
    ),
  );
  return Object.entries(fields).every(
    ([field, spec]) => spec.required !== true || Object.hasOwn(meter, field),
  ) && Object.keys(meter).length > 0
    ? meter
    : undefined;
}

function chosen(kind: Kind, ids: string[], objects: Record<string, Value>[]): Value | undefined {
  if (kind === 'entity') {
    return ids[0];
  }
  if (kind === 'entities') {
    return ids.length > 0 ? ids : undefined;
  }
  if (kind === 'object') {
    return objects[0];
  }
  if (kind === 'objects') {
    return objects.length > 0 ? objects : undefined;
  }
  return undefined;
}

export function energyFind(
  rule: EnergyValue,
  kind: Kind,
  fields: Readonly<Record<string, SlotSpec>>,
  registries: Registries,
): EnergyFind {
  const prefs = registries.energy;
  let ids: string[] = [];
  let objects: Record<string, Value>[] = [];
  if (rule === 'energy.devices') {
    const devices = prefs === undefined ? [] : metered(prefs, registries);
    ids = devices.flatMap((device) => device.stat_rate ?? []);
    objects = devices.flatMap((device): Record<string, Value>[] => {
      const meter = meterOf(device, fields, registries);
      return meter === undefined ? [] : [meter];
    });
  } else {
    const role = SOURCES[rule];
    ids = (prefs?.energy_sources ?? [])
      .filter((source) => source.type === role.type)
      .map((source) => source[role.stat])
      .filter((id) => known(id, registries));
  }
  const value = chosen(kind, ids, objects);
  const picked =
    value === undefined
      ? []
      : kind === 'entity' || kind === 'entities'
        ? [value].flat().filter((id) => typeof id === 'string')
        : objects
            .slice(0, kind === 'object' ? 1 : undefined)
            .flatMap((meter) => (typeof meter['power'] === 'string' ? [meter['power']] : []));
  return {
    candidates: ids,
    picked,
    value,
    ...(value === undefined ? { missing: `the energy settings name no ${NAMES[rule]}` } : {}),
  };
}
