import type { CarChoice, Plan, SystemChoice } from '../contract/builder.ts';
import type { Value } from '../contract/templates.ts';

import { glancesSlots, proxmoxSlots, roomSlots, snake, systemSlots } from './slots.ts';
import type { Car, Home } from './types.ts';

function spelled(template: string, slots: Record<string, Value>): SystemChoice {
  return { template, slots, spelled: true };
}

export function systemChoices(home: Home): SystemChoice[] {
  const { proxmox, network, tailscale, adguard, media } = home.system;
  return [
    ...(proxmox ? [spelled('proxmox-server', proxmoxSlots(proxmox))] : []),
    ...(network ? [spelled('unifi-network', snake(network))] : []),
    ...(tailscale ? [spelled('tailscale', snake(tailscale))] : []),
    ...(adguard ? [spelled('adguard', snake(adguard))] : []),
    spelled('home-assistant', systemSlots(home.system, home.rooms)),
    ...(media ? [spelled('media-server', snake(media))] : []),
  ];
}

function carChoice(car: Car): CarChoice {
  const { key: _key, ...slots } = snake(car);
  return { key: car.key, slots };
}

export function homePlan(home: Home): Plan {
  const { order, sections } = home;
  return {
    title: home.title,
    icon: 'mdi:home-variant',
    glances: { slots: glancesSlots(home), spelled: true },
    rooms: home.rooms.map((room) => ({ slots: roomSlots(room), spelled: true })),
    people: home.people.map((person) => ({
      entity: person.entity,
      slots: snake(person),
      spelled: true,
    })),
    cars: home.cars.map(carChoice),
    system: systemChoices(home),
    open: { ...home.popupOpen },
    sections: {
      rooms: { title: sections.rooms },
      people: { title: sections.people },
      garage: { title: sections.garage },
      system: { title: sections.system },
    },
    ...(order === undefined ? {} : { order: [...order] }),
  };
}
