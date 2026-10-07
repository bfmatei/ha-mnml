import type { PopupOpen } from './cards.ts';
import type { MdiIcon, PersonId } from './entities.ts';
import { isMapping } from './templates.ts';
import type { Template, Value } from './templates.ts';

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

export type SectionKey = 'rooms' | 'people' | 'garage' | 'system';

export interface SectionLook {
  title?: string;
  icon?: MdiIcon;
  template?: string;
}

export interface Plan {
  title: string;
  icon: MdiIcon;
  rooms: RoomChoice[];
  people: PersonChoice[];
  cars: CarChoice[];
  system: SystemChoice[];
  open: PopupOpen;
  sections?: Partial<Record<SectionKey, SectionLook>>;
}

export interface RecipeSection extends SectionLook {
  templates?: string[];
}

export interface Recipe {
  title: string;
  icon: MdiIcon;
  open: PopupOpen;
  sections: Partial<Record<SectionKey, RecipeSection>>;
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
  'adguard',
  'media-server',
];

export const SYSTEM_NAMES: Readonly<Record<string, string>> = {
  'home-assistant': 'Home Assistant',
  'proxmox-server': 'Proxmox VE server',
  'unifi-network': 'UniFi network',
  adguard: 'AdGuard Home',
  'media-server': 'Media server',
};

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
    text(value['title']) &&
    typeof value['icon'] === 'string' &&
    ICON.test(value['icon']) &&
    sectionsOk(value['sections']) &&
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
