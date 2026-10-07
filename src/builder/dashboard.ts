import type { Plan } from '../contract/builder.ts';
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
  const system = plan.system.map(({ template, slots }) => {
    const found = templates[template];
    return slots === undefined || found === undefined
      ? card(template)
      : card(template, { ...discover(found, undefined, registries), ...slots });
  });
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
            plan.rooms.map((room) => card('room', room.slots, room.area)),
          ),
          ...section(
            'People',
            'mdi:account-group',
            plan.people.map((person) =>
              card('person', { ...personOf(registries, person.entity), ...person.slots }),
            ),
          ),
          ...section(
            'Garage',
            'mdi:garage',
            plan.cars.map((car) => card('car', { ...car.slots, key: car.key })),
          ),
          ...section('System', 'mdi:server-network', system),
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
