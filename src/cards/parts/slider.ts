import { LitElement, css, html, nothing, render } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, SliderKind } from '../../contract/cards.ts';
import type { EntityId, MdiIcon } from '../../contract/entities.ts';
import { formatAttribute, unavailableValue } from '../../ha/format.ts';
import { callService, numberAttribute, numericState, settled } from '../../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';
import { UNAVAILABLE } from '../../ha/rules.ts';
import { colorStyle, colorVar, icon } from '../../ha/templates.ts';
import type { Host } from '../base.ts';
import { BASE_STYLE } from '../styles.ts';

import { dismissable } from './overlay.ts';

export interface SliderSpec {
  min: number;
  max: number;
  step: number;
  value: number;
  gradient?: string;
  dimmed?: true;
  format(value: number): string;
  commit(value: number): Promise<unknown>;
}

export interface SliderLabel {
  icon: MdiIcon;
  name: string;
}

const SLIDER_STYLE = css`
  .slider {
    position: relative;
    height: 40px;
    border-radius: 12px;
    overflow: hidden;
    background: var(--m-pill);
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
    inset: 0 auto 0 0;
    width: var(--fill);
    border-right: 2px solid var(--m-color, var(--accent-color));
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
    left: clamp(4px, calc(var(--fill) - 2px), calc(100% - 8px));
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
  .slider .label .label-value {
    margin-left: auto;
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
    border-radius: var(--ha-card-border-radius, 18px);
    background: var(--card-background-color);
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
    box-shadow: inset 0 0 0 1px
      var(--mnml-card-edge-color, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
    pointer-events: none;
  }
  @media (prefers-contrast: more) {
    .slider .fill {
      border-right-width: 3px;
    }
  }
  @media (forced-colors: active) {
    .slider {
      border: 1px solid CanvasText;
    }
    .slider .fill {
      background: Highlight;
      border-right-color: CanvasText;
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

const WHITE_GRADIENT = 'linear-gradient(90deg, #ffb057 0%, #fff1dc 55%, #cfe1ff 100%)';
const HUE_GRADIENT =
  'linear-gradient(90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))';

const COMMIT_GRACE = 600;
const COMMIT_CEILING = 5000;
const KEY_DEBOUNCE = 500;
const OVERLAY_TIMEOUT = 3000;

function decimals(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

interface SpecOptions {
  turn_on?: true;
}

export function sliderSpec(
  hass: HomeAssistant,
  id: EntityId,
  stateObj: HassEntity,
  kind: SliderKind,
  options: SpecOptions = {},
): SliderSpec | undefined {
  switch (kind) {
    case 'brightness': {
      const brightness = numberAttribute(stateObj, 'brightness') ?? 0;
      return {
        min: 0,
        max: 100,
        step: 1,
        value: stateObj.state === 'on' ? Math.round((brightness / 255) * 100) : 0,
        format: (value) => formatAttribute(hass, stateObj, 'brightness', (value / 100) * 255),
        commit: (value) =>
          value === 0
            ? callService(hass, id, 'light.turn_off')
            : callService(hass, id, 'light.turn_on', { brightness_pct: value }),
      };
    }
    case 'color_temp': {
      const min = numberAttribute(stateObj, 'min_color_temp_kelvin') ?? 2000;
      const kelvin = numberAttribute(stateObj, 'color_temp_kelvin');
      return {
        min,
        max: numberAttribute(stateObj, 'max_color_temp_kelvin') ?? 6500,
        step: 50,
        value: kelvin ?? min,
        gradient: WHITE_GRADIENT,
        dimmed: stateObj.state === 'on' && kelvin !== undefined ? undefined : true,
        format: (value) => formatAttribute(hass, stateObj, 'color_temp_kelvin', value),
        commit: (value) => callService(hass, id, 'light.turn_on', { color_temp_kelvin: value }),
      };
    }
    case 'hue': {
      const hs = stateObj.attributes['hs_color'];
      const hue = Array.isArray(hs) && typeof hs[0] === 'number' ? hs[0] : undefined;
      return {
        min: 0,
        max: 360,
        step: 1,
        value: Math.round(hue ?? 0),
        gradient: HUE_GRADIENT,
        dimmed: stateObj.state === 'on' && hue !== undefined ? undefined : true,
        format: (value) => `${value}°`,
        commit: (value) => callService(hass, id, 'light.turn_on', { hs_color: [value, 100] }),
      };
    }
    case 'temperature': {
      const min = numberAttribute(stateObj, 'min_temp') ?? 7;
      return {
        min,
        max: numberAttribute(stateObj, 'max_temp') ?? 35,
        step: numberAttribute(stateObj, 'target_temp_step') ?? 0.5,
        value: numberAttribute(stateObj, 'temperature') ?? min,
        format: (value) => formatAttribute(hass, stateObj, 'temperature', value),
        commit: async (value) => {
          if (options.turn_on && stateObj.state === 'off') {
            await callService(hass, id, 'climate.turn_on');
          }
          return callService(hass, id, 'climate.set_temperature', { temperature: value });
        },
      };
    }
    case 'value': {
      const min = numberAttribute(stateObj, 'min') ?? 0;
      return {
        min,
        max: numberAttribute(stateObj, 'max') ?? 100,
        step: numberAttribute(stateObj, 'step') ?? 1,
        value: numericState(stateObj) ?? min,
        format: (value) => hass.formatEntityState(stateObj, String(value)),
        commit: (value) => callService(hass, id, 'number.set_value', { value }),
      };
    }
    case 'volume': {
      const level = numberAttribute(stateObj, 'volume_level') ?? 0;
      return {
        min: 0,
        max: 100,
        step: 1,
        value: Math.round(level * 100),
        format: (value) => `${value} %`,
        commit: (value) =>
          callService(hass, id, 'media_player.volume_set', { volume_level: value / 100 }),
      };
    }
    default:
      return undefined;
  }
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
    background: var(--card-background-color);
  }
  .overlay mnml-slider {
    flex: 1;
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
  private timer: ReturnType<typeof setTimeout> | undefined;
  private keyed = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('spec') && !this.dragging && this.release === undefined) {
      this.value = undefined;
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.timer);
    if (this.keyed && this.spec !== undefined && this.value !== undefined) {
      void this.spec.commit(this.value);
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
    return html`<div
      class=${classMap({
        slider: true,
        gradient: spec.gradient !== undefined,
        dimmed: spec.dimmed === true,
        full: this.full,
      })}
      style=${styleMap({
        '--fill': `${Math.max(0, Math.min(100, percent))}%`,
        '--gradient': spec.gradient,
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
    const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;
    return this.quantise(spec.min + ratio * (spec.max - spec.min));
  }

  private releaseSoon(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.release?.();
      this.release = undefined;
    }, COMMIT_GRACE);
  }

  private commit(): void {
    const spec = this.spec;
    const owner = this.owner;
    if (spec === undefined || owner === undefined) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.releaseSoon();
    }, COMMIT_CEILING);
    void settled(owner, spec.commit(this.value ?? spec.value)).then(() => {
      this.releaseSoon();
    });
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
    clearTimeout(this.timer);
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
    const next =
      event.key === 'Home'
        ? spec.min
        : event.key === 'End'
          ? spec.max
          : event.key === 'ArrowRight' || event.key === 'ArrowUp'
            ? this.quantise(current + step)
            : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
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
    clearTimeout(this.timer);
    this.keyed = true;
    this.timer = setTimeout(() => {
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
): void {
  const root = surface.getRootNode();
  const focusedIn = (): Element | null => (root instanceof ShadowRoot ? root.activeElement : null);
  const opener = focusedIn();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const close = dismissable(overlay, host, {
    closed: (refocus) => {
      clearTimeout(timer);
      if (refocus && opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    },
  });
  const holdsFocus = (): boolean => {
    const active = focusedIn();
    return active !== null && overlay.contains(active);
  };
  const schedule = (): void => {
    clearTimeout(timer);
    if (overlay.isConnected && !holdsFocus()) {
      timer = setTimeout(close, OVERLAY_TIMEOUT);
    }
  };
  render(
    html`<mnml-slider
        .spec=${spec}
        .label=${label}
        .color=${color}
        .owner=${host}
        .interacted=${schedule}
      ></mnml-slider>
      <button
        type="button"
        class="control"
        aria-label="Close"
        title="Close"
        @click=${() => {
          close(true);
        }}
      >
        ${icon('mdi:close')}
      </button>`,
    overlay,
  );
  overlay.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  overlay.addEventListener('focusin', schedule);
  overlay.addEventListener('focusout', () => setTimeout(schedule, 0));
  surface.append(overlay);
  const slider = overlay.querySelector('mnml-slider');
  if (slider instanceof HTMLElement) {
    slider.focus();
  }
  schedule();
}
