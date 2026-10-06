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
  card: Value;
  popups?: Value[];
  example?: Record<string, Value>;
}

export type Templates = Readonly<Record<string, Template>>;

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
