import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { HeaderCard } from '../contract/cards.ts';
import { stateLine } from '../ha/format.ts';
import { stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { cardName } from '../ha/names.ts';
import { back, closePopup } from '../ha/navigation.ts';
import { tint } from '../ha/rules.ts';
import { colorStyle, icon, quietly, stateIcon } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import type { KeySchema } from './keys.ts';
import { renderControls, requireControls } from './parts/controls.ts';
import { ITEM_STYLE } from './parts/item.ts';
import { tip } from './parts/tooltip.ts';
import { HEADER_CARD } from './schemas.ts';
import { BASE_STYLE } from './styles.ts';

const HEADER_STYLE = css`
  .header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }
  .header .card {
    flex: 1;
    min-width: 0;
  }
  .header .round {
    flex: none;
    width: 40px;
    height: 40px;
    margin-top: 8px;
    border-radius: 12px;
    background: var(--m-card);
    -webkit-backdrop-filter: var(--mnml-card-backdrop-filter, none);
    backdrop-filter: var(--mnml-card-backdrop-filter, none);
    --round-shadow:
      inset 0 0 0 1px var(--m-edge), inset 0 1px 0 var(--mnml-card-highlight-color, transparent),
      var(--m-shadow);
    box-shadow: var(--round-shadow);
    color: var(--primary-text-color);
  }
  .header .round ha-icon {
    --mdc-icon-size: 22px;
  }
`;

function round(label: string, glyph: TemplateResult, run: () => void): TemplateResult {
  return html`<button
    type="button"
    class="control round"
    aria-label=${label}
    ${tip(label)}
    @click=${quietly(run)}
  >
    ${glyph}
  </button>`;
}

export class MnmlHeaderCard extends MnmlCard<HeaderCard> {
  static override styles = [BASE_STYLE, ...ITEM_STYLE, HEADER_STYLE];

  protected schema(): KeySchema {
    return HEADER_CARD;
  }

  protected override validate(config: HeaderCard): void {
    if (config.entity === undefined) {
      requireString('name', config.name);
      requireString('icon', config.icon);
    }
    requireControls('controls', config.controls);
  }

  protected draw(hass: HomeAssistant, config: HeaderCard): TemplateResult {
    const stateObj = stateOf(hass, config.entity);
    const color = tint(config.color, config.when, stateObj);
    return html`<div class="header">
      <div class="card row">
        <div
          class=${classMap({ pill: true, colored: color !== undefined })}
          style=${styleMap(colorStyle(color))}
        >
          ${stateIcon(hass, stateObj, config.icon)}
        </div>
        <div class="text">
          <div class="name">${cardName(hass, config.entity, config)}</div>
          <div class="state">${stateLine(hass, config.entity, config.state)}</div>
        </div>
        ${renderControls(config.controls, { hass, host: this }) ?? nothing}
      </div>
      ${config.back ? round('Back', icon('mdi:arrow-left'), back) : nothing}
      ${round('Close', icon('mdi:close'), closePopup)}
    </div>`;
  }
}
