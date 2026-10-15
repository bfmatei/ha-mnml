import { isIcon } from './entities.ts';
import type { MdiIcon } from './entities.ts';

export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

export type Kind =
  | 'text'
  | 'texts'
  | 'number'
  | 'icon'
  | 'flag'
  | 'entity'
  | 'entities'
  | 'object'
  | 'objects';

export interface Filter {
  domain?: string;
  device_class?: string;
  platform?: string;
  translation_key?: string;
  entity_category?: 'none' | 'diagnostic' | 'config';
  unit?: string;
  state_class?: string;
  attribute?: Record<string, string>;
  name?: string;
  manufacturer?: string;
  model?: string;
  entry_type?: 'none' | 'service';
  integration?: string;
  label?: string;
  exclude?: Filter;
}

export type AreaValue =
  | 'area.name'
  | 'area.icon'
  | 'area.id'
  | 'area.temperature'
  | 'area.humidity';

export type EnergyValue =
  | 'energy.grid_power'
  | 'energy.solar_power'
  | 'energy.battery_power'
  | 'energy.battery_charge'
  | 'energy.devices';

export interface FilterRule extends Filter {
  scope?: 'area' | 'all';
}

export interface ObjectsRule {
  per: 'device' | 'area';
  scope?: 'area' | 'all';
  where?: Filter;
  fields: Record<string, Rule>;
}

export interface ObjectRule {
  device?: Filter | Filter[];
  scope?: 'area' | 'all';
  fields: Record<string, Rule>;
}

export type Rule = AreaValue | EnergyValue | FilterRule | ObjectsRule | ObjectRule | Rule[];

export interface SlotSpec {
  kind: Kind;
  required?: true;
  default?: Value;
  discover?: Rule;
  label?: string;
  help?: string;
  group?: string;
  fields?: Record<string, SlotSpec>;
}

export interface Template {
  description?: string;
  title?: string;
  icon?: MdiIcon;
  slots?: Record<string, SlotSpec>;
  retired?: string[];
  card: Value;
  popups?: Value[];
  example?: Record<string, Value>;
}

export type Templates = Readonly<Record<string, Template>>;

export interface WrittenSlot {
  shape?: string;
  kind?: Kind;
  required?: true;
  default?: Value;
  discover?: Rule;
  label?: string;
  help?: string;
  group?: string;
  fields?: Record<string, WrittenSlot>;
}

export interface WrittenTemplate {
  description?: string;
  title?: string;
  icon?: MdiIcon;
  slots?: Record<string, WrittenSlot>;
  retired?: string[];
  card: Value;
  popups?: Value[];
  example?: Record<string, Value>;
}

export type Shapes = Readonly<Record<string, WrittenSlot>>;

export interface Instance {
  template: string;
  slots?: Record<string, Value>;
}

export function isTemplate(value: unknown): value is Template {
  return typeof value === 'object' && value !== null && 'card' in value;
}

export function isMapping(value: unknown): value is Record<string, Value> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedKeys);
  }
  if (isMapping(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, sortedKeys(value[key])]),
    );
  }
  return value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortedKeys(a)) === JSON.stringify(sortedKeys(b));
}

export function sameWritten(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isStorable(value: unknown, shipped = false): value is Template {
  if (!isMapping(value)) {
    return false;
  }
  const card = value['card'];
  if (!isMapping(card) && !(shipped && Array.isArray(card))) {
    return false;
  }
  const popups = value['popups'];
  return popups === undefined || (Array.isArray(popups) && popups.every(isMapping));
}

export const TEMPLATE_ICON: MdiIcon = 'mdi:puzzle-outline';

export function lookProblem(template: {
  readonly title?: unknown;
  readonly icon?: unknown;
}): string | undefined {
  const { title, icon } = template;
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return 'its title is a text, the name the panel shows';
  }
  if (icon !== undefined && !isIcon(icon)) {
    return 'its icon is mdi: and the name of an icon, such as mdi:sofa';
  }
  return undefined;
}

function spoken(code: string): string {
  const words = code.replaceAll(/[-_]+/g, ' ').trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function templateTitle(
  template: { readonly title?: string } | undefined,
  name: string,
): string {
  const title = template?.title;
  return title !== undefined && title.trim() !== '' ? title : spoken(name);
}

export function slotLabel(name: string, spec: Pick<SlotSpec, 'label'> | undefined): string {
  const label = spec?.label;
  return label !== undefined && label !== '' ? label : spoken(name);
}

export function pathLabel(
  slots: Readonly<Record<string, SlotSpec>> | undefined,
  path: string,
): string {
  const words: string[] = [];
  let level = slots;
  for (const name of path.split('.')) {
    const spec = level !== undefined && Object.hasOwn(level, name) ? level[name] : undefined;
    words.push(slotLabel(name, spec));
    level = spec?.fields;
  }
  return words.join(': ');
}

const SIMPLE_KINDS: ReadonlySet<Kind> = new Set([
  'text',
  'texts',
  'number',
  'icon',
  'flag',
  'entity',
  'entities',
]);

export const BASICS = 'Basics';

export function slotGroup(name: string, spec: SlotSpec, basics = BASICS): string {
  return spec.group ?? (SIMPLE_KINDS.has(spec.kind) ? basics : slotLabel(name, spec));
}

export function templateIcon(template: { readonly icon?: string } | undefined): MdiIcon {
  const icon = template?.icon;
  return isIcon(icon) ? icon : TEMPLATE_ICON;
}

export function templateWithLook(
  template: WrittenTemplate,
  key: 'title' | 'icon',
  value: string,
): WrittenTemplate {
  const { description, title, icon, ...rest } = template;
  const looks = { title, icon, [key]: value === '' ? undefined : value };
  return {
    ...(description === undefined ? {} : { description }),
    ...(looks.title === undefined ? {} : { title: looks.title }),
    ...(isIcon(looks.icon) ? { icon: looks.icon } : {}),
    ...rest,
  };
}

export const PART_KEY = '_part';

export function idOf(item: Value): string | undefined {
  return isMapping(item) && typeof item['id'] === 'string' ? item['id'] : undefined;
}

export function plainKey(key: string): string {
  return key.endsWith('?') || key.endsWith('!') ? key.slice(0, -1) : key;
}

export const ITEM_KEYS: ReadonlySet<string> = new Set(['id', 'if', 'unless', 'each', 'as']);

export const TEMPLATE_KEYS: ReadonlySet<string> = new Set([...ITEM_KEYS, 'template', 'slots']);

export const LAYOUT_KEYS: ReadonlySet<string> = new Set([
  'grid_options',
  'visibility',
  'view_layout',
  'layout_options',
  'card_mod',
]);
