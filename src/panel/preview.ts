import { LitElement, css, html, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { live } from 'lit/directives/live.js';
import { styleMap } from 'lit/directives/style-map.js';

import { checkPopups } from '../cards/parts/popup-registry.ts';
import type { Popup } from '../contract/cards.ts';
import { PART_KEY, isMapping } from '../contract/templates.ts';
import type { Template, Templates, Value, WrittenTemplate } from '../contract/templates.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { navigate } from '../ha/navigation.ts';
import { registriesOf } from '../ha/registries.ts';
import { icon } from '../ha/templates.ts';
import { discover } from '../templates/discover.ts';
import { expand, filled } from '../templates/expand.ts';
import type { Marking } from '../templates/expand.ts';

import { shapedOf } from './data.ts';
import { messageOf } from './message.ts';
import { PANEL_STYLE } from './style.ts';

export interface Trial {
  card: Value;
  popups: Popup[];
  sources: string[];
}

export interface TrialOn {
  area?: string | undefined;
  slots?: Record<string, Value> | undefined;
}

function sourcesOf(list: readonly Value[]): string[] {
  return list.map((each) =>
    isMapping(each) && typeof each[PART_KEY] === 'string' ? each[PART_KEY] : '',
  );
}

export function tryDraft(
  templates: Templates,
  name: string,
  draft: WrittenTemplate,
  on: TrialOn,
  hass: HomeAssistant | undefined,
  marking?: Marking,
): Trial {
  const shaped = shapedOf(name, draft);
  const all: Templates = { ...templates, [name]: shaped };
  const found =
    on.area === undefined || hass === undefined
      ? {}
      : discover(shaped, on.area, registriesOf(hass));
  const expanded = expand(
    all,
    { template: name, slots: on.slots ?? {} },
    found,
    new Set(),
    marking,
  );
  if (expanded.missing !== undefined) {
    throw new Error(`waiting for ${expanded.missing.join(', ')}`);
  }
  const card = expanded.card;
  const popup = isMapping(card) && card['type'] === undefined && typeof card['hash'] === 'string';
  return popup
    ? {
        card: null,
        popups: checkPopups([card, ...expanded.popups]),
        sources: sourcesOf([card, ...expanded.popups]),
      }
    : { card, popups: checkPopups(expanded.popups), sources: sourcesOf(expanded.popups) };
}

export function richestArea(
  templates: Templates,
  name: string,
  template: Template,
  areas: readonly { value: string }[],
  hass: HomeAssistant | undefined,
): string | undefined {
  if (hass === undefined) {
    return undefined;
  }
  const counted: { area: string; count: number }[] = [];
  for (const area of areas) {
    try {
      const found = discover(template, area.value, registriesOf(hass));
      counted.push({
        area: area.value,
        count: Object.values(found).filter((value) => filled(value)).length,
      });
    } catch {
      continue;
    }
  }
  for (const { area, count } of counted.toSorted((a, b) => b.count - a.count)) {
    if (count === 0) {
      return undefined;
    }
    try {
      tryDraft(templates, name, template, { area }, hass);
      return area;
    } catch {
      continue;
    }
  }
  return undefined;
}

export function trialOf(template: WrittenTemplate, area: string | undefined): TrialOn {
  return area === undefined ? { slots: template.example ?? {} } : { area };
}

export interface Area {
  value: string;
  label: string;
}

interface Box {
  kind: 'hover' | 'chosen' | 'drop';
  x: number;
  y: number;
  width: number;
  height: number;
}

function partsOf(root: ParentNode, key: string, found: Element[] = []): Element[] {
  for (const child of root.querySelectorAll('*')) {
    if (child.getAttribute('data-part') === key) {
      found.push(child);
    }
    if (child.shadowRoot !== null) {
      partsOf(child.shadowRoot, key, found);
    }
  }
  return found;
}

function allParts(root: ParentNode, found = new Map<string, Element>()): Map<string, Element> {
  for (const child of root.querySelectorAll('*')) {
    const part = child.getAttribute('data-part');
    if (part !== null && !found.has(part)) {
      found.set(part, child);
    }
    if (child.shadowRoot !== null) {
      allParts(child.shadowRoot, found);
    }
  }
  return found;
}

export type StageKey = 'remove' | 'earlier' | 'later';

function partAt(event: Event): string | undefined {
  for (const node of event.composedPath()) {
    if (node instanceof Element) {
      const part = node.getAttribute('data-part');
      if (part !== null) {
        return part;
      }
    }
  }
  return undefined;
}

const LONG_PRESS = 400;

function markNative(root: ParentNode): void {
  for (const child of root.querySelectorAll('*')) {
    if (!child.hasAttribute('data-part')) {
      const config: unknown = Reflect.get(child, 'config') ?? Reflect.get(child, '_config');
      const part = isMapping(config) ? config[PART_KEY] : undefined;
      if (typeof part === 'string') {
        child.setAttribute('data-part', part);
      }
    }
    if (child.shadowRoot !== null) {
      markNative(child.shadowRoot);
    }
  }
}

const PREVIEW_STYLE = css`
  .preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .preview-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stage {
    max-width: 560px;
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .popup-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .preview.staged .stage {
    position: relative;
    max-width: 640px;
  }
  .preview.staged .cards {
    cursor: pointer;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .cards.sheet {
    box-sizing: border-box;
    max-width: 560px;
    padding: 10px;
    border-radius: 22px;
    background: var(--card-background-color);
    box-shadow: 0 8px 28px rgb(0 0 0 / 0.18);
  }
  .marks {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .mark {
    position: absolute;
    box-sizing: border-box;
    border-radius: 12px;
    outline-offset: 2px;
  }
  .mark.hover {
    outline: 2px dashed color-mix(in srgb, var(--primary-color) 70%, transparent);
  }
  .mark.drop {
    outline: 3px solid var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 18%, transparent);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    margin: 0;
    white-space: nowrap;
  }
  .stage-box:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 4px;
    border-radius: 22px;
  }
  .mark.chosen {
    outline: 2px solid var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 9%, transparent);
  }
  .view-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-right: auto;
  }
`;

export class MnmlPreview extends LitElement {
  static override styles = [PANEL_STYLE, PREVIEW_STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) trial: (() => Trial) | undefined;
  @property({ attribute: false }) areas: readonly Area[] = [];
  @property({ attribute: false }) area: string | undefined;
  @property({ attribute: false }) choose: ((area: string | undefined) => void) | undefined;
  @property({ attribute: false }) staged = false;
  @property({ attribute: false }) selected = '';
  @property({ attribute: false }) view = 'card';
  @property({ attribute: false }) pick: ((key: string) => void) | undefined;
  @property({ attribute: false }) show: ((view: string) => void) | undefined;
  @property({ attribute: false }) act: ((action: StageKey) => void) | undefined;
  @property({ attribute: false }) reorder: ((from: string, to: string) => void) | undefined;
  @property({ attribute: false }) said = '';
  @state() private hovered = '';
  @state() private dropping = '';
  @state() private boxes: Box[] = [];
  @state() private helpless = false;
  @query('.cards') private stage: HTMLElement | null | undefined;
  @query('.stage-box') private frame: HTMLElement | null | undefined;
  private made: Trial | undefined;
  private problem: string | undefined;
  private drawn: ChildCard[] = [];
  private drawing = 0;
  private watcher: ResizeObserver | undefined;
  private drag: { key: string; x: number; y: number; moving: boolean; touch: boolean } | undefined;
  private press: ReturnType<typeof setTimeout> | undefined;
  private skipClick = false;
  private cursor: string | undefined;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.watcher?.disconnect();
    this.watcher = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('selected')) {
      this.cursor = undefined;
    }
    if (changed.has('trial') || changed.has('area')) {
      try {
        this.made = this.trial?.();
        this.problem = undefined;
      } catch (error) {
        this.made = undefined;
        this.problem = messageOf(error);
      }
    }
    if (changed.has('hass') && this.hass !== undefined) {
      for (const child of this.drawn) {
        child.hass = this.hass;
      }
    }
  }

  private siblings(key: string): string[] {
    const at = key.lastIndexOf('/');
    const prefix = key.slice(0, at);
    if (!key.slice(at + 1).startsWith('#') || this.stage === null || this.stage === undefined) {
      return [];
    }
    return [...allParts(this.stage).keys()].filter(
      (other) => other.slice(0, other.lastIndexOf('/')) === prefix && other.includes('/#'),
    );
  }

  private nearest(key: string, x: number, y: number): string | undefined {
    const parts =
      this.stage === null || this.stage === undefined ? undefined : allParts(this.stage);
    let best: string | undefined;
    let least = Number.POSITIVE_INFINITY;
    for (const other of this.siblings(key)) {
      const box = parts?.get(other)?.getBoundingClientRect();
      if (box === undefined) {
        continue;
      }
      const away = Math.hypot(box.left + box.width / 2 - x, box.top + box.height / 2 - y);
      if (away < least) {
        least = away;
        best = other;
      }
    }
    return best;
  }

  private readonly onClick = {
    handleEvent: (event: Event): void => {
      event.stopPropagation();
      event.preventDefault();
      if (this.skipClick) {
        this.skipClick = false;
        return;
      }
      const part = partAt(event) ?? this.sourceOfView();
      this.frame?.focus({ preventScroll: true });
      if (part !== undefined) {
        this.pick?.(part);
      }
    },
    capture: true,
  };

  private readonly onDown = {
    handleEvent: (event: Event): void => {
      event.stopPropagation();
      if (!(event instanceof PointerEvent) || event.button !== 0) {
        return;
      }
      const key = partAt(event);
      clearTimeout(this.press);
      if (key === undefined) {
        this.drag = undefined;
        return;
      }
      const touch = event.pointerType === 'touch';
      const drag = { key, x: event.clientX, y: event.clientY, moving: false, touch };
      this.drag = drag;
      if (touch) {
        this.press = setTimeout(() => {
          if (this.drag === drag) {
            drag.moving = true;
          }
        }, LONG_PRESS);
      }
    },
    capture: true,
  };

  private readonly onMove = {
    handleEvent: (event: Event): void => {
      if (!(event instanceof PointerEvent)) {
        return;
      }
      const drag = this.drag;
      if (drag !== undefined && (event.buttons & 1) === 1) {
        const away = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
        if (drag.touch && !drag.moving && away > 8) {
          clearTimeout(this.press);
          this.drag = undefined;
          return;
        }
        if (!drag.touch && !drag.moving && away > 6) {
          drag.moving = true;
        }
        if (drag.moving) {
          const over = this.nearest(drag.key, event.clientX, event.clientY);
          this.dropping = over === undefined || over === drag.key ? '' : over;
          return;
        }
      }
      if (!drag?.touch) {
        this.hovered = partAt(event) ?? '';
      }
    },
    capture: true,
  };

  private readonly onUp = {
    handleEvent: (event: Event): void => {
      event.stopPropagation();
      clearTimeout(this.press);
      const drag = this.drag;
      this.drag = undefined;
      if (drag?.moving === true) {
        this.skipClick = true;
        const target = this.dropping;
        this.dropping = '';
        if (target !== '') {
          this.reorder?.(drag.key, target);
        }
      }
    },
    capture: true,
  };

  private readonly onCancel = {
    handleEvent: (): void => {
      clearTimeout(this.press);
      this.drag = undefined;
      this.dropping = '';
    },
    capture: true,
  };

  private readonly onTouch = {
    handleEvent: (event: Event): void => {
      if (this.drag?.moving === true && event.cancelable) {
        event.preventDefault();
      }
    },
    capture: true,
    passive: false,
  };

  private readonly onKeys = {
    handleEvent: (event: Event): void => {
      if (!(event instanceof KeyboardEvent) || !this.staged || event.target !== this.frame) {
        return;
      }
      const keys =
        this.stage === null || this.stage === undefined ? [] : [...allParts(this.stage).keys()];
      const at = keys.indexOf(this.cursor ?? this.selected);
      const go = (to: number | undefined): void => {
        const next =
          to === undefined ? undefined : keys[Math.max(0, Math.min(keys.length - 1, to))];
        if (next !== undefined) {
          event.preventDefault();
          this.cursor = next;
          this.pick?.(next);
        }
      };
      if (event.altKey && ['ArrowLeft', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        this.act?.('earlier');
      } else if (event.altKey && ['ArrowRight', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        this.act?.('later');
      } else if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
        go(at + 1);
      } else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
        go(at <= 0 ? 0 : at - 1);
      } else if (event.key === 'Home') {
        go(0);
      } else if (event.key === 'End') {
        go(keys.length - 1);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.act?.('remove');
      } else if (event.key === 'Escape') {
        this.pick?.('');
      }
    },
  };

  private readonly onSilence = {
    handleEvent: (event: Event): void => {
      event.stopPropagation();
    },
    capture: true,
  };

  private readonly onLeave = (): void => {
    this.hovered = '';
  };

  private shownView(): string {
    const made = this.made;
    if (this.view === 'card' && made?.card === null && made.popups[0] !== undefined) {
      return made.popups[0].hash;
    }
    return this.view;
  }

  private sourceOfView(): string | undefined {
    const made = this.made;
    const view = this.shownView();
    if (made === undefined || view === 'card') {
      return undefined;
    }
    const at = made.popups.findIndex((popup) => popup.hash === view);
    const source = made.sources[at];
    return source === undefined || source === '' ? undefined : source;
  }

  private drawViews(made: Trial | undefined): TemplateResult | typeof nothing {
    if (!this.staged || made === undefined || made.popups.length === 0) {
      return nothing;
    }
    const views = [
      ...(made.card === null ? [] : ['card']),
      ...made.popups.map((popup) => popup.hash),
    ];
    const now = this.shownView();
    return html`<div class="view-tabs">
      ${views.map(
        (view) =>
          html`<button
            type="button"
            class=${classMap({ chip: true, active: view === now })}
            aria-pressed=${view === now}
            @click=${() => {
              this.show?.(view);
            }}
          >
            ${view === 'card' ? 'Card' : view}
          </button>`,
      )}
    </div>`;
  }

  protected override render(): TemplateResult {
    const made = this.made;
    return html`<div class=${classMap({ preview: true, staged: this.staged })}>
      <div class="preview-head">
        ${this.drawViews(made)}
        <span class="muted">Try it on</span>
        <select
          class="area-picker"
          aria-label="Try it on"
          .value=${live(this.area ?? '')}
          @change=${(event: Event) => {
            const value = field(event.target, 'value');
            this.choose?.(typeof value === 'string' && value !== '' ? value : undefined);
          }}
        >
          <option value="" ?selected=${this.area === undefined}>The example</option>
          ${this.areas.map(
            (area) =>
              html`<option value=${area.value} ?selected=${area.value === this.area}>
                ${area.label}
              </option>`,
          )}
        </select>
      </div>
      <div
        class="stage stage-box"
        tabindex=${this.staged ? 0 : nothing}
        role=${this.staged ? 'application' : nothing}
        aria-label=${
          this.staged
            ? 'The card. Click a part, or use the arrow keys to move between parts. Delete removes the part, Alt and the arrows move it.'
            : nothing
        }
        @keydown=${this.staged ? this.onKeys : nothing}
      >
        ${
          this.problem === undefined
            ? html`<div
                  class=${classMap({ cards: true, sheet: this.staged && this.shownView() !== 'card' })}
                  @click=${this.staged ? this.onClick : nothing}
                  @pointerdown=${this.staged ? this.onDown : nothing}
                  @pointerup=${this.staged ? this.onUp : nothing}
                  @pointercancel=${this.staged ? this.onCancel : nothing}
                  @touchmove=${this.staged ? this.onTouch : nothing}
                  @pointermove=${this.staged ? this.onMove : nothing}
                  @pointerleave=${this.staged ? this.onLeave : nothing}
                  @keydown=${this.staged ? this.onSilence : nothing}
                ></div>
                ${
                  this.helpless
                    ? html`<p class="muted">
                        Home Assistant has not loaded its card helpers on this page, so the preview
                        cannot draw. Open a dashboard once, then come back.
                      </p>`
                    : nothing
                }`
            : html`<div class="problem">
                ${icon('mdi:alert-circle-outline')}<span>${this.problem}</span>
              </div>`
        }
        ${
          this.staged
            ? html`<p class="sr-only" role="status" aria-live="polite">${this.said}</p>
                <div class="marks" aria-hidden="true">
                  ${this.boxes.map(
                    (box) =>
                      html`<div
                        class=${`mark ${box.kind}`}
                        style=${styleMap({
                          left: `${box.x}px`,
                          top: `${box.y}px`,
                          width: `${box.width}px`,
                          height: `${box.height}px`,
                        })}
                      ></div>`,
                  )}
                </div>`
            : nothing
        }
      </div>
      ${
        this.staged || made === undefined || made.popups.length === 0
          ? nothing
          : html`<div class="popup-list">
              <span class="muted">Pop-ups</span>
              ${made.popups.map(
                (popup) =>
                  html`<button
                    type="button"
                    class="chip"
                    aria-label=${`Open ${popup.hash}`}
                    title=${`Open ${popup.hash}`}
                    @click=${() => {
                      navigate(popup.hash);
                    }}
                  >
                    ${popup.hash}
                  </button>`,
              )}
            </div>`
      }
    </div>`;
  }

  protected override firstUpdated(): void {
    const box = this.frame;
    if (box === null || box === undefined || typeof ResizeObserver !== 'function') {
      return;
    }
    this.watcher = new ResizeObserver(() => {
      this.place();
    });
    this.watcher.observe(box);
    if (this.stage !== null && this.stage !== undefined) {
      this.watcher.observe(this.stage);
    }
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('trial') || changed.has('area') || changed.has('view')) {
      void this.drawCards();
    }
    if (
      changed.has('selected') ||
      changed.has('hovered') ||
      changed.has('dropping') ||
      changed.has('view')
    ) {
      this.place();
    }
  }

  private place(): void {
    const frame = this.frame;
    const cards = this.stage;
    if (
      !this.staged ||
      frame === null ||
      frame === undefined ||
      cards === null ||
      cards === undefined
    ) {
      return;
    }
    const base = frame.getBoundingClientRect();
    const boxes: Box[] = [];
    const add = (kind: Box['kind'], key: string): void => {
      if (key === '' || (kind === 'hover' && (key === this.selected || key === this.dropping))) {
        return;
      }
      for (const element of partsOf(cards, key)) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          boxes.push({
            kind,
            x: Math.round(rect.left - base.left),
            y: Math.round(rect.top - base.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
    };
    add('drop', this.dropping);
    add('hover', this.hovered);
    add('chosen', this.selected);
    if (JSON.stringify(boxes) !== JSON.stringify(this.boxes)) {
      this.boxes = boxes;
    }
  }

  private async drawCards(): Promise<void> {
    const box = this.stage;
    const made = this.made;
    if (box === null || box === undefined || made === undefined) {
      return;
    }
    this.drawing += 1;
    const mine = this.drawing;
    const load = window.loadCardHelpers;
    this.helpless = load === undefined;
    if (load === undefined) {
      box.replaceChildren();
      return;
    }
    const helpers = await load();
    if (mine !== this.drawing) {
      return;
    }
    const create = (config: object): ChildCard => {
      const card = helpers.createCardElement(config);
      const part: unknown = Reflect.get(config, PART_KEY);
      if (typeof part === 'string' && !card.hasAttribute('data-part')) {
        card.setAttribute('data-part', part);
      }
      return card;
    };
    const sheet = this.staged
      ? made.popups.find((popup) => popup.hash === this.shownView())
      : undefined;
    const cards =
      sheet === undefined
        ? [
            ...(isMapping(made.card) ? [create(made.card)] : []),
            ...(made.popups.length > 0 && !this.staged
              ? [
                  helpers.createCardElement({
                    type: 'custom:mnml-popups-card',
                    width: '600px',
                    popups: made.popups,
                  }),
                ]
              : []),
          ]
        : sheet.cards.map((card) => create(card));
    for (const card of cards) {
      card.preview = true;
      if (this.hass !== undefined) {
        card.hass = this.hass;
      }
    }
    this.drawn = cards;
    box.replaceChildren(...cards);
    for (const wait of [60, 300, 900]) {
      setTimeout(() => {
        markNative(box);
        this.place();
      }, wait);
    }
  }
}
