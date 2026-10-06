import { LitElement, css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Condition, Popup, PopupsCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import { visible } from '../ha/conditions.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { leave, narrow, reduced } from '../ha/motion.ts';
import { PREBUILD_EVENT, closePopup } from '../ha/navigation.ts';

import { requireKnownKeys, schema } from './keys.ts';
import { announced, checkPopups, onAnnounce } from './parts/popup-registry.ts';
import { MOTION_STYLE } from './styles.ts';

interface Child {
  card: ChildCard;
  visibility: Condition[] | undefined;
}

interface View {
  turn: number;
  label: string | undefined;
  cards: Child[];
}

const ROUTE_EVENTS = ['location-changed', 'popstate', 'hashchange'] as const;

export const SHEET = '(max-width: 600px)';

const FADE_LEAVE = 140;
const SHEET_LEAVE = 200;

function scrollable(node: unknown): node is HTMLElement {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  const overflow = getComputedStyle(node).overflowY;
  return (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight;
}

function scrollableAncestors(from: Node): HTMLElement[] {
  const found: HTMLElement[] = [];
  let node: Node | null = from;
  while (node !== null) {
    const parent: Node | null = node instanceof ShadowRoot ? node.host : (node.parentNode ?? null);
    if (scrollable(parent)) {
      found.push(parent);
    }
    node = parent;
  }
  return found;
}

function feed(child: Child, hass: HomeAssistant): void {
  child.card.hass = hass;
  child.card.hidden = !visible(hass, child.visibility);
}

const POPUPS_STYLE = css`
  :host {
    display: block;
    height: 0;
  }
  dialog[open] {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    border: 0;
    padding: 0;
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    touch-action: none;
  }
  dialog:focus {
    outline: none;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.55);
    animation: mnml-fade 140ms ease-out;
  }
  dialog.leaving {
    pointer-events: none;
  }
  dialog.leaving::backdrop {
    animation: mnml-vanish 180ms ease-in forwards;
  }
  .panel {
    box-sizing: border-box;
    width: min(var(--popup-width), calc(100% - 16px));
    max-height: calc(100dvh - 64px);
    min-height: 0;
    margin-top: 32px;
    padding: var(--mnml-popup-gap, 8px);
    border-radius: var(--mnml-popup-border-radius, 24px);
    background: var(--mnml-popup-background-color, var(--primary-background-color));
    display: flex;
    flex-direction: column;
    gap: var(--mnml-popup-gap, 8px);
    animation: mnml-rise 160ms ease-out;
  }
  .head {
    flex: none;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--mnml-popup-gap, 8px);
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }
  .body:empty {
    display: none;
  }
  [hidden] {
    display: none;
  }
  @media (max-width: 600px) {
    dialog[open] {
      align-items: flex-end;
    }
    .panel {
      width: 100%;
      max-height: 85dvh;
      margin-top: 0;
      animation: mnml-sheet 220ms ease-out;
      border-end-start-radius: 0;
      border-end-end-radius: 0;
      padding-bottom: calc(var(--mnml-popup-gap, 8px) + env(safe-area-inset-bottom, 0px));
    }
  }
`;

const SCHEMA = schema<PopupsCard>(
  { type: true, width: true, popups: true },
  { popups: schema<Popup>({ hash: true, cards: true }) },
);

export class MnmlPopupsCard extends LitElement {
  static override styles = [MOTION_STYLE, POPUPS_STYLE];

  @state() private view: View | undefined;
  @state() private leaving = false;
  @query('dialog') private dialog: HTMLDialogElement | null | undefined;
  @query('.panel') private panel: HTMLElement | null | undefined;

  private config: PopupsCard | undefined;
  private current: HomeAssistant | undefined;
  private shownHash: string | undefined;
  private fed: Child[] = [];
  private turn = 0;
  private locked: { node: HTMLElement; overflow: string }[] | undefined;
  private ready: { hash: string; cards: Child[] } | undefined;
  private readonly pending = new Map<string, Promise<Child[]>>();
  private unsubscribe: (() => void) | undefined;

  private readonly route = (): void => {
    const hash = location.hash;
    if (this.shownHash === hash) {
      return;
    }
    const entry = this.entries().find((popup) => popup.hash === hash);
    if (entry === undefined) {
      this.shut();
      return;
    }
    void this.show(entry);
  };

  private readonly prepare = (event: Event): void => {
    const hash = field(field(event, 'detail'), 'hash');
    if (
      typeof hash !== 'string' ||
      hash === this.shownHash ||
      this.ready?.hash === hash ||
      this.pending.has(hash)
    ) {
      return;
    }
    const config = this.config;
    const entry = this.entries().find((popup) => popup.hash === hash);
    if (entry === undefined) {
      return;
    }
    const build = this.build(entry);
    this.pending.set(hash, build);
    void build.then((cards) => {
      if (this.pending.get(hash) === build) {
        this.pending.delete(hash);
      }
      if (!this.isConnected || this.config !== config || this.shownHash === hash) {
        return;
      }
      this.ready = { hash, cards };
    });
  };

  private readonly cancelled = (event: Event): void => {
    event.preventDefault();
    closePopup();
  };

  private readonly clicked = (event: Event): void => {
    if (event.target === event.currentTarget) {
      closePopup();
    }
  };

  private readonly dragged = {
    handleEvent: (event: Event): void => {
      if (!event.composedPath().some(scrollable)) {
        event.preventDefault();
      }
    },
    passive: false,
  };

  setConfig(config: PopupsCard): void {
    requireKnownKeys(config, SCHEMA);
    if (!/^\d+(?:\.\d+)?px$/.test(config.width)) {
      throw new Error('width must be a size in pixels, such as 560px');
    }
    if (config.popups !== undefined && !Array.isArray(config.popups)) {
      throw new Error('popups must be a list');
    }
    checkPopups(config.popups ?? []);
    this.shut();
    this.ready = undefined;
    this.pending.clear();
    this.config = config;
    if (this.isConnected) {
      this.route();
    }
  }

  get hass(): HomeAssistant | undefined {
    return this.current;
  }

  set hass(hass: HomeAssistant | undefined) {
    this.current = hass;
    if (hass === undefined) {
      return;
    }
    for (const child of this.fed) {
      feed(child, hass);
    }
    for (const child of this.ready?.cards ?? []) {
      feed(child, hass);
    }
  }

  getCardSize(): number {
    return 0;
  }

  getGridOptions(): { columns: number; rows: 'auto' } {
    return { columns: 1, rows: 'auto' };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    for (const name of ROUTE_EVENTS) {
      window.addEventListener(name, this.route);
    }
    window.addEventListener(PREBUILD_EVENT, this.prepare);
    this.unsubscribe = onAnnounce(this.route);
    this.route();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const name of ROUTE_EVENTS) {
      window.removeEventListener(name, this.route);
    }
    window.removeEventListener(PREBUILD_EVENT, this.prepare);
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.ready = undefined;
    this.pending.clear();
    this.shut();
  }

  protected override render(): TemplateResult | typeof nothing {
    const view = this.view;
    if (view === undefined) {
      return nothing;
    }
    const [first, ...rest] = view.cards;
    return html`<dialog
      class=${classMap({ leaving: this.leaving })}
      style=${styleMap({ '--popup-width': this.config?.width })}
      aria-label=${ifDefined(view.label)}
      @cancel=${this.cancelled}
      @click=${this.clicked}
      @touchmove=${this.dragged}
    >
      ${keyed(
        view.turn,
        html`<div class="panel">
          <div class="head">${first?.card ?? nothing}</div>
          <div class="body">${rest.map((child) => child.card)}</div>
        </div>`,
      )}
    </dialog>`;
  }

  protected override updated(): void {
    const dialog = this.dialog;
    if (
      dialog !== null &&
      dialog !== undefined &&
      this.isConnected &&
      !dialog.open &&
      !this.leaving
    ) {
      dialog.showModal();
    }
  }

  private entries(): Popup[] {
    return announced(this.config?.popups ?? []);
  }

  private async build(entry: Popup): Promise<Child[]> {
    const helpers = await window.loadCardHelpers?.();
    if (helpers === undefined) {
      return [];
    }
    return entry.cards.map((config) => {
      const child = { card: helpers.createCardElement(config), visibility: config.visibility };
      if (this.current !== undefined) {
        feed(child, this.current);
      }
      return child;
    });
  }

  private async show(entry: Popup): Promise<void> {
    if (this.config === undefined) {
      return;
    }
    this.shownHash = entry.hash;
    this.turn += 1;
    const turn = this.turn;
    const name = entry.cards[0]?.['name'];
    const label = typeof name === 'string' ? name : undefined;
    this.lock();
    this.leaving = false;
    this.fed = [];
    this.view = { turn, label, cards: [] };
    const ready = this.ready;
    this.ready = undefined;
    const cards =
      ready?.hash === entry.hash
        ? ready.cards
        : await (this.pending.get(entry.hash) ?? this.build(entry));
    await this.updateComplete;
    if (this.turn !== turn) {
      return;
    }
    this.fed = cards;
    this.view = { turn, label, cards };
  }

  private lock(): void {
    this.locked ??= scrollableAncestors(this).map((node) => {
      const overflow = node.style.overflow;
      node.style.overflow = 'hidden';
      return { node, overflow };
    });
  }

  private unlock(): void {
    for (const { node, overflow } of this.locked ?? []) {
      node.style.overflow = overflow;
    }
    this.locked = undefined;
  }

  private shut(): void {
    this.shownHash = undefined;
    this.unlock();
    if (this.view === undefined || this.leaving) {
      return;
    }
    this.turn += 1;
    const turn = this.turn;
    this.fed = [];
    const panel = this.panel;
    if (panel === null || panel === undefined || this.isUpdatePending || reduced()) {
      this.close();
      return;
    }
    this.leaving = true;
    const sheet = narrow(SHEET);
    const keyframes: Keyframe[] = sheet
      ? [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]
      : [{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px)' }];
    void leave(panel, keyframes, sheet ? SHEET_LEAVE : FADE_LEAVE).then(() => {
      if (this.turn === turn) {
        this.close();
      }
    });
  }

  private close(): void {
    this.dialog?.close();
    this.view = undefined;
    this.leaving = false;
  }
}
