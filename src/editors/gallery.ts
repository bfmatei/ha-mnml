import { LitElement, css, html, nothing } from 'lit';
import type { CSSResultGroup, PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';

import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import type { Template, Templates } from '../contract/templates.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { quietly } from '../ha/templates.ts';
import { OWNER } from '../templates/families.ts';
import { rolesOf } from '../templates/roles.ts';

import { drawsCard, previewConfig } from './slots.ts';
import { EDITOR_STYLE } from './style.ts';

interface Preview {
  readonly template: Template;
  readonly card: ChildCard;
}

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
    text-align: left;
    padding: 8px;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1px var(--divider-color);
    white-space: normal;
  }
  .tile-name {
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .tile-description {
    font-size: 12px;
  }
  .tile-preview {
    height: 120px;
    overflow: hidden;
    border-radius: 8px;
  }
`;

export class MnmlTemplateGallery extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, CONTROL_STYLE, EDITOR_STYLE, GALLERY_STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) templates: Templates = {};
  @property({ attribute: false }) own: Templates = {};
  @state() private filter = '';
  @state() private everything = false;
  private observer: IntersectionObserver | undefined;
  private readonly previews = new Map<string, Preview>();

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
      for (const [name, preview] of this.previews) {
        if (this.templates[name] !== preview.template) {
          this.previews.delete(name);
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
    return html`<div class="gallery">
      <input
        class="filter"
        placeholder="Filter"
        aria-label="Filter the templates"
        .value=${live(this.filter)}
        @input=${filtered}
      />
      <div class="gallery">${this.tiles()}</div>
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

  private tiles(): TemplateResult {
    const templates = this.templates;
    const own = new Set(Object.keys(this.own));
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
                (name) => this.tile(name),
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

  private tile(name: string): TemplateResult | typeof nothing {
    const template = this.templates[name];
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
        this.dispatchEvent(new CustomEvent('template-picked', { detail: { template: name } }));
      })}
    >
      <div class="tile-name">${name}</div>
      <div class="tile-description">${template.description ?? ''}</div>
      ${
        drawsCard(template)
          ? html`<div class="tile-preview" inert data-template=${name}>
              ${this.previews.get(name)?.card ?? nothing}
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
    this.previews.set(name, { template, card });
    this.requestUpdate();
  }
}
