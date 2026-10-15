import { isMapping } from '../contract/templates.ts';
import type { Template, Value } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';

function slotOf(part: Value, template: Template): string[] {
  if (!isMapping(part) || part['each'] !== undefined) {
    return [];
  }
  const when = part['if'];
  if (typeof when !== 'string') {
    return [];
  }
  const [slot = ''] = when.split('.');
  const spec = template.slots?.[slot];
  return spec === undefined || spec.required === true ? [] : [slot];
}

export function partsOf(template: Template): string[] {
  const card = isMapping(template.card) ? template.card : {};
  const slots = Object.values(card).flatMap((value) =>
    Array.isArray(value)
      ? value.flatMap((part) => slotOf(part, template))
      : slotOf(value, template),
  );
  return [...new Set(slots)];
}

const domainOf = (entity: string): string => entity.split('.', 1)[0] ?? '';

export function swapsFor(registries: Registries, current: string, area?: string): string[] {
  const classOf = (entity: string): unknown =>
    registries.states[entity]?.attributes?.['device_class'];
  const device = registries.entities[current]?.device_id ?? undefined;
  const areaOf = (entity: string): string | undefined => {
    const entry = registries.entities[entity];
    const own = entry?.area_id ?? undefined;
    const held = entry?.device_id ?? undefined;
    return (
      own ?? (held === undefined ? undefined : (registries.devices[held]?.area_id ?? undefined))
    );
  };
  const rank = (entity: string): number => {
    if (device !== undefined && registries.entities[entity]?.device_id === device) {
      return 0;
    }
    return area !== undefined && areaOf(entity) === area ? 1 : 2;
  };
  const kind = classOf(current);
  return Object.keys(registries.states)
    .filter(
      (entity) =>
        entity !== current && domainOf(entity) === domainOf(current) && classOf(entity) === kind,
    )
    .toSorted((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
