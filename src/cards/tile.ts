import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type { TileCard } from '../contract/cards.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import { stateLine } from '../ha/format.ts';
import { stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { cardName } from '../ha/names.ts';
import { navigate, offerOrigin, prebuild } from '../ha/navigation.ts';
import { onPress, stateIcon } from '../ha/templates.ts';

import { MnmlCard } from './base.ts';
import { renderControls } from './parts/controls.ts';
import { ITEM_STYLE, itemLine } from './parts/item.ts';
import { BASE_STYLE } from './styles.ts';

const TILE_STYLE = css`
  .tile {
    cursor: pointer;
    padding: 10px;
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    column-gap: 12px;
    row-gap: 8px;
    align-items: center;
    -webkit-tap-highlight-color: transparent;
  }
  .tile > .pill {
    grid-column: 1;
  }
  .tile > .text {
    grid-column: 2;
  }
  .tile > .text > .state {
    white-space: normal;
  }
  .tile > .chips {
    grid-column: 3;
    gap: 4px;
  }
  .tile > .chips .control {
    background: var(--m-pill);
    box-shadow: var(--m-well);
  }
  .tile > .row {
    position: relative;
    grid-column: 1 / -1;
    gap: 8px;
    min-height: 36px;
    padding: 4px;
    background: var(--m-pill);
    box-shadow: var(--m-well);
    border-radius: 14px;
  }
  .tile > .row > .pill {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: none;
    box-shadow: none;
  }
  .tile > .row > .pill ha-icon,
  .tile > .row > .pill ha-state-icon,
  .tile > .row > .pill ha-attribute-icon {
    --mdc-icon-size: 18px;
  }
  .tile > .row > .line {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tile > .row .control {
    min-width: 28px;
    height: 28px;
    border-radius: 50%;
  }
  .tile > .row .control.armed {
    border-radius: 14px;
  }
  .tile > .row .control ha-icon,
  .tile > .row .control ha-state-icon,
  .tile > .row .control ha-attribute-icon {
    --mdc-icon-size: 16px;
  }
  @media (pointer: coarse) {
    .tile > .row > .lane {
      gap: 16px;
    }
    .tile > .row .control:not(.inert)::after {
      content: '';
      position: absolute;
      inset: -8px;
    }
  }
  .tile > .row > .overlay {
    padding: 0;
    border-radius: inherit;
    --m-slider-height: 36px;
  }
  .tile:active:not(:has(.control:active, .pill.link:active, .row.link:active))::before {
    opacity: 1;
  }
`;

export class MnmlTileCard extends MnmlCard<TileCard> {
  static override styles = [BASE_STYLE, ...ITEM_STYLE, TILE_STYLE];

  protected override readonly columns = 6;

  protected override updated(): void {
    super.updated();
    const popup = this.config?.popup;
    if (popup !== undefined && this.style.display !== 'none') {
      offerOrigin(popup, this);
    }
  }

  protected structure(): Structure {
    return CARD_STRUCTURES['custom:mnml-tile-card'];
  }

  protected draw(hass: HomeAssistant, config: TileCard): TemplateResult {
    const name = cardName(hass, config.entity, config);
    const open = (): void => {
      navigate(config.popup, this);
    };
    return html`<div
      class="card tile"
      @pointerdown=${() => {
        prebuild(config.popup);
      }}
      @click=${open}
    >
      <div class="pill" role="button" tabindex="0" aria-label=${name} @keydown=${onPress(open)}>
        ${stateIcon(hass, stateOf(hass, config.entity), config.icon)}
      </div>
      <div class="text">
        <div class="name">${name}</div>
        <div class="state">${stateLine(hass, config.entity, config.state)}</div>
      </div>
      ${renderControls(config.chips, { hass, host: this }, 'lane chips') ?? nothing}
      ${config.item === undefined ? nothing : itemLine(hass, config.item, this)}
    </div>`;
  }
}
