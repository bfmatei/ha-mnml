import type { SlotSpec, Template, Value } from '../contract/templates.ts';

import { areaOf, describe, deviceName, discoverSlot, fromDevice, matches } from './discover.ts';
import type { Registries, Step } from './discover.ts';

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

function reasonOf(steps: Step[], registries: Registries): string | undefined {
  const first = steps.find((step) => step.filter !== undefined);
  if (first?.filter === undefined) {
    const named = steps[0];
    return named?.area === null || named?.area === undefined
      ? 'needs an area: without one only whole-home rules run'
      : 'the area has none';
  }
  if (first.devices !== undefined && first.devices.length > 0) {
    const names = first.devices.map((id) => deviceName(id, registries));
    return `found ${names.join(', ')}, without every field the slot needs`;
  }
  const { filter } = first;
  const everywhere = first.everywhere;
  if (!everywhere && (first.area === null || first.area === undefined)) {
    return 'needs an area: without one only whole-home rules run';
  }
  const where = everywhere
    ? 'the home'
    : (registries.areas[first.area ?? '']?.name ?? String(first.area));
  const parts = [`no ${first.devices === undefined ? describe(filter) : first.rule} in ${where}`];
  const near = steps.flatMap((step) => step.near).slice(0, ELSEWHERE);
  if (near.length > 0) {
    parts.push(
      `almost: ${near.map((miss) => `${miss.entity_id} ${miss.why.join(' and ')}`).join('; ')}`,
    );
  }
  if (!everywhere) {
    const elsewhere = Object.values(registries.entities)
      .filter((entry) => entry.hidden !== true && matches(entry, filter, registries))
      .filter((entry) => areaOf(entry, registries) !== first.area)
      .toSorted((a, b) => a.entity_id.localeCompare(b.entity_id))
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

function fitOf(id: string, registries: Registries): DeviceFit {
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
    .map((id) => fitOf(id, registries));
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
): Record<string, Trace> {
  const traces: Record<string, Trace> = {};
  for (const [slot, spec] of Object.entries(template.slots ?? {})) {
    if (spec.discover === undefined) {
      continue;
    }
    const steps: Step[] = [];
    const value = discoverSlot(slot, spec, area, registries, { step: (step) => steps.push(step) });
    traces[slot] = {
      value,
      steps,
      ...(value === undefined ? { reason: reasonOf(steps, registries) } : {}),
      ...fitting(spec, steps, area, registries),
    };
  }
  return traces;
}
