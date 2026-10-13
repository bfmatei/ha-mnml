import { SECTION_LOOKS, SECTION_ORDER, lookOf } from '../contract/builder.ts';
import type { Plan, SectionKey, SectionLook, SystemChoice } from '../contract/builder.ts';
import type { MdiIcon } from '../contract/entities.ts';
import type { Value } from '../contract/templates.ts';

const ICON = /^mdi:[a-z0-9-]+$/;

export const isIcon = (value: string): value is MdiIcon => ICON.test(value);

export function movedBy<T>(list: readonly T[], from: number, by: number): T[] {
  const to = from + by;
  if (to < 0 || to >= list.length) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) {
    next.splice(to, 0, item);
  }
  return next;
}

export function templatesOf(plan: Plan): { rooms: string; people: string; cars: string } {
  return {
    rooms: lookOf(plan, 'rooms').template ?? 'room',
    people: lookOf(plan, 'people').template ?? 'person',
    cars: lookOf(plan, 'garage').template ?? 'car',
  };
}

export function withLook(
  plan: Plan,
  key: SectionKey,
  change: Partial<Record<keyof SectionLook, string>>,
): Plan['sections'] {
  const fallback = SECTION_LOOKS[key];
  const merged: Partial<Record<keyof SectionLook, string>> = { ...plan.sections?.[key], ...change };
  const title = merged.title;
  const icon = merged.icon === fallback.icon ? undefined : merged.icon;
  const template = merged.template === fallback.template ? undefined : merged.template;
  const look: SectionLook = {
    ...(title === undefined || title === '' ? {} : { title }),
    ...(icon === undefined || !isIcon(icon) ? {} : { icon }),
    ...(template === undefined || template === '' ? {} : { template }),
  };
  const others = Object.fromEntries(
    Object.entries(plan.sections ?? {}).filter(([section]) => section !== key),
  );
  const sections = Object.keys(look).length === 0 ? others : { ...others, [key]: look };
  return Object.keys(sections).length === 0 ? undefined : sections;
}

function kept(
  slots: Record<string, Value> | undefined,
  declared: ReadonlySet<string>,
): Record<string, Value> | undefined {
  if (slots === undefined) {
    return undefined;
  }
  const left = Object.fromEntries(Object.entries(slots).filter(([slot]) => declared.has(slot)));
  return Object.keys(left).length === 0 ? undefined : left;
}

export function withDeclared(plan: Plan, key: SectionKey, declared: ReadonlySet<string>): Plan {
  if (key === 'rooms') {
    return {
      ...plan,
      rooms: plan.rooms.map((room) => {
        const slots = kept(room.slots, declared);
        if (room.spelled === true) {
          return { slots: slots ?? {}, spelled: true };
        }
        return slots === undefined ? { area: room.area } : { area: room.area, slots };
      }),
    };
  }
  if (key === 'people') {
    return {
      ...plan,
      people: plan.people.map((person) => {
        const slots = kept(person.slots, declared);
        if (person.spelled === true) {
          return { entity: person.entity, slots: slots ?? {}, spelled: true };
        }
        return slots === undefined ? { entity: person.entity } : { entity: person.entity, slots };
      }),
    };
  }
  if (key === 'garage') {
    return {
      ...plan,
      cars: plan.cars.map((car) => ({ key: car.key, slots: kept(car.slots, declared) ?? {} })),
    };
  }
  return plan;
}

export function trimmed(sections: Plan['sections']): Plan['sections'] {
  if (sections === undefined) {
    return undefined;
  }
  const looks = Object.fromEntries(
    Object.entries(sections).flatMap(([key, look]) => {
      const title = look.title?.trim();
      const { title: _title, ...rest } = look;
      const next: SectionLook = {
        ...rest,
        ...(title === undefined || title === '' ? {} : { title }),
      };
      return Object.keys(next).length === 0 ? [] : [[key, next]];
    }),
  );
  return Object.keys(looks).length === 0 ? undefined : looks;
}

export function withSystem(chosen: readonly SystemChoice[], choice: SystemChoice): SystemChoice[] {
  return chosen.some((each) => each.template === choice.template)
    ? chosen.map((each) => (each.template === choice.template ? choice : each))
    : [...chosen, choice];
}

export function withOrder(plan: Plan, order: readonly SectionKey[]): Plan {
  const { order: _order, ...rest } = plan;
  return order.every((key, index) => SECTION_ORDER[index] === key)
    ? rest
    : { ...rest, order: [...order] };
}

export function withGlances(plan: Plan, shown: boolean): Plan {
  const { glances, ...rest } = plan;
  return shown ? { ...rest, glances: glances ?? {} } : rest;
}
