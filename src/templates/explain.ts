import type { SlotSpec, Template, Value } from '../contract/templates.ts';
import type { EntityEntry, Registries } from '../ha/registries.ts';

import { discoverSlot, fromDevice } from './discover.ts';
import type { Step } from './discover.ts';
import { areaOf, deviceName, indexOf, relativesOf } from './entity-index.ts';
import { describe, matches } from './filters.ts';

export interface DeviceFit {
  id: string;
  name: string;
  area?: string;
}

export interface Trace {
  value: Value | undefined;
  steps: Step[];
  reason?: string;
  devices?: DeviceFit[];
  device?: string;
}

const ELSEWHERE = 3;
const NEEDS_AREA = 'needs an area: without one only whole-home rules run';

function roomOf(
  area: string | undefined,
  device: string | undefined,
  registries: Registries,
): string | undefined {
  return (
    area ?? (device === undefined ? undefined : (registries.devices[device]?.area_id ?? undefined))
  );
}

function reasonOf(
  steps: Step[],
  registries: Registries,
  area: string | undefined,
  device: string | undefined,
): string | undefined {
  const first = steps.find((step) => step.filter !== undefined);
  if (first?.filter === undefined) {
    const named = steps[0];
    if (named?.missing !== undefined) {
      return named.missing;
    }
    if (device !== undefined) {
      return roomOf(area, device, registries) === undefined
        ? `${deviceName(device, registries)} is in no area`
        : 'the area has none';
    }
    return named?.area === null || named?.area === undefined ? NEEDS_AREA : 'the area has none';
  }
  if (first.devices !== undefined && first.devices.length > 0) {
    const names = first.devices.map((id) => deviceName(id, registries));
    return `found ${names.join(', ')}, without every field the slot needs`;
  }
  const { filter } = first;
  const everywhere = first.everywhere;
  const unplaced = first.area === null || first.area === undefined;
  const on = !everywhere && unplaced ? device : undefined;
  if (!everywhere && unplaced && on === undefined) {
    return NEEDS_AREA;
  }
  const where =
    on === undefined
      ? `in ${everywhere ? 'the home' : (registries.areas[first.area ?? '']?.name ?? String(first.area))}`
      : `on ${deviceName(on, registries)}`;
  const parts = [`no ${first.devices === undefined ? describe(filter) : first.rule} ${where}`];
  const near = steps.flatMap((step) => step.near).slice(0, ELSEWHERE);
  if (near.length > 0) {
    parts.push(
      `almost: ${near.map((miss) => `${miss.entity_id} ${miss.why.join(' and ')}`).join('; ')}`,
    );
  }
  if (!everywhere) {
    const mine = on === undefined ? undefined : new Set([on, ...relativesOf(on, registries)]);
    const away = (entry: EntityEntry): boolean =>
      mine === undefined
        ? areaOf(entry, registries) !== first.area
        : !mine.has(entry.device_id ?? '');
    const elsewhere = indexOf(registries)
      .visible.filter((entry) => matches(entry, filter, registries) && away(entry))
      .slice(0, ELSEWHERE);
    if (elsewhere.length > 0) {
      parts.push(
        `found elsewhere: ${elsewhere
          .map((entry) => {
            const area = areaOf(entry, registries);
            return `${entry.entity_id}${area === undefined ? ' (in no area)' : ` in ${registries.areas[area]?.name ?? area}`}`;
          })
          .join(', ')}`,
      );
    }
  }
  return parts.join('; ');
}

export function deviceFit(id: string, registries: Registries): DeviceFit {
  const area = registries.devices[id]?.area_id;
  const named = area === undefined || area === null ? undefined : registries.areas[area]?.name;
  return {
    id,
    name: deviceName(id, registries),
    ...(named === undefined ? {} : { area: named }),
  };
}

function fitting(
  spec: SlotSpec,
  steps: readonly Step[],
  area: string | undefined,
  registries: Registries,
): Pick<Trace, 'devices' | 'device'> {
  if (spec.kind !== 'object') {
    return {};
  }
  const anchors = steps.filter((step) => step.field === '' && step.devices !== undefined);
  const devices = [...new Set(anchors.flatMap((step) => step.devices ?? []))]
    .filter((id) => registries.devices[id] !== undefined)
    .filter((id) => fromDevice(spec, id, area, registries) !== undefined)
    .map((id) => deviceFit(id, registries));
  const device = anchors
    .flatMap((step) => step.chosen ?? [])
    .find((id) => devices.some((fit) => fit.id === id));
  if (devices.length === 0) {
    return {};
  }
  return device === undefined ? { devices } : { devices, device };
}

export function explain(
  template: Template,
  area: string | undefined,
  registries: Registries,
  device?: string,
): Record<string, Trace> {
  const traces: Record<string, Trace> = {};
  for (const [slot, spec] of Object.entries(template.slots ?? {})) {
    if (spec.discover === undefined) {
      continue;
    }
    const steps: Step[] = [];
    const value = discoverSlot(
      slot,
      spec,
      area,
      registries,
      { step: (step) => steps.push(step) },
      device,
    );
    traces[slot] = {
      value,
      steps,
      ...(value === undefined ? { reason: reasonOf(steps, registries, area, device) } : {}),
      ...fitting(spec, steps, roomOf(area, device, registries), registries),
    };
  }
  return traces;
}
