import { LitElement, css, html, nothing } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';
import { property, query, queryAll, state } from 'lit/decorators.js';
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
    position: fixed;
    inset: auto;
    margin: 0;
    border: 0;
    overflow: visible;
    display: none;
    flex-direction: column;
    min-width: 200px;
    padding: 4px 0;
    border-radius: 8px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
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
    white-space: nowrap;
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

const STEPS: Readonly<Record<string, (at: number, count: number) => number>> = {
  ArrowDown: (at) => at + 1,
  ArrowUp: (at) => at - 1,
  Home: () => 0,
  End: (_, count) => count - 1,
};

export class MnmlRowMenu extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, ROW_MENU_STYLE];

  @property({ attribute: false }) label = '';
  @property({ attribute: false }) items: readonly MenuItem[] = [];
  @state() private open = false;
  @query('.row-menu-button') private button: HTMLButtonElement | null | undefined;
  @query('.row-menu-list') private list: HTMLElement | null | undefined;
  @queryAll('.row-menu-item:not(:disabled)') private usable:
    | NodeListOf<HTMLButtonElement>
    | undefined;

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
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        @click=${quietly(this.toggle)}
      >
        ${icon('mdi:dots-vertical')}
      </button>
      <div class="row-menu-list" role="menu" popover="manual">
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
    window.addEventListener('scroll', this.scrolled, true);
    window.addEventListener('resize', this.scrolled);
    this.open = true;
    void this.updateComplete.then(() => {
      this.place();
      this.usable?.[0]?.focus();
    });
  };

  private place(): void {
    const { list, button } = this;
    if (!this.open || !list || !button) {
      return;
    }
    if (typeof list.showPopover === 'function' && !list.matches(':popover-open')) {
      list.showPopover();
    }
    const anchor = button.getBoundingClientRect();
    const box = list.getBoundingClientRect();
    const below = anchor.bottom + 4;
    const top = below + box.height > window.innerHeight - 8 ? anchor.top - box.height - 4 : below;
    const left = Math.min(Math.max(anchor.right - box.width, 8), window.innerWidth - box.width - 8);
    list.style.top = `${Math.max(Math.round(top), 8)}px`;
    list.style.left = `${Math.round(left)}px`;
  }

  private readonly scrolled = (event: Event): void => {
    if (event.composedPath().includes(this)) {
      return;
    }
    const anchor = this.button?.getBoundingClientRect();
    if (anchor === undefined || anchor.bottom < 0 || anchor.top > window.innerHeight) {
      this.close();
      return;
    }
    this.place();
  };

  private close(): void {
    window.removeEventListener('pointerdown', this.outside, true);
    window.removeEventListener('scroll', this.scrolled, true);
    window.removeEventListener('resize', this.scrolled);
    const list = this.list;
    if (typeof list?.hidePopover === 'function' && list.matches(':popover-open')) {
      list.hidePopover();
    }
    this.open = false;
  }

  private readonly outside = (event: Event): void => {
    if (!event.composedPath().includes(this)) {
      this.close();
    }
  };

  private readonly pressed = (event: KeyboardEvent): void => {
    if (!this.open) {
      return;
    }
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.close();
      this.button?.focus();
      return;
    }
    const items = [...(this.usable ?? [])];
    const at = items.findIndex((item) => item === this.shadowRoot?.activeElement);
    const to = STEPS[event.key]?.(at, items.length);
    if (to === undefined || items.length === 0) {
      return;
    }
    event.preventDefault();
    items[(to + items.length) % items.length]?.focus();
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
