import { subnetRange } from '../contract/subnet.ts';
import type { Value } from '../contract/templates.ts';
import { TemplateError, expand } from '../templates/expand.ts';
import { SHIPPED } from '../templates/shipped.ts';

import { personSlots, proxmoxSlots, roomSlots, snake, systemSlots } from './slots.ts';
import type { Home } from './types.ts';
import { SECTION_NAMES, drawn } from './view.ts';

type Json = Record<string, unknown>;

const KEY = /^[a-z0-9-]+$/;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(value: unknown, visit: (node: Json) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit);
    }
    return;
  }
  if (!isJson(value)) {
    return;
  }
  visit(value);
  for (const child of Object.values(value)) {
    walk(child, visit);
  }
}

export function hashProblems(dashboard: unknown): string[] {
  const defined: string[] = [];
  const opened = new Set<string>();
  walk(dashboard, (node) => {
    if (typeof node['hash'] === 'string') {
      defined.push(node['hash']);
    }
    if (typeof node['popup'] === 'string') {
      opened.add(node['popup']);
    }
  });
  const twice = defined.filter((hash, index) => defined.indexOf(hash) !== index);
  return [
    ...[...opened]
      .filter((hash) => !defined.includes(hash))
      .toSorted()
      .map((hash) => `${hash} is opened but no pop-up defines it`),
    ...[...new Set(twice)].toSorted().map((hash) => `${hash} is defined twice`),
  ];
}

function hashes(template: string, slots: Record<string, Value>): string[] {
  return expand(SHIPPED, { template, slots }).popups.flatMap((popup) =>
    isJson(popup) && typeof popup['hash'] === 'string' ? [popup['hash']] : [],
  );
}

function producible(home: Home): string[] {
  const standIn = (part: string): Record<string, Value> => {
    for (const room of home.rooms) {
      const value = roomSlots(room)[part];
      if (value !== undefined && !(Array.isArray(value) && value.length === 0)) {
        return { [part]: value };
      }
    }
    return {};
  };
  const full = {
    ...standIn('heating'),
    ...standIn('ac'),
    ...standIn('vacuum'),
    ...standIn('printer3d'),
    ...standIn('speakers'),
  };
  const { proxmox, network, adguard, media } = home.system;
  const all = [
    ...home.rooms.flatMap((room) => hashes('room', { ...roomSlots(room), ...full })),
    ...home.people.flatMap((person) => hashes('person', personSlots(person))),
    ...home.cars.flatMap((car) => hashes('car', snake(car))),
    ...(proxmox ? hashes('proxmox-server', proxmoxSlots(proxmox)) : []),
    ...(network ? hashes('unifi-network', snake(network)) : []),
    ...(adguard ? hashes('adguard', snake(adguard)) : []),
    ...hashes('home-assistant', systemSlots(home.system, home.rooms)),
    ...(media ? hashes('media-server', snake(media)) : []),
  ];
  const twice = all.filter((hash, index) => all.indexOf(hash) !== index);
  return [...new Set(twice)].map((hash) => `${hash} can be produced twice`);
}

function keyProblems(home: Home): string[] {
  const keys = [
    ...home.rooms.map((room) => room.key),
    ...home.rooms.flatMap((room) =>
      (room.media ?? []).flatMap((member) => (typeof member === 'string' ? [] : [member.key])),
    ),
    ...home.cars.map((car) => car.key),
    ...home.people.map((person) => person.key),
    ...home.people.flatMap((person) => person.devices.map((device) => device.key)),
    ...(home.system.network?.wifi ?? []).map((wifi) => wifi.key),
  ];
  return keys
    .filter((key) => !KEY.test(key))
    .map((key) => `${key} is no URL fragment: keys are lower case letters, digits and -`);
}

function subnetProblems(home: Home): string[] {
  return (home.system.network?.clients?.networks ?? [])
    .filter(({ subnet }) => subnetRange(subnet) === undefined)
    .map(({ name, subnet }) => `${name}: ${subnet} is no IPv4 subnet`);
}

function orderProblems(home: Home): string[] {
  if (home.order === undefined) {
    return [];
  }
  const wrong = SECTION_NAMES.filter(
    (name) => home.order?.filter((listed) => listed === name).length !== 1,
  );
  return wrong.length === 0 && home.order.length === SECTION_NAMES.length
    ? []
    : [`order must list each of ${SECTION_NAMES.join(', ')} once`];
}

function drawable(check: () => string[]): string[] {
  try {
    return check();
  } catch (error) {
    if (error instanceof TemplateError) {
      return [`the templates cannot draw the home: ${error.message}`];
    }
    throw error;
  }
}

export function problems(home: Home): string[] {
  return [
    ...drawable(() => [...hashProblems(drawn(home)), ...producible(home)]),
    ...keyProblems(home),
    ...subnetProblems(home),
    ...orderProblems(home),
  ];
}
