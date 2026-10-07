import { LitElement, html, nothing } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';

import { LAYOUT } from '../cards/keys.ts';
import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import { isMapping } from '../contract/templates.ts';
import type { SlotSpec, Template, Templates, Value } from '../contract/templates.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon, quietly } from '../ha/templates.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { onShared, resolvedTemplates, sharedTemplates } from '../store/store.ts';
import type { SharedState } from '../store/store.ts';
import { discover } from '../templates/discover.ts';
import { filled, toValue } from '../templates/expand.ts';
import { OWNER } from '../templates/families.ts';
import { rolesOf } from '../templates/roles.ts';

import { adder, keysForm } from './draw.ts';
import type { Context, Slot } from './draw.ts';
import {
  defaultArea,
  groupsOf,
  homeWide,
  noteOf,
  overridesOf,
  slotLabel,
  sourceOf,
  valuesOf,
} from './fill.ts';
import type { Source } from './fill.ts';
import { formData, fromForm, isSimple, labelFor, schemaOf } from './form.ts';
import type { FormItem } from './form.ts';
import { haForm } from './ha-form.ts';
import { openPanel } from './leave.ts';
import { sectionPanel } from './panel.ts';
import { Unsupported, place, text } from './shape.ts';
import type { PlainShape } from './shape.ts';
import { drawsCard, kept, previewConfig, slotsShape } from './slots.ts';
import { EDITOR_STYLE } from './style.ts';
import { summarize } from './summary.ts';

const TYPE = 'custom:mnml-template-card';
const KEYS = new Set(['template', 'area', 'slots']);
const PICKED = new Set(['type', 'template', 'area', 'slots']);
const KEY_ORDER: PlainShape = {
  kind: 'plain',
  id: 'template-card',
  label: 'Template',
  fields: { template: text(), area: text(), slots: text() },
  sections: [],
};
const AREA_SCHEMA: readonly FormItem[] = [{ name: 'area', required: true, selector: { area: {} } }];

interface Origin {
  readonly source: Source;
  readonly found: Readonly<Record<string, Value>>;
  readonly own: Readonly<Record<string, Value>>;
  readonly where: string;
}

const SOURCES: readonly [Source, string, string][] = [
  ['area', 'Find in an area', 'The template finds its devices in the area you pick.'],
  ['yourself', 'Fill in yourself', 'You pick each device.'],
];
const HOME: [Source, string, string] = [
  'home',
  'Find in the whole home',
  'The template finds what it needs anywhere in your home.',
];

function lacks(spec: SlotSpec, value: Value | undefined): boolean {
  if (!filled(value)) {
    return spec.required === true;
  }
  return (
    spec.kind === 'object' &&
    isMapping(value) &&
    Object.entries(spec.fields ?? {}).some(([field, inner]) => lacks(inner, value[field]))
  );
}

export class MnmlTemplateCardEditor extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, CONTROL_STYLE, EDITOR_STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @state() private config: Record<string, Value> = { type: TYPE, template: '' };
  @state() private problem: string | undefined;
  @state() private filter = '';
  @state() private browsing = false;
  @state() private loaded = false;
  @state() private values: Record<string, Value> | undefined;
  @state() private pendingArea = false;
  @state() private everything = false;
  private loading = false;
  private stopShared: (() => void) | undefined;
  private observer: IntersectionObserver | undefined;
  private readonly open = new Map<string, boolean>();
  private readonly previews = new Map<string, ChildCard>();

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.stopShared === undefined) {
      this.stopShared = onShared(() => {
        this.previews.clear();
        this.requestUpdate();
      });
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopShared?.();
    this.stopShared = undefined;
    this.observer?.disconnect();
    this.observer = undefined;
  }

  setConfig(config: unknown): void {
    if (customElements.get('ha-form') === undefined) {
      throw new Unsupported("Home Assistant's form is not loaded");
    }
    if (!isMapping(config)) {
      throw new Unsupported('the card is not a mapping');
    }
    for (const key of Object.keys(config)) {
      if (!KEYS.has(key) && !LAYOUT.has(key)) {
        throw new Unsupported(`${key} is not a key the editor knows`);
      }
    }
    if (config['area'] !== undefined && typeof config['area'] !== 'string') {
      throw new Unsupported('area is not an area');
    }
    if (config['slots'] !== undefined && !isMapping(config['slots'])) {
      throw new Unsupported('slots is not a mapping');
    }
    const value = toValue(config);
    if (!isMapping(value) || JSON.stringify(value) === JSON.stringify(this.config)) {
      return;
    }
    this.config = value;
    this.values = undefined;
    this.pendingArea = false;
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
    const body =
      !this.browsing && named && template === undefined && waiting
        ? html`<div class="template-description">Loading the templates...</div>`
        : this.browsing || template === undefined || !named
          ? this.gallery(templates)
          : this.chosen(name, template);
    return html`<div class="object">
      ${problems.map((problem) =>
        problem === undefined ? nothing : html`<div class="problem">${problem}</div>`,
      )}
      ${
        unknown === undefined
          ? nothing
          : html`<div class="problem">
              ${unknown} is not a template this dashboard knows: pick one
            </div>`
      }
      ${body}
    </div>`;
  }

  protected override updated(): void {
    if (typeof IntersectionObserver !== 'function') {
      return;
    }
    const waiting = [...this.renderRoot.querySelectorAll<HTMLElement>('.tile-preview')].filter(
      (target) => {
        const name = target.dataset['template'];
        return name !== undefined && !this.previews.has(name);
      },
    );
    if (waiting.length === 0) {
      return;
    }
    this.observer ??= new IntersectionObserver(this.shown);
    for (const target of waiting) {
      this.observer.observe(target);
    }
  }

  private readonly shown = (entries: readonly IntersectionObserverEntry[]): void => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        this.observer?.unobserve(entry.target);
        void this.preview(entry.target);
      }
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

  private get ownNames(): string[] {
    const shared = this.shared;
    return shared?.status === 'ready' ? Object.keys(shared.own) : [];
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

  private drawing(): Context {
    return {
      hass: this.hass,
      hashes: [],
      open: this.open,
      redraw: (): void => {
        this.requestUpdate();
      },
    };
  }

  private gallery(templates: Templates): TemplateResult {
    const filtered = (event: Event): void => {
      const box = event.currentTarget;
      this.filter = box instanceof HTMLInputElement ? box.value : '';
    };
    return html`<div class="gallery">
      <input
        class="filter"
        placeholder="Filter"
        aria-label="Filter the templates"
        .value=${live(this.filter)}
        @input=${filtered}
      />
      <div class="gallery">${this.tiles(templates)}</div>
    </div>`;
  }

  private tiles(templates: Templates): TemplateResult {
    const own = new Set(this.ownNames);
    const roles = rolesOf(templates);
    const words = this.filter.trim().toLowerCase();
    const names = Object.keys(templates)
      .toSorted()
      .filter((name) => {
        const text = `${name} ${templates[name]?.description ?? ''}`.toLowerCase();
        return words === '' || text.includes(words);
      });
    const tiles = names.filter((name) => roles[name] === 'tile');
    const rest = names.filter((name) => roles[name] !== 'tile');
    const grouped = (from: readonly string[]): TemplateResult => {
      const groups = new Map<string, string[]>();
      for (const name of from) {
        const group = own.has(name) ? 'Yours' : `Shipped: ${OWNER[name] ?? 'common'}`;
        groups.set(group, [...(groups.get(group) ?? []), name]);
      }
      const order = [...groups.keys()].toSorted((a, b) =>
        a === 'Yours' ? -1 : b === 'Yours' ? 1 : a.localeCompare(b),
      );
      return html`${repeat(
        order,
        (group) => group,
        (group) =>
          html`<div class="heading">${group}</div>
            <div class="tiles">
              ${repeat(
                groups.get(group) ?? [],
                (name) => name,
                (name) => this.tile(templates, name),
              )}
            </div>`,
      )}`;
    };
    const open = this.everything || words !== '';
    return html`${grouped(tiles)}
    ${
      rest.length === 0
        ? nothing
        : html`<button
              type="button"
              class="control fold"
              aria-expanded=${open}
              @click=${quietly(() => {
                this.everything = !this.everything;
              })}
            >
              Pop-ups and parts (${rest.length})
            </button>
            ${open ? grouped(rest) : nothing}`
    }`;
  }

  private tile(templates: Templates, name: string): TemplateResult | typeof nothing {
    const template = templates[name];
    if (template === undefined) {
      return nothing;
    }
    const use = `Use ${name}`;
    return html`<button
      type="button"
      class="control tile"
      aria-label=${use}
      title=${use}
      @click=${quietly(() => {
        this.pick(name);
      })}
    >
      <div class="tile-name">${name}</div>
      <div class="tile-description">${template.description ?? ''}</div>
      ${
        drawsCard(template)
          ? html`<div class="tile-preview" data-template=${name}>
              ${this.previews.get(name) ?? nothing}
            </div>`
          : nothing
      }
    </button>`;
  }

  private async preview(target: Element): Promise<void> {
    const name = target instanceof HTMLElement ? target.dataset['template'] : undefined;
    const template = name === undefined ? undefined : this.templates[name];
    if (name === undefined || template === undefined) {
      return;
    }
    const helpers = await window.loadCardHelpers?.();
    if (helpers === undefined) {
      return;
    }
    const card = helpers.createCardElement(previewConfig(name, template, this.hass));
    card.preview = true;
    if (this.hass !== undefined) {
      card.hass = this.hass;
    }
    this.previews.set(name, card);
    this.requestUpdate();
  }

  private pick(name: string): void {
    this.browsing = false;
    const template = this.templates[name];
    if (name === this.config['template'] || template === undefined) {
      return;
    }
    this.values = undefined;
    this.pendingArea = false;
    const start = previewConfig(name, template, this.hass);
    const layout = Object.fromEntries(
      Object.entries(this.config).filter(([key]) => !PICKED.has(key)),
    );
    const empty =
      start['area'] === undefined &&
      start['slots'] === undefined &&
      !homeWide(template.slots ?? {});
    const named = place(KEY_ORDER, { type: TYPE, ...layout }, 'template', name);
    const placed = place(KEY_ORDER, named, 'area', start['area']);
    this.write(place(KEY_ORDER, placed, 'slots', empty ? {} : start['slots']));
  }

  private areaForm(template: Template): TemplateResult {
    return haForm({
      hass: this.hass,
      data: { area: this.config['area'] ?? '' },
      schema: AREA_SCHEMA,
      computeLabel: () => 'Area',
      changed: (data) => {
        const area = data['area'];
        if (typeof area !== 'string' || area === '') {
          return;
        }
        if (this.pendingArea) {
          this.pendingArea = false;
          this.toArea(template, area, this.values ?? {});
          return;
        }
        this.values = undefined;
        this.write(place(KEY_ORDER, this.config, 'area', area));
      },
    });
  }

  private foundFor(template: Template, area: string | undefined): Record<string, Value> {
    const hass = this.hass;
    return hass === undefined
      ? {}
      : discover(template, area === '' ? undefined : area, {
          areas: hass.areas,
          devices: hass.devices,
          entities: hass.entities,
          states: hass.states,
        });
  }

  private origin(template: Template): Origin {
    const source = this.pendingArea ? 'area' : sourceOf(this.config);
    const area = typeof this.config['area'] === 'string' ? this.config['area'] : undefined;
    const placeless = source === 'area' && (area === undefined || area === '');
    const found =
      source === 'yourself' || placeless
        ? {}
        : this.foundFor(template, source === 'home' ? undefined : area);
    const own = isMapping(this.config['slots']) ? this.config['slots'] : {};
    const where = area === undefined || area === '' ? '' : (this.hass?.areas[area]?.name ?? area);
    return { source, found, own, where };
  }

  private chosen(name: string, template: Template): TemplateResult {
    const slots = template.slots ?? {};
    const shape = slotsShape(slots, name);
    const origin = this.origin(template);
    const home = origin.source === 'home';
    const values = home
      ? valuesOf('home', origin.found, origin.own)
      : (this.values ?? valuesOf(origin.source, origin.found, origin.own));
    const slot: Slot = {
      get: (): Record<string, Value> => (home ? values : (this.values ?? values)),
      set: (next): void => {
        this.edit(template, next);
      },
    };
    const context = this.drawing();
    const groups = groupsOf(slots);
    const finds =
      origin.source !== 'yourself' &&
      (origin.source === 'home' || origin.where !== '') &&
      Object.values(slots).some((spec) => spec.discover !== undefined);
    const missing = new Set(
      Object.entries(slots)
        .filter(([slotName, spec]) => lacks(spec, slot.get()[slotName]))
        .map(([slotName]) => slotName),
    );
    return html`<div class="object">
      ${this.header(name, template)} ${this.sources(template, slots)}
      ${origin.source === 'area' ? this.areaForm(template) : nothing}
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
              summary: summarize(shape, group.slots, slot.get(), this.hass),
              body: () =>
                this.groupBody(template, group.name, group.slots, shape, slot, context, origin),
            },
          ),
      )}
      ${kept(slots).map((leftover) => html`<div class="heading">${leftover}: set in YAML</div>`)}
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
    const where = origin.source === 'home' ? 'the whole home' : origin.where;
    return html`<div class="findings">
      ${
        found.length === 0
          ? html`<div class="found">Nothing found in ${where}</div>`
          : html`<div class="found">Found in ${where}: ${found.join(', ')}</div>`
      }
      ${
        missing.size === 0
          ? nothing
          : html`<div class="needs">
              Needs:
              ${[...missing].map((slotName) => slotLabel(slotName, slots[slotName] ?? { kind: 'text' })).join(', ')}
            </div>`
      }
      ${adder('Change what it found', 'mdi:pencil-outline', openAll, 'Change what it found')}
    </div>`;
  }

  private header(name: string, template: Template): TemplateResult {
    return html`<div class="template-head">
      <div class="template-top">
        <div class="template-name">Template: ${name}</div>
        ${adder(
          'Change the template',
          'mdi:swap-horizontal',
          () => {
            this.browsing = true;
          },
          'Change',
        )}
        ${
          this.hass?.user?.is_admin === true
            ? adder(
                'Edit this template in MNML',
                'mdi:view-dashboard-edit',
                () => {
                  void openPanel(this, `/mnml/templates/${name}`);
                },
                'Edit this template',
              )
            : nothing
        }
      </div>
      <div class="template-description">${template.description ?? ''}</div>
    </div>`;
  }

  private sources(template: Template, slots: Readonly<Record<string, SlotSpec>>): TemplateResult {
    const current = this.pendingArea ? 'area' : sourceOf(this.config);
    const choices = homeWide(slots) ? [...SOURCES, HOME] : SOURCES;
    return html`<div class="sources" role="radiogroup">
      ${choices.map(
        ([source, title, help]) => html`<button
          type="button"
          class="source"
          role="radio"
          aria-label=${title}
          title=${title}
          aria-checked=${String(source === current)}
          @click=${quietly(() => {
            this.switchSource(template, source);
          })}
        >
          ${icon(source === current ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank')}
          <span class="source-title">${title}</span>
          <span class="source-help">${help}</span>
        </button>`,
      )}
    </div>`;
  }

  private groupBody(
    template: Template,
    title: string,
    names: readonly string[],
    shape: PlainShape,
    slot: Slot,
    context: Context,
    origin: Origin,
  ): TemplateResult[] {
    const specs = template.slots ?? {};
    const drawn: TemplateResult[] = [];
    const simple = names.filter((name) => {
      const field = shape.fields[name];
      return field !== undefined && isSimple(field);
    });
    if (simple.length > 0) {
      drawn.push(this.slotsForm(shape, simple, specs, slot, origin));
    }
    for (const name of names.filter((each) => !simple.includes(each))) {
      const spec = specs[name];
      if (spec === undefined || shape.fields[name] === undefined) {
        continue;
      }
      const label = slotLabel(name, spec);
      const optional = spec.kind === 'object' && spec.required !== true;
      if (optional && slot.get()[name] === undefined) {
        drawn.push(
          adder(`Add ${label}`, 'mdi:plus', () => {
            slot.set({ ...slot.get(), [name]: {} }, true);
          }),
        );
        continue;
      }
      const alone = names.length === 1 && label === title;
      const fields = keysForm(shape, [name], slot, context, 'slots', !alone);
      const words = noteOf(origin.source, name, origin.found, origin.own, origin.where) ?? '';
      const note = html`<div class="slot-note" ?hidden=${words === ''}>${words}</div>`;
      drawn.push(
        ...(alone ? [note, ...fields] : [...fields.slice(0, 1), note, ...fields.slice(1)]),
      );
      if (optional) {
        drawn.push(
          adder(
            `Remove ${label}`,
            'mdi:delete-outline',
            () => {
              slot.set(
                Object.fromEntries(Object.entries(slot.get()).filter(([key]) => key !== name)),
                true,
              );
            },
            'Remove',
          ),
        );
      }
    }
    if (origin.source === 'area') {
      const back = 'Use what the area found';
      drawn.push(html`<button
        type="button"
        class="control adder"
        aria-label=${back}
        title=${back}
        ?hidden=${!names.some((name) => Object.hasOwn(origin.own, name))}
        @click=${quietly(() => {
          const next = Object.fromEntries(
            Object.entries(slot.get()).filter(([key]) => !names.includes(key)),
          );
          for (const name of names) {
            const found = origin.found[name];
            if (found !== undefined) {
              next[name] = found;
            }
          }
          slot.set(next, true);
        })}
      >
        ${icon('mdi:restore')}<span>${back}</span>
      </button>`);
    }
    return drawn;
  }

  private slotsForm(
    shape: PlainShape,
    keys: readonly string[],
    specs: Readonly<Record<string, SlotSpec>>,
    slot: Slot,
    origin: Origin,
  ): TemplateResult {
    return haForm({
      hass: this.hass,
      data: formData(shape, keys, slot.get()),
      schema: schemaOf(shape, keys, []),
      computeLabel: (item) => labelFor(shape, item.name),
      computeHelper: (item) => {
        const note = noteOf(origin.source, item.name, origin.found, origin.own, origin.where);
        const words = [specs[item.name]?.help, note].filter(
          (part): part is string => part !== undefined,
        );
        return words.length === 0 ? undefined : words.join(' ');
      },
      changed: (data) => {
        slot.set(fromForm(shape, keys, data, slot.get()), false);
      },
    });
  }

  private edit(template: Template, next: Record<string, Value>): void {
    this.values = next;
    if (sourceOf(this.config) === 'area') {
      const area = typeof this.config['area'] === 'string' ? this.config['area'] : undefined;
      const overrides = overridesOf(this.foundFor(template, area), next);
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
    const values = this.values ?? valuesOf(origin.source, origin.found, origin.own);
    this.values = values;
    this.pendingArea = false;
    const rest = this.placeless();
    if (to === 'home') {
      this.write(rest);
      return;
    }
    if (to === 'yourself') {
      this.write(place(KEY_ORDER, rest, 'slots', values));
      return;
    }
    const current =
      typeof this.config['area'] === 'string' && this.config['area'] !== ''
        ? this.config['area']
        : undefined;
    const area = current ?? defaultArea({ ...this.config, slots: values }, this.hass?.areas ?? {});
    if (area === undefined) {
      this.pendingArea = true;
      return;
    }
    this.toArea(template, area, values);
  }

  private placeless(): Record<string, Value> {
    return Object.fromEntries(
      Object.entries(this.config).filter(([key]) => key !== 'area' && key !== 'slots'),
    );
  }

  private toArea(template: Template, area: string, values: Record<string, Value>): void {
    const overrides = overridesOf(this.foundFor(template, area), values);
    const withArea = place(KEY_ORDER, this.placeless(), 'area', area);
    this.write(
      Object.keys(overrides).length === 0
        ? withArea
        : place(KEY_ORDER, withArea, 'slots', overrides),
    );
  }
}
