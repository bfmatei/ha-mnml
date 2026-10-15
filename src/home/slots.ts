import type { MdiIcon, SensorId } from '../contract/entities.ts';
import type { Value } from '../contract/templates.ts';
import { toValue } from '../templates/expand.ts';

import type { Ac, Home, Lights, Meter, Proxmox, Room, System } from './types.ts';

const PERSON_ICON: MdiIcon = 'mdi:account';

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
    heating: room.heating && snake(room.heating),
    ac: room.ac && acSlots(room.ac),
    vacuum: room.vacuum && snake(room.vacuum),
    printer3d: room.printer3d && snake(room.printer3d),
    cameras: (room.cameras ?? []).map((camera) => snake(camera)),
    covers: (room.covers ?? []).map((cover) => snake(cover)),
    fans: (room.fans ?? []).map((fan) => snake(fan)),
    humidifiers: (room.humidifiers ?? []).map((humidifier) => snake(humidifier)),
    appliances: (room.appliances ?? []).map((appliance) => snake(appliance)),
    pets: (room.pets ?? []).map((pet) => snake(pet)),
    plants: (room.plants ?? []).map((plant) => snake(plant)),
    media: members.map((member) =>
      typeof member === 'string' ? { entity: member } : { entity: member.entity, key: member.key },
    ),
    speakers: members.flatMap((member) => (typeof member === 'string' ? [] : [snake(member)])),
    outlets: (room.outlets ?? []).map((outlet) => snake(outlet)),
    diffuser: room.diffuser && snake(room.diffuser),
    timers: room.timers,
    schedules: room.schedules,
    batteries: batteriesOf(room),
    leaks: room.leaks,
  });
}

function batteriesOf(room: Room): SensorId[] {
  return [
    ...(room.batteries ?? []),
    ...(room.heating?.thermostats ?? []).map((thermostat) => thermostat.battery),
  ].toSorted();
}

function batteryGroups(home: Home): Record<string, unknown>[] {
  return [
    ...home.rooms.flatMap((room) => {
      const batteries = batteriesOf(room);
      return batteries.length === 0 ? [] : [{ name: room.name, icon: room.icon, batteries }];
    }),
    ...home.people.map((person) => ({
      entity: person.entity,
      icon: PERSON_ICON,
      batteries: person.devices.map((device) => device.battery),
    })),
  ];
}

function metersOf(home: Home): Meter[] {
  return [
    ...home.rooms.flatMap((room) => [
      ...(room.outlets ?? []).map((outlet) => outlet.energy),
      room.ac?.energy,
      room.printer3d?.outlet?.energy,
    ]),
    home.system.proxmox?.outlet.energy,
  ].flatMap((meter) => meter ?? []);
}

export function proxmoxSlots(proxmox: Proxmox): Record<string, Value> {
  return {
    ...snake(proxmox),
    ...record({
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
    backups: system.backups,
    all_firmware: [...system.firmware, ...rooms.flatMap((room) => room.firmware ?? [])],
    room_firmware: rooms.flatMap((room) =>
      room.firmware === undefined ? [] : [{ name: room.name, firmware: room.firmware }],
    ),
  });
}

export function glancesSlots(home: Home): Record<string, Value> {
  const checks = home.system.proxmox?.checks;
  return record({
    weather: home.outside,
    alarm: home.security?.alarm,
    vacation: home.vacation,
    energy: home.energy && snake(home.energy),
    meters: metersOf(home),
    timers: home.rooms.flatMap((room) =>
      (room.timers ?? []).map((entity) => ({ entity, room: room.key })),
    ),
    people: home.people.map((person) => person.entity),
    checks: checks && snake(checks),
    batteries: [
      ...home.rooms.flatMap((room) => batteriesOf(room)),
      ...home.people.flatMap((person) => person.devices.map((device) => device.battery)),
    ].toSorted(),
    battery_groups: batteryGroups(home),
    room_leaks: home.rooms.flatMap((room) =>
      room.leaks === undefined ? [] : [{ room: room.key, sensors: room.leaks }],
    ),
    smoke: home.security?.smoke,
    notifications: home.system.proxmox?.notifications?.messages,
    messages: true,
    updates: [
      ...home.system.updates,
      ...home.system.firmware,
      ...home.rooms.flatMap((room) => room.firmware ?? []),
    ],
    services: home.system.services,
    disks: home.system.proxmox?.disks?.failing,
    backup: home.system.proxmox?.backups?.problem,
    guests: home.system.proxmox?.guests.map((guest) => guest.status),
    network_devices: home.system.network?.devices,
    tailscale: home.system.tailscale?.devices.flatMap((device) =>
      device.essential === true ? [device.connected] : [],
    ),
    media_health: home.system.media?.movies?.health,
  });
}
