import { CONTROL } from '../contract/structure.ts';
import { isMapping } from '../contract/templates.ts';
import type { Rule, SlotSpec, Template, Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { registriesOf } from '../ha/registries.ts';
import { discover } from '../templates/discover.ts';
import { filled } from '../templates/expand.ts';

import { singular, slotLabel } from './fill.ts';
import type { Field, PlainShape } from './shape.ts';

const TEMPLATE_CARD = 'custom:mnml-template-card';

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
              of: slotsShape(
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
              of: slotsShape(
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

export function slotsShape(
  slots: Readonly<Record<string, SlotSpec>>,
  id: string,
  label = 'Item',
): PlainShape {
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

export function drawsCard(template: Template): boolean {
  const card = template.card;
  const type = isMapping(card) ? card['type'] : undefined;
  return (
    typeof type === 'string' &&
    !type.includes('[[') &&
    !CONTROL.variants.some((variant) => variant.when === type)
  );
}

export function previewConfig(
  name: string,
  template: Template,
  hass: HomeAssistant | undefined,
): Record<string, Value> {
  const required = Object.entries(template.slots ?? {}).filter(
    ([, spec]) => spec.required === true,
  );
  if (
    hass !== undefined &&
    required.length > 0 &&
    required.every(([, spec]) => spec.discover !== undefined)
  ) {
    const registries = registriesOf(hass);
    const fitting = Object.values(hass.areas).flatMap((area) => {
      const found = discover(template, area.area_id, registries);
      return required.every(([slot]) => filled(found[slot]))
        ? [
            {
              area: area.area_id,
              more: Object.keys(found).some(
                (slot) => !required.some(([name]) => name === slot) && filled(found[slot]),
              ),
            },
          ]
        : [];
    });
    const chosen = fitting.find((each) => each.more) ?? fitting[0];
    if (chosen !== undefined) {
      return { type: TEMPLATE_CARD, template: name, area: chosen.area };
    }
  }
  if (template.example !== undefined) {
    return { type: TEMPLATE_CARD, template: name, slots: template.example };
  }
  return { type: TEMPLATE_CARD, template: name };
}
