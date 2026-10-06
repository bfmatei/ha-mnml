import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { filled } from '../templates/expand.ts';

import { singular } from './fill.ts';
import { labelFor } from './form.ts';
import type { PlainShape } from './shape.ts';

export function nameOf(hass: HomeAssistant | undefined, id: string): string {
  const friendly = hass?.states[id]?.attributes['friendly_name'];
  return typeof friendly === 'string' && friendly !== '' ? friendly : id;
}

const counted = (count: number, label: string): string => {
  const word = label.toLowerCase();
  return count === 1 ? `1 ${singular(word)}` : `${count} ${word}`;
};

function brief(
  shape: PlainShape,
  key: string,
  value: Value,
  hass: HomeAssistant | undefined,
): string {
  const spec = shape.fields[key];
  if (spec === undefined) {
    return '';
  }
  const label = labelFor(shape, key);
  if (spec.kind === 'entity' || spec.kind === 'popup') {
    return typeof value === 'string' ? (spec.kind === 'entity' ? nameOf(hass, value) : value) : '';
  }
  if (Array.isArray(value)) {
    return counted(value.length, label);
  }
  if (spec.kind === 'part' && isMapping(value)) {
    const main = value['entity'] ?? value['group'] ?? value['name'];
    return typeof main === 'string' ? nameOf(hass, main) : label;
  }
  if (spec.kind === 'flag') {
    return value === true || typeof value === 'string' ? label : '';
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function summarize(
  shape: PlainShape,
  keys: readonly string[],
  value: Readonly<Record<string, Value>>,
  hass: HomeAssistant | undefined,
): string {
  const parts = keys.flatMap((key) => {
    const inner = value[key];
    if (inner === undefined || !filled(inner)) {
      return [];
    }
    const text = brief(shape, key, inner, hass);
    return text === '' ? [] : [text];
  });
  if (parts.length === 0) {
    return 'not set';
  }
  return parts.length > 3 ? `${parts.slice(0, 3).join(', ')}, ...` : parts.join(', ');
}
