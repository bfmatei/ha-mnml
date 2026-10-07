import type {
  CarChoice,
  PersonChoice,
  Plan,
  RoomChoice,
  SystemChoice,
} from '../contract/builder.ts';
import type { TemplateCard } from '../contract/cards.ts';
import type { Templates, Value } from '../contract/templates.ts';
import { headingSlots } from '../home/slots.ts';
import type { Dashboard, Section } from '../home/types.ts';
import { discover } from '../templates/discover.ts';
import type { Registries } from '../templates/discover.ts';

import { personOf } from './person.ts';

function card(template: string, slots?: Record<string, Value>, area?: string): TemplateCard {
  return { type: 'custom:mnml-template-card', template, area, slots };
}

export function roomCard(room: RoomChoice): TemplateCard {
  return card('room', room.slots, room.area);
}

export function personCard(person: PersonChoice, registries: Registries): TemplateCard {
  return card('person', { ...personOf(registries, person.entity), ...person.slots });
}

export function carCard(car: CarChoice): TemplateCard {
  return card('car', { ...car.slots, key: car.key });
}

export function systemCard(
  choice: SystemChoice,
  registries: Registries,
  templates: Templates,
): TemplateCard {
  const template = templates[choice.template];
  return choice.slots === undefined || template === undefined
    ? card(choice.template)
    : card(choice.template, { ...discover(template, undefined, registries), ...choice.slots });
}

function section(title: string, icon: string, cards: TemplateCard[]): Section[] {
  return cards.length === 0
    ? []
    : [
        {
          type: 'grid',
          column_span: 3,
          cards: [card('section-heading', headingSlots(title, icon)), ...cards],
        },
      ];
}

export function dashboardOf(plan: Plan, registries: Registries, templates: Templates): Dashboard {
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
          ...section(
            'Rooms',
            'mdi:floor-plan',
            plan.rooms.filter((room) => Object.hasOwn(registries.areas, room.area)).map(roomCard),
          ),
          ...section(
            'People',
            'mdi:account-group',
            plan.people
              .filter((person) => Object.hasOwn(registries.states, person.entity))
              .map((person) => personCard(person, registries)),
          ),
          ...section('Garage', 'mdi:garage', plan.cars.map(carCard)),
          ...section(
            'System',
            'mdi:server-network',
            plan.system.map((choice) => systemCard(choice, registries, templates)),
          ),
          {
            type: 'grid',
            column_span: 3,
            cards: [
              {
                type: 'custom:mnml-popups-card',
                width: '560px',
                open: Object.keys(plan.open).length > 0 ? plan.open : undefined,
              },
            ],
          },
        ],
      },
    ],
  };
}
