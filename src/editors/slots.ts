import { isMapping, slotLabel } from '../contract/templates.ts';
import type { Rule, SlotSpec } from '../contract/templates.ts';
import { singular } from '../words/panel/editors-en.ts';

import type { Field, PlainForm } from './form.ts';

function domainsOf(rule: Rule | undefined): readonly string[] | undefined {
  if (rule === undefined || typeof rule === 'string' || Array.isArray(rule) || !isMapping(rule)) {
    return undefined;
  }
  const domain = rule['domain'];
  return typeof domain === 'string' ? [domain] : undefined;
}

function fieldOf(spec: SlotSpec, id: string, name: string): Field | undefined {
  const base = ((): Field | undefined => {
    switch (spec.kind) {
      case 'text':
      case 'texts':
      case 'number':
      case 'icon':
      case 'flag': {
        return { kind: spec.kind };
      }
      case 'entity':
      case 'entities': {
        return { kind: spec.kind, domains: domainsOf(spec.discover) };
      }
      case 'object': {
        return spec.fields === undefined
          ? undefined
          : {
              kind: 'part',
              of: slotsForm(
                spec.fields,
                `${id}=${JSON.stringify(spec.fields)}`,
                slotLabel(name, spec),
              ),
            };
      }
      case 'objects': {
        return spec.fields === undefined
          ? undefined
          : {
              kind: 'parts',
              of: slotsForm(
                spec.fields,
                `${id}=${JSON.stringify(spec.fields)}`,
                singular(slotLabel(name, spec)),
              ),
            };
      }
    }
  })();
  if (base === undefined) {
    return undefined;
  }
  const labelled = { ...base, label: slotLabel(name, spec) };
  const withDefault =
    spec.default === undefined ? labelled : { ...labelled, default: spec.default };
  return spec.required === true ? { ...withDefault, required: true } : withDefault;
}

export function slotsForm(
  slots: Readonly<Record<string, SlotSpec>>,
  id: string,
  label = 'Item',
): PlainForm {
  const fields: Record<string, Field> = {};
  for (const [name, spec] of Object.entries(slots)) {
    const made = fieldOf(spec, `${id}.${name}`, name);
    if (made !== undefined) {
      fields[name] = made;
    }
  }
  return {
    kind: 'plain',
    id: `slots:${id}`,
    label,
    fields,
    sections: [{ title: 'Slots', keys: Object.keys(fields) }],
  };
}

export function kept(slots: Readonly<Record<string, SlotSpec>>): string[] {
  return Object.entries(slots)
    .filter(([name, spec]) => fieldOf(spec, name, name) === undefined)
    .map(([name]) => name);
}
