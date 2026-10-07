import { isMapping } from '../contract/templates.ts';
import type { Rule, SlotSpec, Template, Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { discover } from '../templates/discover.ts';
import { filled } from '../templates/expand.ts';

import { singular, slotLabel } from './fill.ts';
import { CONTROL } from './kinds.ts';
import { entities, entity, flag, icon, need, number, part, parts, text, texts } from './shape.ts';
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
      case 'text': {
        return text();
      }
      case 'texts': {
        return texts();
      }
      case 'number': {
        return number();
      }
      case 'icon': {
        return icon();
      }
      case 'flag': {
        return flag();
      }
      case 'entity': {
        return entity(domainsOf(spec.discover));
      }
      case 'entities': {
        return entities(domainsOf(spec.discover));
      }
      case 'object': {
        return spec.fields === undefined
          ? undefined
          : part(
              slotsShape(
                spec.fields,
                `${id}=${JSON.stringify(spec.fields)}`,
                slotLabel(name, spec),
              ),
            );
      }
      case 'objects': {
        return spec.fields === undefined
          ? undefined
          : parts(
              slotsShape(
                spec.fields,
                `${id}=${JSON.stringify(spec.fields)}`,
                singular(slotLabel(name, spec)),
              ),
            );
      }
    }
  })();
  if (base === undefined) {
    return undefined;
  }
  const labelled = { ...base, label: slotLabel(name, spec) };
  const withDefault =
    spec.default === undefined ? labelled : { ...labelled, default: spec.default };
  return spec.required === true ? need(withDefault) : withDefault;
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
    const registries = {
      areas: hass.areas,
      devices: hass.devices,
      entities: hass.entities,
      states: hass.states,
    };
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
