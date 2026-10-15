import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { HeaderCard } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import { rightToLeft } from '../ha/direction.ts';
import { SEPARATOR, stateLine } from '../ha/format.ts';
import type { Line } from '../ha/format.ts';
import { stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { messageCount } from '../ha/message-count.ts';
import { cardName } from '../ha/names.ts';
import { back, closePopup } from '../ha/navigation.ts';
import { tint } from '../ha/rules.ts';
import { colorStyle, icon, quietly, stateIcon } from '../ha/templates.ts';
import { wordsFor } from '../words/words.ts';

import { MnmlCard } from './base.ts';
import { renderControls } from './parts/controls.ts';
import { ITEM_STYLE } from './parts/item.ts';
import { tip } from './parts/tooltip.ts';
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

function counted(hass: HomeAssistant, line: Line, all: number | undefined): Line {
  if (all === undefined) {
    return line;
  }
  const count = all === 0 ? wordsFor(hass.locale.language).messages.none : String(all);
  return line.length === 0 ? [count] : [...line, SEPARATOR, count];
}

export class MnmlHeaderCard extends MnmlCard<HeaderCard> {
  static override styles = [BASE_STYLE, ...ITEM_STYLE, HEADER_STYLE];

  protected structure(): Structure {
    return CARD_STRUCTURES['custom:mnml-header-card'];
  }

  protected draw(hass: HomeAssistant, config: HeaderCard): TemplateResult {
    const stateObj = stateOf(hass, config.entity);
    const all = config.messages === true ? messageCount(this, hass)?.all : undefined;
    const line = counted(hass, stateLine(hass, config.entity, config.state), all);
    const color =
      config.messages === true
        ? all !== undefined && all > 0
          ? config.color
          : undefined
        : tint(config.color, config.when, stateObj);
    const words = wordsFor(hass.locale.language);
    const arrow: MdiIcon = rightToLeft(this) ? 'mdi:arrow-right' : 'mdi:arrow-left';
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
          <div class="state">${line}</div>
        </div>
        ${renderControls(config.controls, { hass, host: this }) ?? nothing}
      </div>
      ${config.back ? round(words.back, icon(arrow), back) : nothing}
      ${round(words.close, icon('mdi:close'), closePopup)}
    </div>`;
  }
}
