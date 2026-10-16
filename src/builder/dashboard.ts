import type { TemplateCard, TileCard } from '../contract/cards.ts';
import type { Card, Dashboard, Section } from '../contract/dashboard.ts';
import { lookOf, orderOf } from '../contract/plan.ts';
import type {
  CarChoice,
  DeviceChoice,
  GlancesChoice,
  PersonChoice,
  Plan,
  PlanSection,
  RoomChoice,
  SystemChoice,
} from '../contract/plan.ts';
import { isMapping } from '../contract/templates.ts';
import type { SlotSpec, Templates, Value } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';
import { discover } from '../templates/discover.ts';

import { personOf } from './person.ts';

function headingSlots(title: string, icon: string): Record<string, Value> {
  return { title, icon };
}

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

export function deviceCard(choice: DeviceChoice): TemplateCard {
  return { type: 'custom:mnml-template-card', template: choice.template, device: choice.device };
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

function heading(plan: Plan, key: PlanSection, templates: Templates): TemplateCard {
  const { title, icon } = lookOf(plan, key);
  return card('section-heading', templates, headingSlots(title, icon));
}

function grid(cards: Card[], span = 3): Section {
  return { type: 'grid', column_span: span, cards };
}

const HALF = 6;

function fillsHalf(cards: readonly Card[]): boolean {
  return cards.reduce((sum, each) => sum + (each.grid_options?.columns ?? 12), 0) === HALF;
}

function sideBySide(
  keys: readonly PlanSection[],
  drawn: (key: PlanSection) => Card[],
  titled: (key: PlanSection) => TemplateCard,
): Card[] {
  const [first, second] = keys;
  if (first === undefined) {
    return [];
  }
  if (second !== undefined && fillsHalf(drawn(first)) && fillsHalf(drawn(second))) {
    return [
      { ...titled(first), grid_options: { columns: HALF } },
      { ...titled(second), grid_options: { columns: HALF } },
      ...drawn(first),
      ...drawn(second),
      ...sideBySide(keys.slice(2), drawn, titled),
    ];
  }
  return [titled(first), ...drawn(first), ...sideBySide(keys.slice(1), drawn, titled)];
}

interface Square {
  square: NonNullable<TileCard['square']>;
  columns: number;
}

const SQUARES: Readonly<Record<PlanSection, Square>> = {
  rooms: { square: 'large', columns: 6 },
  devices: { square: 'small', columns: 3 },
  people: { square: 'small', columns: 3 },
  garage: { square: 'small', columns: 3 },
  system: { square: 'small', columns: 3 },
};

function squared(
  card: TemplateCard,
  { square, columns }: Square,
  registries: Registries,
  templates: Templates,
): Card {
  const template = templates[card.template];
  if (template === undefined || !Object.hasOwn(template.slots ?? {}, 'square')) {
    return card;
  }
  const live = card.slots === undefined && card.area === undefined && card.device === undefined;
  const found = live ? discover(template, undefined, registries) : {};
  return { ...card, slots: { ...found, ...card.slots, square }, grid_options: { columns } };
}

export function dashboardOf(plan: Plan, registries: Registries, templates: Templates): Dashboard {
  const rooms = lookOf(plan, 'rooms').template;
  const people = lookOf(plan, 'people').template;
  const cars = lookOf(plan, 'garage').template;
  const parts: Record<PlanSection, TemplateCard[]> = {
    rooms: plan.rooms
      .filter((room) => room.spelled === true || Object.hasOwn(registries.areas, room.area))
      .map((room) => roomCard(room, rooms, templates)),
    devices: (plan.devices ?? [])
      .filter((choice) => Object.hasOwn(registries.devices, choice.device))
      .map((choice) => deviceCard(choice)),
    people: plan.people
      .filter(
        (person) => person.spelled === true || Object.hasOwn(registries.states, person.entity),
      )
      .map((person) => personCard(person, registries, people, templates)),
    garage: plan.cars.map((car) => carCard(car, cars, templates)),
    system: plan.system.map((choice) => systemCard(choice, registries, templates)),
  };
  const keys = orderOf(plan).filter((key) => parts[key].length > 0);
  const titled = (key: PlanSection): TemplateCard => heading(plan, key, templates);
  const squares = plan.squares === true;
  const drawn = (key: PlanSection): Card[] =>
    squares
      ? parts[key].map((each) => squared(each, SQUARES[key], registries, templates))
      : parts[key];
  const across = squares ? 4 : 3;
  const side = keys.filter((key) => key !== 'rooms');
  return {
    title: plan.title,
    views: [
      {
        title: plan.title,
        path: 'home',
        icon: plan.icon,
        type: 'sections',
        max_columns: across,
        sections: [
          ...(plan.glances === undefined
            ? []
            : [grid([glancesCard(plan.glances, registries, templates)], across)]),
          ...(squares
            ? [
                ...(keys.includes('rooms') ? [grid([titled('rooms'), ...drawn('rooms')], 3)] : []),
                ...(side.length > 0 ? [grid(sideBySide(side, drawn, titled), 1)] : []),
              ]
            : keys.map((key) => grid([titled(key), ...drawn(key)]))),
          grid(
            [
              {
                type: 'custom:mnml-popups-card',
                width: '560px',
                open: Object.keys(plan.open).length > 0 ? plan.open : undefined,
                idle_close: plan.idle_close,
                alerts:
                  plan.alerts !== undefined && plan.alerts.length > 0 ? plan.alerts : undefined,
              },
            ],
            across,
          ),
        ],
      },
    ],
  };
}
