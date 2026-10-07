import type { TemplateCard } from '../contract/cards.ts';
import type { Value } from '../contract/templates.ts';
import { expandDashboard } from '../templates/dashboard.ts';
import { toValue } from '../templates/expand.ts';
import { SHIPPED } from '../templates/shipped.ts';

import { headingSlots, personSlots, proxmoxSlots, roomSlots, snake, systemSlots } from './slots.ts';
import type { Card, Dashboard, Home } from './types.ts';

function instance(template: string, slots: Record<string, Value>): TemplateCard {
  return { type: 'custom:mnml-template-card', template, slots };
}

export function build(home: Home): Dashboard {
  const rooms: Card[] = [
    instance(
      'section-heading',
      headingSlots(home.sections.rooms, 'mdi:floor-plan', {
        state:
          home.outside === undefined
            ? undefined
            : [{ entity: home.outside, attribute: 'temperature', icon: true }],
      }),
    ),
    ...home.rooms.map((room) => instance('room', roomSlots(room))),
  ];

  const people: Card[] = [
    instance(
      'section-heading',
      headingSlots(home.sections.people, 'mdi:account-group', {
        controls:
          home.vacation === undefined
            ? undefined
            : [{ type: 'toggle', entity: home.vacation, color: 'amber' }],
      }),
    ),
    ...home.people.map((person) => instance('person', personSlots(person))),
  ];

  const garage: Card[] = [
    instance('section-heading', headingSlots(home.sections.garage, 'mdi:garage')),
    ...home.cars.map((car) => instance('car', snake(car))),
  ];

  const { proxmox, adguard, network, media } = home.system;
  const infrastructure: Card[] = [
    instance('section-heading', headingSlots(home.sections.infrastructure, 'mdi:server-network')),
    ...(proxmox ? [instance('proxmox-server', proxmoxSlots(proxmox))] : []),
    ...(network ? [instance('unifi-network', snake(network))] : []),
    ...(adguard ? [instance('adguard', snake(adguard))] : []),
    instance('home-assistant', systemSlots(home.system, home.rooms)),
    ...(media ? [instance('media-server', snake(media))] : []),
  ];

  return {
    title: home.title,
    views: [
      {
        title: home.title,
        path: 'home',
        icon: 'mdi:home-variant',
        type: 'sections',
        max_columns: 3,
        sections: [
          { type: 'grid', column_span: 3, cards: rooms },
          { type: 'grid', column_span: 3, cards: people },
          { type: 'grid', column_span: 3, cards: garage },
          { type: 'grid', column_span: 3, cards: infrastructure },
          {
            type: 'grid',
            column_span: 3,
            cards: [{ type: 'custom:mnml-popups-card', width: '560px', open: home.popupOpen }],
          },
        ],
      },
    ],
  };
}

export function drawn(home: Home): Value {
  return expandDashboard(SHIPPED, toValue(build(home)));
}
