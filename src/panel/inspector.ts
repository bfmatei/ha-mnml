import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import { isMapping, pathLabel, slotGroup, templateTitle } from '../contract/templates.ts';
import type { Kind, SlotSpec, Template, Templates, Value } from '../contract/templates.ts';
import { objectForm } from '../editors/draw.ts';
import type { Context } from '../editors/draw.ts';
import { IN_PLACE, REDRAW } from '../editors/drawing.ts';
import type { Drawing } from '../editors/drawing.ts';
import { switchVariant, variantOf } from '../editors/form.ts';
import type { PlainForm } from '../editors/form.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

import { pick, select, simpleForm } from './form.ts';
import type { Part } from './outline.ts';
import type { Path } from './tree.ts';

export interface InspectorActions {
  hass: HomeAssistant | undefined;
  open: Map<string, boolean>;
  template: Template;
  templates: Templates;
  value: (path: Path) => Record<string, Value>;
  update: (path: Path, next: Record<string, Value>, drawing: Drawing) => void;
  redraw: () => void;
}

const BOUND = /\[\[[^\]]+\]\]/;
const PLAIN = '(plain)';

interface SlotPath {
  path: string;
  kind: Kind;
}

export function slotKinds(
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

export interface SlotChoice {
  value: string;
  label: string;
  group: string;
}

export function slotChoices(
  slots: Readonly<Record<string, SlotSpec>> | undefined,
  paths: readonly string[],
  basics: string = PANEL_EN.slots.basics,
): SlotChoice[] {
  return paths.map((path) => {
    const top = path.split('.')[0] ?? path;
    const spec = slots !== undefined && Object.hasOwn(slots, top) ? slots[top] : undefined;
    return {
      value: path,
      label: pathLabel(slots, path),
      group: spec === undefined ? basics : slotGroup(top, spec, basics),
    };
  });
}

const saidOf = (actions: InspectorActions): PanelWords =>
  panelWordsFor(actions.hass?.locale.language);

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
  const change = (wanted: string, chosen: readonly string[]): void => {
    const first = slotPaths(actions.template.slots).slice(0, 1);
    actions.update(
      part.path,
      withCondition(actions.value(part.path), wanted, chosen.length > 0 ? chosen : first),
      REDRAW,
    );
  };
  const said = saidOf(actions);
  return html`<section class="inspect-section">
    <h3>${said.stage.when}</h3>
    ${pick({
      label: said.stage.show,
      options: [
        { value: 'always', label: said.stage.shows.always },
        { value: 'if', label: said.stage.shows.if },
        { value: 'unless', label: said.stage.shows.unless },
      ],
      value: show,
      changed: (wanted) => {
        change(wanted, slots);
      },
    })}
    ${
      show === 'always'
        ? nothing
        : simpleForm({
            hass: actions.hass,
            schema: [
              {
                name: 'slots',
                selector: select(
                  slotChoices(
                    actions.template.slots,
                    slotPaths(actions.template.slots),
                    said.slots.basics,
                  ).map((choice) => ({
                    value: choice.value,
                    label: `${choice.group}: ${choice.label}`,
                  })),
                  true,
                ),
              },
            ],
            data: { slots },
            labels: { slots: said.stage.dependsOn },
            changed: (data) => {
              change(
                show,
                Array.isArray(data['slots']) ? data['slots'].map((slot) => text(slot)) : [],
              );
            },
          })
    }
  </section>`;
}

function drawBindings(part: Part, form: PlainForm, actions: InspectorActions): TemplateResult {
  const fields = Object.entries(form.fields).filter(
    ([, spec]) => spec.kind !== 'parts' && spec.kind !== 'part',
  );
  const bound = fields.filter(([key]) => {
    const value = part.value[key];
    return typeof value === 'string' && BOUND.test(value);
  });
  const free = fields
    .filter(([key]) => !bound.some(([taken]) => taken === key))
    .map(([key, spec]) => ({ value: key, label: spec.label ?? key, kind: spec.kind }));
  const said = saidOf(actions).inspector;
  return html`<section class="inspect-section">
    <h3>${said.linked}</h3>
    ${bound.length === 0 ? nothing : html`<p class="muted">${said.brackets}</p>`}
    ${bound.map(
      ([key, spec]) =>
        html`<div class="binding">
          ${simpleForm({
            hass: actions.hass,
            schema: [{ name: key, selector: { text: {} } }],
            data: { [key]: part.value[key] ?? '' },
            labels: { [key]: spec.label ?? key },
            changed: (data) => {
              actions.update(
                part.path,
                { ...actions.value(part.path), [key]: text(data[key]) },
                IN_PLACE,
              );
            },
          })}
          <button
            type="button"
            class="icon-button"
            aria-label=${said.byHand(spec.label ?? key)}
            title=${said.byHand(spec.label ?? key)}
            @click=${() => {
              const { [key]: _gone, ...rest } = actions.value(part.path);
              actions.update(part.path, rest, REDRAW);
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
                REDRAW,
              );
            }}
          ></mnml-binder>`
        : nothing
    }
  </section>`;
}

const unknown = (message: string, said: PanelWords['inspector']): TemplateResult[] => [
  html`<section class="inspect-section">
    <h3>${said.fixed}</h3>
    <p class="muted">${message}</p>
  </section>`,
];

function drawValues(part: Part, actions: InspectorActions): TemplateResult[] {
  const form = part.form;
  const said = saidOf(actions).inspector;
  if (form === undefined) {
    return unknown(said.noForm, said);
  }
  let variant: PlainForm;
  try {
    variant = variantOf(form, part.value);
  } catch {
    return unknown(said.unknownKind, said);
  }
  const kinds =
    form.kind === 'plain'
      ? nothing
      : pick({
          label: said.type,
          options: form.variants.map((each) => ({
            value: each.when ?? PLAIN,
            label: each.form.label,
          })),
          value: form.variants.find((each) => each.form === variant)?.when ?? PLAIN,
          changed: (when) => {
            actions.update(
              part.path,
              switchVariant(form, actions.value(part.path), when === PLAIN ? undefined : when),
              REDRAW,
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
  const values: PlainForm = {
    ...variant,
    fields: literal,
    sections: [{ title: variant.label, keys: Object.keys(literal) }],
  };
  const context: Context = {
    hass: actions.hass,
    popups: [],
    open: actions.open,
    redraw: actions.redraw,
  };
  return [
    drawBindings(part, variant, actions),
    html`<section class="inspect-section">
      ${kinds}
      <h3>${said.fixed}</h3>
      ${objectForm(
        values,
        {
          get: (): Record<string, Value> => actions.value(part.path),
          set: (next, drawing): void => {
            actions.update(part.path, next, drawing);
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
  const said = saidOf(actions).inspector;
  return html`<section class="inspect-section">
    <h3>${said.shared}</h3>
    ${pick({
      label: said.uses,
      options: Object.entries(actions.templates)
        .map(([each, template]) => ({ value: each, label: templateTitle(template, each) }))
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      value: name,
      changed: (chosen) => {
        actions.update(part.path, { ...actions.value(part.path), template: chosen }, REDRAW);
      },
    })}
    ${
      specs.length === 0
        ? nothing
        : html`<h3>${said.given}</h3>
            ${specs.map((slot) => {
              const given = slots[slot];
              return simpleForm({
                hass: actions.hass,
                schema: [{ name: slot, selector: { text: {} } }],
                data: {
                  [slot]:
                    given === undefined
                      ? ''
                      : typeof given === 'string'
                        ? given
                        : JSON.stringify(given),
                },
                helpers: {
                  [slot]: fragment?.slots?.[slot]?.help ?? said.givenHelp,
                },
                changed: (data) => {
                  const now = actions.value(part.path);
                  const before = isMapping(now['slots']) ? now['slots'] : {};
                  const value = text(data[slot]);
                  const next =
                    value === ''
                      ? Object.fromEntries(Object.entries(before).filter(([key]) => key !== slot))
                      : { ...before, [slot]: value };
                  actions.update(part.path, { ...now, slots: next }, IN_PLACE);
                },
              });
            })}`
    }
  </section>`;
}

export function drawInspector(part: Part | undefined, actions: InspectorActions): TemplateResult {
  const said = saidOf(actions).inspector;
  if (part === undefined) {
    return html`<div class="inspector">
      <p class="muted">${said.pick}</p>
    </div>`;
  }
  return html`<div class="inspector">
    <div class="inspect-head">
      <h2>${part.label}</h2>
      <span class="muted">${said.kinds[part.kind]}</span>
    </div>
    ${drawCondition(part, actions)}
    ${part.kind === 'fragment' ? drawFragment(part, actions) : drawValues(part, actions)}
  </div>`;
}

export const INSPECTOR_STYLE = css`
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .inspect-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .inspect-head h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
  .inspect-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--divider-color);
  }
  .inspect-section p {
    margin: 0;
  }
  .inspect-section h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .binding {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .binding > ha-form {
    flex: 1;
  }
  .inspect-section > .action {
    align-self: flex-start;
  }
`;
