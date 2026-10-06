import { LitElement, css, html, nothing } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { BASE_STYLE } from '../cards/styles.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { icon, quietly } from '../ha/templates.ts';

export interface MenuItem {
  readonly label: string;
  readonly icon: MdiIcon;
  readonly disabled?: true;
  readonly run: () => void;
}

const ROW_MENU_STYLE = css`
  .row-menu {
    position: relative;
  }
  .row-menu-button {
    all: unset;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--secondary-text-color);
    cursor: pointer;
  }
  .row-menu-button:hover {
    background: var(--m-hover);
  }
  .row-menu-list {
    position: absolute;
    right: 0;
    top: 40px;
    z-index: 2;
    display: none;
    flex-direction: column;
    min-width: 160px;
    padding: 4px 0;
    border-radius: 8px;
    background: var(--card-background-color);
    box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.28));
  }
  .row-menu.open .row-menu-list {
    display: flex;
  }
  .row-menu-item {
    all: unset;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    color: var(--primary-text-color);
    cursor: pointer;
  }
  .row-menu-item:hover {
    background: var(--m-hover);
  }
  .row-menu-item:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .row-menu-button:focus-visible,
  .row-menu-item:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
`;

export class MnmlRowMenu extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, ROW_MENU_STYLE];

  @property({ attribute: false }) label = '';
  @property({ attribute: false }) items: readonly MenuItem[] = [];
  @state() private open = false;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.close();
  }

  protected override render(): TemplateResult {
    const more = `More for ${this.label}`;
    return html`<div
      class=${classMap({ 'row-menu': true, open: this.open })}
      @keydown=${this.pressed}
      @focusout=${this.left}
    >
      <button
        type="button"
        class="row-menu-button"
        aria-label=${more}
        title=${more}
        @click=${quietly(this.toggle)}
      >
        ${icon('mdi:dots-vertical')}
      </button>
      <div class="row-menu-list" role="menu">
        ${this.open ? this.items.map((item) => this.entry(item)) : nothing}
      </div>
    </div>`;
  }

  private entry(item: MenuItem): TemplateResult {
    return html`<button
      type="button"
      class="row-menu-item"
      role="menuitem"
      aria-label=${item.label}
      title=${item.label}
      ?disabled=${item.disabled === true}
      @click=${quietly(() => {
        this.close();
        item.run();
      })}
    >
      ${icon(item.icon)}<span>${item.label}</span>
    </button>`;
  }

  private readonly toggle = (): void => {
    if (this.open) {
      this.close();
      return;
    }
    window.addEventListener('pointerdown', this.outside, true);
    this.open = true;
  };

  private close(): void {
    window.removeEventListener('pointerdown', this.outside, true);
    this.open = false;
  }

  private readonly outside = (event: Event): void => {
    if (!event.composedPath().includes(this)) {
      this.close();
    }
  };

  private readonly pressed = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.open) {
      event.stopPropagation();
      this.close();
    }
  };

  private readonly left = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    const inside = next instanceof Node && this.renderRoot.contains(next);
    if (!inside) {
      this.close();
    }
  };
}

export function rowMenu(label: string, items: readonly MenuItem[]): TemplateResult {
  return html`<mnml-row-menu .label=${label} .items=${items}></mnml-row-menu>`;
}
