import { html, LitElement, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import { isMapping } from '../contract/templates.ts';
import type { Kind, SlotSpec, Template, Templates, Value } from '../contract/templates.ts';
import { objectForm } from '../editors/draw.ts';
import type { Context } from '../editors/draw.ts';
import { switchVariant, variantOf } from '../editors/shape.ts';
import type { Field, PlainShape } from '../editors/shape.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';

import { select, simpleForm } from './form.ts';
import type { Part } from './outline.ts';
import { PANEL_STYLE } from './style.ts';
import type { Path } from './tree.ts';

export interface InspectorActions {
  hass: HomeAssistant | undefined;
  open: Map<string, boolean>;
  template: Template;
  templates: Templates;
  value: (path: Path) => Record<string, Value>;
  update: (path: Path, next: Record<string, Value>, redraw: boolean) => void;
  redraw: () => void;
}

const BOUND = /\[\[[^\]]+\]\]/;
const PLAIN = '(plain)';

interface SlotPath {
  path: string;
  kind: Kind;
}

function slotKinds(
  slots: Readonly<Record<string, SlotSpec>> | undefined,
  prefix = '',
  found: SlotPath[] = [],
): SlotPath[] {
  for (const [name, spec] of Object.entries(slots ?? {})) {
    found.push({ path: `${prefix}${name}`, kind: spec.kind });
    if (spec.kind === 'object' && spec.fields !== undefined) {
      slotKinds(spec.fields, `${prefix}${name}.`, found);
    }
  }
  return found;
}

export const slotPaths = (slots: Readonly<Record<string, SlotSpec>> | undefined): string[] =>
  slotKinds(slots).map((slot) => slot.path);

type FieldKind = Field['kind'];

const FITS: Partial<Record<FieldKind, readonly Kind[]>> = {
  text: ['text', 'number', 'icon', 'entity'],
  words: ['text', 'number'],
  summary: ['text', 'number'],
  choice: ['text'],
  popup: ['text'],
  service: ['text'],
  color: ['text'],
  texts: ['texts', 'text'],
  number: ['number'],
  share: ['number'],
  flag: ['flag'],
  icon: ['icon', 'text'],
  entity: ['entity'],
  entities: ['entities', 'entity'],
};

export function fittingSlots(
  slots: Readonly<Record<string, SlotSpec>> | undefined,
  field: FieldKind,
): string[] {
  const fits = FITS[field];
  return slotKinds(slots)
    .filter((slot) => fits === undefined || fits.includes(slot.kind))
    .map((slot) => slot.path);
}

const text = (value: Value | undefined, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

export function conditionOf(value: Record<string, Value>): { show: string; slots: string[] } {
  const rule = value['if'] ?? value['unless'];
  const slots = (Array.isArray(rule) ? rule : rule === undefined ? [] : [rule]).map(String);
  return {
    show: value['if'] !== undefined ? 'if' : value['unless'] !== undefined ? 'unless' : 'always',
    slots,
  };
}

export function withCondition(
  value: Record<string, Value>,
  show: string,
  slots: readonly string[],
): Record<string, Value> {
  const rest = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'if' && key !== 'unless'),
  );
  if (show === 'always' || slots.length === 0) {
    return rest;
  }
  const rule: Value = slots.length === 1 ? (slots[0] ?? '') : [...slots];
  const { id, ...others } = rest;
  return id === undefined ? { [show]: rule, ...others } : { id, [show]: rule, ...others };
}

function drawCondition(part: Part, actions: InspectorActions): TemplateResult {
  const { show, slots } = conditionOf(part.value);
  return html`<section class="inspect-section">
    <h3>Shown</h3>
    ${simpleForm({
      hass: actions.hass,
      schema: [
        {
          name: 'show',
          selector: select([
            { value: 'always', label: 'Always' },
            { value: 'if', label: 'Only if these slots are set' },
            { value: 'unless', label: 'Only if they are not set' },
          ]),
        },
        ...(show === 'always'
          ? []
          : [{ name: 'slots', selector: select(slotPaths(actions.template.slots), true) }]),
      ],
      data: { show, slots },
      labels: { show: 'Shown', slots: 'Slots' },
      changed: (data) => {
        const chosen = Array.isArray(data['slots']) ? data['slots'].map((slot) => text(slot)) : [];
        const wanted = text(data['show'], 'always');
        const first = slotPaths(actions.template.slots).slice(0, 1);
        actions.update(
          part.path,
          withCondition(actions.value(part.path), wanted, chosen.length > 0 ? chosen : first),
          true,
        );
      },
    })}
  </section>`;
}

interface Free {
  value: string;
  label: string;
  kind: FieldKind;
}

export class MnmlBinder extends LitElement {
  static override styles = PANEL_STYLE;

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) fields: readonly Free[] = [];
  @property({ attribute: false }) slots: Readonly<Record<string, SlotSpec>> | undefined;
  @property({ attribute: false }) bind: (field: string, slot: string) => void = () => {};
  @state() private chosenField = '';
  @state() private chosenSlot = '';

  protected override render(): TemplateResult | typeof nothing {
    const field = this.fields.find((each) => each.value === this.chosenField) ?? this.fields[0];
    const slots = field === undefined ? [] : fittingSlots(this.slots, field.kind);
    const slot = slots.includes(this.chosenSlot) ? this.chosenSlot : (slots[0] ?? '');
    if (field === undefined) {
      return nothing;
    }
    return html`${simpleForm({
        hass: this.hass,
        schema: [
          {
            name: 'field',
            selector: select(this.fields.map(({ value, label }) => ({ value, label }))),
          },
          { name: 'slot', selector: select(slots) },
        ],
        data: { field: field.value, slot },
        labels: { field: 'Field', slot: 'Slot' },
        helpers: slots.length === 0 ? { slot: 'No slot of a kind that fits this field' } : {},
        changed: (data) => {
          this.chosenField = text(data['field']);
          this.chosenSlot = text(data['slot']);
        },
      })}
      <button
        type="button"
        class="action"
        aria-label="Bind the field to the slot"
        title="Bind the field to the slot"
        ?disabled=${slot === ''}
        @click=${() => {
          if (slot !== '') {
            this.bind(field.value, slot);
          }
        }}
      >
        ${icon('mdi:link-variant')}<span>Bind</span>
      </button>`;
  }
}

function drawBindings(part: Part, shape: PlainShape, actions: InspectorActions): TemplateResult {
  const fields = Object.entries(shape.fields).filter(
    ([, spec]) => spec.kind !== 'parts' && spec.kind !== 'part',
  );
  const bound = fields.filter(([key]) => {
    const value = part.value[key];
    return typeof value === 'string' && BOUND.test(value);
  });
  const free = fields
    .filter(([key]) => !bound.some(([taken]) => taken === key))
    .map(([key, spec]) => ({ value: key, label: spec.label ?? key, kind: spec.kind }));
  return html`<section class="inspect-section">
    <h3>From slots</h3>
    ${bound.map(
      ([key, spec]) =>
        html`<div class="binding">
          ${simpleForm({
            hass: actions.hass,
            schema: [{ name: key, selector: { text: {} } }],
            data: { [key]: part.value[key] ?? '' },
            labels: { [key]: spec.label ?? key },
            helpers: { [key]: 'A slot in double brackets, alone or inside text' },
            changed: (data) => {
              actions.update(
                part.path,
                { ...actions.value(part.path), [key]: text(data[key]) },
                false,
              );
            },
          })}
          <button
            type="button"
            class="icon-button"
            aria-label=${`Set ${spec.label ?? key} by hand`}
            title=${`Set ${spec.label ?? key} by hand`}
            @click=${() => {
              const { [key]: _gone, ...rest } = actions.value(part.path);
              actions.update(part.path, rest, true);
            }}
          >
            ${icon('mdi:link-variant-off')}
          </button>
        </div>`,
    )}
    ${
      free.length > 0 && slotPaths(actions.template.slots).length > 0
        ? html`<mnml-binder
            .hass=${actions.hass}
            .fields=${free}
            .slots=${actions.template.slots}
            .bind=${(field: string, slot: string) => {
              actions.update(
                part.path,
                { ...actions.value(part.path), [field]: `[[${slot}]]` },
                true,
              );
            }}
          ></mnml-binder>`
        : nothing
    }
  </section>`;
}

const unknown = (message: string): TemplateResult[] => [
  html`<section class="inspect-section">
    <h3>Values</h3>
    <p class="muted">${message}</p>
  </section>`,
];

function drawValues(part: Part, actions: InspectorActions): TemplateResult[] {
  const shape = part.shape;
  if (shape === undefined) {
    return unknown('This part has no form of its own; change it in the YAML tab.');
  }
  let variant: PlainShape;
  try {
    variant = variantOf(shape, part.value);
  } catch {
    return unknown('This part is of a kind the form does not know; change it in the YAML tab.');
  }
  const kinds =
    shape.kind === 'plain'
      ? nothing
      : simpleForm({
          hass: actions.hass,
          schema: [
            {
              name: 'kind',
              selector: select(
                shape.variants.map((each) => ({
                  value: each.when ?? PLAIN,
                  label: each.shape.label,
                })),
              ),
            },
          ],
          data: { kind: shape.variants.find((each) => each.shape === variant)?.when ?? PLAIN },
          labels: { kind: 'Kind' },
          changed: (data) => {
            const when = text(data['kind'], PLAIN);
            actions.update(
              part.path,
              switchVariant(shape, actions.value(part.path), when === PLAIN ? undefined : when),
              true,
            );
          },
        });
  const literal = Object.fromEntries(
    Object.entries(variant.fields).filter(([key, spec]) => {
      const value = part.value[key];
      return (
        spec.kind !== 'parts' &&
        spec.kind !== 'part' &&
        !(typeof value === 'string' && BOUND.test(value))
      );
    }),
  );
  const values: PlainShape = {
    ...variant,
    fields: literal,
    sections: [{ title: variant.label, keys: Object.keys(literal) }],
  };
  const context: Context = {
    hass: actions.hass,
    hashes: [],
    open: actions.open,
    redraw: actions.redraw,
  };
  return [
    drawBindings(part, variant, actions),
    html`<section class="inspect-section">
      ${kinds}
      <h3>Values</h3>
      ${objectForm(
        values,
        {
          get: (): Record<string, Value> => actions.value(part.path),
          set: (next, redraw): void => {
            actions.update(part.path, next, redraw);
          },
        },
        context,
        part.path.join('/'),
        false,
      )}
    </section>`,
  ];
}

function drawFragment(part: Part, actions: InspectorActions): TemplateResult {
  const name = text(part.value['template']);
  const fragment = actions.templates[name];
  const slots = isMapping(part.value['slots']) ? part.value['slots'] : {};
  const specs = Object.keys(fragment?.slots ?? {});
  return html`<section class="inspect-section">
    <h3>Fragment</h3>
    ${simpleForm({
      hass: actions.hass,
      schema: [{ name: 'template', selector: select(Object.keys(actions.templates).toSorted()) }],
      data: { template: name },
      labels: { template: 'Template' },
      changed: (data) => {
        actions.update(
          part.path,
          { ...actions.value(part.path), template: text(data['template']) },
          true,
        );
      },
    })}
    ${
      specs.length === 0
        ? nothing
        : html`<h3>Its slots</h3>
            ${simpleForm({
              hass: actions.hass,
              schema: specs.map((slot) => ({ name: slot, selector: { text: {} } })),
              data: Object.fromEntries(
                specs.map((slot) => [
                  slot,
                  typeof slots[slot] === 'string' ? slots[slot] : JSON.stringify(slots[slot] ?? ''),
                ]),
              ),
              helpers: Object.fromEntries(
                specs.map((slot) => [
                  slot,
                  fragment?.slots?.[slot]?.help ??
                    'A value, or a slot of this template in double brackets',
                ]),
              ),
              changed: (data) => {
                const next = Object.fromEntries(
                  Object.entries(data).filter(([, value]) => value !== '' && value !== undefined),
                );
                actions.update(part.path, { ...actions.value(part.path), slots: next }, false);
              },
            })}`
    }
  </section>`;
}

export function drawInspector(part: Part | undefined, actions: InspectorActions): TemplateResult {
  if (part === undefined) {
    return html`<div class="inspector">
      <p class="muted">Pick a part in the outline to change it.</p>
    </div>`;
  }
  return html`<div class="inspector">
    <div class="inspect-head">
      <h2>${part.label}</h2>
      <span class="muted">${part.kind === 'fragment' ? 'a fragment' : part.kind}</span>
    </div>
    ${drawCondition(part, actions)}
    ${part.kind === 'fragment' ? drawFragment(part, actions) : drawValues(part, actions)}
  </div>`;
}
