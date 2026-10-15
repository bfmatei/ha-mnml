import type { DeviceChoice, RoomChoice } from '../contract/plan.ts';
import { isMapping } from '../contract/templates.ts';
import type { Filter, Templates, Value } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';
import { discover } from '../templates/discover.ts';
import { byDeviceName, deviceName, indexOf } from '../templates/entity-index.ts';
import { matches } from '../templates/filters.ts';
import { cardsFor } from '../templates/stands.ts';
import type { TemplateIndex } from '../templates/stands.ts';

export interface Offer {
  readonly device: string;
  readonly name: string;
  readonly area: string | undefined;
  readonly templates: readonly string[];
}

interface Shown {
  readonly name: string;
  readonly found: Readonly<Record<string, Value>>;
}

function placeOf(device: string, registries: Registries): string | undefined {
  const area = registries.devices[device]?.area_id ?? undefined;
  return area !== undefined && Object.hasOwn(registries.areas, area) ? area : undefined;
}

export function offersIn(
  registries: Registries,
  index: TemplateIndex,
  chosen: readonly DeviceChoice[] = [],
): Offer[] {
  const areas = Object.keys(registries.areas);
  const rank = (area: string | undefined): number =>
    area === undefined ? areas.length : areas.indexOf(area);
  const byName = byDeviceName(registries);
  return Object.keys(registries.devices)
    .flatMap((device): Offer[] => {
      const found = cardsFor(index, device, registries).map(({ template }) => template);
      const kept = chosen.flatMap((choice) =>
        choice.device === device && !found.includes(choice.template) ? [choice.template] : [],
      );
      const templates = [...found, ...new Set(kept)];
      return templates.length === 0
        ? []
        : [
            {
              device,
              name: deviceName(device, registries),
              area: placeOf(device, registries),
              templates,
            },
          ];
    })
    .toSorted((a, b) => rank(a.area) - rank(b.area) || byName(a.device, b.device));
}

export function roomFound(
  room: RoomChoice,
  template: string,
  registries: Registries,
  templates: Templates,
): Record<string, Value> {
  if (room.spelled === true) {
    return room.slots;
  }
  const found = templates[template];
  return {
    ...(found === undefined ? {} : discover(found, room.area, registries)),
    ...room.slots,
  };
}

const holds = (value: Value | undefined, id: string): boolean =>
  value === id ||
  (Array.isArray(value)
    ? value.some((each) => holds(each, id))
    : isMapping(value) && Object.values(value).some((each) => holds(each, id)));

export function shownBy(
  device: string,
  anchor: readonly Filter[] | undefined,
  rooms: readonly Shown[],
  registries: Registries,
): string | undefined {
  const own = (indexOf(registries).devices.get(device) ?? [])
    .filter(
      (entry) =>
        anchor === undefined || anchor.some((filter) => matches(entry, filter, registries)),
    )
    .map((entry) => entry.entity_id);
  return rooms.find((room) => own.some((id) => holds(room.found, id)))?.name;
}
