import { LitElement, html, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { checkPopups } from '../cards/parts/popup-registry.ts';
import type { Popup } from '../contract/cards.ts';
import { isMapping } from '../contract/templates.ts';
import type { Template, Templates, Value } from '../contract/templates.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { navigate } from '../ha/navigation.ts';
import { icon } from '../ha/templates.ts';
import { discover } from '../templates/discover.ts';
import { expand } from '../templates/expand.ts';

import { PANEL_STYLE } from './style.ts';

export interface Trial {
  card: Value;
  popups: Popup[];
}

export type TrialOn =
  | { area: string; slots?: never }
  | { area?: never; slots: Record<string, Value> };

export function tryDraft(
  templates: Templates,
  name: string,
  draft: Template,
  on: TrialOn,
  hass: HomeAssistant | undefined,
): Trial {
  const all: Templates = { ...templates, [name]: draft };
  const found =
    on.area === undefined || hass === undefined
      ? {}
      : discover(draft, on.area, {
          areas: hass.areas,
          devices: hass.devices,
          entities: hass.entities,
          states: hass.states,
        });
  const expanded = expand(all, { template: name, slots: on.slots ?? {} }, found);
  if (expanded.missing !== undefined) {
    throw new Error(`waiting for ${expanded.missing.join(', ')}`);
  }
  const card = expanded.card;
  const popup = isMapping(card) && card['type'] === undefined && typeof card['hash'] === 'string';
  return popup
    ? { card: null, popups: checkPopups([card, ...expanded.popups]) }
    : { card, popups: checkPopups(expanded.popups) };
}

export function trialOf(template: Template, area: string | undefined): TrialOn {
  return area === undefined ? { slots: template.example ?? {} } : { area };
}

export interface Area {
  value: string;
  label: string;
}

export class MnmlPreview extends LitElement {
  static override styles = PANEL_STYLE;

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) trial: (() => Trial) | undefined;
  @property({ attribute: false }) areas: readonly Area[] = [];
  @property({ attribute: false }) area: string | undefined;
  @property({ attribute: false }) choose: ((area: string | undefined) => void) | undefined;
  @query('.cards') private stage: HTMLElement | null | undefined;
  private made: Trial | undefined;
  private problem: string | undefined;
  private drawn: ChildCard[] = [];
  private drawing = 0;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('trial') || changed.has('area')) {
      try {
        this.made = this.trial?.();
        this.problem = undefined;
      } catch (error) {
        this.made = undefined;
        this.problem = error instanceof Error ? error.message : String(error);
      }
    }
    if (changed.has('hass') && this.hass !== undefined) {
      for (const child of this.drawn) {
        child.hass = this.hass;
      }
    }
  }

  protected override render(): TemplateResult {
    const made = this.made;
    return html`<div class="preview">
      <div class="preview-head">
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
      <div class="stage">
        ${
          this.problem === undefined
            ? html`<div class="cards"></div>`
            : html`<div class="problem">
                ${icon('mdi:alert-circle-outline')}<span>${this.problem}</span>
              </div>`
        }
      </div>
      ${
        made === undefined || made.popups.length === 0
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

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('trial') || changed.has('area')) {
      void this.drawCards();
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
    if (load === undefined) {
      const said = document.createElement('p');
      said.className = 'muted';
      said.textContent =
        'Home Assistant has not loaded its card helpers on this page, so the preview cannot draw. Open a dashboard once, then come back.';
      box.replaceChildren(said);
      return;
    }
    const helpers = await load();
    if (mine !== this.drawing) {
      return;
    }
    const cards = [
      ...(isMapping(made.card) ? [helpers.createCardElement(made.card)] : []),
      ...(made.popups.length > 0
        ? [
            helpers.createCardElement({
              type: 'custom:mnml-popups-card',
              width: '600px',
              popups: made.popups,
            }),
          ]
        : []),
    ];
    for (const card of cards) {
      card.preview = true;
      if (this.hass !== undefined) {
        card.hass = this.hass;
      }
    }
    this.drawn = cards;
    box.replaceChildren(...cards);
  }
}
