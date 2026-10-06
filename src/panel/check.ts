import { isMapping } from '../contract/templates.ts';
import type { SlotSpec, Template, Templates, Value } from '../contract/templates.ts';
import { fitsKind, toValue } from '../templates/expand.ts';

import { tryDraft } from './preview.ts';

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

function wrongDefault(slots: Readonly<Record<string, SlotSpec>>, prefix = ''): string | undefined {
  for (const [slot, spec] of Object.entries(slots)) {
    if (spec.default !== undefined && !fitsKind(spec.kind, spec.default)) {
      return `the default of ${prefix}${slot} is not of kind ${spec.kind}`;
    }
    const inner =
      spec.fields === undefined ? undefined : wrongDefault(spec.fields, `${prefix}${slot}.`);
    if (inner !== undefined) {
      return inner;
    }
  }
  return undefined;
}

const READ = /\[\[([a-z_][a-z0-9_]*)(?:\.[a-z0-9_]+)*\]\]/g;

const names = (rule: Value | undefined): string[] =>
  (Array.isArray(rule) ? rule : rule === undefined ? [] : [rule]).flatMap((each) =>
    typeof each === 'string' ? [each.split('.')[0] ?? each] : [],
  );

function unknownRead(value: Value, where: string, known: ReadonlySet<string>): string | undefined {
  if (typeof value === 'string') {
    for (const match of value.matchAll(READ)) {
      if (!known.has(match[1] ?? '')) {
        return `${where}: ${match[0]} reads a slot the template does not declare`;
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
      return `${where}: two parts share the id ${twice}`;
    }
    for (const [index, item] of value.entries()) {
      const found = unknownRead(item, `${where}[${index}]`, known);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (!isMapping(value)) {
    return undefined;
  }
  const gate = [...names(value['if']), ...names(value['unless']), ...names(value['each'])].find(
    (slot) => !known.has(slot),
  );
  if (gate !== undefined) {
    return `${where}: ${gate} is not a slot the template declares`;
  }
  const alias = value['as'];
  const inner = typeof alias === 'string' ? new Set([...known, alias]) : known;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'if' || key === 'unless' || key === 'each' || key === 'as' || key === 'id') {
      continue;
    }
    const found = unknownRead(
      entry,
      `${where}.${key.endsWith('?') ? key.slice(0, -1) : key}`,
      inner,
    );
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

export function problemOf(templates: Templates, name: string, draft: Template): string | undefined {
  const fallback = wrongDefault(draft.slots ?? {});
  if (fallback !== undefined) {
    return fallback;
  }
  const known = new Set(Object.keys(draft.slots ?? {}));
  const unread =
    unknownRead(draft.card, 'card', known) ?? unknownRead(draft.popups ?? [], 'popups', known);
  if (unread !== undefined) {
    return unread;
  }
  let made;
  try {
    made = tryDraft(templates, name, draft, { slots: draft.example ?? {} }, undefined);
  } catch (error) {
    return `With the example: ${message(error)}`;
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
      return `${tag}: ${message(error)}`;
    }
  }
  return undefined;
}
