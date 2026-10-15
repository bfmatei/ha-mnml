import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';

import { isMapping, slotLabel } from '../contract/templates.ts';
import type {
  AreaValue,
  EnergyValue,
  FilterRule,
  Kind,
  ObjectsRule,
  Rule,
  SlotSpec,
  Template,
  Value,
  WrittenSlot,
  WrittenTemplate,
} from '../contract/templates.ts';
import { toYaml } from '../contract/yaml.ts';
import { IN_PLACE, REDRAW } from '../editors/drawing.ts';
import type { Drawing } from '../editors/drawing.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { icon } from '../ha/templates.ts';
import { nodeHash } from '../templates/changes.ts';
import { TEXT_FILTERS } from '../templates/discover.ts';
import type { Step } from '../templates/discover.ts';
import { ENERGY_WORDS, isEnergyValue } from '../templates/energy.ts';
import { toValue } from '../templates/expand.ts';
import { explain } from '../templates/explain.ts';
import type { Trace } from '../templates/explain.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

import { slotOf } from './data.ts';
import { messageOf } from './message.ts';
import { readYaml } from './yaml.ts';

export interface SlotsActions {
  name: string;
  hass: HomeAssistant | undefined;
  open: Map<string, boolean>;
  areas: readonly { value: string; label: string }[];
  shipped: Template | undefined;
  update: (next: WrittenTemplate, drawing: Drawing) => void;
  redraw: () => void;
}

const KINDS: readonly Kind[] = [
  'text',
  'texts',
  'number',
  'icon',
  'flag',
  'entity',
  'entities',
  'object',
  'objects',
];
const AREA_VALUES: readonly AreaValue[] = [
  'area.name',
  'area.icon',
  'area.id',
  'area.temperature',
  'area.humidity',
];
const ENERGY_VALUES: readonly EnergyValue[] = Object.keys(ENERGY_WORDS).filter(isEnergyValue);
const CATEGORIES = ['none', 'diagnostic', 'config'];

type Said = PanelWords['slots'];

const saidOf = (hass: HomeAssistant | undefined): Said =>
  panelWordsFor(hass?.locale.language).slots;
const LISTS: readonly Kind[] = ['object', 'objects'];
const SLOT_NAME = /^[a-z_][a-z0-9_]*$/;

type Mode = 'area' | 'energy' | 'find' | 'per' | 'fields';

const isAreaValue = (rule: Rule): rule is AreaValue =>
  typeof rule === 'string' && rule.startsWith('area.');
const isEnergyRule = (rule: Rule): rule is EnergyValue =>
  typeof rule === 'string' && isEnergyValue(rule);

const FILTER_KEYS = new Set<string>(['domain', ...TEXT_FILTERS, 'scope']);

function isFilter(value: Readonly<Record<string, Value>>): boolean {
  return Object.entries(value).every(([key, inner]) => {
    if (key === 'exclude') {
      return isMapping(inner) && isFilter(inner);
    }
    if (key === 'attribute') {
      return isMapping(inner) && Object.values(inner).every((each) => typeof each === 'string');
    }
    return FILTER_KEYS.has(key) && typeof inner === 'string';
  });
}

const isAnchor = (value: Value | undefined): boolean =>
  value === undefined ||
  (Array.isArray(value)
    ? value.every((each) => isMapping(each) && isFilter(each))
    : isMapping(value) && isFilter(value));

function isRule(value: unknown): value is Rule {
  if (typeof value === 'string') {
    return AREA_VALUES.some((each) => each === value) || isEnergyValue(value);
  }
  if (Array.isArray(value)) {
    return value.every(isRule);
  }
  if (!isMapping(value)) {
    return false;
  }
  const fields = value['fields'];
  if (fields !== undefined) {
    return isMapping(fields) && Object.values(fields).every(isRule) && isAnchor(value['device']);
  }
  return isFilter(value);
}
const isPer = (rule: Rule): rule is ObjectsRule => isMapping(rule) && 'per' in rule;
const isFind = (rule: Rule): rule is FilterRule =>
  !Array.isArray(rule) && typeof rule !== 'string' && !('fields' in rule);

function modeOf(rule: Rule): Mode {
  if (isAreaValue(rule)) {
    return 'area';
  }
  if (isEnergyRule(rule)) {
    return 'energy';
  }
  if (isPer(rule)) {
    return 'per';
  }
  return isMapping(rule) && 'fields' in rule ? 'fields' : 'find';
}

function alternatives(spec: WrittenSlot): Rule[] {
  const rule = spec.discover;
  if (rule === undefined) {
    return [];
  }
  return Array.isArray(rule) ? rule : [rule];
}

function withRules(spec: WrittenSlot, rules: readonly Rule[]): WrittenSlot {
  const { discover: _old, ...rest } = spec;
  if (rules.length === 0) {
    return rest;
  }
  return { ...rest, discover: rules.length === 1 ? (rules[0] ?? []) : [...rules] };
}

function starterRule(kind: Kind, mode: Mode): Rule {
  if (mode === 'area') {
    return kind === 'entity' ? 'area.temperature' : 'area.name';
  }
  if (mode === 'energy') {
    return kind === 'objects' ? 'energy.devices' : 'energy.grid_power';
  }
  if (mode === 'per') {
    return { per: 'device', fields: {} };
  }
  if (mode === 'fields') {
    return { fields: {} };
  }
  return { domain: kind === 'entity' || kind === 'entities' ? 'sensor' : 'light' };
}

interface Option {
  value: string;
  label: string;
}

const valueOf = (event: Event): string => {
  const value = field(event.target, 'value');
  return typeof value === 'string' ? value : '';
};

function choose(
  options: readonly Option[],
  value: string,
  label: string,
  changed: (value: string) => void,
  fixed = false,
): TemplateResult {
  return html`<select
    class="word"
    aria-label=${label}
    ?disabled=${fixed}
    .value=${live(value)}
    @change=${(event: Event) => {
      changed(valueOf(event));
    }}
  >
    ${options.map(
      (option) =>
        html`<option value=${option.value} ?selected=${option.value === value}>
          ${option.label}
        </option>`,
    )}
  </select>`;
}

let lists = 0;

function typed(
  value: string,
  label: string,
  list: readonly string[],
  changed: (value: string) => void,
): TemplateResult {
  lists += 1;
  const id = `list-${label.replaceAll(/\W+/g, '-')}-${lists}`;
  return html`<span class="word-box"
    ><input
      class="word"
      .value=${value}
      aria-label=${label}
      placeholder=${label}
      list=${id}
      @change=${(event: Event) => {
        changed(valueOf(event).trim());
      }}
    /><datalist id=${id}>
      ${list.map((item) => html`<option value=${item}></option>`)}
    </datalist></span
  >`;
}

function known(hass: HomeAssistant | undefined): {
  domains: string[];
  classes: (domain: string | undefined) => string[];
  platforms: string[];
} {
  const states = Object.values(hass?.states ?? {});
  const domains = [...new Set(states.map((state) => state.entity_id.split('.')[0] ?? ''))]
    .filter(Boolean)
    .toSorted();
  const platforms = [
    ...new Set(Object.values(hass?.entities ?? {}).map((entry) => entry.platform ?? '')),
  ]
    .filter(Boolean)
    .toSorted();
  return {
    domains,
    platforms,
    classes: (domain) =>
      [
        ...new Set(
          states
            .filter((state) => domain === undefined || state.entity_id.startsWith(`${domain}.`))
            .map((state) => state.attributes['device_class'])
            .filter((value): value is string => typeof value === 'string'),
        ),
      ].toSorted(),
  };
}

function drawFind(
  rule: FilterRule,
  kind: Kind,
  hass: HomeAssistant | undefined,
  set: (rule: Rule) => void,
): TemplateResult[] {
  const facts = known(hass);
  const said = saidOf(hass);
  const words: TemplateResult[] = [
    html`<span>${kind === 'entities' ? said.every : said.theFirst}</span>`,
    typed(rule.domain ?? '', said.filterFields.domain, facts.domains, (domain) => {
      const { domain: _old, ...rest } = rule;
      set(domain === '' ? rest : { ...rest, domain });
    }),
  ];
  for (const key of TEXT_FILTERS) {
    const value = rule[key];
    if (value === undefined) {
      continue;
    }
    const list =
      key === 'device_class'
        ? facts.classes(rule.domain)
        : key === 'platform'
          ? facts.platforms
          : key === 'entity_category'
            ? CATEGORIES
            : [];
    words.push(
      html`<span>${said.filters[key]}</span>`,
      typed(value, said.filterFields[key], list, (next) => {
        const { [key]: _old, ...rest } = rule;
        set(next === '' ? rest : { ...rest, [key]: next });
      }),
    );
  }
  words.push(
    html`<span>${said.in}</span>`,
    choose(
      [
        { value: 'area', label: said.theArea },
        { value: 'all', label: said.wholeHome },
      ],
      rule.scope ?? 'area',
      said.where,
      (scope) => {
        const { scope: _old, ...rest } = rule;
        set(scope === 'all' ? { ...rest, scope: 'all' } : rest);
      },
    ),
  );
  for (const key of TEXT_FILTERS) {
    if (rule[key] === undefined) {
      words.push(
        html`<button
          type="button"
          class="chip"
          aria-label=${said.addFilter(said.filters[key])}
          title=${said.addFilter(said.filters[key])}
          @click=${() => {
            set({ ...rule, [key]: '' });
          }}
        >
          ${icon('mdi:plus')}<span>${said.filters[key]}</span>
        </button>`,
      );
    }
  }
  return words;
}

function drawYamlRule(
  rule: Rule,
  set: (rule: Rule) => void,
  redraw: () => void,
  said: Said,
): TemplateResult {
  let problem = '';
  return html`<div class="rule-yaml">
    <textarea
      class="yaml-text small"
      aria-label=${said.ruleYaml}
      .value=${toYaml(rule)}
      @change=${(event: Event) => {
        try {
          const read = readYaml(valueOf(event));
          if (isRule(read)) {
            set(read);
            return;
          }
          problem = said.notRule;
        } catch (error) {
          problem = messageOf(error);
        }
        const target = event.target;
        if (target instanceof HTMLElement) {
          target.title = problem;
          target.setAttribute('aria-invalid', 'true');
        }
        redraw();
      }}
    ></textarea>
  </div>`;
}

function drawRule(
  rule: Rule,
  kind: Kind,
  actions: SlotsActions,
  set: (rule: Rule) => void,
  remove: () => void,
): TemplateResult {
  const mode = modeOf(rule);
  const said = saidOf(actions.hass);
  const modes: Option[] = [
    { value: 'area', label: said.modes.area },
    { value: 'energy', label: said.modes.energy },
    { value: 'find', label: said.modes.find },
    ...(kind === 'objects' ? [{ value: 'per', label: said.modes.per }] : []),
    ...(kind === 'object' ? [{ value: 'fields', label: said.modes.fields }] : []),
  ];
  const areaOptions = AREA_VALUES.map((value) => ({ value, label: said.areaValues[value] }));
  const energyOptions = ENERGY_VALUES.map((value) => ({ value, label: said.energyValues[value] }));
  const rest = isAreaValue(rule)
    ? [
        choose(areaOptions, rule, said.areaValue, (next) => {
          const found = AREA_VALUES.find((each) => each === next);
          if (found !== undefined) {
            set(found);
          }
        }),
      ]
    : isEnergyRule(rule)
      ? [
          choose(energyOptions, rule, said.energyValue, (next) => {
            const found = ENERGY_VALUES.find((each) => each === next);
            if (found !== undefined) {
              set(found);
            }
          }),
        ]
      : isPer(rule)
        ? [
            choose(
              [
                { value: 'device', label: said.perDevice },
                { value: 'area', label: said.perArea },
              ],
              rule.per,
              said.per,
              (per) => {
                set({ ...rule, per: per === 'area' ? 'area' : 'device' });
              },
            ),
            html`<span class="muted">${said.withFields}</span>`,
            drawYamlRule(rule, set, actions.redraw, said),
          ]
        : isMapping(rule) && 'fields' in rule
          ? [drawYamlRule(rule, set, actions.redraw, said)]
          : isFind(rule)
            ? rule.attribute === undefined
              ? drawFind(rule, kind, actions.hass, set)
              : [drawYamlRule(rule, set, actions.redraw, said)]
            : [];
  return html`<div class="sentence">
    ${choose(modes, mode, said.how, (next) => {
      set(
        starterRule(
          kind,
          next === 'area' || next === 'energy' || next === 'per' || next === 'fields'
            ? next
            : 'find',
        ),
      );
    })}
    ${rest}
    <button
      type="button"
      class="icon-button"
      aria-label=${said.removeRule}
      title=${said.removeRule}
      @click=${remove}
    >
      ${icon('mdi:close')}
    </button>
  </div>`;
}

function describeFound(value: Value | undefined, hass: HomeAssistant | undefined): string {
  if (value === undefined) {
    return saidOf(hass).nothing;
  }
  const named = (item: Value): string => {
    if (typeof item === 'string' && hass?.states[item] !== undefined) {
      const friendly = hass.states[item]?.attributes['friendly_name'];
      return typeof friendly === 'string' ? `${item} (${friendly})` : item;
    }
    return typeof item === 'string' ? item : JSON.stringify(item);
  };
  return Array.isArray(value)
    ? value.length === 0
      ? saidOf(hass).nothing
      : value.map(named).join(', ')
    : named(value);
}

function matchesOf(step: Step, said: Said): string {
  return said.matches(step.candidates.length, step.picked, step.tied?.slice(1) ?? []);
}

function drawTrace(trace: Trace, said: Said): TemplateResult {
  return html`<ul class="trace">
    ${trace.steps.map(
      (step) =>
        html`<li>
          ${step.field === '' ? nothing : html`<b>${step.field}</b>: `}${step.rule}${
            step.filter === undefined && step.candidates.length === 0 && step.picked.length === 0
              ? nothing
              : html`: ${matchesOf(step, said)}`
          }
          ${
            step.near.length === 0
              ? nothing
              : html`<ul class="near">
                  ${step.near.map(
                    (near) => html`<li>${near.entity_id} ${said.both(near.why)}</li>`,
                  )}
                </ul>`
          }
        </li>`,
    )}
    ${trace.reason === undefined ? nothing : html`<li class="reason">${trace.reason}</li>`}
  </ul>`;
}

function drawTrial(
  name: string,
  spec: SlotSpec,
  actions: SlotsActions,
): TemplateResult | typeof nothing {
  const hass = actions.hass;
  if (hass === undefined || actions.areas.length === 0 || spec.discover === undefined) {
    return nothing;
  }
  const key = `trial:${name}`;
  const chosen =
    [...actions.open.keys()].find((each) => each.startsWith(`${key}=`))?.slice(key.length + 1) ??
    actions.areas[0]?.value ??
    '';
  const trace = explain({ card: {}, slots: { [name]: spec } }, chosen, registriesOf(hass))[name];
  const said = saidOf(hass);
  return html`<div class="trial">
    <span class="muted">${said.trialIn}</span>
    ${choose(actions.areas, chosen, said.tryIn, (where) => {
      for (const each of [...actions.open.keys()].filter((item) => item.startsWith(`${key}=`))) {
        actions.open.delete(each);
      }
      actions.open.set(`${key}=${where}`, true);
      actions.redraw();
    })}
    <span class="found">${said.finds(describeFound(trace?.value, hass))}</span>
    ${trace === undefined ? nothing : drawTrace(trace, said)}
  </div>`;
}

function parseDefault(kind: Kind, text: string): Value | undefined {
  if (text.trim() === '') {
    return undefined;
  }
  return kind === 'text' || kind === 'icon' || kind === 'entity' ? text : readYaml(text);
}

function oneLine(value: Value | undefined): string {
  return value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
}

type SlotKey = 'label' | 'help' | 'group' | 'required' | 'default' | 'fields';

type Edit = (slot: WrittenSlot) => WrittenSlot;

const without =
  (key: SlotKey): Edit =>
  (slot) => {
    const next = { ...slot };
    Reflect.deleteProperty(next, key);
    return next;
  };

const hashOf = (value: unknown): string =>
  nodeHash(value === undefined ? undefined : toValue(value));

function overrideOf(base: SlotSpec, wanted: WrittenSlot): WrittenSlot {
  const { kind, required, default: value, discover, label, help, group } = wanted;
  const fields = Object.fromEntries(
    Object.entries(base.fields ?? {}).flatMap(([field, inner]): [string, WrittenSlot][] => {
      const asked = wanted.fields?.[field];
      const change = asked === undefined ? {} : overrideOf(inner, asked);
      return Object.keys(change).length === 0 ? [] : [[field, change]];
    }),
  );
  return {
    ...(kind === undefined || kind === base.kind ? {} : { kind }),
    ...(required === true && base.required !== true ? { required } : {}),
    ...(value === undefined || hashOf(value) === hashOf(base.default) ? {} : { default: value }),
    ...(discover === undefined || hashOf(discover) === hashOf(base.discover) ? {} : { discover }),
    ...(label === undefined || label === base.label ? {} : { label }),
    ...(help === undefined || help === base.help ? {} : { help }),
    ...(group === undefined || group === base.group ? {} : { group }),
    ...(Object.keys(fields).length === 0 ? {} : { fields }),
  };
}

function drawDelete(label: string, remove: () => void, said: Said): TemplateResult {
  return html`<button
    type="button"
    class="icon-button"
    aria-label=${said.deleteSlot(label)}
    title=${said.deleteSlot(label)}
    @click=${remove}
  >
    ${icon('mdi:delete-outline')}
  </button>`;
}

interface Editing {
  name: string;
  spec: SlotSpec;
  floor: SlotSpec | undefined;
  now: () => WrittenSlot;
  current: () => SlotSpec;
  apply: (edit: Edit, drawing: Drawing) => void;
  actions: SlotsActions;
}

function drawHead(
  editing: Editing,
  changed: boolean,
  remove: (() => void) | undefined,
): TemplateResult {
  const { name, spec } = editing;
  const said = saidOf(editing.actions.hass);
  const shape = editing.now().shape;
  const label = slotLabel(name, spec);
  return html`<div class="slot-head">
    <span class="slot-label">${label}</span>
    <code class="slot-name">${name}</code>
    <span class="muted">${spec.kind}</span>
    ${shape === undefined ? nothing : html`<span class="muted">${said.shape(shape, spec.kind === 'objects')}</span>`}
    ${spec.required === true ? html`<span class="badge">${said.required}</span>` : nothing}
    ${changed ? html`<span class="badge changed">${said.changed}</span>` : nothing}
    ${remove === undefined ? nothing : drawDelete(label, remove, said)}
  </div>`;
}

function drawKind(editing: Editing, kinds: readonly Kind[]): TemplateResult {
  const said = saidOf(editing.actions.hass);
  return html`<label class="fact"
    ><span class="fact-label">${said.kind}</span>${choose(
      kinds.map((kind) => ({ value: kind, label: kind })),
      editing.spec.kind,
      said.kind,
      (kind) => {
        const found = kinds.find((each) => each === kind);
        if (found !== undefined) {
          editing.apply((slot) => ({ ...slot, kind: found }), REDRAW);
        }
      },
      kinds.length < 2,
    )}</label
  >`;
}

function drawText(
  editing: Editing,
  key: 'label' | 'help' | 'group',
  label: string,
): TemplateResult {
  const { spec, apply } = editing;
  const shaped = editing.floor?.[key];
  return html`<label class="fact"
    ><span class="fact-label">${label}</span
    ><input
      class="fact-input"
      aria-label=${label}
      .value=${spec[key] === shaped ? '' : (spec[key] ?? '')}
      .placeholder=${shaped ?? ''}
      @change=${(event: Event) => {
        const next = valueOf(event).trim();
        apply(next === '' ? without(key) : (slot) => ({ ...slot, [key]: next }), IN_PLACE);
        if (next === shaped && event.target instanceof HTMLInputElement) {
          event.target.value = '';
        }
      }}
  /></label>`;
}

function drawRequired(editing: Editing): TemplateResult {
  const said = saidOf(editing.actions.hass);
  return html`<label class="fact"
    ><span class="fact-label">${said.requiredLabel}</span
    ><input
      type="checkbox"
      aria-label=${said.requiredLabel}
      ?disabled=${editing.floor?.required === true}
      .checked=${editing.spec.required === true}
      @change=${(event: Event) => {
        editing.apply(
          field(event.target, 'checked') === true
            ? (slot) => ({ ...slot, required: true })
            : without('required'),
          REDRAW,
        );
      }}
  /></label>`;
}

function drawDefault(editing: Editing): TemplateResult {
  const { spec, current, apply } = editing;
  const shapedDefault = editing.floor?.default;
  const fallback = hashOf(spec.default) === hashOf(shapedDefault) ? '' : oneLine(spec.default);
  const said = saidOf(editing.actions.hass);
  return html`<label class="fact"
    ><span class="fact-label">${said.default}</span
    ><input
      class="fact-input"
      aria-label=${said.default}
      .value=${fallback}
      .placeholder=${oneLine(shapedDefault)}
      @change=${(event: Event) => {
        const target = event.target;
        try {
          const value = parseDefault(current().kind, valueOf(event));
          apply(
            value === undefined ? without('default') : (slot) => ({ ...slot, default: value }),
            IN_PLACE,
          );
          if (target instanceof HTMLInputElement) {
            target.setCustomValidity('');
            if (value !== undefined && hashOf(value) === hashOf(shapedDefault)) {
              target.value = '';
            }
          }
        } catch (error) {
          if (target instanceof HTMLInputElement) {
            target.setCustomValidity(messageOf(error));
            target.reportValidity();
          }
        }
      }}
  /></label>`;
}

function drawFacts(editing: Editing, kinds: readonly Kind[], depth: number): TemplateResult {
  const said = saidOf(editing.actions.hass);
  return html`<div class="slot-facts">
    ${drawKind(editing, kinds)} ${drawText(editing, 'label', said.label)}
    ${drawText(editing, 'help', said.help)}
    ${depth === 0 ? drawText(editing, 'group', said.group) : nothing} ${drawRequired(editing)}
    ${drawDefault(editing)}
  </div>`;
}

function drawFinding(editing: Editing): TemplateResult {
  const { name, spec, actions, apply } = editing;
  const said = saidOf(actions.hass);
  const rules = alternatives(spec);
  const more = rules.length === 0 ? said.findIt : said.orElseFind;
  return html`<div class="finding">
    <h4>${rules.length === 0 ? said.byHand : said.foundBy}</h4>
    ${rules.map(
      (rule, index) =>
        html`${index > 0 ? html`<div class="or">${said.orElse}</div>` : nothing}${drawRule(
          rule,
          spec.kind,
          actions,
          (next) => {
            apply(
              (slot) =>
                withRules(
                  slot,
                  alternatives(slot).map((each, at) => (at === index ? next : each)),
                ),
              REDRAW,
            );
          },
          () => {
            apply(
              (slot) =>
                withRules(
                  slot,
                  alternatives(slot).filter((_each, at) => at !== index),
                ),
              REDRAW,
            );
          },
        )}`,
    )}
    <button
      type="button"
      class="chip"
      aria-label=${more}
      title=${more}
      @click=${() => {
        apply(
          (slot) =>
            withRules(slot, [
              ...alternatives(slot),
              starterRule(spec.kind, spec.kind === 'objects' ? 'per' : 'find'),
            ]),
          REDRAW,
        );
      }}
    >
      ${icon('mdi:magnify')}<span>${more}</span>
    </button>
    ${drawTrial(name, spec, actions)}
  </div>`;
}

function drawFields(
  editing: Editing,
  shipped: SlotSpec | undefined,
  depth: number,
): TemplateResult | typeof nothing {
  const { floor, now, current, apply } = editing;
  if (!LISTS.includes(editing.spec.kind)) {
    return nothing;
  }
  return html`<div class="fields">
    <h4>${saidOf(editing.actions.hass).fields}</h4>
    ${drawSlotList(
      () => (floor === undefined ? now().fields : current().fields) ?? {},
      shipped?.fields,
      editing.actions,
      (next, drawing) => {
        apply(
          Object.keys(next).length === 0
            ? without('fields')
            : (slot) => ({ ...slot, fields: next }),
          drawing,
        );
      },
      depth + 1,
      floor === undefined ? undefined : (floor.fields ?? {}),
    )}
  </div>`;
}

function kindsOf(
  spec: SlotSpec,
  base: SlotSpec | undefined,
  within: SlotSpec | undefined,
): readonly Kind[] {
  if (within !== undefined) {
    return [spec.kind];
  }
  if (base === undefined) {
    return KINDS;
  }
  return LISTS.includes(base.kind) ? LISTS : [base.kind];
}

function drawSlot(
  name: string,
  now: () => WrittenSlot,
  shipped: SlotSpec | undefined,
  actions: SlotsActions,
  set: (spec: WrittenSlot | undefined, drawing: Drawing) => void,
  depth: number,
  within: SlotSpec | undefined,
): TemplateResult {
  const remove = (): void => {
    set(undefined, REDRAW);
  };
  let spec: SlotSpec;
  try {
    spec = slotOf(actions.name, name, now());
  } catch (error) {
    return html`<section class="slot">
      <div class="slot-head">
        <span class="slot-label">${slotLabel(name, now())}</span
        ><code class="slot-name">${name}</code>${drawDelete(
          slotLabel(name, now()),
          remove,
          saidOf(actions.hass),
        )}
      </div>
      <p class="problem-line">${messageOf(error)}</p>
    </section>`;
  }
  const shape = now().shape;
  const base = shape === undefined ? undefined : slotOf(actions.name, name, { shape });
  const current = (): SlotSpec => {
    try {
      return slotOf(actions.name, name, now());
    } catch {
      return spec;
    }
  };
  const editing: Editing = {
    name,
    spec,
    floor: within ?? base,
    now,
    current,
    apply: (edit, drawing) => {
      set(
        shape === undefined || base === undefined
          ? edit(now())
          : { shape, ...overrideOf(base, edit(current())) },
        drawing,
      );
    },
    actions,
  };
  const changed =
    actions.shipped !== undefined && (shipped === undefined || hashOf(shipped) !== hashOf(spec));
  return html`<section class="slot">
    ${drawHead(editing, changed, within === undefined ? remove : undefined)}
    ${drawFacts(editing, kindsOf(spec, base, within), depth)} ${drawFinding(editing)}
    ${drawFields(editing, shipped, depth)}
  </section>`;
}

function drawAdd(
  names: readonly string[],
  add: (name: string, kind: Kind) => void,
  said: Said,
): TemplateResult {
  return html`<div class="add-slot">
    <input
      class="fact-input"
      placeholder="new_slot"
      aria-label=${said.newSlot}
      @input=${(event: Event) => {
        if (event.target instanceof HTMLInputElement) {
          event.target.setCustomValidity('');
        }
      }}
    />
    <select class="word" aria-label=${said.itsKind}>
      ${KINDS.map((each) => html`<option value=${each}>${each}</option>`)}
    </select>
    <button
      type="button"
      class="action"
      aria-label=${said.addSlot}
      title=${said.addSlot}
      @click=${(event: Event) => {
        const box =
          event.currentTarget instanceof HTMLElement ? event.currentTarget.parentElement : null;
        const input = box?.querySelector('input');
        const picked = box?.querySelector('select')?.value;
        const wanted = input?.value.trim() ?? '';
        if (!SLOT_NAME.test(wanted) || names.includes(wanted)) {
          input?.setCustomValidity(names.includes(wanted) ? said.taken : said.nameRule);
          input?.reportValidity();
          return;
        }
        add(wanted, KINDS.find((each) => each === picked) ?? 'text');
      }}
    >
      ${said.add}
    </button>
  </div>`;
}

function groupOf(name: string, slot: string, spec: WrittenSlot): string | undefined {
  try {
    return slotOf(name, slot, spec).group;
  } catch {
    return spec.group;
  }
}

function drawSlotList(
  now: () => Readonly<Record<string, WrittenSlot>>,
  shipped: Readonly<Record<string, SlotSpec>> | undefined,
  actions: SlotsActions,
  set: (next: Record<string, WrittenSlot>, drawing: Drawing) => void,
  depth: number,
  within: Readonly<Record<string, SlotSpec>> | undefined,
): TemplateResult {
  const slots = now();
  const said = saidOf(actions.hass);
  const groups = new Map<string, [string, WrittenSlot][]>();
  for (const entry of Object.entries(slots)) {
    const group = depth === 0 ? (groupOf(actions.name, ...entry) ?? said.basics) : '';
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }
  return html`<div class="slot-list">
    ${[...groups].map(
      ([group, entries]) =>
        html`${group === '' ? nothing : html`<h3 class="slot-group">${group}</h3>`}${entries.map(
          ([name, spec]) =>
            drawSlot(
              name,
              () => now()[name] ?? spec,
              shipped?.[name],
              actions,
              (next, drawing) => {
                set(
                  Object.fromEntries(
                    Object.entries(now()).flatMap(([each, inner]) =>
                      each !== name ? [[each, inner]] : next === undefined ? [] : [[each, next]],
                    ),
                  ),
                  drawing,
                );
              },
              depth,
              within?.[name],
            ),
        )}`,
    )}
    ${
      within === undefined
        ? drawAdd(
            Object.keys(slots),
            (name, kind) => {
              set({ ...now(), [name]: { kind } }, REDRAW);
            },
            said,
          )
        : nothing
    }
  </div>`;
}

export function drawSlots(now: () => WrittenTemplate, actions: SlotsActions): TemplateResult {
  return html`<div class="slots-tab">
    <p class="muted">${saidOf(actions.hass).about}</p>
    ${drawSlotList(
      () => now().slots ?? {},
      actions.shipped?.slots,
      actions,
      (next, drawing) => {
        const { slots: _old, ...rest } = now();
        actions.update(Object.keys(next).length === 0 ? rest : { ...rest, slots: next }, drawing);
      },
      0,
      undefined,
    )}
  </div>`;
}

export const SLOTS_STYLE = css`
  .slot-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .slot-group {
    margin: 12px 0 0;
    font-size: 14px;
    font-weight: 600;
  }
  .slot {
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--card-background-color);
  }
  .slot-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .slot-head .icon-button {
    margin-inline-start: auto;
  }
  .slot-label {
    font-size: 15px;
    font-weight: 500;
  }
  .slot-name {
    font-family: var(--ha-font-family-code, monospace);
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .slot-facts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px 16px;
    align-items: start;
  }
  .fact {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    color: var(--secondary-text-color);
  }
  .fact input[type='checkbox'] {
    width: 20px;
    height: 20px;
    margin: 6px 0;
    accent-color: var(--primary-color);
  }
  .finding {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--divider-color);
  }
  .finding > .sentence,
  .finding > .trial {
    align-self: stretch;
  }
  .finding h4,
  .fields h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .sentence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .word-box input {
    width: 140px;
  }
  .or {
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .trial {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .found {
    color: var(--primary-text-color);
  }
  .trace {
    flex-basis: 100%;
    margin: 0;
    padding-inline-start: 18px;
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .trace .near {
    margin: 2px 0 4px;
    padding-inline-start: 16px;
  }
  .trace .reason {
    color: var(--primary-text-color);
  }
  .fields {
    padding-inline-start: 12px;
    border-inline-start: 2px solid var(--divider-color);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .add-slot {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
`;
