import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';

import { deviceCard } from '../builder/dashboard.ts';
import type { Offer } from '../builder/devices.ts';
import type { TemplateCard } from '../contract/cards.ts';
import type { DeviceChoice } from '../contract/plan.ts';
import { field } from '../ha/field.ts';
import type { PanelWords } from '../words/panel/en.ts';

interface DevicesView {
  readonly offers: readonly Offer[];
  readonly chosen: readonly DeviceChoice[];
  readonly areaName: (area: string) => string;
  readonly titleOf: (template: string) => string;
  readonly shownBy: (offer: Offer) => string | undefined;
  readonly tile: (card: TemplateCard) => TemplateResult;
  readonly said: PanelWords['plan'];
  readonly pick: (choice: DeviceChoice) => void;
  readonly drop: (device: string) => void;
}

export const DEVICES_STYLE = css`
  .plan-group {
    margin: 8px 0 0;
    color: var(--secondary-text-color);
    font-size: 14px;
    font-weight: 500;
  }
`;

function picked(event: Event): string {
  const value = field(event.target, 'value');
  return typeof value === 'string' ? value : '';
}

function offered(view: DevicesView, offer: Offer): TemplateResult {
  const [best] = offer.templates;
  const room = view.shownBy(offer);
  const said = view.said;
  return html`<div class="plan-row off">
    <input
      type="checkbox"
      aria-label=${said.show(offer.name)}
      .checked=${live(false)}
      @change=${() => {
        if (best !== undefined) {
          view.pick({ device: offer.device, template: best });
        }
      }}
    />
    <span class="plan-words">
      <span>${offer.name}</span>
      <span class="muted">${said.or(offer.templates.map((name) => view.titleOf(name)))}</span>
      ${room === undefined ? nothing : html`<span class="muted">${said.shownByRoom(room)}</span>`}
    </span>
  </div>`;
}

function shown(view: DevicesView, offer: Offer, choice: DeviceChoice): TemplateResult {
  const said = view.said;
  const carded = new Set(view.chosen.map(({ device }) => device));
  const others = view.offers.filter(
    (each) => !carded.has(each.device) && each.templates.includes(choice.template),
  );
  const switching =
    offer.templates.length < 2
      ? nothing
      : html`<select
          class="area-picker"
          aria-label=${said.cardFor(offer.name)}
          .value=${live(choice.template)}
          @change=${(event: Event) => {
            view.pick({ device: offer.device, template: picked(event) });
          }}
        >
          ${offer.templates.map(
            (name) =>
              html`<option value=${name} ?selected=${name === choice.template}>
                ${view.titleOf(name)}
              </option>`,
          )}
        </select>`;
  const same =
    others.length === 0
      ? nothing
      : html`<select
          class="area-picker"
          aria-label=${said.sameFor(offer.name)}
          .value=${live('')}
          @change=${(event: Event) => {
            const device = picked(event);
            if (device !== '') {
              view.pick({ device, template: choice.template });
            }
          }}
        >
          <option value="" selected>${said.sameForPick}</option>
          ${others.map((each) => html`<option value=${each.device}>${each.name}</option>`)}
        </select>`;
  return html`<div class="plan-row">
    <input
      type="checkbox"
      aria-label=${said.show(offer.name)}
      .checked=${live(true)}
      @change=${() => {
        view.drop(offer.device);
      }}
    />
    ${view.tile(deviceCard(choice))}
    ${
      switching === nothing && same === nothing
        ? nothing
        : html`<span class="row-actions">${switching}${same}</span>`
    }
  </div>`;
}

export function devicesList(view: DevicesView): TemplateResult {
  const said = view.said;
  if (view.offers.length === 0) {
    return html`<p class="muted">${said.noDevices}</p>`;
  }
  const areas = [...new Set(view.offers.map((offer) => offer.area))];
  return html`<p class="muted">${said.devicesAbout}</p>
    ${areas.map(
      (area) =>
        html`<h3 class="plan-group">${area === undefined ? said.noArea : view.areaName(area)}</h3>
          ${view.offers
            .filter((offer) => offer.area === area)
            .map((offer) => {
              const choice = view.chosen.find((each) => each.device === offer.device);
              return choice === undefined ? offered(view, offer) : shown(view, offer, choice);
            })}`,
    )}`;
}
