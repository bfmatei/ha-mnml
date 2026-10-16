import { isIcon } from '../contract/entities.ts';
import { PLAN_ORDER, SECTION_LOOKS, lookOf } from '../contract/plan.ts';
import type {
  CarChoice,
  DeviceChoice,
  PersonChoice,
  Plan,
  PlanSection,
  RoomChoice,
  SectionLook,
  SystemChoice,
} from '../contract/plan.ts';
import { sameValue, templateTitle } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';
import { deviceName } from '../templates/entity-index.ts';

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

export function sectionsWithLook(
  plan: Plan,
  key: PlanSection,
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

export function withDeclared(plan: Plan, key: PlanSection, declared: ReadonlySet<string>): Plan {
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

export function withOrder(plan: Plan, order: readonly PlanSection[]): Plan {
  const { order: _order, ...rest } = plan;
  return order.every((key, index) => PLAN_ORDER[index] === key)
    ? rest
    : { ...rest, order: [...order] };
}

export function withDevice(plan: Plan, choice: DeviceChoice, listed: readonly string[]): Plan {
  const chosen = plan.devices ?? [];
  if (chosen.some((each) => each.device === choice.device)) {
    return {
      ...plan,
      devices: chosen.map((each) => (each.device === choice.device ? choice : each)),
    };
  }
  const at = listed.indexOf(choice.device);
  const before = at === -1 ? -1 : chosen.findIndex((each) => listed.indexOf(each.device) > at);
  return {
    ...plan,
    devices:
      before === -1
        ? [...chosen, choice]
        : [...chosen.slice(0, before), choice, ...chosen.slice(before)],
  };
}

export function withoutDevice(plan: Plan, device: string): Plan {
  const { devices, ...rest } = plan;
  const left = (devices ?? []).filter((each) => each.device !== device);
  return left.length === 0 ? rest : { ...rest, devices: left };
}

export function withGlances(plan: Plan, shown: boolean): Plan {
  const { glances, ...rest } = plan;
  return shown ? { ...rest, glances: glances ?? {} } : rest;
}

export function slotsWith(
  slots: Readonly<Record<string, Value>> | undefined,
  slot: string,
  value: Value | undefined,
): Record<string, Value> | undefined {
  const { [slot]: _was, ...rest } = slots ?? {};
  const next = value === undefined ? rest : { ...rest, [slot]: value };
  return Object.keys(next).length === 0 ? undefined : next;
}

export function tidied(plan: Plan): Plan {
  const sections = trimmed(plan.sections);
  const { sections: _looks, ...rest } = plan;
  return { ...rest, title: plan.title.trim(), ...(sections === undefined ? {} : { sections }) };
}

const FIELDS = [
  'title',
  'icon',
  'glances',
  'open',
  'squares',
  'sections',
  'order',
] as const satisfies readonly (keyof Plan)[];

type PlanField = (typeof FIELDS)[number];

export type PlanChange =
  | { field: PlanField; section?: never; name?: never; how?: never }
  | { field?: never; section: PlanSection; name: string; how: 'added' | 'removed' | 'changed' }
  | { field?: never; section: PlanSection; name?: never; how: 'moved' };

export interface RowNames {
  readonly rooms: (room: RoomChoice) => string;
  readonly devices: (choice: DeviceChoice) => string;
  readonly people: (person: PersonChoice) => string;
  readonly garage: (car: CarChoice) => string;
  readonly system: (choice: SystemChoice) => string;
}

export function roomName(room: RoomChoice, registries: Registries, unnamed: string): string {
  if (room.spelled === true) {
    const name = room.slots['name'];
    return typeof name === 'string' ? name : unnamed;
  }
  return registries.areas[room.area]?.name ?? room.area;
}

export function rowNames(registries: Registries, templates: Templates, unnamed: string): RowNames {
  return {
    rooms: (room) => roomName(room, registries, unnamed),
    devices: ({ device }) => deviceName(device, registries),
    people: ({ entity }) => {
      const name = registries.states[entity]?.attributes['friendly_name'];
      return typeof name === 'string' ? name : entity;
    },
    garage: ({ key }) => key,
    system: ({ template }) => templateTitle(templates[template], template),
  };
}

function rowChanges<T>(
  section: PlanSection,
  before: readonly T[],
  after: readonly T[],
  id: (row: T) => string,
  name: ((row: T) => string) | undefined,
): PlanChange[] {
  const was = new Map(before.map((row) => [id(row), row]));
  const now = new Map(after.map((row) => [id(row), row]));
  const kept = [...now.keys()].filter((key) => was.has(key));
  const moved = !sameValue(
    kept,
    [...was.keys()].filter((key) => now.has(key)),
  );
  const changed = [...new Set([...was.keys(), ...now.keys()])].flatMap((key): PlanChange[] => {
    const old = was.get(key);
    const fresh = now.get(key);
    const row = fresh ?? old;
    if (sameValue(old, fresh) || row === undefined) {
      return [];
    }
    const how = old === undefined ? 'added' : fresh === undefined ? 'removed' : 'changed';
    return [{ section, name: name === undefined ? key : name(row), how }];
  });
  return moved ? [...changed, { section, how: 'moved' }] : changed;
}

const roomId = (room: RoomChoice): string =>
  room.spelled === true ? `spelled:${JSON.stringify(room.slots['name'] ?? null)}` : room.area;
const deviceId = (choice: DeviceChoice): string => choice.device;
const personId = (person: PersonChoice): string => person.entity;
const carId = (car: CarChoice): string => car.key;
const systemId = (choice: SystemChoice): string => choice.template;

export function changesIn(built: Plan, draft: Plan, names?: RowNames): PlanChange[] {
  const before = tidied(built);
  const after = tidied(draft);
  return [
    ...FIELDS.filter((field) => !sameValue(before[field], after[field])).map(
      (field): PlanChange => ({ field }),
    ),
    ...rowChanges('rooms', before.rooms, after.rooms, roomId, names?.rooms),
    ...rowChanges('devices', before.devices ?? [], after.devices ?? [], deviceId, names?.devices),
    ...rowChanges('people', before.people, after.people, personId, names?.people),
    ...rowChanges('garage', before.cars, after.cars, carId, names?.garage),
    ...rowChanges('system', before.system, after.system, systemId, names?.system),
  ];
}

export function planChanges(built: Plan, draft: Plan): number {
  return changesIn(built, draft).length;
}
