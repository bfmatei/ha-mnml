import type { PersonId } from '../contract/entities.ts';
import type { Value } from '../contract/templates.ts';
import type { Registries } from '../templates/discover.ts';

const SENSORS: readonly (readonly [string, string])[] = [
  ['battery', '_battery_level'],
  ['battery_state', '_battery_state'],
  ['connection', '_connection_type'],
  ['network', '_ssid'],
  ['storage', '_storage'],
  ['focus', '_focus'],
  ['activity', '_activity'],
  ['permission', '_location_permission'],
];

function trackersOf(registries: Registries, entity: PersonId): string[] {
  const trackers = registries.states[entity]?.attributes['device_trackers'];
  return Array.isArray(trackers)
    ? trackers.filter((tracker): tracker is string => typeof tracker === 'string')
    : [];
}

function deviceOf(
  registries: Registries,
  key: string,
  tracker: string,
): Record<string, string> | undefined {
  const entry = registries.entities[tracker];
  const id = entry?.device_id;
  if (entry?.platform !== 'mobile_app' || id === undefined || id === null) {
    return undefined;
  }
  const own = Object.values(registries.entities)
    .filter((each) => each.device_id === id)
    .map((each) => each.entity_id);
  const sensors: Record<string, string> = {};
  for (const [slot, suffix] of SENSORS) {
    const found = own.find((each) => each.endsWith(suffix));
    if (found === undefined) {
      return undefined;
    }
    sensors[slot] = found;
  }
  const objectId = tracker.slice(tracker.indexOf('.') + 1);
  const device = registries.devices[id];
  const name = device?.name_by_user ?? device?.name ?? undefined;
  return {
    key: objectId.startsWith(`${key}_`) ? objectId.slice(key.length + 1) : objectId,
    ...(name === undefined ? {} : { name }),
    tracker,
    ...sensors,
  };
}

export function personOf(registries: Registries, entity: PersonId): Record<string, Value> {
  const key = entity.slice('person.'.length);
  const devices = trackersOf(registries, entity)
    .map((tracker) => deviceOf(registries, key, tracker))
    .filter((device): device is Record<string, string> => device !== undefined);
  if (devices.length === 0) {
    return { key, entity };
  }
  return {
    key,
    entity,
    devices,
    activities: devices.flatMap((device) => device['activity'] ?? []),
    focuses: devices.flatMap((device) => device['focus'] ?? []),
    batteries: devices.flatMap((device) => device['battery'] ?? []),
  };
}
