import type { Control, StateItem } from '../contract/cards.ts';
import type { Value } from '../contract/templates.ts';
import { toValue } from '../templates/expand.ts';

import type { Ac, Heating, Lights, Person, Proxmox, Room, System } from './types.ts';

export function headingSlots(
  title: string,
  icon: string,
  options: { state?: StateItem[]; controls?: Control[] } = {},
): Record<string, Value> {
  return {
    title,
    icon,
    state: toValue(options.state ?? null),
    controls: toValue(options.controls ?? null),
  };
}

function record(input: Record<string, unknown>): Record<string, Value> {
  const value = toValue(input);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('slots are a mapping');
  }
  return value;
}

function lightsSlots(lights: Lights): Record<string, Value> {
  return record({
    group: lights.group,
    color: lights.color,
    members: (lights.members ?? []).map((member) =>
      typeof member === 'string'
        ? { entity: member }
        : { entity: member.group, members: member.members },
    ),
    scenes: lights.scenes,
    active_scene: lights.activeScene,
  });
}

function heatingSlots(heating: Heating): Record<string, Value> {
  return record({
    entity: heating.entity,
    preset: heating.preset,
    thermostats: heating.thermostats.map(({ valve, battery }) => ({ valve, battery })),
    batteries: heating.thermostats.map(({ battery }) => battery),
  });
}

function acSlots(ac: Ac): Record<string, Value> {
  return record({
    entity: ac.entity,
    fan: ac.fan,
    swing: ac.swing,
    horizontal_swing: ac.horizontalSwing,
    power_saving: ac.powerSaving,
    dehumidifier: ac.dehumidifier,
    energy: ac.energy,
  });
}

function snakeKey(key: string): string {
  return key.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(snakeCase);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [snakeKey(key), snakeCase(item)]),
    );
  }
  return value;
}

export function snake(subject: object): Record<string, Value> {
  const value = toValue(snakeCase(subject));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('a subject is a mapping');
  }
  return value;
}

export function roomSlots(room: Room): Record<string, Value> {
  const members = room.media ?? [];
  return record({
    key: room.key,
    name: room.name,
    icon: room.icon,
    temperature: room.temperature,
    humidity: room.humidity,
    window: room.window,
    door: room.door,
    lock: room.lock,
    lights: lightsSlots(room.lights),
    heating: room.heating && heatingSlots(room.heating),
    ac: room.ac && acSlots(room.ac),
    vacuum: room.vacuum && snake(room.vacuum),
    printer3d: room.printer3d && snake(room.printer3d),
    media: members.map((member) =>
      typeof member === 'string' ? { entity: member } : { entity: member.entity, key: member.key },
    ),
    speakers: members.flatMap((member) => (typeof member === 'string' ? [] : [snake(member)])),
    outlets: (room.outlets ?? []).map((outlet) => snake(outlet)),
    diffuser: room.diffuser && snake(room.diffuser),
    batteries: [
      ...(room.batteries ?? []),
      ...(room.heating?.thermostats ?? []).map((thermostat) => thermostat.battery),
    ].toSorted(),
    leaks: room.leaks,
    meters: [
      ...(room.outlets ?? []).flatMap((outlet) =>
        outlet.energy === undefined ? [] : [outlet.energy],
      ),
      ...(room.ac?.energy === undefined ? [] : [room.ac.energy]),
    ],
  });
}

export function personSlots(person: Person): Record<string, Value> {
  return {
    ...snake(person),
    activities: person.devices.map((device) => device.activity),
    focuses: person.devices.map((device) => device.focus),
    batteries: person.devices.map((device) => device.battery),
  };
}

export function proxmoxSlots(proxmox: Proxmox): Record<string, Value> {
  return {
    ...snake(proxmox),
    ...record({
      guest_statuses: proxmox.guests.map((guest) => guest.status),
      guest_disks: proxmox.guests.flatMap((guest) =>
        guest.disk === undefined ? [] : [guest.disk],
      ),
      message_sources: [
        ...(proxmox.notifications?.sources ?? []),
        ...proxmox.guests.flatMap(({ host, status }) =>
          host === undefined ? [] : [{ source: host, entity: status }],
        ),
      ],
    }),
  };
}

export function systemSlots(system: System, rooms: readonly Room[]): Record<string, Value> {
  return record({
    cpu: system.cpu,
    memory: system.memory,
    disk_free: system.diskFree,
    disk_used: system.diskUsed,
    services: system.services,
    updates: system.updates,
    firmware: system.firmware,
    all_firmware: [...system.firmware, ...rooms.flatMap((room) => room.firmware ?? [])],
    room_firmware: rooms.flatMap((room) =>
      room.firmware === undefined ? [] : [{ name: room.name, firmware: room.firmware }],
    ),
  });
}
