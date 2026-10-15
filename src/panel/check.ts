import { ITEM_KEYS, isMapping, lookProblem, plainKey, slotLabel } from '../contract/templates.ts';
import type {
  SlotSpec,
  Template,
  Templates,
  Value,
  WrittenTemplate,
} from '../contract/templates.ts';
import { PATH, WORDS, fitsKind, toValue } from '../templates/expand.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';

import { shapedOf } from './data.ts';
import { messageOf } from './message.ts';
import { tryDraft } from './preview.ts';

type Said = PanelWords['check'];

function mnmlCards(value: Value, found: Record<string, Value>[] = []): Record<string, Value>[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      mnmlCards(item, found);
    }
  } else if (isMapping(value)) {
    const type = value['type'];
    if (typeof type === 'string' && type.startsWith('custom:mnml-')) {
      found.push(value);
    }
    for (const inner of Object.values(value)) {
      mnmlCards(inner, found);
    }
  }
  return found;
}

function wrongDefault(
  slots: Readonly<Record<string, SlotSpec>>,
  said: Said,
  prefix = '',
): string | undefined {
  for (const [slot, spec] of Object.entries(slots)) {
    const label = `${prefix}${slotLabel(slot, spec)}`;
    if (spec.default !== undefined && !fitsKind(spec.kind, spec.default)) {
      return said.wrongDefault(label, said.kinds[spec.kind]);
    }
    const inner =
      spec.fields === undefined ? undefined : wrongDefault(spec.fields, said, `${label}: `);
    if (inner !== undefined) {
      return inner;
    }
  }
  return undefined;
}

const READ = new RegExp(`\\[\\[(${PATH})\\]\\]`, 'g');

const names = (rule: Value | undefined): string[] =>
  (Array.isArray(rule) ? rule : rule === undefined ? [] : [rule]).flatMap((each) =>
    typeof each === 'string' ? [each.split('.')[0] ?? each] : [],
  );

function unknownRead(
  value: Value,
  where: string,
  known: ReadonlySet<string>,
  said: Said,
): string | undefined {
  if (typeof value === 'string') {
    for (const match of value.matchAll(READ)) {
      const head = match[1]?.split('.')[0] ?? '';
      if (head !== WORDS && !known.has(head)) {
        return said.undeclared(where, match[0]);
      }
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    const ids = value.flatMap((item) =>
      isMapping(item) && typeof item['id'] === 'string' ? [item['id']] : [],
    );
    const twice = ids.find((id, index) => ids.indexOf(id) !== index);
    if (twice !== undefined) {
      return said.sharedId(where, twice);
    }
    for (const [index, item] of value.entries()) {
      const found = unknownRead(item, `${where}[${index}]`, known, said);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (!isMapping(value)) {
    return undefined;
  }
  const alias = value['as'];
  const inner = typeof alias === 'string' ? new Set([...known, alias]) : known;
  const gate = [
    ...names(value['if']).filter((slot) => !inner.has(slot)),
    ...names(value['unless']).filter((slot) => !inner.has(slot)),
    ...names(value['each']).filter((slot) => !known.has(slot)),
  ][0];
  if (gate !== undefined) {
    return said.notSlot(where, gate);
  }
  for (const [key, entry] of Object.entries(value)) {
    if (ITEM_KEYS.has(key)) {
      continue;
    }
    const found = unknownRead(entry, `${where}.${plainKey(key)}`, inner, said);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

export function problemOf(
  templates: Templates,
  name: string,
  written: WrittenTemplate,
  said: Said = PANEL_EN.check,
): string | undefined {
  let draft: Template;
  try {
    draft = shapedOf(name, written);
  } catch (error) {
    return messageOf(error);
  }
  const look = lookProblem(draft);
  if (look !== undefined) {
    return `${look.charAt(0).toUpperCase()}${look.slice(1)}`;
  }
  const fallback = wrongDefault(draft.slots ?? {}, said);
  if (fallback !== undefined) {
    return fallback;
  }
  const known = new Set(Object.keys(draft.slots ?? {}));
  const unread =
    unknownRead(draft.card, 'card', known, said) ??
    unknownRead(draft.popups ?? [], 'popups', known, said);
  if (unread !== undefined) {
    return unread;
  }
  let made;
  try {
    made = tryDraft(templates, name, draft, { slots: draft.example ?? {} }, undefined);
  } catch (error) {
    return said.withExample(messageOf(error));
  }
  for (const config of mnmlCards([made.card, toValue(made.popups)])) {
    const type = config['type'];
    const tag = typeof type === 'string' ? type.slice('custom:'.length) : '';
    const Card = customElements.get(tag);
    if (Card === undefined) {
      continue;
    }
    const probe: object = new Card();
    const setConfig: unknown = Reflect.get(probe, 'setConfig');
    if (typeof setConfig !== 'function') {
      continue;
    }
    try {
      Reflect.apply(setConfig, probe, [config]);
    } catch (error) {
      return `${tag}: ${messageOf(error)}`;
    }
  }
  return undefined;
}
