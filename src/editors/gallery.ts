import { LitElement, css, html, nothing } from 'lit';
import type { CSSResultGroup, PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';

import { unplaced } from '../builder/plan.ts';
import { cardOf } from '../cards/parts/card-element.ts';
import { placeOf, previewOf } from '../cards/stubs.ts';
import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import { templateIcon, templateTitle } from '../contract/templates.ts';
import type { Template, Templates } from '../contract/templates.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { quietly } from '../ha/templates.ts';
import { byDeviceName, deviceName } from '../templates/entity-index.ts';
import { OWNER } from '../templates/families.ts';
import { familyTitle } from '../templates/family-titles.ts';
import { rolesOf } from '../templates/roles.ts';
import { cardsFor, drawsCard, templateIndex } from '../templates/stands.ts';
import type { Standing, TemplateIndex } from '../templates/stands.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';
import { editorWordsFor } from '../words/panel/editors.ts';

import { EDITOR_STYLE } from './style.ts';

interface Preview {
  readonly name: string;
  readonly template: Template;
  readonly card: ChildCard;
}

interface Fitted {
  readonly device: string;
  readonly name: string;
  readonly area: string | undefined;
  readonly kind: Standing | undefined;
  readonly cards: readonly string[];
}

interface Fitting {
  readonly index: TemplateIndex;
  readonly registries: readonly object[];
  readonly devices: readonly Fitted[];
}

interface Stranding {
  readonly templates: Templates;
  readonly registries: readonly object[];
  readonly stranded: boolean;
}

const CARD = 'custom:mnml-template-card';
const AREAS_PAGE = '/mnml/areas';

const previewKey = (target: HTMLElement): string | undefined => {
  const name = target.dataset['template'];
  const device = target.dataset['device'];
  return name === undefined || device === undefined ? name : `${name}@${device}`;
};

const GALLERY_STYLE = css`
  .fold {
    justify-content: flex-start;
    margin: 12px 0 0;
    color: var(--primary-color);
    font-size: 14px;
    font-weight: 500;
  }
  .gallery {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  .tile {
    height: auto;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    text-align: start;
    padding: 8px;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1px var(--divider-color);
    white-space: normal;
  }
  .tile-head {
    display: flex;
    align-items: center;
    gap: 8px;
    --mdc-icon-size: 20px;
  }
  .tile-name {
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .tile-description {
    font-size: 12px;
  }
  .tile-code {
    font-family: var(--ha-font-family-code, monospace);
    font-size: 11px;
    color: var(--secondary-text-color);
  }
  .tile-preview {
    height: 120px;
    overflow: hidden;
    border-radius: 8px;
  }
  .views {
    display: flex;
    gap: 8px;
  }
  .views .fold {
    margin: 0;
  }
  .device {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .device-head {
    display: flex;
    align-items: center;
    gap: 8px;
    --mdc-icon-size: 20px;
  }
  .device-name {
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .device-kind {
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .stranded {
    margin: 0;
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .stranded a {
    color: var(--primary-color);
  }
`;

export class MnmlTemplateGallery extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, CONTROL_STYLE, EDITOR_STYLE, GALLERY_STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) templates: Templates = {};
  @property({ attribute: false }) own: Templates = {};
  @state() private filter = '';
  @state() private everything = false;
  @state() private byDevice = false;
  private observer: IntersectionObserver | undefined;
  private readonly previews = new Map<string, Preview>();
  private indexed: { readonly templates: Templates; readonly index: TemplateIndex } | undefined;
  private fitting: Fitting | undefined;
  private stranding: Stranding | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.observer = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('templates')) {
      for (const [key, preview] of this.previews) {
        if (this.templates[preview.name] !== preview.template) {
          this.previews.delete(key);
        }
      }
    }
    const hass = this.hass;
    if (changed.has('hass') && hass !== undefined) {
      for (const { card } of this.previews.values()) {
        card.hass = hass;
      }
    }
  }

  protected override render(): TemplateResult {
    const filtered = (event: Event): void => {
      const box = event.currentTarget;
      this.filter = box instanceof HTMLInputElement ? box.value : '';
    };
    const words = this.words();
    return html`<div class="gallery">
      <input
        class="filter"
        placeholder=${words.filter}
        aria-label=${words.filterTemplates}
        .value=${live(this.filter)}
        @input=${filtered}
      />
      <div class="views">
        <button
          type="button"
          class="control fold"
          aria-label=${words.forDevice}
          aria-pressed=${this.byDevice}
          @click=${quietly(() => {
            this.byDevice = !this.byDevice;
          })}
        >
          ${words.forDevice}
        </button>
      </div>
      <div class="gallery">${this.byDevice ? this.devices() : this.tiles()}</div>
    </div>`;
  }

  protected override updated(): void {
    if (typeof IntersectionObserver !== 'function') {
      return;
    }
    const waiting = [...this.renderRoot.querySelectorAll<HTMLElement>('.tile-preview')].filter(
      (target) => {
        const key = previewKey(target);
        return key !== undefined && !this.previews.has(key);
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

  private words(): EditorWords['gallery'] {
    return editorWordsFor(this.hass?.locale.language).gallery;
  }

  private tiles(): TemplateResult {
    const said = this.words();
    const templates = this.templates;
    const own = new Set(Object.keys(this.own));
    const roles = rolesOf(templates);
    const words = this.filter.trim().toLowerCase();
    const titles = new Map(
      Object.keys(templates).map((name) => [name, templateTitle(templates[name], name)]),
    );
    const names = Object.keys(templates)
      .toSorted(
        (a, b) => (titles.get(a) ?? a).localeCompare(titles.get(b) ?? b) || a.localeCompare(b),
      )
      .filter((name) => {
        const text =
          `${titles.get(name) ?? ''} ${name} ${templates[name]?.description ?? ''}`.toLowerCase();
        return words === '' || text.includes(words);
      });
    const tiles = names.filter((name) => roles[name] === 'tile');
    const rest = names.filter((name) => roles[name] !== 'tile');
    const grouped = (from: readonly string[]): TemplateResult => {
      const groups = new Map<string, string[]>();
      for (const name of from) {
        const group = own.has(name)
          ? said.yours
          : said.shipped(familyTitle(OWNER[name] ?? 'common'));
        groups.set(group, [...(groups.get(group) ?? []), name]);
      }
      const order = [...groups.keys()].toSorted((a, b) =>
        a === said.yours ? -1 : b === said.yours ? 1 : a.localeCompare(b),
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
                (name) => this.tile(name),
              )}
            </div>`,
      )}`;
    };
    const open = this.everything || words !== '';
    return html`${
      this.stranded()
        ? html`<p class="stranded">${said.stranded} <a href=${AREAS_PAGE}>${said.sortThem}</a></p>`
        : nothing
    }
    ${grouped(tiles)}
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
              ${said.rest(rest.length)}
            </button>
            ${open ? grouped(rest) : nothing}`
    }`;
  }

  private tile(name: string): TemplateResult | typeof nothing {
    const template = this.templates[name];
    if (template === undefined) {
      return nothing;
    }
    const title = templateTitle(template, name);
    const use = this.words().use(title);
    return html`<button
      type="button"
      class="control tile"
      aria-label=${use}
      title=${use}
      @click=${quietly(() => {
        this.dispatchEvent(new CustomEvent('template-picked', { detail: { template: name } }));
      })}
    >
      <div class="tile-head">
        <ha-icon .icon=${templateIcon(template)}></ha-icon>
        <span class="tile-name">${title}</span>
      </div>
      <div class="tile-description">${template.description ?? ''}</div>
      <code class="tile-code">${name}</code>
      ${
        drawsCard(template)
          ? html`<div class="tile-preview" inert data-template=${name}>
              ${this.previews.get(name)?.card ?? nothing}
            </div>`
          : nothing
      }
    </button>`;
  }

  private index(): TemplateIndex {
    const known = this.indexed;
    if (known !== undefined && known.templates === this.templates) {
      return known.index;
    }
    const index = templateIndex(this.templates);
    this.indexed = { templates: this.templates, index };
    return index;
  }

  private stranded(): boolean {
    const hass = this.hass;
    const registries = [hass?.areas, hass?.devices, hass?.entities].map(
      (registry) => registry ?? {},
    );
    const known = this.stranding;
    if (
      known !== undefined &&
      known.templates === this.templates &&
      known.registries.every((registry, at) => registry === registries[at])
    ) {
      return known.stranded;
    }
    const home = registriesOf(hass);
    const away = unplaced(home);
    const roles = rolesOf(this.templates);
    const stranded =
      away.devices + away.entities > 0 &&
      Object.entries(this.templates).some(
        ([name, template]) =>
          roles[name] === 'tile' && drawsCard(template) && placeOf(template, home) === undefined,
      );
    this.stranding = { templates: this.templates, registries, stranded };
    return stranded;
  }

  private fitted(): readonly Fitted[] {
    const hass = this.hass;
    const index = this.index();
    const registries = [hass?.areas, hass?.devices, hass?.entities].map(
      (registry) => registry ?? {},
    );
    const known = this.fitting;
    if (
      known !== undefined &&
      known.index === index &&
      known.registries.every((registry, at) => registry === registries[at])
    ) {
      return known.devices;
    }
    const home = registriesOf(hass);
    const devices = Object.keys(home.devices)
      .toSorted(byDeviceName(home))
      .flatMap((device): Fitted[] => {
        const cards = cardsFor(index, device, home).map(({ template }) => template);
        const area = home.devices[device]?.area_id ?? undefined;
        const named = area === undefined ? undefined : (home.areas[area]?.name ?? area);
        const kind = index[cards[0] ?? ''];
        return cards.length === 0
          ? []
          : [{ device, name: deviceName(device, home), area: named, kind, cards }];
      });
    this.fitting = { index, registries, devices };
    return devices;
  }

  private devices(): TemplateResult {
    const said = this.words();
    const noArea = said.noArea;
    const index = this.index();
    const words = this.filter.trim().toLowerCase();
    const titleOf = (template: string): string => index[template]?.title ?? template;
    const shown = this.fitted().flatMap((fitted): Fitted[] => {
      const cards =
        words === '' || fitted.name.toLowerCase().includes(words)
          ? fitted.cards
          : fitted.cards.filter((template) => titleOf(template).toLowerCase().includes(words));
      return cards.length === 0 ? [] : [{ ...fitted, cards }];
    });
    if (shown.length === 0) {
      return html`<div class="empty">${words === '' ? said.noDevice : said.noMatch}</div>`;
    }
    const areas = [...new Set(shown.map((fitted) => fitted.area ?? noArea))].toSorted((a, b) =>
      a === noArea ? 1 : b === noArea ? -1 : a.localeCompare(b),
    );
    return html`${repeat(
      areas,
      (area) => area,
      (area) =>
        html`<div class="heading">${area}</div>
          ${repeat(
            shown.filter((fitted) => (fitted.area ?? noArea) === area),
            (fitted) => fitted.device,
            (fitted) => this.device(fitted, index),
          )}`,
    )}`;
  }

  private device(fitted: Fitted, index: TemplateIndex): TemplateResult {
    const kind = fitted.kind;
    return html`<section class="device" role="group" aria-label=${fitted.name}>
      <div class="device-head">
        ${kind === undefined ? nothing : html`<ha-icon .icon=${kind.icon}></ha-icon>`}
        <span class="device-name">${fitted.name}</span>
        ${kind === undefined ? nothing : html`<span class="device-kind">${kind.title}</span>`}
      </div>
      <div class="tiles">
        ${repeat(
          fitted.cards,
          (template) => template,
          (template) => this.deviceTile(template, fitted, index),
        )}
      </div>
    </section>`;
  }

  private deviceTile(template: string, fitted: Fitted, index: TemplateIndex): TemplateResult {
    const standing = index[template];
    const title = standing?.title ?? template;
    const use = this.words().useFor(title, fitted.name);
    return html`<button
      type="button"
      class="control tile"
      aria-label=${use}
      title=${use}
      @click=${quietly(() => {
        this.dispatchEvent(
          new CustomEvent('template-picked', { detail: { template, device: fitted.device } }),
        );
      })}
    >
      <div class="tile-head">
        ${standing === undefined ? nothing : html`<ha-icon .icon=${standing.icon}></ha-icon>`}
        <span class="tile-name">${title}</span>
      </div>
      <div class="tile-description">${this.templates[template]?.description ?? ''}</div>
      <div class="tile-preview" inert data-template=${template} data-device=${fitted.device}>
        ${this.previews.get(`${template}@${fitted.device}`)?.card ?? nothing}
      </div>
    </button>`;
  }

  private async preview(target: Element): Promise<void> {
    const key = target instanceof HTMLElement ? previewKey(target) : undefined;
    const name = target instanceof HTMLElement ? target.dataset['template'] : undefined;
    const device = target instanceof HTMLElement ? target.dataset['device'] : undefined;
    const template = name === undefined ? undefined : this.templates[name];
    if (key === undefined || name === undefined || template === undefined) {
      return;
    }
    const card = await cardOf(
      device === undefined
        ? previewOf(name, template, this.hass)
        : { type: CARD, template: name, device },
    );
    card.preview = true;
    if (this.hass !== undefined) {
      card.hass = this.hass;
    }
    this.previews.set(key, { name, template, card });
    this.requestUpdate();
  }
}
