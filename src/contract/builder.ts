import type { PopupOpen } from './cards.ts';
import type { MdiIcon, PersonId } from './entities.ts';
import { OPENINGS } from './structure.ts';
import { isMapping } from './templates.ts';
import type { Template, Value } from './templates.ts';

interface AreaRoom {
  area: string;
  slots?: Record<string, Value>;
  spelled?: never;
}

interface SpelledRoom {
  area?: never;
  slots: Record<string, Value>;
  spelled: true;
}

export type RoomChoice = AreaRoom | SpelledRoom;

interface FoundPerson {
  entity: PersonId;
  slots?: Record<string, Value>;
  spelled?: never;
}

interface SpelledPerson {
  entity: PersonId;
  slots: Record<string, Value>;
  spelled: true;
}

export type PersonChoice = FoundPerson | SpelledPerson;

export interface CarChoice {
  key: string;
  slots: Record<string, Value>;
}

interface FoundSystem {
  template: string;
  slots?: Record<string, Value>;
  spelled?: never;
}

interface SpelledSystem {
  template: string;
  slots: Record<string, Value>;
  spelled: true;
}

export type SystemChoice = FoundSystem | SpelledSystem;

interface FoundGlances {
  slots?: Record<string, Value>;
  spelled?: never;
}

interface SpelledGlances {
  slots: Record<string, Value>;
  spelled: true;
}

export type GlancesChoice = FoundGlances | SpelledGlances;

export type SectionKey = 'rooms' | 'people' | 'garage' | 'system';

export interface SectionLook {
  title?: string;
  icon?: MdiIcon;
  template?: string;
}

export interface Plan {
  title: string;
  icon: MdiIcon;
  glances?: GlancesChoice;
  rooms: RoomChoice[];
  people: PersonChoice[];
  cars: CarChoice[];
  system: SystemChoice[];
  open: PopupOpen;
  sections?: Partial<Record<SectionKey, SectionLook>>;
  order?: SectionKey[];
}

const PLAN_KEYS: Readonly<Record<keyof Plan, true>> = {
  title: true,
  icon: true,
  glances: true,
  rooms: true,
  people: true,
  cars: true,
  system: true,
  open: true,
  sections: true,
  order: true,
};

export const SECTION_ORDER: readonly SectionKey[] = ['rooms', 'people', 'garage', 'system'];

export function orderOf(plan: Pick<Plan, 'order'>): SectionKey[] {
  const given = (plan.order ?? []).filter(
    (key, index, all) => SECTION_ORDER.includes(key) && all.indexOf(key) === index,
  );
  return [...given, ...SECTION_ORDER.filter((key) => !given.includes(key))];
}

export function isOrder(value: unknown): value is SectionKey[] {
  return (
    Array.isArray(value) &&
    value.every(
      (key, index) => SECTION_ORDER.some((known) => known === key) && value.indexOf(key) === index,
    )
  );
}

export interface RecipeSection extends SectionLook {
  templates?: string[];
}

export interface Recipe {
  title: string;
  icon: MdiIcon;
  glances?: true;
  open: PopupOpen;
  sections: Partial<Record<SectionKey, RecipeSection>>;
  order?: SectionKey[];
  templates: Record<string, Template>;
}

interface Look {
  title: string;
  icon: MdiIcon;
  template: string | undefined;
}

export const SECTION_LOOKS: Readonly<Record<SectionKey, Look>> = {
  rooms: { title: 'Rooms', icon: 'mdi:floor-plan', template: 'room' },
  people: { title: 'People', icon: 'mdi:account-group', template: 'person' },
  garage: { title: 'Garage', icon: 'mdi:garage', template: 'car' },
  system: { title: 'System', icon: 'mdi:server-network', template: undefined },
};

export function lookOf(plan: Pick<Plan, 'sections'>, key: SectionKey): Look {
  const given = plan.sections?.[key];
  const fallback = SECTION_LOOKS[key];
  return {
    title: given?.title ?? fallback.title,
    icon: given?.icon ?? fallback.icon,
    template: given?.template ?? fallback.template,
  };
}

export const SYSTEM_TEMPLATES: readonly string[] = [
  'home-assistant',
  'proxmox-server',
  'unifi-network',
  'tailscale',
  'adguard',
  'media-server',
];

export const SYSTEM_NAMES: Readonly<Record<string, string>> = {
  'home-assistant': 'Home Assistant',
  'proxmox-server': 'Proxmox VE server',
  'unifi-network': 'UniFi network',
  tailscale: 'Tailscale',
  adguard: 'AdGuard Home',
  'media-server': 'Media server',
};

const OPENING_NAMES: ReadonlySet<string> = new Set(OPENINGS);
const DEVICES = new Set(['phone', 'tablet', 'desktop']);

const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const text = (value: unknown): value is string => typeof value === 'string' && value !== '';
const named = (value: unknown): value is string => typeof value === 'string' && NAME.test(value);

export function isPersonId(value: unknown): value is PersonId {
  return typeof value === 'string' && /^person\.[a-z0-9_]+$/.test(value);
}

function only(value: Record<string, Value>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function slotsOk(each: Record<string, Value>): boolean {
  const { slots, spelled } = each;
  return spelled === undefined
    ? slots === undefined || isMapping(slots)
    : spelled === true && isMapping(slots);
}

function roomOk(room: Record<string, Value>): boolean {
  return (
    only(room, ['area', 'slots', 'spelled']) &&
    (room['spelled'] === undefined ? text(room['area']) : room['area'] === undefined) &&
    slotsOk(room)
  );
}

function glancesOk(value: unknown): boolean {
  return (
    value === undefined || (isMapping(value) && only(value, ['slots', 'spelled']) && slotsOk(value))
  );
}

const ICON = /^mdi:[a-z0-9-]+$/;

function lookOk(value: unknown, templated: boolean): boolean {
  return (
    isMapping(value) &&
    Object.keys(value).every((key) => ['title', 'icon', 'template'].includes(key)) &&
    (value['title'] === undefined || text(value['title'])) &&
    (value['icon'] === undefined ||
      (typeof value['icon'] === 'string' && ICON.test(value['icon']))) &&
    (value['template'] === undefined || (templated && named(value['template'])))
  );
}

function sectionsOk(value: unknown): boolean {
  return (
    value === undefined ||
    (isMapping(value) &&
      Object.entries(value).every(
        ([key, look]) => Object.hasOwn(SECTION_LOOKS, key) && lookOk(look, key !== 'system'),
      ))
  );
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
    Object.keys(value).every((key) => Object.hasOwn(PLAN_KEYS, key)) &&
    text(value['title']) &&
    typeof value['icon'] === 'string' &&
    ICON.test(value['icon']) &&
    glancesOk(value['glances']) &&
    sectionsOk(value['sections']) &&
    (value['order'] === undefined || isOrder(value['order'])) &&
    listOf(value['rooms'], roomOk) &&
    listOf(
      value['people'],
      (person) =>
        only(person, ['entity', 'slots', 'spelled']) &&
        isPersonId(person['entity']) &&
        slotsOk(person),
    ) &&
    listOf(
      value['cars'],
      (car) => only(car, ['key', 'slots']) && named(car['key']) && isMapping(car['slots']),
    ) &&
    listOf(
      value['system'],
      (each) =>
        only(each, ['template', 'slots', 'spelled']) && named(each['template']) && slotsOk(each),
    ) &&
    isMapping(open) &&
    Object.entries(open).every(
      ([device, opening]) =>
        DEVICES.has(device) && typeof opening === 'string' && OPENING_NAMES.has(opening),
    )
  );
}
