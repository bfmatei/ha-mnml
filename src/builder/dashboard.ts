import { lookOf, orderOf } from '../contract/builder.ts';
import type {
  CarChoice,
  GlancesChoice,
  PersonChoice,
  Plan,
  RoomChoice,
  SectionKey,
  SystemChoice,
} from '../contract/builder.ts';
import type { TemplateCard } from '../contract/cards.ts';
import { isMapping } from '../contract/templates.ts';
import type { SlotSpec, Templates, Value } from '../contract/templates.ts';
import { headingSlots } from '../home/slots.ts';
import type { Card, Dashboard, Section } from '../home/types.ts';
import { discover } from '../templates/discover.ts';
import type { Registries } from '../templates/discover.ts';

import { personOf } from './person.ts';

function declared(
  slots: Readonly<Record<string, Value>>,
  specs: Readonly<Record<string, SlotSpec>>,
): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(slots).flatMap(([name, value]): [string, Value][] => {
      const spec = Object.hasOwn(specs, name) ? specs[name] : undefined;
      return spec === undefined ? [] : [[name, within(value, spec)]];
    }),
  );
}

function within(value: Value, spec: SlotSpec): Value {
  const fields = spec.fields;
  if (fields === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => (isMapping(item) ? declared(item, fields) : item));
  }
  return isMapping(value) ? declared(value, fields) : value;
}

function card(
  name: string,
  templates: Templates,
  slots?: Record<string, Value>,
  area?: string,
): TemplateCard {
  const template = templates[name];
  const kept =
    slots === undefined || template === undefined ? slots : declared(slots, template.slots ?? {});
  return {
    type: 'custom:mnml-template-card',
    template: name,
    area,
    slots:
      area !== undefined && kept !== undefined && Object.keys(kept).length === 0 ? undefined : kept,
  };
}

export function roomCard(
  room: RoomChoice,
  template = 'room',
  templates: Templates = {},
): TemplateCard {
  return card(template, templates, room.slots, room.area);
}

export function personCard(
  person: PersonChoice,
  registries: Registries,
  template = 'person',
  templates: Templates = {},
): TemplateCard {
  return person.spelled === true
    ? card(template, templates, person.slots)
    : card(template, templates, { ...personOf(registries, person.entity), ...person.slots });
}

export function carCard(car: CarChoice, template = 'car', templates: Templates = {}): TemplateCard {
  const { key: _key, ...slots } = car.slots;
  return card(template, templates, { key: car.key, ...slots });
}

export function systemCard(
  choice: SystemChoice,
  registries: Registries,
  templates: Templates,
): TemplateCard {
  if (choice.spelled === true) {
    return card(choice.template, templates, choice.slots);
  }
  const template = templates[choice.template];
  return choice.slots === undefined || template === undefined
    ? card(choice.template, templates)
    : card(choice.template, templates, {
        ...discover(template, undefined, registries),
        ...choice.slots,
      });
}

function glancesCard(
  choice: GlancesChoice,
  registries: Registries,
  templates: Templates,
): TemplateCard {
  return systemCard({ template: 'glances', ...choice }, registries, templates);
}

function heading(plan: Plan, key: SectionKey, templates: Templates): TemplateCard {
  const { title, icon } = lookOf(plan, key);
  return card('section-heading', templates, headingSlots(title, icon));
}

function grid(cards: Card[]): Section {
  return { type: 'grid', column_span: 3, cards };
}

export function dashboardOf(plan: Plan, registries: Registries, templates: Templates): Dashboard {
  const rooms = lookOf(plan, 'rooms').template;
  const people = lookOf(plan, 'people').template;
  const cars = lookOf(plan, 'garage').template;
  const parts: Record<SectionKey, TemplateCard[]> = {
    rooms: plan.rooms
      .filter((room) => room.spelled === true || Object.hasOwn(registries.areas, room.area))
      .map((room) => roomCard(room, rooms, templates)),
    people: plan.people
      .filter(
        (person) => person.spelled === true || Object.hasOwn(registries.states, person.entity),
      )
      .map((person) => personCard(person, registries, people, templates)),
    garage: plan.cars.map((car) => carCard(car, cars, templates)),
    system: plan.system.map((choice) => systemCard(choice, registries, templates)),
  };
  return {
    title: plan.title,
    views: [
      {
        title: plan.title,
        path: 'home',
        icon: plan.icon,
        type: 'sections',
        max_columns: 3,
        sections: [
          ...(plan.glances === undefined
            ? []
            : [grid([glancesCard(plan.glances, registries, templates)])]),
          ...orderOf(plan)
            .filter((key) => parts[key].length > 0)
            .map((key) => grid([heading(plan, key, templates), ...parts[key]])),
          grid([
            {
              type: 'custom:mnml-popups-card',
              width: '560px',
              open: Object.keys(plan.open).length > 0 ? plan.open : undefined,
            },
          ]),
        ],
      },
    ],
  };
}
