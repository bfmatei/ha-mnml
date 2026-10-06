import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';

import { isMapping } from '../contract/templates.ts';
import type {
  AreaValue,
  FilterRule,
  Kind,
  ObjectsRule,
  Rule,
  SlotSpec,
  Template,
  Value,
} from '../contract/templates.ts';
import { toYaml } from '../contract/yaml.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import { nodeHash } from '../templates/changes.ts';
import { discover } from '../templates/discover.ts';
import { toValue } from '../templates/expand.ts';

import { readYaml } from './yaml.ts';

export interface SlotsActions {
  hass: HomeAssistant | undefined;
  open: Map<string, boolean>;
  areas: readonly { value: string; label: string }[];
  shipped: Template | undefined;
  update: (next: Template, redraw: boolean) => void;
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
const AREA_VALUES: readonly { value: AreaValue; label: string }[] = [
  { value: 'area.name', label: 'name' },
  { value: 'area.icon', label: 'icon' },
  { value: 'area.id', label: 'id' },
  { value: 'area.temperature', label: 'temperature sensor' },
  { value: 'area.humidity', label: 'humidity sensor' },
];
const FILTERS = [
  { key: 'device_class', words: 'with device class' },
  { key: 'platform', words: 'from the integration' },
  { key: 'translation_key', words: 'with translation key' },
] as const;
const SLOT_NAME = /^[a-z_][a-z0-9_]*$/;

type Mode = 'area' | 'find' | 'per' | 'fields';

const isAreaValue = (rule: Rule): rule is AreaValue => typeof rule === 'string';

const FILTER_KEYS = new Set(['domain', 'device_class', 'platform', 'translation_key', 'scope']);

function isRule(value: unknown): value is Rule {
  if (typeof value === 'string') {
    return AREA_VALUES.some((each) => each.value === value);
  }
  if (Array.isArray(value)) {
    return value.every(isRule);
  }
  if (!isMapping(value)) {
    return false;
  }
  const fields = value['fields'];
  if (fields !== undefined) {
    return isMapping(fields) && Object.values(fields).every(isRule);
  }
  return Object.entries(value).every(
    ([key, inner]) => FILTER_KEYS.has(key) && typeof inner === 'string',
  );
}
const isPer = (rule: Rule): rule is ObjectsRule => isMapping(rule) && 'per' in rule;
const isFind = (rule: Rule): rule is FilterRule =>
  !Array.isArray(rule) && typeof rule !== 'string' && !('fields' in rule);

function modeOf(rule: Rule): Mode {
  if (isAreaValue(rule)) {
    return 'area';
  }
  if (isPer(rule)) {
    return 'per';
  }
  return isMapping(rule) && 'fields' in rule ? 'fields' : 'find';
}

function alternatives(spec: SlotSpec): Rule[] {
  const rule = spec.discover;
  if (rule === undefined) {
    return [];
  }
  return Array.isArray(rule) ? rule : [rule];
}

function withRules(spec: SlotSpec, rules: readonly Rule[]): SlotSpec {
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
): TemplateResult {
  return html`<select
    class="word"
    aria-label=${label}
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
  const words: TemplateResult[] = [
    html`<span>${kind === 'entities' ? 'every' : 'the first'}</span>`,
    typed(rule.domain ?? '', 'domain', facts.domains, (domain) => {
      const { domain: _old, ...rest } = rule;
      set(domain === '' ? rest : { ...rest, domain });
    }),
  ];
  for (const filter of FILTERS) {
    const value = rule[filter.key];
    if (value === undefined) {
      continue;
    }
    const list =
      filter.key === 'device_class'
        ? facts.classes(rule.domain)
        : filter.key === 'platform'
          ? facts.platforms
          : [];
    words.push(
      html`<span>${filter.words}</span>`,
      typed(value, filter.key.replace('_', ' '), list, (next) => {
        const { [filter.key]: _old, ...rest } = rule;
        set(next === '' ? rest : { ...rest, [filter.key]: next });
      }),
    );
  }
  words.push(
    html`<span>in</span>`,
    choose(
      [
        { value: 'area', label: 'the area' },
        { value: 'all', label: 'the whole home' },
      ],
      rule.scope ?? 'area',
      'where',
      (scope) => {
        const { scope: _old, ...rest } = rule;
        set(scope === 'all' ? { ...rest, scope: 'all' } : rest);
      },
    ),
  );
  for (const filter of FILTERS) {
    if (rule[filter.key] === undefined) {
      words.push(
        html`<button
          type="button"
          class="chip"
          aria-label=${`Add: ${filter.words}`}
          title=${`Add: ${filter.words}`}
          @click=${() => {
            set({ ...rule, [filter.key]: '' });
          }}
        >
          ${icon('mdi:plus')}<span>${filter.words}</span>
        </button>`,
      );
    }
  }
  return words;
}

function drawYamlRule(rule: Rule, set: (rule: Rule) => void, redraw: () => void): TemplateResult {
  let problem = '';
  return html`<div class="rule-yaml">
    <textarea
      class="yaml-text small"
      aria-label="The rule in YAML"
      .value=${toYaml(rule)}
      @change=${(event: Event) => {
        try {
          const read = readYaml(valueOf(event));
          if (isRule(read)) {
            set(read);
            return;
          }
          problem = 'not a rule: see the rules in the templates guide';
        } catch (error) {
          problem = error instanceof Error ? error.message : String(error);
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
  const modes: Option[] = [
    { value: 'area', label: "Use the area's" },
    { value: 'find', label: 'Find' },
    ...(kind === 'objects' ? [{ value: 'per', label: 'Make one' }] : []),
    ...(kind === 'object' ? [{ value: 'fields', label: 'Fill the fields' }] : []),
  ];
  const rest = isAreaValue(rule)
    ? [
        choose(AREA_VALUES, rule, "the area's value", (next) => {
          const found = AREA_VALUES.find((each) => each.value === next);
          if (found !== undefined) {
            set(found.value);
          }
        }),
      ]
    : isPer(rule)
      ? [
          choose(
            [
              { value: 'device', label: 'per device' },
              { value: 'area', label: 'per area' },
            ],
            rule.per,
            'per',
            (per) => {
              set({ ...rule, per: per === 'area' ? 'area' : 'device' });
            },
          ),
          html`<span class="muted">with these fields:</span>`,
          drawYamlRule(rule, set, actions.redraw),
        ]
      : isMapping(rule) && 'fields' in rule
        ? [drawYamlRule(rule, set, actions.redraw)]
        : isFind(rule)
          ? drawFind(rule, kind, actions.hass, set)
          : [];
  return html`<div class="sentence">
    ${choose(modes, mode, 'how', (next) => {
      set(
        starterRule(kind, next === 'area' || next === 'per' || next === 'fields' ? next : 'find'),
      );
    })}
    ${rest}
    <button
      type="button"
      class="icon-button"
      aria-label="Remove this way of finding it"
      title="Remove this way of finding it"
      @click=${remove}
    >
      ${icon('mdi:close')}
    </button>
  </div>`;
}

function describeFound(value: Value | undefined, hass: HomeAssistant | undefined): string {
  if (value === undefined) {
    return 'nothing';
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
      ? 'nothing'
      : value.map(named).join(', ')
    : named(value);
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
  const found = discover({ card: {}, slots: { [name]: spec } }, chosen, {
    areas: hass.areas,
    devices: hass.devices,
    entities: hass.entities,
    states: hass.states,
  });
  return html`<div class="trial">
    <span class="muted">In</span>
    ${choose(actions.areas, chosen, 'Try it in', (where) => {
      for (const each of [...actions.open.keys()].filter((item) => item.startsWith(`${key}=`))) {
        actions.open.delete(each);
      }
      actions.open.set(`${key}=${where}`, true);
      actions.redraw();
    })}
    <span class="found">it finds ${describeFound(found[name], hass)}</span>
  </div>`;
}

function parseDefault(kind: Kind, text: string): Value | undefined {
  if (text.trim() === '') {
    return undefined;
  }
  return kind === 'text' || kind === 'icon' || kind === 'entity' ? text : readYaml(text);
}

type SlotKey = 'label' | 'help' | 'group' | 'required' | 'default' | 'fields';

function drawSlot(
  name: string,
  now: () => SlotSpec,
  shipped: SlotSpec | undefined,
  actions: SlotsActions,
  set: (spec: SlotSpec | undefined, redraw: boolean) => void,
  depth: number,
): TemplateResult {
  const spec = now();
  const changed =
    actions.shipped !== undefined &&
    (shipped === undefined || nodeHash(toValue(shipped)) !== nodeHash(toValue(spec)));
  const without = (key: SlotKey): SlotSpec => {
    const next: SlotSpec = { ...now() };
    Reflect.deleteProperty(next, key);
    return next;
  };
  const text = (
    value: string | undefined,
    label: string,
    apply: (next: string) => SlotSpec,
  ): TemplateResult =>
    html`<label class="fact"
      ><span class="fact-label">${label}</span
      ><input
        class="fact-input"
        aria-label=${label}
        .value=${value ?? ''}
        @change=${(event: Event) => {
          set(apply(valueOf(event).trim()), false);
        }}
    /></label>`;
  const fallback =
    spec.default === undefined
      ? ''
      : typeof spec.default === 'string'
        ? spec.default
        : toYaml(spec.default).trim();
  const rules = alternatives(spec);
  return html`<section class="slot">
    <div class="slot-head">
      <code class="slot-name">${name}</code>
      <span class="muted">${spec.kind}</span>
      ${spec.required === true ? html`<span class="badge">required</span>` : nothing}
      ${changed ? html`<span class="badge changed">changed</span>` : nothing}
      <button
        type="button"
        class="icon-button"
        aria-label=${`Delete the slot ${name}`}
        title=${`Delete the slot ${name}`}
        @click=${() => {
          set(undefined, true);
        }}
      >
        ${icon('mdi:delete-outline')}
      </button>
    </div>
    <div class="slot-facts">
      <label class="fact"
        ><span class="fact-label">Kind</span>${choose(
          KINDS.map((kind) => ({ value: kind, label: kind })),
          spec.kind,
          'Kind',
          (kind) => {
            const found = KINDS.find((each) => each === kind);
            if (found !== undefined) {
              set({ ...now(), kind: found }, true);
            }
          },
        )}</label
      >
      ${text(spec.label, 'Label', (label) => (label === '' ? without('label') : { ...now(), label }))}
      ${text(spec.help, 'Help', (help) => (help === '' ? without('help') : { ...now(), help }))}
      ${
        depth === 0
          ? text(spec.group, 'Panel', (group) =>
              group === '' ? without('group') : { ...now(), group },
            )
          : nothing
      }
      <label class="fact"
        ><span class="fact-label">Required</span
        ><input
          type="checkbox"
          aria-label="Required"
          .checked=${spec.required === true}
          @change=${(event: Event) => {
            set(
              field(event.target, 'checked') === true
                ? { ...now(), required: true }
                : without('required'),
              true,
            );
          }}
      /></label>
      <label class="fact"
        ><span class="fact-label">Default</span
        ><input
          class="fact-input"
          aria-label="Default"
          .value=${fallback}
          @change=${(event: Event) => {
            const target = event.target;
            try {
              const value = parseDefault(now().kind, valueOf(event));
              set(value === undefined ? without('default') : { ...now(), default: value }, false);
              if (target instanceof HTMLInputElement) {
                target.setCustomValidity('');
              }
            } catch (error) {
              if (target instanceof HTMLInputElement) {
                target.setCustomValidity(error instanceof Error ? error.message : String(error));
                target.reportValidity();
              }
            }
          }}
      /></label>
    </div>
    <div class="finding">
      <h4>${rules.length === 0 ? 'Set by hand' : 'Found by'}</h4>
      ${rules.map(
        (rule, index) =>
          html`${index > 0 ? html`<div class="or">or else</div>` : nothing}${drawRule(
            rule,
            spec.kind,
            actions,
            (next) => {
              set(
                withRules(
                  now(),
                  alternatives(now()).map((each, at) => (at === index ? next : each)),
                ),
                true,
              );
            },
            () => {
              set(
                withRules(
                  now(),
                  alternatives(now()).filter((_each, at) => at !== index),
                ),
                true,
              );
            },
          )}`,
      )}
      <button
        type="button"
        class="chip"
        aria-label=${rules.length === 0 ? 'Find it' : 'Or else'}
        title=${rules.length === 0 ? 'Find it' : 'Or else'}
        @click=${() => {
          set(
            withRules(now(), [
              ...alternatives(now()),
              starterRule(spec.kind, spec.kind === 'objects' ? 'per' : 'find'),
            ]),
            true,
          );
        }}
      >
        ${icon('mdi:magnify')}<span>${rules.length === 0 ? 'Find it' : 'Or else'}</span>
      </button>
      ${drawTrial(name, spec, actions)}
    </div>
    ${
      spec.kind === 'object' || spec.kind === 'objects'
        ? html`<div class="fields">
            <h4>Fields</h4>
            ${drawSlotList(
              () => now().fields ?? {},
              shipped?.fields,
              actions,
              (next, redraw) => {
                set(
                  Object.keys(next).length === 0 ? without('fields') : { ...now(), fields: next },
                  redraw,
                );
              },
              depth + 1,
            )}
          </div>`
        : nothing
    }
  </section>`;
}

function drawAdd(
  names: readonly string[],
  add: (name: string, kind: Kind) => void,
): TemplateResult {
  return html`<div class="add-slot">
    <input
      class="fact-input"
      placeholder="new_slot"
      aria-label="The new slot"
      @input=${(event: Event) => {
        if (event.target instanceof HTMLInputElement) {
          event.target.setCustomValidity('');
        }
      }}
    />
    <select class="word" aria-label="Its kind">
      ${KINDS.map((each) => html`<option value=${each}>${each}</option>`)}
    </select>
    <button
      type="button"
      class="action"
      aria-label="Add the slot"
      title="Add the slot"
      @click=${(event: Event) => {
        const box =
          event.currentTarget instanceof HTMLElement ? event.currentTarget.parentElement : null;
        const input = box?.querySelector('input');
        const picked = box?.querySelector('select')?.value;
        const wanted = input?.value.trim() ?? '';
        if (!SLOT_NAME.test(wanted) || names.includes(wanted)) {
          input?.setCustomValidity(
            names.includes(wanted)
              ? 'A slot of that name is there already'
              : 'Lower case letters, digits and _',
          );
          input?.reportValidity();
          return;
        }
        add(wanted, KINDS.find((each) => each === picked) ?? 'text');
      }}
    >
      Add
    </button>
  </div>`;
}

function drawSlotList(
  now: () => Readonly<Record<string, SlotSpec>>,
  shipped: Readonly<Record<string, SlotSpec>> | undefined,
  actions: SlotsActions,
  set: (next: Record<string, SlotSpec>, redraw: boolean) => void,
  depth: number,
): TemplateResult {
  const slots = now();
  const groups = new Map<string, [string, SlotSpec][]>();
  for (const entry of Object.entries(slots)) {
    const group = depth === 0 ? (entry[1].group ?? 'Basics') : '';
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
              (next, redraw) => {
                set(
                  Object.fromEntries(
                    Object.entries(now()).flatMap(([each, inner]) =>
                      each !== name ? [[each, inner]] : next === undefined ? [] : [[each, next]],
                    ),
                  ),
                  redraw,
                );
              },
              depth,
            ),
        )}`,
    )}
    ${drawAdd(Object.keys(slots), (name, kind) => {
      set({ ...now(), [name]: { kind } }, true);
    })}
  </div>`;
}

export function drawSlots(now: () => Template, actions: SlotsActions): TemplateResult {
  return html`<div class="slots-tab">
    <p class="muted">
      A slot is what a card of this template is given, or finds on its own in its area.
    </p>
    ${drawSlotList(
      () => now().slots ?? {},
      actions.shipped?.slots,
      actions,
      (next, redraw) => {
        const { slots: _old, ...rest } = now();
        actions.update(Object.keys(next).length === 0 ? rest : { ...rest, slots: next }, redraw);
      },
      0,
    )}
  </div>`;
}
