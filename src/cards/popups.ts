import { LitElement, css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';

import type {
  LovelaceCardConfig,
  Popup,
  PopupAlert,
  PopupOpening,
  PopupScreen,
  PopupsCard,
} from '../contract/cards.ts';
import type { PopupHash } from '../contract/entities.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import { Judge } from '../ha/conditions.ts';
import { rightToLeft } from '../ha/direction.ts';
import { field } from '../ha/field.ts';
import { stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { letGoOfFocus, trackInput } from '../ha/modality.ts';
import { leave, narrow, reduced } from '../ha/motion.ts';
import { nameOf } from '../ha/names.ts';
import {
  PREBUILD_EVENT,
  back,
  closePopup,
  navigate,
  originOf,
  popupDepth,
  whenOrigin,
} from '../ha/navigation.ts';
import { active } from '../ha/rules.ts';
import { scrollable, scrollableAncestors } from '../ha/scroll.ts';

import { requireCard } from './keys.ts';
import { cardOf } from './parts/card-element.ts';
import { announced, checkPopups, onAnnounce } from './parts/popup-registry.ts';
import { swipeToClose } from './parts/popup-swipe.ts';
import {
  foldTo,
  folded,
  following,
  placed,
  reveal,
  settled,
  unfolded,
} from './parts/popup-unfold.ts';
import type { Place } from './parts/popup-unfold.ts';
import { MOTION_STYLE } from './styles.ts';

interface Child {
  card: ChildCard;
  entity: unknown;
  visibility: unknown;
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
const DEFAULT_OPEN = { phone: 'sheet', tablet: 'dialog', desktop: 'dialog' } as const;
const ORIGIN_WAIT = 600;
const UNFOLD = 300;
const SLIDE_OUT = 110;
const SLIDE_IN = 200;
const SLIDE_SHIFT = 20;
const FOLD = 220;
const FADE_LEAVE = 140;
const SHEET_LEAVE = 200;
const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
const reported = new Set<string>();

function screen(): PopupScreen {
  return narrow(SHEET) ? 'phone' : narrow(TABLET) ? 'tablet' : 'desktop';
}

function alerted(alert: PopupAlert, hass: HomeAssistant): boolean {
  return active(
    alert.is === undefined && alert.not === undefined
      ? { attribute: alert.attribute, is: ['on'] }
      : alert,
    stateOf(hass, alert.entity),
  );
}

function causedBy(previous: HomeAssistant | undefined, hass: HomeAssistant): boolean {
  const user = hass.user?.id;
  if (previous === undefined || user === undefined || previous.states === hass.states) {
    return false;
  }
  return Object.values(hass.states).some(
    (stateObj) =>
      stateObj !== previous.states[stateObj.entity_id] && stateObj.context?.user_id === user,
  );
}

function headerName(
  header: LovelaceCardConfig | undefined,
  hass: HomeAssistant | undefined,
): string | undefined {
  const name = header?.['name'];
  if (typeof name === 'string') {
    return name;
  }
  const entity = header?.['entity'];
  if (typeof entity !== 'string' || hass === undefined) {
    return undefined;
  }
  return nameOf(hass, entity, header?.['label'] === 'device' ? { label: 'device' } : {});
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
    inset-inline-start: 0;
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
    margin-inline-end: calc(5px - var(--mnml-popup-gap, 8px));
    padding-inline-end: 6px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
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
  private fed: Child[] = [];
  private turn = 0;
  private sessions = 0;
  private shownDepth = 0;
  private motion: Animation[] = [];
  private locked: { node: HTMLElement; overflow: string }[] | undefined;
  private ready: { hash: string; cards: Child[] } | undefined;
  private readonly pending = new Map<string, Promise<Child[]>>();
  private unsubscribe: (() => void) | undefined;
  private sizes: ResizeObserver | undefined;
  private held: boolean[] | undefined;
  private readonly raised = new Map<number, PopupHash>();
  private idle: ReturnType<typeof setTimeout> | undefined;
  private lastInput = 0;
  private readonly judge = new Judge(() => {
    this.rejudge();
  });

  private readonly input = (): void => {
    this.lastInput = performance.now();
  };

  private readonly idled = (): void => {
    this.idle = undefined;
    const seconds = this.config?.idle_close;
    if (seconds === undefined || this.shownHash === undefined) {
      this.stopIdle();
      return;
    }
    const left = seconds * 1000 - (performance.now() - this.lastInput);
    if (left > 0) {
      this.idle = setTimeout(this.idled, left);
      return;
    }
    this.stopIdle();
    closePopup();
  };

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

  private readonly follower = following(
    () => (this.leaving ? undefined : this.view),
    () => this.dialogWidth(),
    (place) => {
      if (this.view !== undefined) {
        this.view = { ...this.view, place };
      }
    },
  );

  private readonly swipe = swipeToClose(
    () => this.panel,
    () => this.leaving,
    (gone) => {
      this.dismiss(gone);
    },
  );

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

  private dismiss(gone: Promise<unknown>): void {
    this.turn += 1;
    const turn = this.turn;
    this.leaving = true;
    closePopup();
    void gone.then(
      () => {
        if (this.turn === turn) {
          this.close();
        }
      },
      () => undefined,
    );
  }

  setConfig(config: PopupsCard): void {
    requireCard(config, CARD_STRUCTURES['custom:mnml-popups-card']);
    if (!/^\d+(?:\.\d+)?px$/.test(config.width)) {
      throw new Error('width must be a size in pixels, such as 560px');
    }
    if (config.idle_close !== undefined && config.idle_close <= 0) {
      throw new Error('idle_close must be a number of seconds above zero');
    }
    checkPopups(config.popups ?? []);
    this.shut();
    this.ready = undefined;
    this.pending.clear();
    this.held = undefined;
    this.raised.clear();
    this.config = config;
    if (this.isConnected) {
      this.route();
    }
  }

  get hass(): HomeAssistant | undefined {
    return this.current;
  }

  set hass(hass: HomeAssistant | undefined) {
    const previous = this.current;
    this.current = hass;
    if (hass === undefined) {
      return;
    }
    if (this.idle !== undefined && causedBy(previous, hass)) {
      this.input();
    }
    for (const child of [...this.fed, ...(this.ready?.cards ?? [])]) {
      this.feed(child, hass);
    }
    this.alert(hass);
  }

  private feed(child: Child, hass: HomeAssistant): void {
    child.card.hass = hass;
    child.card.hidden = !this.judge.shown(child.visibility, hass, child.entity);
  }

  private rejudge(): void {
    const hass = this.current;
    if (hass === undefined) {
      return;
    }
    for (const child of [...this.fed, ...(this.ready?.cards ?? [])]) {
      child.card.hidden = !this.judge.shown(child.visibility, hass, child.entity);
    }
  }

  private alert(hass: HomeAssistant): void {
    const alerts = this.config?.alerts ?? [];
    const held = alerts.map((alert) => alerted(alert, hass));
    const before = this.held;
    this.held = held;
    if (before === undefined || !this.isConnected) {
      return;
    }
    for (const [index, alert] of alerts.entries()) {
      if (held[index] === before[index]) {
        continue;
      }
      if (held[index] === true) {
        this.raise(index, alert, hass);
      } else {
        this.lower(index);
      }
    }
  }

  private raise(index: number, alert: PopupAlert, hass: HomeAssistant): void {
    const user = hass.user?.id;
    if (
      (alert.screens !== undefined && !alert.screens.includes(screen())) ||
      (alert.users !== undefined && (user === undefined || !alert.users.includes(user))) ||
      location.hash === alert.popup
    ) {
      return;
    }
    if (!this.entries().some((popup) => popup.hash === alert.popup)) {
      this.report(`alerts[${index}] opens ${alert.popup}, and no pop-up has that hash`);
      return;
    }
    this.raised.set(index, alert.popup);
    navigate(alert.popup);
  }

  private report(message: string): void {
    if (reported.has(message)) {
      return;
    }
    reported.add(message);
    this.dispatchEvent(
      new CustomEvent('hass-notification', {
        bubbles: true,
        composed: true,
        detail: { message },
      }),
    );
  }

  private lower(index: number): void {
    const hash = this.raised.get(index);
    this.raised.delete(index);
    if (hash !== undefined && location.hash === hash) {
      back();
    }
  }

  private watchIdle(): void {
    const seconds = this.config?.idle_close;
    this.lastInput = performance.now();
    if (seconds === undefined || this.idle !== undefined) {
      return;
    }
    for (const name of INPUT_EVENTS) {
      window.addEventListener(name, this.input, { capture: true, passive: true });
    }
    this.idle = setTimeout(this.idled, seconds * 1000);
  }

  private stopIdle(): void {
    clearTimeout(this.idle);
    this.idle = undefined;
    for (const name of INPUT_EVENTS) {
      window.removeEventListener(name, this.input, { capture: true });
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
    trackInput();
    this.held = undefined;
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
    this.follower.stop();
    this.ready = undefined;
    this.pending.clear();
    this.shut();
    this.judge.close();
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
          @pointerdown=${this.swipe.start}
          @pointermove=${this.swipe.move}
          @pointerup=${this.swipe.end}
          @pointercancel=${this.swipe.cancel}
        >
          <div class="head">${first?.card ?? nothing}</div>
          <div class="body" @scroll=${this.scrolled}>${rest.map((child) => child.card)}</div>
        </div>`,
      )}
    </dialog>`;
  }

  private readonly scrolled = (): void => {
    this.input();
    this.measure();
  };

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

  private build(entry: Popup): Promise<Child[]> {
    return Promise.all(
      entry.cards.map(async (config) => {
        const child = {
          card: await cardOf(config),
          entity: config['entity'],
          visibility: config.visibility,
        };
        if (this.current !== undefined) {
          this.feed(child, this.current);
        }
        return child;
      }),
    );
  }

  private async show(entry: Popup): Promise<void> {
    if (this.config === undefined) {
      return;
    }
    this.shownHash = entry.hash;
    this.watchIdle();
    this.turn += 1;
    const turn = this.turn;
    const label = headerName(entry.cards[0], this.current);
    const patient = this.landing === entry.hash;
    this.landing = undefined;
    const before = this.leaving ? undefined : this.view;
    const kept = unfolded(before) ? before : undefined;
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
      kept?.place ??
      (from === undefined ? undefined : placed(from.getBoundingClientRect(), this.dialogWidth()));
    const unfolding = kept === undefined && place !== undefined;
    const anchor = from;
    const open = before !== undefined && this.dialog?.open === true && !reduced();
    const session = open ? before.session : ++this.sessions;
    const direction = (popupDepth() >= this.shownDepth ? 1 : -1) * (rightToLeft(this) ? -1 : 1);
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
    if (place !== undefined) {
      this.follower.start();
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
    const device = screen();
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
    this.stopIdle();
    this.unlock();
    if (this.leaving) {
      return;
    }
    this.turn += 1;
    if (this.view === undefined) {
      return;
    }
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
        : foldTo(panel.getBoundingClientRect(), anchor.getBoundingClientRect(), this.radius());
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

  private dialogWidth(): number {
    return Number.parseFloat(this.config?.width ?? '0');
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
    this.swipe.reset();
    this.follower.stop();
    this.dialog?.close();
    letGoOfFocus();
    this.judge.close();
    this.view = undefined;
    this.leaving = false;
  }
}
