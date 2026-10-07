import { SECTION_LOOKS, SYSTEM_TEMPLATES, isPersonId } from '../contract/builder.ts';
import type { Plan, Recipe, SectionKey, SectionLook } from '../contract/builder.ts';
import type { PersonId } from '../contract/entities.ts';
import type { Instance, Templates, Value } from '../contract/templates.ts';
import { discover } from '../templates/discover.ts';
import type { Registries } from '../templates/discover.ts';
import { expand, filled } from '../templates/expand.ts';

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
  if (template === undefined) {
    return false;
  }
  const found = discover(template, undefined, registries);
  return (
    Object.values(found).some((value) => filled(value)) &&
    draws(templates, { template: name }, found)
  );
}

export function peopleIn(registries: Registries): PersonId[] {
  return [
    ...new Set([...Object.keys(registries.entities), ...Object.keys(registries.states)]),
  ].filter(isPersonId);
}

export const DEFAULT_RECIPE: Recipe = {
  title: 'Home',
  icon: 'mdi:home-variant',
  open: { tablet: 'unfold', desktop: 'unfold' },
  sections: { rooms: {}, people: {}, system: {} },
  templates: {},
};

const KEYS: readonly SectionKey[] = ['rooms', 'people', 'garage', 'system'];

function lookIn(recipe: Recipe, key: SectionKey): SectionLook {
  const given = recipe.sections[key];
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

export function planFrom(recipe: Recipe, registries: Registries, templates: Templates): Plan {
  const looks = Object.fromEntries(
    KEYS.flatMap((key) => {
      const look = lookIn(recipe, key);
      return Object.keys(look).length === 0 ? [] : [[key, look]];
    }),
  );
  const { rooms, people, system } = recipe.sections;
  const roomTemplate = rooms?.template ?? 'room';
  return {
    title: recipe.title,
    icon: recipe.icon,
    rooms:
      rooms === undefined
        ? []
        : Object.values(registries.areas)
            .filter((area) => roomShows(registries, templates, area.area_id, roomTemplate))
            .map((area) => ({ area: area.area_id })),
    people: people === undefined ? [] : peopleIn(registries).map((entity) => ({ entity })),
    cars: [],
    system:
      system === undefined
        ? []
        : (system.templates ?? SYSTEM_TEMPLATES)
            .filter((name) => systemFills(registries, templates, name))
            .map((template) => ({ template })),
    open: { ...recipe.open },
    ...(Object.keys(looks).length === 0 ? {} : { sections: looks }),
    ...(recipe.order === undefined ? {} : { order: [...recipe.order] }),
  };
}

export function defaultPlan(registries: Registries, templates: Templates): Plan {
  return planFrom(DEFAULT_RECIPE, registries, templates);
}
