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

export type Rule = AreaValue | FilterRule | ObjectsRule | ObjectRule | Rule[];

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

export const PART_KEY = '_part';
