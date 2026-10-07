import { SYSTEM_TEMPLATES, isPersonId } from '../contract/builder.ts';
import type { Plan } from '../contract/builder.ts';
import type { PersonId } from '../contract/entities.ts';
import type { Instance, Templates, Value } from '../contract/templates.ts';
import { discover } from '../templates/discover.ts';
import type { Registries } from '../templates/discover.ts';
import { expand } from '../templates/expand.ts';

const NAMING = new Set(['key', 'name', 'icon']);

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
  return (
    template !== undefined &&
    draws(templates, { template: name }, discover(template, undefined, registries))
  );
}

export function peopleIn(registries: Registries): PersonId[] {
  return [
    ...new Set([...Object.keys(registries.entities), ...Object.keys(registries.states)]),
  ].filter(isPersonId);
}

export function defaultPlan(registries: Registries, templates: Templates): Plan {
  const people = peopleIn(registries);
  return {
    title: 'Home',
    icon: 'mdi:home-variant',
    rooms: Object.values(registries.areas)
      .filter((area) => roomShows(registries, templates, area.area_id))
      .map((area) => ({ area: area.area_id })),
    people: people.map((entity) => ({ entity })),
    cars: [],
    system: SYSTEM_TEMPLATES.filter((name) => systemFills(registries, templates, name)).map(
      (template) => ({ template }),
    ),
    open: { tablet: 'unfold', desktop: 'unfold' },
  };
}
