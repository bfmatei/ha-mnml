import { isMapping } from '../contract/templates.ts';
import type {
  Rule,
  SlotSpec,
  Template,
  Templates,
  Value,
  WrittenSlot,
  WrittenTemplate,
} from '../contract/templates.ts';
import { variantOf } from '../editors/shape.ts';
import type { HomeAssistant } from '../ha/hass.ts';

import type { Part } from './outline.ts';
import { withValue } from './tree.ts';
import type { Path } from './tree.ts';

const WHOLE = /^\[\[([a-z_][a-z0-9_]*(?:\.[a-z0-9_]+)*)\]\]$/;

export interface DataField {
  key: string;
  label: string;
  holder: Path;
  value: string;
  slot: string | undefined;
}

export function slotIn(value: unknown): string | undefined {
  return typeof value === 'string' ? WHOLE.exec(value)?.[1] : undefined;
}

export function sentence(text: string): string {
  const spaced = text.replace(/^my-/, '').replaceAll(/[-_.]/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function specAt(
  slots: Readonly<Record<string, SlotSpec>> | undefined,
  path: string,
): SlotSpec | undefined {
  let found: SlotSpec | undefined;
  let level = slots;
  for (const name of path.split('.')) {
    found = level?.[name];
    level = found?.fields;
  }
  return found;
}

export function slotLabel(template: Template, path: string): string {
  return specAt(template.slots, path)?.label ?? sentence(path);
}

export function findsItself(template: Template, path: string): boolean {
  return specAt(template.slots, path)?.discover !== undefined;
}

function valueOfSlot(values: Readonly<Record<string, Value>>, path: string): Value | undefined {
  let node: Value | undefined = values;
  for (const name of path.split('.')) {
    node = isMapping(node) ? node[name] : undefined;
  }
  return node;
}

const entityText = (value: Value | undefined): string | undefined =>
  typeof value === 'string' && value.includes('.') ? value : undefined;

export function resolvedEntity(
  values: Readonly<Record<string, Value>>,
  field: DataField,
): string | undefined {
  return field.slot === undefined
    ? entityText(field.value)
    : entityText(valueOfSlot(values, field.slot));
}

interface Key {
  key: string;
  label: string | undefined;
}

function entityKeys(part: Part, templates: Templates): Key[] {
  if (part.kind === 'fragment') {
    const name = part.value['template'];
    const fragment = typeof name === 'string' ? templates[name] : undefined;
    return Object.entries(fragment?.slots ?? {})
      .filter(([, spec]) => spec.kind === 'entity')
      .map(([key, spec]) => ({ key, label: spec.label }));
  }
  if (part.shape === undefined) {
    return [];
  }
  try {
    return Object.entries(variantOf(part.shape, part.value).fields)
      .filter(([, spec]) => spec.kind === 'entity')
      .map(([key, spec]) => ({ key, label: spec.label }));
  } catch {
    return [];
  }
}

export function dataFields(part: Part, template: Template, templates: Templates): DataField[] {
  const holderValue = part.kind === 'fragment' ? part.value['slots'] : part.value;
  const holder: Path = part.kind === 'fragment' ? [...part.path, 'slots'] : part.path;
  const values = isMapping(holderValue) ? holderValue : {};
  return entityKeys(part, templates).map(({ key, label }) => {
    const raw = values[key];
    const value = typeof raw === 'string' ? raw : '';
    const slot = slotIn(value);
    return {
      key,
      holder,
      value,
      slot,
      label:
        slot === undefined
          ? (label ?? sentence(key === 'entity' ? 'what it shows' : key))
          : slotLabel(template, slot),
    };
  });
}

function nested(
  into: Record<string, Value>,
  path: readonly string[],
  value: Value,
): Record<string, Value> {
  const [head, ...rest] = path;
  if (head === undefined) {
    return into;
  }
  if (rest.length === 0) {
    return { ...into, [head]: value };
  }
  const inner = into[head];
  return { ...into, [head]: nested(isMapping(inner) ? inner : {}, rest, value) };
}

export function setLiteral(
  template: WrittenTemplate,
  field: DataField,
  entity: string,
): WrittenTemplate {
  return withValue(template, [...field.holder, field.key], entity);
}

export function setPreview(
  template: WrittenTemplate,
  slot: string,
  entity: string,
): WrittenTemplate {
  return { ...template, example: nested(template.example ?? {}, slot.split('.'), entity) };
}

export function fixField(
  template: WrittenTemplate,
  field: DataField,
  entity: string | undefined,
): WrittenTemplate {
  return withValue(template, [...field.holder, field.key], entity);
}

function ruleFor(entity: string, hass: HomeAssistant | undefined): Rule {
  const domain = entity.split('.')[0] ?? '';
  const attributes = hass?.states[entity]?.attributes;
  const deviceClass: unknown = attributes?.['device_class'];
  return typeof deviceClass === 'string' && deviceClass !== ''
    ? { domain, device_class: deviceClass }
    : { domain };
}

function slotNameFor(template: WrittenTemplate, wanted: string): string {
  const base =
    wanted
      .replaceAll(/[^a-z0-9_]/gi, '_')
      .toLowerCase()
      .replaceAll(/^_+|_+$/g, '')
      .replace(/^(\d)/, '_$1') || 'entity';
  const taken = new Set(Object.keys(template.slots ?? {}));
  let name = base;
  for (let n = 2; taken.has(name); n += 1) {
    name = `${base}_${n}`;
  }
  return name;
}

export function automateField(
  template: WrittenTemplate,
  field: DataField,
  entity: string,
  hass: HomeAssistant | undefined,
): WrittenTemplate {
  const holderId = field.holder
    .filter((segment) => segment.startsWith('#'))
    .at(-1)
    ?.slice(1);
  const name = slotNameFor(template, field.key === 'entity' ? (holderId ?? 'entity') : field.key);
  const slots: Record<string, WrittenSlot> = {
    ...template.slots,
    [name]: { kind: 'entity', label: sentence(name), discover: ruleFor(entity, hass) },
  };
  const next: WrittenTemplate = {
    ...template,
    slots,
    example: { ...template.example, [name]: entity },
  };
  return withValue(next, [...field.holder, field.key], `[[${name}]]`);
}
