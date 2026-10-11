import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import type { Template, Templates, Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';

import { findsItself, resolvedEntity, sentence, slotLabel } from './binding.ts';
import type { DataField } from './binding.ts';
import { pick, simpleForm } from './form.ts';
import { conditionOf, slotPaths } from './inspector.ts';
import { startersOf } from './outline.ts';
import type { Group, Part, Starter } from './outline.ts';
import { drawLook } from './simple.ts';
import type { SimpleActions, SimpleRow } from './simple.ts';

export interface StageActions extends SimpleActions {
  select: (key: string) => void;
  duplicate: (part: Part) => void;
  remove: (part: Part) => void;
  move: (group: Group, from: number, to: number) => void;
  add: (group: Group, starter: Starter) => void;
  open: (template: string) => void;
  detach: (part: Part) => void;
  pick: (data: DataField, entity: string) => void;
  fix: (data: DataField) => void;
  automate: (data: DataField) => void;
  condition: (part: Part, show: string, slots: readonly string[]) => void;
}

export interface StageInput {
  root: Part | Group;
  selected: string;
  template: Template;
  templates: Templates;
  values: Readonly<Record<string, Value>>;
  data: readonly DataField[];
  detachable: boolean;
  chain: readonly Part[];
  rows: readonly SimpleRow[];
  advanced: TemplateResult | typeof nothing;
  hass: HomeAssistant | undefined;
}

const LOOK_LABELS: Record<string, string> = {
  name: 'Name',
  title: 'Title',
  icon: 'Icon',
  color: 'Colour',
};

const SHOWN = 5;

const PLACES: Record<string, string> = {
  state: 'the line under the name',
  chips: 'the chips',
  controls: 'the buttons',
  rows: 'the rows',
  cards: 'the pop-up',
  popups: 'the pop-ups',
  items: 'the items',
};

const STATE_WORDS: Record<string, string> = {
  Text: 'A text',
  Attribute: 'An attribute',
  Minutes: 'A duration',
  Serial: 'A serial number',
  Name: 'A name',
  Value: 'A value',
};

const placeOf = (group: Group): string =>
  PLACES[group.label.toLowerCase()] ?? group.label.toLowerCase();

const key = (part: Part): string => part.path.join('/');

export function titleOf(part: Part): string {
  const last = part.path.at(-1) ?? '';
  if (last.startsWith('#')) {
    return sentence(last.slice(1));
  }
  return last === 'card' ? part.label : sentence(last.replace(/\?$/, ''));
}

function kindOf(parent: Part | undefined, group: Group | undefined): string | undefined {
  if (parent === undefined || group === undefined) {
    return undefined;
  }
  const single = group.label.replace(/ies$/, 'y').replace(/s$/, '');
  const article = /^[aeiou]/i.test(single) ? 'An' : 'A';
  return `${article} ${single} of the ${titleOf(parent).toLowerCase()}`;
}

function describe(template: string | undefined, templates: Templates): string | undefined {
  const text = template === undefined ? undefined : templates[template]?.description;
  const first = text?.split(/(?<=\.)\s/)[0];
  return first === undefined || first === '' ? undefined : first;
}

const STATE_ORDER = ['Value', 'Attribute', 'Text', 'Name', 'Minutes', 'Serial'];

function ordered(group: Group): Starter[] {
  const starters = startersOf(group);
  return group.label === 'state'
    ? starters.toSorted((a, b) => STATE_ORDER.indexOf(a.label) - STATE_ORDER.indexOf(b.label))
    : starters;
}

function chip(group: Group, starter: Starter, actions: StageActions): TemplateResult {
  return html`<button
    type="button"
    class="chip"
    @click=${() => {
      actions.add(group, starter);
    }}
  >
    ${icon('mdi:plus')}${group.label === 'state' ? (STATE_WORDS[starter.label] ?? starter.label) : starter.label}
  </button>`;
}

function adds(groups: readonly Group[], actions: StageActions): TemplateResult | typeof nothing {
  const lists = groups.filter((group) => group.list);
  if (lists.length === 0) {
    return nothing;
  }
  return html`<section class="stage-section stage-adds">
    <h3>Add</h3>
    ${lists.map((group) => {
      const starters = ordered(group);
      const first = starters.slice(0, SHOWN);
      const rest = starters.slice(SHOWN);
      return html`<div class="stage-add">
        <span class="stage-add-label">To ${placeOf(group)}</span>
        ${first.map((starter) => chip(group, starter, actions))}
        ${
          rest.length === 0
            ? nothing
            : html`<details class="stage-rest">
                <summary class="chip">More</summary>
                <div class="stage-add">${rest.map((starter) => chip(group, starter, actions))}</div>
              </details>`
        }
      </div>`;
    })}
  </section>`;
}

function crumbs(chain: readonly Part[], actions: StageActions): TemplateResult {
  return html`<nav class="stage-crumbs" aria-label="Where you are">
    ${chain.map(
      (part, index) =>
        html`${index === 0 ? nothing : icon('mdi:chevron-right')}<button
            type="button"
            class=${classMap({ crumb: true, current: index === chain.length - 1 })}
            @click=${() => {
              actions.select(key(part));
            }}
          >
            ${titleOf(part)}
          </button>`,
    )}
  </nav>`;
}

export function groupOfPart(chain: readonly Part[]): { group: Group; index: number } | undefined {
  const part = chain.at(-1);
  const parent = chain.at(-2);
  if (part === undefined || parent === undefined) {
    return undefined;
  }
  for (const group of parent.groups) {
    const index = group.parts.findIndex((each) => key(each) === key(part));
    if (index !== -1 && group.list) {
      return { group, index };
    }
  }
  return undefined;
}

function nameOf(entity: string, hass: HomeAssistant | undefined): string {
  const name: unknown = hass?.states[entity]?.attributes['friendly_name'];
  return typeof name === 'string' ? name : entity;
}

function drawData(data: DataField, input: StageInput, actions: StageActions): TemplateResult {
  const { template, values, hass } = input;
  const shown = resolvedEntity(values, data);
  const bound = data.slot !== undefined;
  const itself = bound && data.slot !== undefined && findsItself(template, data.slot);
  const note = !bound
    ? 'The same one everywhere.'
    : itself
      ? shown === undefined
        ? 'Picked for each room by itself. None is found here.'
        : `Picked for each room by itself. Here: ${nameOf(shown, hass)}.`
      : 'Chosen where the card is used. The one above is only for this preview.';
  return html`<div class="stage-field">
    ${data.label === 'What it shows' ? nothing : html`<span class="stage-field-label">${data.label}</span>`}
    ${simpleForm({
      hass,
      schema: [{ name: 'entity', selector: { entity: {} } }],
      data: { entity: shown ?? '' },
      labels: { entity: '' },
      changed: (next) => {
        const chosen = next['entity'];
        if (typeof chosen === 'string' && chosen !== '') {
          actions.pick(data, chosen);
        }
      },
    })}
    <p class="muted">${note}</p>
    <div class="stage-modes">
      <button
        type="button"
        class=${classMap({ chip: true, active: !bound })}
        aria-pressed=${!bound}
        @click=${() => {
          if (bound) {
            actions.fix(data);
          }
        }}
      >
        Always this one
      </button>
      <button
        type="button"
        class=${classMap({ chip: true, active: bound })}
        aria-pressed=${bound}
        ?disabled=${!bound && shown === undefined}
        @click=${() => {
          if (!bound) {
            actions.automate(data);
          }
        }}
      >
        Changes with the room
      </button>
    </div>
  </div>`;
}

function drawWhen(
  part: Part,
  input: StageInput,
  actions: StageActions,
): TemplateResult | typeof nothing {
  const paths = slotPaths(input.template.slots);
  if (paths.length === 0 || part.kind === 'card') {
    return nothing;
  }
  const { show, slots } = conditionOf(part.value);
  const first = paths[0] ?? '';
  return html`<section class="stage-section">
    <h3>When it shows</h3>
    ${pick({
      label: 'Show',
      options: [
        { value: 'always', label: 'Always' },
        { value: 'if', label: 'Only when found' },
        { value: 'unless', label: 'Only when not found' },
      ],
      value: show,
      changed: (wanted) => {
        actions.condition(part, wanted, [slots[0] ?? first]);
      },
    })}
    ${
      show === 'always'
        ? nothing
        : pick({
            label: 'Depends on',
            options: paths.map((path) => ({ value: path, label: slotLabel(input.template, path) })),
            value: slots[0] ?? first,
            changed: (slot) => {
              actions.condition(part, show, [slot === '' ? first : slot]);
            },
          })
    }
  </section>`;
}

export function drawStagePanel(input: StageInput, actions: StageActions): TemplateResult {
  const { chain, rows, hass } = input;
  const part = chain.at(-1);
  const hidden =
    part === undefined ? rows.find((each) => each.path.join('/') === input.selected) : undefined;
  if (hidden !== undefined && !hidden.on) {
    const name = sentence((hidden.path.at(-1) ?? '').replace(/^#/, ''));
    return html`<div class="stage-panel">
      <h2 class="stage-title">${name}</h2>
      <p class="muted">This part is switched off, so it is not on the card.</p>
      <label class="stage-switch">
        <input
          type="checkbox"
          aria-label=${`Show ${name}`}
          data-path=${input.selected}
          .checked=${false}
          @change=${(event: Event) => {
            actions.toggle(hidden, field(event.target, 'checked') === true);
          }}
        />
        <span>Show it again</span>
      </label>
    </div>`;
  }
  if (part === undefined) {
    const top = 'groups' in input.root ? input.root.groups : [input.root];
    return html`<div class="stage-panel">
      <p class="stage-hint">
        ${icon('mdi:cursor-default-click-outline')}
        <span>Click anything on the card to change it, or add something below.</span>
      </p>
      ${adds(top, actions)}
    </div>`;
  }
  const row = rows.find((each) => each.path.join('/') === key(part));
  const place = groupOfPart(chain);
  const named = part.value['template'];
  const used = part.kind === 'fragment' && typeof named === 'string' ? named : undefined;
  const said = describe(used, input.templates);
  return html`<div class="stage-panel">
    ${chain.length > 1 ? crumbs(chain, actions) : nothing}
    <div class="stage-head">
      <div>
        <h2 class="stage-title">${titleOf(part)}</h2>
        ${
          (kindOf(chain.at(-2), place?.group) ?? part.label) === titleOf(part)
            ? nothing
            : html`<p class="muted">${kindOf(chain.at(-2), place?.group) ?? part.label}</p>`
        }
        ${said === undefined ? nothing : html`<p class="muted">${said}</p>`}
      </div>
      ${
        row?.switchable === true
          ? html`<label class="stage-switch">
              <input
                type="checkbox"
                aria-label=${`Show ${titleOf(part)}`}
                data-path=${key(part)}
                .checked=${row.on}
                @change=${(event: Event) => {
                  actions.toggle(row, field(event.target, 'checked') === true);
                }}
              />
              <span>Shown</span>
            </label>`
          : nothing
      }
    </div>
    ${
      input.data.length === 0
        ? nothing
        : html`<section class="stage-section">
            <h3>What it shows</h3>
            ${input.data.map((data) => drawData(data, input, actions))}
          </section>`
    }
    ${
      row === undefined || row.looks.length === 0
        ? nothing
        : html`<section class="stage-section">
            <h3>How it looks</h3>
            <div class="stage-looks">
              ${row.looks.map(
                (look) =>
                  html`<label class="stage-look"
                    ><span>${LOOK_LABELS[look.key] ?? look.key}</span>${drawLook(
                      look,
                      row.label,
                      actions,
                      hass,
                    )}</label
                  >`,
              )}
            </div>
          </section>`
    }
    ${drawWhen(part, input, actions)}
    ${
      place === undefined
        ? nothing
        : html`<section class="stage-section">
            <h3>Order</h3>
            <div class="stage-moves">
              <button
                type="button"
                class="chip"
                ?disabled=${place.index === 0}
                @click=${() => {
                  actions.move(place.group, place.index, place.index - 1);
                }}
              >
                ${icon('mdi:arrow-up')}Earlier
              </button>
              <button
                type="button"
                class="chip"
                ?disabled=${place.index === place.group.parts.length - 1}
                @click=${() => {
                  actions.move(place.group, place.index, place.index + 1);
                }}
              >
                ${icon('mdi:arrow-down')}Later
              </button>
              <button
                type="button"
                class="chip"
                @click=${() => {
                  actions.duplicate(part);
                }}
              >
                ${icon('mdi:content-copy')}Copy
              </button>
              <button
                type="button"
                class="chip danger"
                @click=${() => {
                  actions.remove(part);
                }}
              >
                ${icon('mdi:delete-outline')}Delete
              </button>
            </div>
          </section>`
    }
    ${
      used !== undefined && Object.hasOwn(input.templates, used)
        ? html`<section class="stage-section">
            <h3>Shared design</h3>
            <p class="muted">
              This is a shared piece (${sentence(used).toLowerCase()}) that other cards use too.
            </p>
            <div class="stage-moves">
              ${
                input.detachable
                  ? html`<button
                      type="button"
                      class="chip"
                      @click=${() => {
                        actions.detach(part);
                      }}
                    >
                      ${icon('mdi:pencil-outline')}Edit it here
                    </button>`
                  : nothing
              }
              <button
                type="button"
                class="chip"
                @click=${() => {
                  actions.open(used);
                }}
              >
                ${icon('mdi:open-in-new')}Edit it for everyone
              </button>
            </div>
            ${
              input.detachable
                ? html`<p class="muted">
                    Editing it here makes a copy for this card only, which stops following the
                    shared piece. Editing it for everyone changes every card that uses it.
                  </p>`
                : nothing
            }
          </section>`
        : nothing
    }
    ${adds(part.groups, actions)}
    ${
      input.advanced === nothing
        ? nothing
        : html`<details class="stage-more">
            <summary>More settings</summary>
            ${input.advanced}
          </details>`
    }
  </div>`;
}
