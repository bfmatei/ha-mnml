import type { PopupAlert, PopupOpen } from './cards.ts';
import { isEntityId, isIcon } from './entities.ts';
import type { MdiIcon, PersonId } from './entities.ts';
import { problemsOf } from './required.ts';
import { CARD_STRUCTURES, OPENINGS } from './structure.ts';
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

export interface DeviceChoice {
  device: string;
  template: string;
}

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

export type PlanSection = 'rooms' | 'devices' | 'people' | 'garage' | 'system';

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
  devices?: DeviceChoice[];
  people: PersonChoice[];
  cars: CarChoice[];
  system: SystemChoice[];
  open: PopupOpen;
  idle_close?: number;
  alerts?: PopupAlert[];
  squares?: true;
  sections?: Partial<Record<PlanSection, SectionLook>>;
  order?: PlanSection[];
}

const PLAN_KEYS: Readonly<Record<keyof Plan, true>> = {
  title: true,
  icon: true,
  glances: true,
  rooms: true,
  devices: true,
  people: true,
  cars: true,
  system: true,
  open: true,
  idle_close: true,
  alerts: true,
  squares: true,
  sections: true,
  order: true,
};

export const SECTION_ORDER: readonly SectionKey[] = ['rooms', 'people', 'garage', 'system'];

export const PLAN_ORDER: readonly PlanSection[] = [
  'rooms',
  'devices',
  'people',
  'garage',
  'system',
];

export function orderOf(plan: Pick<Plan, 'order'>): PlanSection[] {
  const given = (plan.order ?? []).filter(
    (key, index, all) => PLAN_ORDER.includes(key) && all.indexOf(key) === index,
  );
  return [...given, ...PLAN_ORDER.filter((key) => !given.includes(key))];
}

export function isOrder(value: unknown): value is PlanSection[] {
  return (
    Array.isArray(value) &&
    value.every(
      (key, index) => PLAN_ORDER.some((known) => known === key) && value.indexOf(key) === index,
    )
  );
}

export interface DashboardTemplateSection extends SectionLook {
  templates?: string[];
}

export interface DashboardTemplate {
  title: string;
  icon: MdiIcon;
  glances?: true;
  open: PopupOpen;
  squares?: true;
  sections: Partial<Record<SectionKey, DashboardTemplateSection>>;
  order?: PlanSection[];
  templates: Record<string, Template>;
}

interface Look {
  title: string;
  icon: MdiIcon;
  template: string | undefined;
}

export const SECTION_LOOKS: Readonly<Record<PlanSection, Look>> = {
  rooms: { title: 'Rooms', icon: 'mdi:floor-plan', template: 'room' },
  devices: { title: 'Devices', icon: 'mdi:devices', template: undefined },
  people: { title: 'People', icon: 'mdi:account-group', template: 'person' },
  garage: { title: 'Garage', icon: 'mdi:garage', template: 'car' },
  system: { title: 'System', icon: 'mdi:server-network', template: undefined },
};

export function lookOf(plan: Pick<Plan, 'sections'>, key: PlanSection): Look {
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

const OPENING_NAMES: ReadonlySet<string> = new Set(OPENINGS);
const DEVICES = new Set(['phone', 'tablet', 'desktop']);

const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const text = (value: unknown): value is string => typeof value === 'string' && value !== '';
const named = (value: unknown): value is string => typeof value === 'string' && NAME.test(value);

export function isPersonId(value: unknown): value is PersonId {
  return isEntityId(value) && value.startsWith('person.');
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

function lookOk(value: unknown, templated: boolean): boolean {
  return (
    isMapping(value) &&
    Object.keys(value).every((key) => ['title', 'icon', 'template'].includes(key)) &&
    (value['title'] === undefined || text(value['title'])) &&
    (value['icon'] === undefined || isIcon(value['icon'])) &&
    (value['template'] === undefined || (templated && named(value['template'])))
  );
}

function sectionsOk(value: unknown): boolean {
  return (
    value === undefined ||
    (isMapping(value) &&
      Object.entries(value).every(([key, look]) => {
        const known = PLAN_ORDER.find((each) => each === key);
        return known !== undefined && lookOk(look, SECTION_LOOKS[known].template !== undefined);
      }))
  );
}

function listOf(value: unknown, item: (each: Record<string, Value>) => boolean): boolean {
  return Array.isArray(value) && value.every((each) => isMapping(each) && item(each));
}

const ALERT = CARD_STRUCTURES['custom:mnml-popups-card'].keys?.['alerts']?.of;

function idleOk(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function alertsOk(value: unknown): boolean {
  return (
    value === undefined ||
    (ALERT?.kind === 'plain' &&
      listOf(
        value,
        (alert) => only(alert, Object.keys(ALERT.keys)) && problemsOf(ALERT, alert).length === 0,
      ))
  );
}

export function isPlan(value: unknown): value is Plan {
  if (!isMapping(value)) {
    return false;
  }
  const open = value['open'];
  return (
    Object.keys(value).every((key) => Object.hasOwn(PLAN_KEYS, key)) &&
    text(value['title']) &&
    isIcon(value['icon']) &&
    glancesOk(value['glances']) &&
    sectionsOk(value['sections']) &&
    (value['order'] === undefined || isOrder(value['order'])) &&
    idleOk(value['idle_close']) &&
    alertsOk(value['alerts']) &&
    (value['squares'] === undefined || value['squares'] === true) &&
    listOf(value['rooms'], roomOk) &&
    (value['devices'] === undefined ||
      listOf(
        value['devices'],
        (each) =>
          only(each, ['device', 'template']) && text(each['device']) && named(each['template']),
      )) &&
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
