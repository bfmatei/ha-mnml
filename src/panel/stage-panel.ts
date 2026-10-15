import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import { slotLabel, templateTitle } from '../contract/templates.ts';
import type { Template, Templates, Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import { EDITORS_EN } from '../words/panel/editors-en.ts';
import { editorWordsFor } from '../words/panel/editors.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

import { findsItself, resolvedEntity, sentence } from './binding.ts';
import type { DataField } from './binding.ts';
import { pick, simpleForm } from './form.ts';
import { conditionOf, slotChoices, slotPaths } from './inspector.ts';
import { startersOf, wordingFor } from './outline.ts';
import type { Group, Part, Starter, Wording } from './outline.ts';
import { drawLook } from './simple.ts';
import type { SimpleActions, SimpleRow } from './simple.ts';

export interface StageActions extends SimpleActions {
  select: (key: string) => void;
  duplicate: (part: Part) => void;
  remove: (part: Part) => void;
  move: (group: Group, from: number, to: number) => void;
  add: (group: Group, starter: Starter) => void;
  open: (template: string) => void;
  editHere: (part: Part) => void;
  pick: (data: DataField, entity: string) => void;
  fix: (data: DataField) => void;
  automate: (data: DataField) => void;
  condition: (part: Part, show: string, slots: readonly string[]) => void;
  retitle: (key: 'title' | 'icon', value: string) => void;
}

export interface StageInput {
  root: Part | Group;
  selected: string;
  name: string;
  template: Template;
  templates: Templates;
  values: Readonly<Record<string, Value>>;
  data: readonly DataField[];
  editableHere: boolean;
  chain: readonly Part[];
  rows: readonly SimpleRow[];
  advanced: TemplateResult | typeof nothing;
  hass: HomeAssistant | undefined;
}

type Said = PanelWords['stage'];
type Keys = Readonly<Record<string, string>>;

const SHOWN = 5;

const lookup = (table: object, name: string): string | undefined => {
  const found: unknown = Object.hasOwn(table, name) ? Reflect.get(table, name) : undefined;
  return typeof found === 'string' ? found : undefined;
};

const placeOf = (group: Group, said: Said): string =>
  lookup(said.places, group.key) ?? group.label.toLowerCase();

const key = (part: Part): string => part.path.join('/');

export function titleOf(part: Part, template: Template, keys: Keys = EDITORS_EN.keys): string {
  const last = part.path.at(-1) ?? '';
  if (last.startsWith('#')) {
    const id = last.slice(1);
    const slots = template.slots ?? {};
    return Object.hasOwn(slots, id) ? slotLabel(id, slots[id]) : sentence(id);
  }
  const name = last.replace(/\?$/, '');
  return last === 'card' ? part.label : (lookup(keys, name) ?? sentence(name));
}

function kindOf(
  parent: Part | undefined,
  group: Group | undefined,
  input: StageInput,
  said: Said,
): string | undefined {
  if (parent === undefined || group === undefined) {
    return undefined;
  }
  return said.partIn(group.label, titleOf(parent, input.template, keysOf(input)));
}

function keysOf(input: StageInput): Keys {
  return editorWordsFor(input.hass?.locale.language).keys;
}

function markOf(starter: Starter): string {
  const type = starter.value['type'];
  return typeof type === 'string' ? type : (Object.keys(starter.value)[0] ?? 'value');
}

function describe(template: string | undefined, templates: Templates): string | undefined {
  const text = template === undefined ? undefined : templates[template]?.description;
  const first = text?.split(/(?<=\.)\s/)[0];
  return first === undefined || first === '' ? undefined : first;
}

const STATE_ORDER = ['value', 'attribute', 'text', 'name', 'minutes', 'serial'];

function ordered(group: Group, wording: Wording): Starter[] {
  const starters = startersOf(group, wording);
  return group.key === 'state'
    ? starters.toSorted((a, b) => STATE_ORDER.indexOf(markOf(a)) - STATE_ORDER.indexOf(markOf(b)))
    : starters;
}

function chip(group: Group, starter: Starter, actions: StageActions, said: Said): TemplateResult {
  return html`<button
    type="button"
    class="chip"
    @click=${() => {
      actions.add(group, starter);
    }}
  >
    ${icon('mdi:plus')}${group.key === 'state' ? (lookup(said.states, markOf(starter)) ?? starter.label) : starter.label}
  </button>`;
}

function adds(
  groups: readonly Group[],
  input: StageInput,
  actions: StageActions,
  said: Said,
): TemplateResult | typeof nothing {
  const lists = groups.filter((group) => group.list);
  if (lists.length === 0) {
    return nothing;
  }
  const wording = wordingFor(input.hass?.locale.language);
  return html`<section class="stage-section stage-adds">
    <h3>${said.add}</h3>
    ${lists.map((group) => {
      const starters = ordered(group, wording);
      const first = starters.slice(0, SHOWN);
      const rest = starters.slice(SHOWN);
      return html`<div class="stage-add">
        <span class="stage-add-label">${said.to(placeOf(group, said))}</span>
        ${first.map((starter) => chip(group, starter, actions, said))}
        ${
          rest.length === 0
            ? nothing
            : html`<details class="stage-rest">
                <summary class="chip">${said.more}</summary>
                <div class="stage-add">
                  ${rest.map((starter) => chip(group, starter, actions, said))}
                </div>
              </details>`
        }
      </div>`;
    })}
  </section>`;
}

function crumbs(
  chain: readonly Part[],
  input: StageInput,
  actions: StageActions,
  said: Said,
): TemplateResult {
  const keys = keysOf(input);
  return html`<nav class="stage-crumbs" aria-label=${said.whereYouAre}>
    ${chain.map(
      (part, index) =>
        html`${index === 0 ? nothing : icon('mdi:chevron-right')}<button
            type="button"
            class=${classMap({ crumb: true, current: index === chain.length - 1 })}
            @click=${() => {
              actions.select(key(part));
            }}
          >
            ${titleOf(part, input.template, keys)}
          </button>`,
    )}
  </nav>`;
}

interface Place {
  group: Group;
  index: number;
}

export function groupOfPart(chain: readonly Part[]): Place | undefined {
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

function drawData(
  data: DataField,
  input: StageInput,
  actions: StageActions,
  said: Said,
): TemplateResult {
  const { template, values, hass } = input;
  const shown = resolvedEntity(values, data);
  const bound = data.slot !== undefined;
  const itself = bound && data.slot !== undefined && findsItself(template, data.slot);
  const note = !bound
    ? said.same
    : itself
      ? shown === undefined
        ? said.noneHere
        : said.here(nameOf(shown, hass))
      : said.whereUsed;
  const label = bound ? data.label : (lookup(keysOf(input), data.key) ?? data.label);
  return html`<div class="stage-field">
    ${!bound && data.key === 'entity' ? nothing : html`<span class="stage-field-label">${label}</span>`}
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
        ${said.always}
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
        ${said.withRoom}
      </button>
    </div>
  </div>`;
}

function drawWhen(
  part: Part,
  input: StageInput,
  actions: StageActions,
  said: Said,
): TemplateResult | typeof nothing {
  const paths = slotPaths(input.template.slots);
  if (paths.length === 0 || part.kind === 'card') {
    return nothing;
  }
  const { show, slots } = conditionOf(part.value);
  const first = paths[0] ?? '';
  return html`<section class="stage-section">
    <h3>${said.when}</h3>
    ${pick({
      label: said.show,
      options: [
        { value: 'always', label: said.shows.always },
        { value: 'if', label: said.shows.if },
        { value: 'unless', label: said.shows.unless },
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
            label: said.dependsOn,
            options: slotChoices(
              input.template.slots,
              paths,
              panelWordsFor(input.hass?.locale.language).slots.basics,
            ),
            value: slots[0] ?? first,
            changed: (slot) => {
              actions.condition(part, show, [slot === '' ? first : slot]);
            },
          })
    }
  </section>`;
}

function drawOff(
  hidden: SimpleRow,
  input: StageInput,
  actions: StageActions,
  said: Said,
): TemplateResult {
  const last = (hidden.path.at(-1) ?? '').replace(/^#/, '');
  const name = lookup(keysOf(input), last) ?? sentence(last);
  return html`<div class="stage-panel">
    <h2 class="stage-title">${name}</h2>
    <p class="muted">${said.off}</p>
    <label class="stage-switch">
      <input
        type="checkbox"
        aria-label=${said.showName(name)}
        data-path=${input.selected}
        .checked=${false}
        @change=${(event: Event) => {
          actions.toggle(hidden, field(event.target, 'checked') === true);
        }}
      />
      <span>${said.showAgain}</span>
    </label>
  </div>`;
}

function drawName(input: StageInput, actions: StageActions, said: Said): TemplateResult {
  const retitling: SimpleActions = {
    toggle: () => {},
    look: (look, value) => {
      if (look.key === 'title' || look.key === 'icon') {
        actions.retitle(look.key, value);
      }
    },
  };
  return html`<section class="stage-section">
    <h3>${said.itsName}</h3>
    <div class="stage-looks">
      ${(['title', 'icon'] as const).map(
        (look) =>
          html`<label class="stage-look"
            ><span>${said.looks[look]}</span>${drawLook(
              { path: [look], key: look, value: input.template[look] ?? '' },
              said.template,
              retitling,
              input.hass,
            )}</label
          >`,
      )}
    </div>
    <p class="muted">${said.titled} <code class="code-name">${input.name}</code>.</p>
  </section>`;
}

function drawStart(input: StageInput, actions: StageActions, said: Said): TemplateResult {
  const root = input.root;
  const top = 'groups' in root ? root.groups : [root];
  return html`<div class="stage-panel">
    <p class="stage-hint">
      ${icon('mdi:cursor-default-click-outline')}
      <span>${said.hint}</span>
    </p>
    ${adds(top, input, actions, said)} ${drawName(input, actions, said)}
  </div>`;
}

function drawHead(
  part: Part,
  input: StageInput,
  row: SimpleRow | undefined,
  about: string | undefined,
  actions: StageActions,
  said: Said,
): TemplateResult {
  const title = titleOf(part, input.template, keysOf(input));
  const kind =
    kindOf(input.chain.at(-2), groupOfPart(input.chain)?.group, input, said) ?? part.label;
  return html`<div class="stage-head">
    <div>
      <h2 class="stage-title">${title}</h2>
      ${kind === title ? nothing : html`<p class="muted">${kind}</p>`}
      ${about === undefined ? nothing : html`<p class="muted">${about}</p>`}
    </div>
    ${
      row?.switchable === true
        ? html`<label class="stage-switch">
            <input
              type="checkbox"
              aria-label=${said.showName(title)}
              data-path=${key(part)}
              .checked=${row.on}
              @change=${(event: Event) => {
                actions.toggle(row, field(event.target, 'checked') === true);
              }}
            />
            <span>${said.shown}</span>
          </label>`
        : nothing
    }
  </div>`;
}

function drawShows(
  input: StageInput,
  actions: StageActions,
  said: Said,
): TemplateResult | typeof nothing {
  if (input.data.length === 0) {
    return nothing;
  }
  return html`<section class="stage-section">
    <h3>${said.what}</h3>
    ${input.data.map((data) => drawData(data, input, actions, said))}
  </section>`;
}

function drawLooks(
  row: SimpleRow | undefined,
  actions: StageActions,
  hass: HomeAssistant | undefined,
  said: Said,
): TemplateResult | typeof nothing {
  if (row === undefined || row.looks.length === 0) {
    return nothing;
  }
  return html`<section class="stage-section">
    <h3>${said.look}</h3>
    <div class="stage-looks">
      ${row.looks.map(
        (look) =>
          html`<label class="stage-look"
            ><span>${lookup(said.looks, look.key) ?? look.key}</span>${drawLook(
              look,
              row.label,
              actions,
              hass,
            )}</label
          >`,
      )}
    </div>
  </section>`;
}

function drawOrder(
  part: Part,
  place: Place | undefined,
  actions: StageActions,
  said: Said,
): TemplateResult | typeof nothing {
  if (place === undefined) {
    return nothing;
  }
  return html`<section class="stage-section">
    <h3>${said.order}</h3>
    <div class="stage-moves">
      <button
        type="button"
        class="chip"
        ?disabled=${place.index === 0}
        @click=${() => {
          actions.move(place.group, place.index, place.index - 1);
        }}
      >
        ${icon('mdi:arrow-up')}${said.earlier}
      </button>
      <button
        type="button"
        class="chip"
        ?disabled=${place.index === place.group.parts.length - 1}
        @click=${() => {
          actions.move(place.group, place.index, place.index + 1);
        }}
      >
        ${icon('mdi:arrow-down')}${said.later}
      </button>
      <button
        type="button"
        class="chip"
        @click=${() => {
          actions.duplicate(part);
        }}
      >
        ${icon('mdi:content-copy')}${said.copy}
      </button>
      <button
        type="button"
        class="chip danger"
        @click=${() => {
          actions.remove(part);
        }}
      >
        ${icon('mdi:delete-outline')}${said.delete}
      </button>
    </div>
  </section>`;
}

function drawShared(
  part: Part,
  used: string | undefined,
  input: StageInput,
  actions: StageActions,
  said: Said,
): TemplateResult | typeof nothing {
  if (used === undefined || !Object.hasOwn(input.templates, used)) {
    return nothing;
  }
  return html`<section class="stage-section">
    <h3>${said.shared}</h3>
    <p class="muted">${said.sharedPiece(templateTitle(input.templates[used], used))}</p>
    <div class="stage-moves">
      ${
        input.editableHere
          ? html`<button
              type="button"
              class="chip"
              @click=${() => {
                actions.editHere(part);
              }}
            >
              ${icon('mdi:pencil-outline')}${said.editHere}
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
        ${icon('mdi:open-in-new')}${said.editAll}
      </button>
    </div>
    ${input.editableHere ? html`<p class="muted">${said.editAbout}</p>` : nothing}
  </section>`;
}

function drawMore(
  advanced: TemplateResult | typeof nothing,
  said: Said,
): TemplateResult | typeof nothing {
  if (advanced === nothing) {
    return nothing;
  }
  return html`<details class="stage-more">
    <summary>${said.settings}</summary>
    ${advanced}
  </details>`;
}

export function drawStagePanel(input: StageInput, actions: StageActions): TemplateResult {
  const { chain, rows } = input;
  const said = panelWordsFor(input.hass?.locale.language).stage;
  const part = chain.at(-1);
  const hidden =
    part === undefined ? rows.find((each) => each.path.join('/') === input.selected) : undefined;
  if (hidden !== undefined && !hidden.on) {
    return drawOff(hidden, input, actions, said);
  }
  if (part === undefined) {
    return drawStart(input, actions, said);
  }
  const row = rows.find((each) => each.path.join('/') === key(part));
  const named = part.value['template'];
  const used = part.kind === 'fragment' && typeof named === 'string' ? named : undefined;
  return html`<div class="stage-panel">
    ${chain.length > 1 ? crumbs(chain, input, actions, said) : nothing}
    ${drawHead(part, input, row, describe(used, input.templates), actions, said)}
    ${drawShows(input, actions, said)} ${drawLooks(row, actions, input.hass, said)}
    ${drawWhen(part, input, actions, said)} ${drawOrder(part, groupOfPart(chain), actions, said)}
    ${drawShared(part, used, input, actions, said)} ${adds(part.groups, input, actions, said)}
    ${drawMore(input.advanced, said)}
  </div>`;
}

export const STAGE_STYLE = css`
  .stage-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .stage-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .stage-head > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .stage-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--divider-color);
  }
  .stage-section h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .stage-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .stage-field-label {
    color: var(--secondary-text-color);
    font-size: 13px;
  }
  .stage-modes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .stage-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--secondary-text-color);
  }
  .stage-crumbs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .stage-crumbs ha-icon {
    --mdc-icon-size: 14px;
  }
  .stage-crumbs ha-icon:dir(rtl) {
    transform: scaleX(-1);
  }
  .crumb {
    all: unset;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
  }
  .crumb:hover {
    background: var(--secondary-background-color);
  }
  .crumb.current {
    color: var(--primary-text-color);
    font-weight: 600;
  }
  .stage-title {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }
  .stage-panel p {
    margin: 0;
  }
  .stage-looks {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .stage-look {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }
  .stage-look > span:first-child {
    color: var(--secondary-text-color);
  }
  .stage-switch {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stage-switch input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--primary-color);
  }
  .stage-moves,
  .stage-add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .stage-adds {
    gap: 16px;
  }
  .stage-add-label {
    flex-basis: 100%;
    color: var(--secondary-text-color);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .stage-rest {
    flex-basis: 100%;
  }
  .stage-rest summary {
    list-style: none;
  }
  .stage-rest[open] > summary {
    margin-bottom: 6px;
  }
  .stage-more {
    padding-top: 16px;
    border-top: 1px solid var(--divider-color);
  }
  .stage-more summary {
    cursor: pointer;
    color: var(--secondary-text-color);
    padding: 4px 0;
  }
  .stage-more[open] summary {
    margin-bottom: 8px;
  }
  .simple-look {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
`;
