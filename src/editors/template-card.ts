import { LitElement, html, nothing } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { repeat } from 'lit/directives/repeat.js';

import { TYPE_AND_LAYOUT } from '../cards/keys.ts';
import { startOf } from '../cards/stubs.ts';
import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import {
  isMapping,
  sameValue,
  sameWritten,
  slotLabel,
  templateIcon,
  templateTitle,
} from '../contract/templates.ts';
import type { Filter, SlotSpec, Template, Templates, Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { icon, quietly } from '../ha/templates.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { onShared, resolvedTemplates, sharedTemplates } from '../store/store.ts';
import type { SharedState } from '../store/store.ts';
import { fromDevice, relativesOf } from '../templates/discover.ts';
import { filled, toValue } from '../templates/expand.ts';
import { deviceFit, explain } from '../templates/explain.ts';
import type { DeviceFit, Trace } from '../templates/explain.ts';
import { OWNER } from '../templates/families.ts';
import { overridesOf } from '../templates/overrides.ts';
import type { Fit, Scope } from '../templates/rank.ts';
import { anchorOf, devicesFor, templateIndex } from '../templates/stands.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';

import { adder, formOf, keysForm, wordsOf } from './draw.ts';
import type { Context, Lens } from './draw.ts';
import { REDRAW } from './drawing.ts';
import {
  defaultArea,
  deviceIn,
  deviceWords,
  groupsOf,
  homeWide,
  noteOf,
  sourceOf,
  valuesOf,
} from './fill.ts';
import type { Source } from './fill.ts';
import { UnsupportedConfig, place } from './form.ts';
import type { PlainForm } from './form.ts';
import { isSimple, slotsFromForm } from './ha-form-data.ts';
import type { FormItem } from './ha-form-data.ts';
import { formMissing, haForm } from './ha-form.ts';
import { openPanel } from './leave.ts';
import { sectionPanel } from './panel.ts';
import type { Related } from './related.ts';
import { kept, slotsForm } from './slots.ts';
import { EDITOR_STYLE } from './style.ts';
import { summarize } from './summary.ts';

const TYPE = 'custom:mnml-template-card';
const KEYS = new Set(['template', 'device', 'area', 'slots']);
const PICKED = new Set(['type', 'template', 'device', 'area', 'slots']);
const KEY_ORDER: PlainForm = {
  kind: 'plain',
  id: 'template-card',
  label: 'Template',
  fields: {
    template: { kind: 'text' },
    device: { kind: 'text' },
    area: { kind: 'text' },
    slots: { kind: 'text' },
  },
  sections: [],
};
const AREA_SCHEMA: readonly FormItem[] = [{ name: 'area', required: true, selector: { area: {} } }];
const NO_TEMPLATES: Templates = {};

const entityFilter = (filter: Filter): Record<string, Value> => ({
  ...(filter.domain === undefined ? {} : { domain: filter.domain }),
  ...(filter.device_class === undefined ? {} : { device_class: filter.device_class }),
  ...(filter.platform === undefined ? {} : { integration: filter.platform }),
});

const deviceSchema = (anchor: readonly Filter[]): readonly FormItem[] => [
  { name: 'device', required: true, selector: { device: { entity: anchor.map(entityFilter) } } },
];

interface Explained {
  readonly template: Template;
  readonly area: string | undefined;
  readonly device: string | undefined;
  readonly registries: readonly object[];
  readonly traces: Record<string, Trace>;
}

interface Fitting {
  readonly template: Template;
  readonly registries: readonly object[];
  readonly fits: readonly Fit[];
}

interface Origin {
  readonly source: Source;
  readonly found: Readonly<Record<string, Value>>;
  readonly traces: Readonly<Record<string, Trace>>;
  readonly own: Readonly<Record<string, Value>>;
  readonly where: string;
}

const sameAll = (a: readonly object[], b: readonly object[]): boolean =>
  a.every((registry, index) => registry === b[index]);

interface Devices {
  readonly using: DeviceFit | undefined;
  readonly others: readonly DeviceFit[];
}

const NO_DEVICES: Devices = { using: undefined, others: [] };

const foundIn = (traces: Readonly<Record<string, Trace>>): Record<string, Value> =>
  Object.fromEntries(
    Object.entries(traces).flatMap(([name, trace]) =>
      trace.value === undefined ? [] : [[name, trace.value]],
    ),
  );

function overExample(
  values: Readonly<Record<string, Value>>,
  example: Readonly<Record<string, Value>> | undefined,
  found: Readonly<Record<string, Value>>,
): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([slot, value]) => {
      const lent =
        example !== undefined && Object.hasOwn(example, slot) && sameValue(example[slot], value);
      const there = found[slot];
      if (!lent) {
        return [[slot, value]];
      }
      return there === undefined ? [] : [[slot, there]];
    }),
  );
}

function lacks(spec: SlotSpec, value: Value | undefined): boolean {
  if (!filled(value)) {
    return spec.required === true;
  }
  return (
    spec.kind === 'object' &&
    isMapping(value) &&
    Object.entries(spec.fields ?? {}).some(([key, inner]) => lacks(inner, value[key]))
  );
}

let everyCard = false;

export class MnmlTemplateCardEditor extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, CONTROL_STYLE, EDITOR_STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @state() private config: Record<string, Value> = { type: TYPE, template: '' };
  @state() private problem: string | undefined;
  @state() private browsing = false;
  @state() private loaded = false;
  @state() private values: Record<string, Value> | undefined;
  @state() private pending: 'area' | 'device' | undefined;
  @state() private asking: 'which' | 'only' | undefined;
  private loading = false;
  private explained: Explained | undefined;
  private fitted: Fitting | undefined;
  private stopShared: (() => void) | undefined;
  private readonly open = new Map<string, boolean>();

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.stopShared === undefined) {
      this.stopShared = onShared(() => {
        this.requestUpdate();
      });
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopShared?.();
    this.stopShared = undefined;
  }

  setConfig(config: unknown): void {
    const missing = formMissing();
    if (missing !== undefined) {
      throw new UnsupportedConfig(this.words().forms[missing]);
    }
    if (!isMapping(config)) {
      throw new UnsupportedConfig('the card is not a mapping');
    }
    for (const key of Object.keys(config)) {
      if (!KEYS.has(key) && !TYPE_AND_LAYOUT.has(key)) {
        throw new UnsupportedConfig(`${key} is not a key the editor knows`);
      }
    }
    if (config['area'] !== undefined && typeof config['area'] !== 'string') {
      throw new UnsupportedConfig('area is not an area');
    }
    if (config['device'] !== undefined && typeof config['device'] !== 'string') {
      throw new UnsupportedConfig('device is not a device');
    }
    if (config['slots'] !== undefined && !isMapping(config['slots'])) {
      throw new UnsupportedConfig('slots is not a mapping');
    }
    const value = toValue(config);
    if (!isMapping(value) || sameWritten(value, this.config)) {
      return;
    }
    this.config = value;
    this.values = undefined;
    this.pending = undefined;
  }

  protected override willUpdate(): void {
    if (this.hass !== undefined && !this.loading) {
      this.loading = true;
      void this.load();
    }
  }

  protected override render(): TemplateResult {
    const name = this.config['template'];
    const templates = this.templates;
    const template = typeof name === 'string' ? templates[name] : undefined;
    const shared = this.shared;
    const problems = [this.problem, shared?.status === 'failed' ? shared.error : undefined];
    const settled =
      this.loaded &&
      shared?.status === 'ready' &&
      !(this.problem !== undefined && typeof name === 'string' && Object.hasOwn(OWNER, name));
    const unknown =
      settled && typeof name === 'string' && name !== '' && template === undefined
        ? name
        : undefined;
    const waiting = !this.loaded || shared === undefined || shared.status === 'waiting';
    const named = typeof name === 'string' && name !== '';
    const ready = !this.browsing && named && template !== undefined;
    const loading = !this.browsing && named && template === undefined && waiting;
    return html`<div class="object">
      ${problems.map((problem) =>
        problem === undefined ? nothing : html`<div class="problem">${problem}</div>`,
      )}
      ${
        unknown === undefined
          ? nothing
          : html`<div class="problem">${this.words().template.unknown(unknown)}</div>`
      }
      ${cache(
        ready || loading
          ? nothing
          : html`<mnml-template-gallery
              .hass=${this.hass}
              .templates=${templates}
              .own=${shared?.status === 'ready' ? shared.own : NO_TEMPLATES}
              @template-picked=${this.picked}
            ></mnml-template-gallery>`,
      )}
      ${
        loading
          ? html`<div class="template-description">${this.words().template.loading}</div>`
          : nothing
      }
      ${ready ? this.chosen(name, template) : nothing}
    </div>`;
  }

  private readonly picked = (event: Event): void => {
    const detail = field(event, 'detail');
    const name = field(detail, 'template');
    const device = field(detail, 'device');
    if (typeof name === 'string') {
      this.pick(name, typeof device === 'string' ? device : undefined);
    }
  };

  private async load(): Promise<void> {
    const names = Object.keys(OWNER);
    await SHIPPED_TEMPLATES.need(names);
    this.problem = SHIPPED_TEMPLATES.failure(names);
    this.loaded = true;
  }

  private get shared(): SharedState | undefined {
    return this.hass === undefined ? undefined : sharedTemplates(this.hass.connection);
  }

  private get templates(): Templates {
    return resolvedTemplates(this.shared ?? { status: 'waiting' }, SHIPPED_TEMPLATES.templates());
  }

  private write(next: Record<string, Value>): void {
    this.config = next;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: next },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private words(): EditorWords {
    return wordsOf(this);
  }

  private drawing(): Context {
    return {
      hass: this.hass,
      popups: [],
      open: this.open,
      redraw: (): void => {
        this.requestUpdate();
      },
    };
  }

  private pick(name: string, device?: string): void {
    this.browsing = false;
    const template = this.templates[name];
    const same =
      name === this.config['template'] &&
      (device === undefined || device === this.config['device']);
    if (same || template === undefined) {
      return;
    }
    this.values = undefined;
    this.pending = undefined;
    this.open.clear();
    const layout = Object.fromEntries(
      Object.entries(this.config).filter(([key]) => !PICKED.has(key)),
    );
    const named = place(KEY_ORDER, { type: TYPE, ...layout }, 'template', name);
    if (device !== undefined) {
      this.write(place(KEY_ORDER, named, 'device', device));
      return;
    }
    const start = startOf(name, template, this.hass);
    const placed = place(KEY_ORDER, named, 'area', start['area']);
    this.write(place(KEY_ORDER, placed, 'slots', start['slots']));
  }

  private given(key: 'area' | 'device'): string | undefined {
    const value = this.config[key];
    return typeof value === 'string' && value !== '' ? value : undefined;
  }

  private areaForm(template: Template): TemplateResult {
    return haForm({
      hass: this.hass,
      data: { area: this.config['area'] ?? '' },
      schema: AREA_SCHEMA,
      computeLabel: () => this.words().template.area,
      changed: (data) => {
        const area = data['area'];
        if (typeof area !== 'string' || area === '') {
          return;
        }
        if (this.pending === 'area') {
          this.pending = undefined;
          this.toPlace(template, { area }, this.values);
          return;
        }
        this.values = undefined;
        this.write(place(KEY_ORDER, this.config, 'area', area));
      },
    });
  }

  private deviceForm(name: string, template: Template): TemplateResult {
    const using = this.given('device');
    const others = this.fitting(name, template).flatMap((fit) =>
      fit.scope.device === undefined || fit.scope.device === using ? [] : [fit.scope.device],
    );
    const moveTo = (device: string): void => {
      if (this.pending === 'device') {
        this.pending = undefined;
        this.toPlace(template, { device }, this.values);
        return;
      }
      this.values = undefined;
      this.write(place(KEY_ORDER, this.config, 'device', device));
    };
    return html`${haForm({
      hass: this.hass,
      data: { device: using ?? '' },
      schema: deviceSchema(anchorOf(template) ?? []),
      computeLabel: () => this.words().template.device,
      changed: (data) => {
        const device = data['device'];
        if (typeof device === 'string' && device !== '') {
          moveTo(device);
        }
      },
    })}
    ${
      others.length === 0
        ? nothing
        : html`<div
            class="alternatives"
            role="group"
            aria-label=${this.words().template.otherDevices}
          >
            <span class="alt-note">${this.words().template.useAnother}</span>
            ${others.map((device) => {
              const words = this.deviceWhere(device, undefined);
              return html`<button
                type="button"
                class="alt"
                aria-label=${this.words().template.use(words)}
                @click=${quietly(() => {
                  moveTo(device);
                })}
              >
                ${words}
              </button>`;
            })}
          </div>`
    }`;
  }

  private fitting(name: string, template: Template): readonly Fit[] {
    const hass = this.hass;
    if (hass === undefined) {
      return [];
    }
    const registries = [hass.areas, hass.devices, hass.entities];
    const known = this.fitted;
    if (
      known !== undefined &&
      known.template === template &&
      sameAll(known.registries, registries)
    ) {
      return known.fits;
    }
    const fits = devicesFor(templateIndex({ [name]: template }), name, registriesOf(hass));
    this.fitted = { template, registries, fits };
    return fits;
  }

  private deviceWhere(device: string, area: string | undefined): string {
    const hass = this.hass;
    if (hass === undefined) {
      return device;
    }
    const fit = deviceFit(device, registriesOf(hass));
    return deviceWords(
      area === undefined ? fit : { ...fit, area: hass.areas[area]?.name ?? area },
      this.words(),
    );
  }

  private tracesFor(
    template: Template,
    area: string | undefined,
    device?: string,
  ): Record<string, Trace> {
    const hass = this.hass;
    if (hass === undefined) {
      return {};
    }
    const where = area === '' ? undefined : area;
    const registries = [hass.areas, hass.devices, hass.entities];
    const known = this.explained;
    if (
      known !== undefined &&
      known.template === template &&
      known.area === where &&
      known.device === device &&
      sameAll(known.registries, registries)
    ) {
      return known.traces;
    }
    const traces = explain(template, where, registriesOf(hass), device);
    this.explained = { template, area: where, device, registries, traces };
    return traces;
  }

  private origin(template: Template): Origin {
    const source = this.pending ?? sourceOf(this.config);
    const area = this.given('area');
    const device = this.given('device');
    const placeless =
      (source === 'area' && area === undefined) || (source === 'device' && device === undefined);
    const traces =
      source === 'yourself' || placeless
        ? {}
        : this.tracesFor(
            template,
            source === 'home' ? undefined : area,
            source === 'device' ? device : undefined,
          );
    const own = isMapping(this.config['slots']) ? this.config['slots'] : {};
    const where =
      source === 'device' && device !== undefined
        ? this.deviceWhere(device, area)
        : area === undefined
          ? ''
          : (this.hass?.areas[area]?.name ?? area);
    return { source, found: foundIn(traces), traces, own, where };
  }

  private chosen(name: string, template: Template): TemplateResult {
    const slots = template.slots ?? {};
    const form = slotsForm(slots, name);
    const origin = this.origin(template);
    const home = origin.source === 'home';
    const values = home
      ? valuesOf('home', origin.found, origin.own)
      : (this.values ?? valuesOf(origin.source, origin.found, origin.own));
    const lens: Lens = {
      get: (): Record<string, Value> => (home ? values : (this.values ?? values)),
      set: (next): void => {
        this.edit(template, next);
      },
    };
    const context = this.drawing();
    const groups = groupsOf(slots, this.words().template.basics);
    const finds =
      origin.source !== 'yourself' &&
      (origin.source === 'home' || origin.where !== '') &&
      Object.values(slots).some((spec) => spec.discover !== undefined);
    const missing = new Set(
      Object.entries(slots)
        .filter(([slotName, spec]) => lacks(spec, lens.get()[slotName]))
        .map(([slotName]) => slotName),
    );
    return html`<div class="object">
      ${this.header(name, template)} ${this.sources(template, slots)}
      ${origin.source === 'area' ? this.areaForm(template) : nothing}
      ${origin.source === 'device' ? this.deviceForm(name, template) : nothing}
      ${
        finds
          ? this.findings(slots, origin, missing, () => {
              for (const group of groups) {
                context.open.set(`group:${group.name}`, true);
              }
              context.redraw();
            })
          : nothing
      }
      ${repeat(
        groups,
        (group) => group.name,
        (group, index) =>
          sectionPanel(
            context,
            `group:${group.name}`,
            finds ? group.slots.some((slotName) => missing.has(slotName)) : index === 0,
            {
              icon: group.icon,
              title: group.name,
              summary: summarize(form, group.slots, lens.get(), this.hass, this.words()),
              body: () =>
                this.groupBody(template, group.name, group.slots, form, lens, context, origin),
            },
          ),
      )}
      ${kept(slots).map(
        (leftover) =>
          html`<div class="heading">
            ${this.words().template.inYaml(slotLabel(leftover, slots[leftover]))}
          </div>`,
      )}
    </div>`;
  }

  private findings(
    slots: Readonly<Record<string, SlotSpec>>,
    origin: Origin,
    missing: ReadonlySet<string>,
    openAll: () => void,
  ): TemplateResult {
    const found = Object.entries(slots)
      .filter(([slotName]) => filled(origin.found[slotName]))
      .map(([slotName, spec]) => slotLabel(slotName, spec));
    const said = this.words().template;
    const where =
      origin.source === 'home'
        ? said.inHome
        : (origin.source === 'device' ? said.on : said.in)(origin.where);
    return html`<div class="findings">
      ${
        found.length === 0
          ? html`<div class="found">${said.nothingFound(where)}</div>`
          : html`<div class="found">${said.found(where, found.join(', '))}</div>`
      }
      ${
        missing.size === 0
          ? nothing
          : html`<div class="needs">
              ${said.needs}
              ${[...missing].map((slotName) => slotLabel(slotName, slots[slotName])).join(', ')}
            </div>`
      }
      ${adder(said.changeFound, 'mdi:pencil-outline', openAll, said.changeFound)}
    </div>`;
  }

  private header(name: string, template: Template): TemplateResult {
    const said = this.words().template;
    return html`<div class="template-head">
      <div class="template-top">
        <ha-icon class="template-icon" .icon=${templateIcon(template)}></ha-icon>
        <div class="template-name">${templateTitle(template, name)}</div>
        ${adder(
          said.changeTemplate,
          'mdi:swap-horizontal',
          () => {
            this.browsing = true;
          },
          said.change,
        )}
        ${
          this.hass?.user?.is_admin === true
            ? adder(
                said.editInPanel,
                'mdi:view-dashboard-edit',
                () => {
                  if (everyCard) {
                    void openPanel(this, `/mnml/templates/${name}`);
                  } else {
                    this.asking = 'which';
                  }
                },
                said.edit,
              )
            : nothing
        }
      </div>
      ${this.whichCards(name)}
      <div class="template-description">${template.description ?? ''}</div>
      <code class="template-code">${name}</code>
    </div>`;
  }

  private whichCards(name: string): TemplateResult | typeof nothing {
    const said = this.words().template;
    if (this.asking === 'only') {
      return html`<div class="which" role="status"><p>${said.onlyThisSaid}</p></div>`;
    }
    if (this.asking !== 'which') {
      return nothing;
    }
    return html`<div class="which" role="group" aria-label=${said.whichCards}>
      <p>${said.whichCards}</p>
      ${adder(said.onlyThis, 'mdi:card-outline', () => {
        this.asking = 'only';
      })}
      ${adder(said.everyCard, 'mdi:cards-outline', () => {
        everyCard = true;
        this.asking = undefined;
        void openPanel(this, `/mnml/templates/${name}`);
      })}
    </div>`;
  }

  private sources(template: Template, slots: Readonly<Record<string, SlotSpec>>): TemplateResult {
    const current = this.pending ?? sourceOf(this.config);
    const choices: Source[] = [
      'area',
      ...(current === 'device' || anchorOf(template) !== undefined ? ['device' as const] : []),
      'yourself',
      ...(homeWide(slots) ? ['home' as const] : []),
    ];
    const said = this.words().sources;
    return html`<div class="sources" role="radiogroup">
      ${choices.map(
        (source) =>
          html`<button
            type="button"
            class="source"
            role="radio"
            aria-label=${said[source].title}
            title=${said[source].title}
            aria-checked=${String(source === current)}
            @click=${quietly(() => {
              this.switchSource(template, source);
            })}
          >
            ${icon(source === current ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank')}
            <span class="source-title">${said[source].title}</span>
            <span class="source-help">${said[source].help}</span>
          </button>`,
      )}
    </div>`;
  }

  private groupBody(
    template: Template,
    title: string,
    names: readonly string[],
    form: PlainForm,
    lens: Lens,
    context: Context,
    origin: Origin,
  ): TemplateResult[] {
    const words = this.words();
    const said = words.template;
    const specs = template.slots ?? {};
    const drawn: TemplateResult[] = [];
    const simple = names.filter((name) => {
      const field = form.fields[name];
      return field !== undefined && isSimple(field);
    });
    if (simple.length > 0) {
      const helper = (name: string): string | undefined => {
        const note = noteOf(
          origin.source,
          name,
          origin.found,
          origin.own,
          origin.where,
          undefined,
          words,
        );
        const parts = [specs[name]?.help, note].filter(
          (part): part is string => part !== undefined,
        );
        return parts.length === 0 ? undefined : parts.join(' ');
      };
      drawn.push(formOf(form, simple, lens, context, { helper, read: slotsFromForm }));
    }
    for (const name of names.filter((each) => !simple.includes(each))) {
      const spec = specs[name];
      if (spec === undefined || form.fields[name] === undefined) {
        continue;
      }
      const label = slotLabel(name, spec);
      const optional = spec.kind === 'object' && spec.required !== true;
      const current = lens.get()[name];
      if (optional && (current === undefined || current === null)) {
        drawn.push(
          adder(said.addSlot(label), 'mdi:plus', () => {
            lens.set({ ...lens.get(), [name]: {} }, REDRAW);
          }),
        );
        continue;
      }
      const alone = names.length === 1 && label === title;
      const fields = keysForm(form, [name], lens, context, 'slots', !alone);
      const devices = spec.kind === 'object' ? this.devicesOf(name, origin) : NO_DEVICES;
      const noted =
        noteOf(origin.source, name, origin.found, origin.own, origin.where, devices.using, words) ??
        '';
      const note = html`<div class="slot-note" ?hidden=${noted === ''}>${noted}</div>`;
      const body =
        spec.kind === 'object'
          ? [
              html`<mnml-related .related=${this.relatedTo(devices.using)}
                >${alone ? fields : fields.slice(1)}</mnml-related
              >`,
            ]
          : fields.slice(alone ? 0 : 1);
      drawn.push(
        ...(alone ? [] : fields.slice(0, 1)),
        note,
        ...this.another(name, spec, devices, lens),
        ...body,
      );
      if (optional) {
        drawn.push(
          adder(
            said.removeSlot(label),
            'mdi:delete-outline',
            () => {
              lens.set(
                Object.fromEntries(Object.entries(lens.get()).filter(([key]) => key !== name)),
                REDRAW,
              );
            },
            said.remove,
          ),
        );
      }
    }
    drawn.push(...this.alternatives(names, template.slots ?? {}, lens, origin));
    if (origin.source === 'area' || origin.source === 'device') {
      const back = said.useFound[origin.source];
      drawn.push(
        html`<button
          type="button"
          class="control adder"
          aria-label=${back}
          title=${back}
          ?hidden=${!names.some((name) => Object.hasOwn(origin.own, name))}
          @click=${quietly(() => {
            const next = Object.fromEntries(
              Object.entries(lens.get()).filter(([key]) => !names.includes(key)),
            );
            for (const name of names) {
              const found = origin.found[name];
              if (found !== undefined) {
                next[name] = found;
              }
            }
            lens.set(next, REDRAW);
          })}
        >
          ${icon('mdi:restore')}<span>${back}</span>
        </button>`,
      );
    }
    return drawn;
  }

  private alternatives(
    names: readonly string[],
    specs: Readonly<Record<string, SlotSpec>>,
    lens: Lens,
    origin: Origin,
  ): TemplateResult[] {
    return names.flatMap((name) => {
      const tied = origin.traces[name]?.steps.find(
        (step) => step.field === '' && step.tied !== undefined,
      )?.tied;
      if (tied === undefined) {
        return [];
      }
      const using = Object.hasOwn(origin.own, name) ? origin.own[name] : origin.found[name];
      const label = slotLabel(name, specs[name]);
      const said = this.words().template;
      return [
        html`<div class="alternatives" role="group" aria-label=${said.choices(label)}>
          <span class="alt-note">${said.tied(label, tied.length)}</span>
          ${tied.map(
            (id) =>
              html`<button
                type="button"
                class="alt"
                aria-label=${said.use(id)}
                aria-pressed=${String(id === using)}
                @click=${quietly(() => {
                  lens.set({ ...lens.get(), [name]: id }, REDRAW);
                })}
              >
                ${id}
              </button>`,
          )}
        </div>`,
      ];
    });
  }

  private devicesOf(name: string, origin: Origin): Devices {
    const trace = origin.traces[name];
    const fits = trace?.devices ?? [];
    const using = Object.hasOwn(origin.own, name)
      ? deviceIn(origin.own[name], fits, this.hass?.entities ?? {})
      : fits.find((fit) => fit.id === trace?.device);
    return { using, others: fits.filter((fit) => fit.id !== using?.id) };
  }

  private relatedTo(device: DeviceFit | undefined): Related | undefined {
    const hass = this.hass;
    if (device === undefined || hass === undefined) {
      return undefined;
    }
    const registries = registriesOf(hass);
    const area = registries.devices[device.id]?.area_id;
    return {
      entities: new Set(
        Object.values(registries.entities)
          .filter((entry) => entry.device_id === device.id)
          .map((entry) => entry.entity_id),
      ),
      devices: new Set(relativesOf(device.id, registries)),
      areas: new Set(area === undefined || area === null ? [] : [area]),
    };
  }

  private another(name: string, spec: SlotSpec, devices: Devices, lens: Lens): TemplateResult[] {
    if (devices.others.length === 0) {
      return [];
    }
    const area = typeof this.config['area'] === 'string' ? this.config['area'] : undefined;
    const words = this.words();
    return [
      html`<div
        class="alternatives"
        role="group"
        aria-label=${words.template.devices(slotLabel(name, spec))}
      >
        <span class="alt-note">${words.template.useAnother}</span>
        ${devices.others.map(
          (fit) =>
            html`<button
              type="button"
              class="alt"
              aria-label=${words.template.use(deviceWords(fit, words))}
              @click=${quietly(() => {
                const value = fromDevice(spec, fit.id, area, registriesOf(this.hass));
                if (value !== undefined) {
                  lens.set({ ...lens.get(), [name]: value }, REDRAW);
                }
              })}
            >
              ${deviceWords(fit, words)}
            </button>`,
        )}
      </div>`,
    ];
  }

  private edit(template: Template, next: Record<string, Value>): void {
    this.values = next;
    const source = sourceOf(this.config);
    if (source === 'area' || source === 'device') {
      const device = source === 'device' ? this.given('device') : undefined;
      const found = foundIn(this.tracesFor(template, this.given('area'), device));
      const overrides = overridesOf(found, next);
      const overridden = Object.keys(overrides).length === 0 ? undefined : overrides;
      this.write(place(KEY_ORDER, this.config, 'slots', overridden));
      return;
    }
    this.write(place(KEY_ORDER, this.config, 'slots', next));
  }

  private switchSource(template: Template, to: Source): void {
    const origin = this.origin(template);
    if (origin.source === to) {
      return;
    }
    const values =
      origin.source === 'home'
        ? valuesOf('home', origin.found, origin.own)
        : (this.values ?? valuesOf(origin.source, origin.found, origin.own));
    const moved = origin.source === 'area' || origin.source === 'device';
    const carried = moved ? undefined : values;
    this.values = to === 'yourself' ? values : to === 'home' ? undefined : carried;
    this.pending = undefined;
    const rest = this.placeless();
    if (to === 'home') {
      this.write(rest);
      return;
    }
    if (to === 'yourself') {
      this.write(place(KEY_ORDER, rest, 'slots', values));
      return;
    }
    if (to === 'device') {
      const device = this.given('device') ?? this.likelyDevice(template, values);
      if (device === undefined) {
        this.pending = 'device';
        return;
      }
      this.toPlace(template, { device }, carried);
      return;
    }
    const device = this.given('device');
    const placed = device === undefined ? undefined : this.hass?.devices[device]?.area_id;
    const area =
      this.given('area') ??
      placed ??
      defaultArea({ ...this.config, slots: values }, this.hass?.areas ?? {});
    if (area === undefined) {
      this.pending = 'area';
      return;
    }
    this.toPlace(template, { area }, carried);
  }

  private likelyDevice(template: Template, values: Record<string, Value>): string | undefined {
    const name = this.config['template'];
    const hass = this.hass;
    if (typeof name !== 'string' || hass === undefined) {
      return undefined;
    }
    const registries = registriesOf(hass);
    const fits = this.fitting(name, template).flatMap((fit) =>
      fit.scope.device === undefined ? [] : [deviceFit(fit.scope.device, registries)],
    );
    return (deviceIn(values, fits, hass.entities) ?? fits[0])?.id;
  }

  private placeless(): Record<string, Value> {
    return Object.fromEntries(
      Object.entries(this.config).filter(
        ([key]) => key !== 'area' && key !== 'device' && key !== 'slots',
      ),
    );
  }

  private toPlace(template: Template, at: Scope, given: Record<string, Value> | undefined): void {
    const found = foundIn(this.tracesFor(template, at.area, at.device));
    const own = isMapping(this.config['slots']) ? this.config['slots'] : {};
    const values = overExample(given ?? { ...found, ...own }, template.example, found);
    if (!sameValue(values, given)) {
      this.values = undefined;
    }
    const overrides = overridesOf(found, values);
    const placed =
      at.device === undefined
        ? place(KEY_ORDER, this.placeless(), 'area', at.area)
        : place(KEY_ORDER, this.placeless(), 'device', at.device);
    this.write(
      Object.keys(overrides).length === 0 ? placed : place(KEY_ORDER, placed, 'slots', overrides),
    );
  }
}
