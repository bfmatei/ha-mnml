import type { PopupOpen } from './cards.ts';
import type { MdiIcon, PersonId } from './entities.ts';
import { isMapping } from './templates.ts';
import type { Value } from './templates.ts';

export interface RoomChoice {
  area: string;
  slots?: Record<string, Value>;
}

export interface PersonChoice {
  entity: PersonId;
  slots?: Record<string, Value>;
}

export interface CarChoice {
  key: string;
  slots: Record<string, Value>;
}

export interface SystemChoice {
  template: string;
  slots?: Record<string, Value>;
}

export interface Plan {
  title: string;
  icon: MdiIcon;
  rooms: RoomChoice[];
  people: PersonChoice[];
  cars: CarChoice[];
  system: SystemChoice[];
  open: PopupOpen;
}

export const SYSTEM_TEMPLATES: readonly string[] = [
  'home-assistant',
  'proxmox-server',
  'unifi-network',
  'adguard',
  'media-server',
];

const OPENINGS = new Set(['sheet', 'dialog', 'unfold']);
const DEVICES = new Set(['phone', 'tablet', 'desktop']);

const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const text = (value: unknown): value is string => typeof value === 'string' && value !== '';
const named = (value: unknown): value is string => typeof value === 'string' && NAME.test(value);

export function isPersonId(value: unknown): value is PersonId {
  return typeof value === 'string' && /^person\.[a-z0-9_]+$/.test(value);
}

function slotsOk(value: unknown): boolean {
  return value === undefined || isMapping(value);
}

function listOf(value: unknown, item: (each: Record<string, Value>) => boolean): boolean {
  return Array.isArray(value) && value.every((each) => isMapping(each) && item(each));
}

export function isPlan(value: unknown): value is Plan {
  if (!isMapping(value)) {
    return false;
  }
  const open = value['open'];
  return (
    text(value['title']) &&
    typeof value['icon'] === 'string' &&
    /^mdi:[a-z0-9-]+$/.test(value['icon']) &&
    listOf(value['rooms'], (room) => text(room['area']) && slotsOk(room['slots'])) &&
    listOf(value['people'], (person) => isPersonId(person['entity']) && slotsOk(person['slots'])) &&
    listOf(value['cars'], (car) => named(car['key']) && isMapping(car['slots'])) &&
    listOf(value['system'], (each) => named(each['template']) && slotsOk(each['slots'])) &&
    isMapping(open) &&
    Object.entries(open).every(
      ([device, opening]) =>
        DEVICES.has(device) && typeof opening === 'string' && OPENINGS.has(opening),
    )
  );
}
