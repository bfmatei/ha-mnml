import { LitElement, css, html, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color } from '../../contract/cards.ts';
import type { MdiIcon } from '../../contract/entities.ts';
import { rightToLeft } from '../../ha/direction.ts';
import { unavailableValue } from '../../ha/format.ts';
import { haptic, run, settled } from '../../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';
import { UNAVAILABLE } from '../../ha/rules.ts';
import { colorStyle, colorVar, icon } from '../../ha/templates.ts';
import { wordsFor } from '../../words/words.ts';
import type { Host } from '../base.ts';
import { BASE_STYLE } from '../styles.ts';

import { closeButton, openOverlay } from './overlay.ts';
import type { SliderSpec } from './slider-spec.ts';

export interface SliderLabel {
  icon: MdiIcon;
  name: string;
}

const SLIDER_STYLE = css`
  .slider {
    position: relative;
    height: var(--m-slider-height, 40px);
    border-radius: 12px;
    overflow: hidden;
    background: var(--m-pill);
    box-shadow: var(--m-well);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: ew-resize;
  }
  .slider.disabled {
    cursor: default;
  }
  .slider .fill {
    position: absolute;
    inset-block: 0;
    inset-inline: 0 auto;
    width: var(--fill);
    border-inline-end: 2px solid var(--m-color, var(--accent-color));
    background: color-mix(in srgb, var(--m-color, var(--accent-color)) 38%, transparent);
  }
  .slider.gradient {
    background: var(--gradient);
  }
  .slider.gradient.dimmed {
    filter: saturate(0.12) opacity(0.55);
  }
  .slider.gradient.dimmed .marker {
    display: none;
  }
  .slider.gradient .fill {
    display: none;
  }
  .slider .marker {
    display: none;
  }
  .slider.gradient .marker {
    display: block;
    position: absolute;
    top: 5px;
    bottom: 5px;
    inset-inline-start: clamp(4px, calc(var(--fill) - 2px), calc(100% - 8px));
    width: 4px;
    border-radius: 2px;
    background: #fff;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.3);
  }
  .slider .label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    pointer-events: none;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .slider .label ha-icon {
    --mdc-icon-size: 20px;
    flex: none;
  }
  .slider .label .label-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .slider .label .label-value {
    flex: none;
    margin-inline-start: auto;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .slider.gradient .label {
    color: var(--primary-text-color);
    text-shadow:
      0 0 6px var(--card-background-color),
      0 0 2px var(--card-background-color);
  }
  .slider.full {
    height: 56px;
    border-radius: var(--ha-card-border-radius, 22px);
    background: var(--mnml-card-background-color, var(--card-background-color));
    -webkit-backdrop-filter: var(--mnml-card-backdrop-filter, none);
    backdrop-filter: var(--mnml-card-backdrop-filter, none);
    box-shadow: var(--mnml-card-shadow, none);
  }
  .slider.full.gradient {
    background: var(--gradient);
  }
  .slider.full .label {
    padding: 0 16px;
    font-size: 15px;
  }

  .slider.full:not(.gradient)::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px
        var(--mnml-card-edge-color, color-mix(in srgb, var(--primary-text-color) 12%, transparent)),
      inset 0 1px 0 var(--mnml-card-highlight-color, transparent);
    pointer-events: none;
  }
  @media (prefers-contrast: more) {
    .slider .fill {
      border-inline-end-width: 3px;
    }
  }
  @media (forced-colors: active) {
    .slider {
      border: 1px solid CanvasText;
    }
    .slider .fill {
      background: Highlight;
      border-inline-end-color: CanvasText;
    }
    .slider.gradient .fill {
      display: block;
    }
    .slider .marker {
      background: CanvasText;
      box-shadow: none;
    }
  }
`;

const COMMIT_GRACE = 600;
const COMMIT_CEILING = 5000;
const KEY_DEBOUNCE = 500;

function decimals(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

export const OVERLAY_STYLE = css`
  .overlay {
    animation: mnml-fade 120ms ease-out;
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: inherit;
    background: var(--mnml-overlay-background-color, var(--card-background-color));
    -webkit-backdrop-filter: var(--mnml-card-backdrop-filter, none);
    backdrop-filter: var(--mnml-card-backdrop-filter, none);
  }
  .overlay mnml-slider {
    flex: 1;
  }
  .heading {
    position: relative;
  }
  .heading > .overlay {
    padding: 0;
    border-radius: 12px;
    --m-slider-height: 36px;
    color: var(--primary-text-color);
    letter-spacing: normal;
    text-transform: none;
  }
`;

export interface Unavailable {
  hass: HomeAssistant;
  stateObj: HassEntity;
}

export class MnmlSlider extends LitElement {
  static override styles = [BASE_STYLE, SLIDER_STYLE];

  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  @property({ attribute: false }) spec: SliderSpec | undefined;
  @property({ attribute: false }) label: SliderLabel | undefined;
  @property({ attribute: false }) color: Color | undefined;
  @property({ attribute: false }) owner: Host | undefined;
  @property({ attribute: false }) unavailable: Unavailable | undefined;
  @property({ attribute: false }) interacted: (() => void) | undefined;
  @property({ type: Boolean }) full = false;

  @state() private value: number | undefined;
  private dragging = false;
  private release: (() => void) | undefined;
  private pause: ReturnType<typeof setTimeout> | undefined;
  private letGo: ReturnType<typeof setTimeout> | undefined;
  private commits = 0;
  private keyed = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('spec') && !this.dragging && this.release === undefined) {
      this.value = undefined;
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.pause);
    clearTimeout(this.letGo);
    if (
      this.keyed &&
      this.spec !== undefined &&
      this.owner !== undefined &&
      this.value !== undefined
    ) {
      haptic('selection');
      run(this.owner, this.spec.commit(this.value));
    }
    this.keyed = false;
    this.release?.();
    this.release = undefined;
  }

  protected override render(): TemplateResult | typeof nothing {
    const label = this.label;
    if (label === undefined) {
      return nothing;
    }
    const off = this.unavailable;
    if (off !== undefined) {
      return html`<div
        class=${classMap({ slider: true, disabled: true, full: this.full })}
        role="slider"
        aria-disabled="true"
        aria-label=${label.name}
        aria-valuetext=${off.hass.formatEntityState(off.stateObj)}
      >
        <div class="label">
          <span class="colored" style=${styleMap(colorStyle(UNAVAILABLE))}
            >${icon(label.icon)}</span
          >
          <span class="label-name">${label.name}</span>
          <span class="label-value colored" style=${styleMap(colorStyle(UNAVAILABLE))}
            >${unavailableValue(off.hass, off.stateObj)}</span
          >
        </div>
      </div>`;
    }
    const spec = this.spec;
    if (spec === undefined) {
      return nothing;
    }
    const current = this.value ?? spec.value;
    const span = spec.max - spec.min;
    const percent = span > 0 ? ((current - spec.min) / span) * 100 : 0;
    const text = spec.format(current);
    const toward = rightToLeft(this) ? 'left' : 'right';
    return html`<div
      class=${classMap({
        slider: true,
        gradient: spec.stops !== undefined,
        dimmed: spec.dimmed === true,
        full: this.full,
      })}
      style=${styleMap({
        '--fill': `${Math.max(0, Math.min(100, percent))}%`,
        '--gradient':
          spec.stops === undefined ? undefined : `linear-gradient(to ${toward}, ${spec.stops})`,
        '--m-color': colorVar(this.color),
      })}
      role="slider"
      tabindex="0"
      aria-label=${label.name}
      aria-valuemin=${spec.min}
      aria-valuemax=${spec.max}
      aria-valuenow=${current}
      aria-valuetext=${text}
      @click=${this.stop}
      @pointerdown=${this.down}
      @pointermove=${this.move}
      @pointerup=${this.settle}
      @pointercancel=${this.settle}
      @lostpointercapture=${this.settle}
      @keydown=${this.key}
    >
      <div class="fill"></div>
      <div class="marker"></div>
      <div class="label">
        ${icon(label.icon)}<span class="label-name">${label.name}</span>${
          spec.dimmed ? nothing : html`<span class="label-value">${text}</span>`
        }
      </div>
    </div>`;
  }

  private readonly stop = (event: Event): void => {
    event.stopPropagation();
  };

  private quantise(raw: number): number {
    const spec = this.spec;
    if (spec === undefined) {
      return raw;
    }
    const stepped = spec.step > 0 ? Math.round(raw / spec.step) * spec.step : raw;
    return Number(Math.max(spec.min, Math.min(spec.max, stepped)).toFixed(decimals(spec.step)));
  }

  private fromPointer(track: Element, clientX: number): number {
    const spec = this.spec;
    if (spec === undefined) {
      return 0;
    }
    const rect = track.getBoundingClientRect();
    const along = rightToLeft(track) ? rect.right - clientX : clientX - rect.left;
    const ratio = rect.width > 0 ? Math.max(0, Math.min(1, along / rect.width)) : 0;
    return this.quantise(spec.min + ratio * (spec.max - spec.min));
  }

  private commit(): void {
    const spec = this.spec;
    const owner = this.owner;
    if (spec === undefined || owner === undefined) {
      return;
    }
    this.commits += 1;
    const sent = this.commits;
    const landed = (): void => {
      if (sent !== this.commits || this.keyed || this.dragging) {
        return;
      }
      clearTimeout(this.letGo);
      this.letGo = setTimeout(() => {
        this.release?.();
        this.release = undefined;
      }, COMMIT_GRACE);
    };
    clearTimeout(this.letGo);
    this.letGo = setTimeout(landed, COMMIT_CEILING);
    haptic('selection');
    void settled(owner, spec.commit(this.value ?? spec.value)).then(landed);
  }

  private readonly down = (event: PointerEvent): void => {
    const track = event.currentTarget;
    if (!(track instanceof Element)) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.dragging = true;
    this.keyed = false;
    clearTimeout(this.pause);
    clearTimeout(this.letGo);
    this.release ??= this.owner?.hold();
    track.setPointerCapture(event.pointerId);
    this.value = this.fromPointer(track, event.clientX);
    this.interacted?.();
  };

  private readonly move = (event: PointerEvent): void => {
    const track = event.currentTarget;
    if (this.dragging && track instanceof Element) {
      this.value = this.fromPointer(track, event.clientX);
      this.interacted?.();
    }
  };

  private readonly settle = (): void => {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.commit();
    this.interacted?.();
  };

  private readonly key = (event: KeyboardEvent): void => {
    const spec = this.spec;
    if (spec === undefined) {
      return;
    }
    const step = spec.step > 0 ? spec.step : 1;
    const current = this.value ?? spec.value;
    const [forward, backward] = rightToLeft(this)
      ? ['ArrowLeft', 'ArrowRight']
      : ['ArrowRight', 'ArrowLeft'];
    const next =
      event.key === 'Home'
        ? spec.min
        : event.key === 'End'
          ? spec.max
          : event.key === forward || event.key === 'ArrowUp'
            ? this.quantise(current + step)
            : event.key === backward || event.key === 'ArrowDown'
              ? this.quantise(current - step)
              : undefined;
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.release ??= this.owner?.hold();
    this.value = next;
    this.interacted?.();
    clearTimeout(this.pause);
    clearTimeout(this.letGo);
    this.keyed = true;
    this.pause = setTimeout(() => {
      this.keyed = false;
      this.commit();
    }, KEY_DEBOUNCE);
  };
}

export function openSliderOverlay(
  surface: HTMLElement,
  spec: SliderSpec,
  label: SliderLabel,
  color: Color | undefined,
  host: Host,
  keyboard: boolean,
  closed?: () => void,
): void {
  const closing = wordsFor(host.hass?.locale.language ?? '').close;
  const { overlay } = openOverlay(
    surface,
    host,
    'overlay',
    ({ close, schedule }) =>
      html`<mnml-slider
          .spec=${spec}
          .label=${label}
          .color=${color}
          .owner=${host}
          .interacted=${schedule}
        ></mnml-slider>
        ${closeButton(closing, close)}`,
    { closed },
  );
  const slider = overlay.querySelector('mnml-slider');
  if (keyboard && slider instanceof MnmlSlider) {
    void slider.updateComplete.then(() => {
      if (slider.isConnected) {
        slider.focus();
      }
    });
  }
}
