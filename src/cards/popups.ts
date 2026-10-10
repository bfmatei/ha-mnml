import { LitElement, css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Condition, Popup, PopupOpening, PopupsCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import { visible } from '../ha/conditions.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { leave, narrow, reduced } from '../ha/motion.ts';
import { PREBUILD_EVENT, closePopup, originOf, popupDepth, whenOrigin } from '../ha/navigation.ts';
import { scrollable, scrollableAncestors } from '../ha/scroll.ts';

import { requireKnownKeys, schema } from './keys.ts';
import { announced, checkPopups, onAnnounce } from './parts/popup-registry.ts';
import { MOTION_STYLE } from './styles.ts';

interface Child {
  card: ChildCard;
  visibility: Condition[] | undefined;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Place {
  left: number;
  width: number;
  edge: number;
  up: boolean;
  maxHeight: number;
  from: Box;
}

interface View {
  turn: number;
  session: number;
  label: string | undefined;
  cards: Child[];
  opening: PopupOpening;
  place: Place | undefined;
  anchor: Element | undefined;
  unfolding: boolean;
}

const ROUTE_EVENTS = ['location-changed', 'popstate', 'hashchange'] as const;

export const SHEET = '(max-width: 600px)';
const TABLET = '(max-width: 1024px)';
const OPENINGS: readonly PopupOpening[] = ['sheet', 'dialog', 'unfold'];
const DEFAULT_OPEN = { phone: 'sheet', tablet: 'dialog', desktop: 'dialog' } as const;
const MARGIN = 8;
const ORIGIN_WAIT = 600;
const SETTLE_FRAMES = 6;
const SETTLE_MAX = 1500;
const UNFOLD_MIN = 420;
const UNFOLD_MIN_WIDTH = 320;
const UNFOLD = 300;
const SLIDE_OUT = 110;
const SLIDE_IN = 200;
const SLIDE_SHIFT = 20;
const SWIPE_ZONE = 88;
const SWIPE_START = 10;
const SWIPE_CLOSE = 80;
const SWIPE_FLICK = 0.6;
const SWIPE_OUT = 200;
const FOLD = 220;

function placed(from: Box): Place {
  const width = Math.min(Math.max(from.width, UNFOLD_MIN_WIDTH), innerWidth - 2 * MARGIN);
  const left = Math.min(Math.max(from.left, MARGIN), innerWidth - width - MARGIN);
  const top = Math.max(from.top, MARGIN);
  const bottom = Math.min(from.top + from.height, innerHeight - MARGIN);
  const below = innerHeight - top - MARGIN;
  const above = bottom - MARGIN;
  return below < UNFOLD_MIN && above > below
    ? { left, width, edge: innerHeight - bottom, up: true, maxHeight: above, from }
    : { left, width, edge: top, up: false, maxHeight: below, from };
}

function folded(place: Place, radius: string): string {
  const left = Math.max(0, place.from.left - place.left);
  const right = Math.max(0, place.width - left - place.from.width);
  const tall = `calc(100% - ${place.from.height}px)`;
  return place.up
    ? `inset(${tall} ${right}px 0px ${left}px round ${radius})`
    : `inset(0px ${right}px ${tall} ${left}px round ${radius})`;
}

const atLeast0 = (value: number): number => Math.max(0, value);

function settled(element: Element): Promise<void> {
  const start = performance.now();
  return new Promise((resolve) => {
    let last = '';
    let still = 0;
    const tick = (): void => {
      const box = element.getBoundingClientRect();
      const now = `${box.left} ${box.top} ${box.width} ${box.height}`;
      still = now === last ? still + 1 : 0;
      last = now;
      if (still >= SETTLE_FRAMES || performance.now() - start > SETTLE_MAX) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

const FADE_LEAVE = 140;
const SHEET_LEAVE = 200;

async function reveal(from: Element): Promise<void> {
  const page = scrollableAncestors(from)[0] ?? document.scrollingElement;
  if (page === null || page === undefined) {
    return;
  }
  const top = from.getBoundingClientRect().top;
  const short = UNFOLD_MIN - (innerHeight - top - MARGIN);
  const wanted = top < MARGIN ? top - MARGIN : Math.min(Math.max(short, 0), top - MARGIN);
  const room = page.scrollHeight - page.clientHeight - page.scrollTop;
  const delta = wanted < 0 ? Math.max(wanted, -page.scrollTop) : Math.min(wanted, room);
  if (delta === 0) {
    return;
  }
  page.scrollBy({ top: delta, behavior: reduced() ? 'instant' : 'smooth' });
  await settled(from);
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
  dialog {
    --p-edge: var(
      --mnml-card-edge-color,
      color-mix(in srgb, var(--primary-text-color) 12%, transparent)
    );
    --p-highlight: var(--mnml-card-highlight-color, transparent);
    --p-section: var(
      --mnml-popup-section-color,
      var(--mnml-pill-color, color-mix(in srgb, var(--primary-text-color) 8%, transparent))
    );
    --p-well: var(--mnml-button-shadow, none);
    --p-raised: var(--mnml-pill-raised-color, var(--card-background-color));
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
    background: var(--mnml-popup-scrim-color, rgb(0 0 0 / 0.55));
    -webkit-backdrop-filter: var(--mnml-popup-scrim-filter, none);
    backdrop-filter: var(--mnml-popup-scrim-filter, none);
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
    position: relative;
    border-radius: var(--mnml-popup-border-radius, 22px);
    background: var(--mnml-popup-background-color, var(--primary-background-color));
    -webkit-backdrop-filter: var(--mnml-popup-backdrop-filter, none);
    backdrop-filter: var(--mnml-popup-backdrop-filter, none);
    box-shadow:
      inset 0 0 0 1px var(--p-edge),
      inset 0 1px 0 var(--p-highlight),
      var(--mnml-popup-shadow, 0 18px 48px rgb(0 0 0 / 0.28));
    --ha-card-border-radius: 14px;
    --mnml-card-background-color: var(--p-section);
    --mnml-card-edge-color: transparent;
    --mnml-card-highlight-color: transparent;
    --mnml-card-shadow: var(--p-well);
    --mnml-card-backdrop-filter: none;
    --mnml-pill-color: var(--p-raised);
    --mnml-button-shadow: 0 0 0 transparent;
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
  .panel::after {
    content: '';
    position: absolute;
    inset: auto 0 0;
    height: 56px;
    border-radius: inherit;
    background: linear-gradient(to top, var(--mnml-popup-scroll-shadow, transparent), transparent);
    pointer-events: none;
    opacity: 0;
    transition: opacity 160ms ease-out;
  }
  .panel.more::after {
    opacity: 1;
  }
  [hidden] {
    display: none;
  }
  dialog.sheet[open] {
    align-items: flex-end;
  }
  .sheet .panel {
    width: 100%;
    max-height: 85dvh;
    margin-top: 0;
    animation: mnml-sheet 220ms ease-out;
    border-end-start-radius: 0;
    border-end-end-radius: 0;
    padding-bottom: calc(var(--mnml-popup-gap, 8px) + env(safe-area-inset-bottom, 0px));
  }
  dialog.unfold[open] {
    display: block;
  }
  dialog.unfold::backdrop {
    background: color-mix(
      in srgb,
      var(--mnml-popup-scrim-color, rgb(0 0 0 / 0.55)) 55%,
      transparent
    );
  }
  .unfold .panel {
    position: absolute;
    margin: 0;
    animation: none;
  }
`;

const SCHEMA = schema<PopupsCard>(
  { type: true, width: true, open: true, popups: true },
  {
    open: schema<NonNullable<PopupsCard['open']>>({ phone: true, tablet: true, desktop: true }),
    popups: schema<Popup>({ hash: true, cards: true }),
  },
);

export class MnmlPopupsCard extends LitElement {
  static override styles = [MOTION_STYLE, POPUPS_STYLE];

  @state() private view: View | undefined;
  @state() private leaving = false;
  @state() private more = false;
  @query('dialog') private dialog: HTMLDialogElement | null | undefined;
  @query('.panel') private panel: HTMLElement | null | undefined;

  private config: PopupsCard | undefined;
  private current: HomeAssistant | undefined;
  private shownHash: string | undefined;
  private landing: string | undefined;
  private following: number | undefined;
  private fed: Child[] = [];
  private turn = 0;
  private sessions = 0;
  private shownDepth = 0;
  private motion: Animation[] = [];
  private swipe: { id: number; y0: number; t0: number; dy: number; active: boolean } | undefined;
  private locked: { node: HTMLElement; overflow: string }[] | undefined;
  private ready: { hash: string; cards: Child[] } | undefined;
  private readonly pending = new Map<string, Promise<Child[]>>();
  private unsubscribe: (() => void) | undefined;
  private sizes: ResizeObserver | undefined;

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

  private readonly follow = (): void => {
    this.following = undefined;
    const view = this.view;
    const from = view?.anchor;
    if (view?.place === undefined || from?.isConnected !== true || this.leaving) {
      return;
    }
    const next = placed(from.getBoundingClientRect());
    const was = view.place;
    if (
      next.left !== was.left ||
      next.width !== was.width ||
      next.edge !== was.edge ||
      next.up !== was.up ||
      next.maxHeight !== was.maxHeight
    ) {
      this.view = { ...view, place: next };
    }
    this.following = requestAnimationFrame(this.follow);
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

  private readonly swipeStart = (event: PointerEvent): void => {
    const panel = this.panel;
    if (
      panel === null ||
      panel === undefined ||
      this.leaving ||
      event.pointerType === 'mouse' ||
      !event.isPrimary ||
      event.clientY - panel.getBoundingClientRect().top > SWIPE_ZONE ||
      event.composedPath().some((node) => scrollable(node) && node.scrollTop > 0)
    ) {
      return;
    }
    this.swipe = {
      id: event.pointerId,
      y0: event.clientY,
      t0: event.timeStamp,
      dy: 0,
      active: false,
    };
  };

  private readonly swipeMove = (event: PointerEvent): void => {
    const swipe = this.swipe;
    const panel = this.panel;
    if (
      swipe === undefined ||
      swipe.id !== event.pointerId ||
      panel === null ||
      panel === undefined
    ) {
      return;
    }
    const dy = event.clientY - swipe.y0;
    if (!swipe.active) {
      if (dy < -SWIPE_START) {
        this.swipe = undefined;
      } else if (dy > SWIPE_START) {
        swipe.active = true;
        panel.setPointerCapture(event.pointerId);
      }
    }
    if (swipe.active) {
      swipe.dy = Math.max(0, dy);
      panel.style.transform = `translateY(${swipe.dy}px)`;
    }
  };

  private readonly swipeEnd = (event: PointerEvent): void => {
    const swipe = this.swipe;
    const panel = this.panel;
    this.swipe = undefined;
    if (
      swipe === undefined ||
      !swipe.active ||
      swipe.id !== event.pointerId ||
      panel === null ||
      panel === undefined
    ) {
      return;
    }
    const speed = swipe.dy / Math.max(1, event.timeStamp - swipe.t0);
    if (swipe.dy > SWIPE_CLOSE || (speed > SWIPE_FLICK && swipe.dy > SWIPE_START * 2)) {
      this.dismiss(swipe.dy);
      return;
    }
    panel.style.removeProperty('transform');
    if (!reduced()) {
      panel.animate([{ transform: `translateY(${swipe.dy}px)` }, { transform: 'none' }], {
        duration: 180,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
      });
    }
  };

  private readonly swipeCancel = (event: PointerEvent): void => {
    const panel = this.panel;
    if (
      this.swipe?.id === event.pointerId &&
      this.swipe.active &&
      panel !== null &&
      panel !== undefined
    ) {
      panel.style.removeProperty('transform');
    }
    this.swipe = undefined;
  };

  private dismiss(from: number): void {
    const panel = this.panel;
    if (panel === null || panel === undefined) {
      return;
    }
    this.turn += 1;
    const turn = this.turn;
    this.leaving = true;
    const slide = reduced()
      ? undefined
      : panel.animate(
          [{ transform: `translateY(${from}px)` }, { transform: `translateY(${innerHeight}px)` }],
          { duration: SWIPE_OUT, easing: 'ease-in', fill: 'forwards' },
        );
    closePopup();
    void (slide?.finished ?? Promise.resolve()).then(
      () => {
        if (this.turn === turn) {
          this.close();
        }
      },
      () => undefined,
    );
  }

  setConfig(config: PopupsCard): void {
    requireKnownKeys(config, SCHEMA);
    if (!/^\d+(?:\.\d+)?px$/.test(config.width)) {
      throw new Error('width must be a size in pixels, such as 560px');
    }
    if (config.popups !== undefined && !Array.isArray(config.popups)) {
      throw new Error('popups must be a list');
    }
    for (const [device, opening] of Object.entries(config.open ?? {})) {
      if (!OPENINGS.includes(opening)) {
        throw new Error(`open.${device} must be one of ${OPENINGS.join(', ')}`);
      }
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
    this.landing = location.hash === '' ? undefined : location.hash;
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
    this.sizes?.disconnect();
    if (this.following !== undefined) {
      cancelAnimationFrame(this.following);
      this.following = undefined;
    }
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
    const panel = classMap({ panel: true, more: this.more });
    const place = view.place;
    const panelStyle =
      place === undefined
        ? {}
        : {
            left: `${place.left}px`,
            [place.up ? 'bottom' : 'top']: `${place.edge}px`,
            width: `${place.width}px`,
            'max-height': `${place.maxHeight}px`,
            'clip-path':
              view.unfolding && view.cards.length === 0 ? folded(place, this.radius()) : undefined,
          };
    return html`<dialog
      class=${classMap({ leaving: this.leaving, [view.opening]: true })}
      style=${styleMap({ '--popup-width': this.config?.width })}
      aria-label=${ifDefined(view.label)}
      @cancel=${this.cancelled}
      @click=${this.clicked}
      @touchmove=${this.dragged}
    >
      ${keyed(
        view.session,
        html`<div
          class=${panel}
          style=${styleMap(panelStyle)}
          @pointerdown=${this.swipeStart}
          @pointermove=${this.swipeMove}
          @pointerup=${this.swipeEnd}
          @pointercancel=${this.swipeCancel}
        >
          <div class="head">${first?.card ?? nothing}</div>
          <div class="body" @scroll=${this.measure}>${rest.map((child) => child.card)}</div>
        </div>`,
      )}
    </dialog>`;
  }

  private readonly measure = (): void => {
    const body = this.renderRoot.querySelector('.body');
    const more = body !== null && body.scrollHeight - body.clientHeight - body.scrollTop > 2;
    if (more !== this.more) {
      this.more = more;
    }
  };

  private watch(): void {
    if (typeof ResizeObserver !== 'function') {
      return;
    }
    this.sizes ??= new ResizeObserver(this.measure);
    this.sizes.disconnect();
    const body = this.renderRoot.querySelector('.body');
    if (body !== null) {
      this.sizes.observe(body);
      for (const child of body.children) {
        this.sizes.observe(child);
      }
    }
  }

  protected override updated(): void {
    this.watch();
    this.measure();
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
    const patient = this.landing === entry.hash;
    this.landing = undefined;
    const before = this.leaving ? undefined : this.view;
    const kept =
      before?.place !== undefined && before.anchor?.isConnected === true ? before : undefined;
    const wanted = kept === undefined ? this.opening() : 'unfold';
    const from =
      kept?.anchor ??
      (wanted === 'unfold'
        ? (originOf(entry.hash) ??
          (patient ? await whenOrigin(entry.hash, ORIGIN_WAIT) : undefined))
        : undefined);
    if (from !== undefined && patient) {
      await settled(from);
    }
    if (from !== undefined && wanted === 'unfold' && kept === undefined) {
      await reveal(from);
    }
    if (this.turn !== turn) {
      return;
    }
    this.lock();
    this.leaving = false;
    this.fed = [];
    for (const motion of this.motion) {
      motion.cancel();
    }
    this.motion = [];
    const opening = wanted === 'unfold' && from === undefined ? 'dialog' : wanted;
    const place =
      kept?.place ?? (from === undefined ? undefined : placed(from.getBoundingClientRect()));
    const unfolding = kept === undefined && place !== undefined;
    const anchor = from;
    const open = before !== undefined && this.dialog?.open === true && !reduced();
    const session = open ? before.session : ++this.sessions;
    const direction = popupDepth() >= this.shownDepth ? 1 : -1;
    this.shownDepth = popupDepth();
    const ready = this.ready;
    this.ready = undefined;
    const built = async (): Promise<Child[]> =>
      ready?.hash === entry.hash
        ? ready.cards
        : await (this.pending.get(entry.hash) ?? this.build(entry));
    if (open) {
      const height = this.panel?.getBoundingClientRect().height ?? 0;
      const [cards] = await Promise.all([built(), this.slideOut(direction)]);
      if (this.turn !== turn) {
        return;
      }
      this.fed = cards;
      this.view = { turn, session, label, cards, opening, place, anchor, unfolding };
      await this.updateComplete;
      if (this.turn === turn) {
        this.slideIn(height, direction);
      }
      return;
    }
    this.view = { turn, session, label, cards: [], opening, place, anchor, unfolding };
    const cards = await built();
    await this.updateComplete;
    if (this.turn !== turn) {
      return;
    }
    this.fed = cards;
    this.view = { turn, session, label, cards, opening, place, anchor, unfolding };
    if (place !== undefined && this.following === undefined) {
      this.following = requestAnimationFrame(this.follow);
    }
    await this.updateComplete;
    const panel = this.panel;
    if (
      this.turn === turn &&
      place !== undefined &&
      unfolding &&
      panel !== null &&
      panel !== undefined &&
      !reduced()
    ) {
      panel.animate([{ clipPath: folded(place, this.radius()) }, { clipPath: this.openClip() }], {
        duration: UNFOLD,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
      });
    }
  }

  private parts(): Element[] {
    return [...(this.panel?.children ?? [])].filter(
      (part) => part.classList.contains('head') || part.classList.contains('body'),
    );
  }

  private async slideOut(direction: number): Promise<void> {
    this.motion = this.parts().map((part) =>
      part.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: `translateX(${-direction * SLIDE_SHIFT}px)` },
        ],
        { duration: SLIDE_OUT, easing: 'ease-in', fill: 'forwards' },
      ),
    );
    await Promise.all(
      this.motion.map((motion) =>
        motion.finished.then(
          () => undefined,
          () => undefined,
        ),
      ),
    );
  }

  private slideIn(height: number, direction: number): void {
    const panel = this.panel;
    for (const motion of this.motion) {
      motion.cancel();
    }
    this.motion = [];
    if (panel === null || panel === undefined) {
      return;
    }
    for (const part of this.parts()) {
      if (part.classList.contains('body')) {
        part.scrollTop = 0;
      }
    }
    this.motion = this.parts().map((part) =>
      part.animate(
        [
          { opacity: 0, transform: `translateX(${direction * SLIDE_SHIFT}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: SLIDE_IN, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      ),
    );
    const now = panel.getBoundingClientRect().height;
    if (Math.abs(now - height) > 1) {
      panel.style.overflow = 'hidden';
      const morph = panel.animate([{ height: `${height}px` }, { height: `${now}px` }], {
        duration: SLIDE_IN,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
      });
      this.motion.push(morph);
      void morph.finished.then(
        () => {
          panel.style.removeProperty('overflow');
        },
        () => {
          panel.style.removeProperty('overflow');
        },
      );
    }
  }

  private opening(): PopupOpening {
    const device = narrow(SHEET) ? 'phone' : narrow(TABLET) ? 'tablet' : 'desktop';
    return this.config?.open?.[device] ?? DEFAULT_OPEN[device];
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
    const opening = this.view.opening;
    const place = this.view.place;
    const anchor = this.view.anchor;
    const back =
      place === undefined || anchor?.isConnected !== true || place.from.width === 0
        ? undefined
        : this.foldTo(panel, anchor);
    const keyframes: Keyframe[] =
      back !== undefined
        ? [{ clipPath: this.openClip() }, { clipPath: back }]
        : opening === 'sheet'
          ? [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]
          : [{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px)' }];
    const duration = back !== undefined ? FOLD : opening === 'sheet' ? SHEET_LEAVE : FADE_LEAVE;
    void leave(panel, keyframes, duration).then(() => {
      if (this.turn === turn) {
        this.close();
      }
    });
  }

  private foldTo(panel: HTMLElement, anchor: Element): string {
    const to = anchor.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    return `inset(${atLeast0(to.top - box.top)}px ${atLeast0(box.right - to.right)}px ${atLeast0(box.bottom - to.bottom)}px ${atLeast0(to.left - box.left)}px round ${this.radius()})`;
  }

  private radius(): string {
    const value = Number.parseFloat(
      getComputedStyle(this).getPropertyValue('--ha-card-border-radius'),
    );
    return `${Number.isFinite(value) ? value : 18}px`;
  }

  private openClip(): string {
    return `inset(0px 0px 0px 0px round ${this.radius()})`;
  }

  private close(): void {
    for (const motion of this.motion) {
      motion.cancel();
    }
    this.motion = [];
    this.swipe = undefined;
    this.dialog?.close();
    this.view = undefined;
    this.leaving = false;
  }
}
