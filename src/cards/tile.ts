import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type { TileCard } from '../contract/cards.ts';
import { stateLine } from '../ha/format.ts';
import { stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { cardName } from '../ha/names.ts';
import { navigate, offerOrigin, prebuild } from '../ha/navigation.ts';
import { onPress, stateIcon } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import { marked, variant } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { renderControls, requireControls } from './parts/controls.ts';
import { ITEM_STYLE, itemRow } from './parts/item.ts';
import { CONTROLS, ITEM, STATE_ITEMS } from './schemas.ts';
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
    justify-content: space-between;
    background: var(--m-pill);
    box-shadow: var(--m-well);
    border-radius: 14px;
  }
  .tile > .row > .pill {
    background: var(--m-raised);
    box-shadow: none;
  }
  .tile:active:not(:has(.control:active, .pill.link:active, .row.link:active))::before {
    opacity: 1;
  }
`;

const NESTED = { state: STATE_ITEMS, chips: CONTROLS, item: ITEM };

const SCHEMA = marked(
  {
    name: variant<Extract<TileCard, { name: string }>>(
      {
        type: true,
        popup: true,
        state: true,
        chips: true,
        item: true,
        entity: true,
        name: true,
        icon: true,
      },
      NESTED,
    ),
  },
  variant<Extract<TileCard, { name?: never }>>(
    {
      type: true,
      popup: true,
      state: true,
      chips: true,
      item: true,
      entity: true,
      label: true,
      icon: true,
    },
    NESTED,
  ),
);

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

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: TileCard): void {
    if (config.entity === undefined) {
      requireString('name', config.name);
      requireString('icon', config.icon);
    }
    requireString('popup', config.popup);
    requireControls('chips', config.chips);
    requireControls('item.controls', config.item?.controls);
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
      ${config.item === undefined ? nothing : itemRow(hass, config.item, this)}
    </div>`;
  }
}
