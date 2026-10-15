import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { filled } from '../templates/expand.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';

import type { PlainForm } from './form.ts';
import { labelFor } from './ha-form-data.ts';

export function nameOf(hass: HomeAssistant | undefined, id: string): string {
  const friendly = hass?.states[id]?.attributes['friendly_name'];
  return typeof friendly === 'string' && friendly !== '' ? friendly : id;
}

function brief(
  form: PlainForm,
  key: string,
  value: Value,
  hass: HomeAssistant | undefined,
  words: EditorWords,
): string {
  const spec = form.fields[key];
  if (spec === undefined) {
    return '';
  }
  const label = labelFor(form, key, words);
  if (spec.kind === 'entity' || spec.kind === 'popup') {
    return typeof value === 'string' ? (spec.kind === 'entity' ? nameOf(hass, value) : value) : '';
  }
  if (Array.isArray(value)) {
    return words.counted(value.length, label);
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
  form: PlainForm,
  keys: readonly string[],
  value: Readonly<Record<string, Value>>,
  hass: HomeAssistant | undefined,
  words: EditorWords,
): string {
  const parts = keys.flatMap((key) => {
    const inner = value[key];
    if (inner === undefined || !filled(inner)) {
      return [];
    }
    const text = brief(form, key, inner, hass, words);
    return text === '' ? [] : [text];
  });
  if (parts.length === 0) {
    return words.notSet;
  }
  return parts.length > 3 ? `${parts.slice(0, 3).join(', ')}, ...` : parts.join(', ');
}
