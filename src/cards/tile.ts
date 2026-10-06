import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, Problems, TileCard } from '../contract/cards.ts';
import { BATTERY_CRITICAL, BATTERY_LOW } from '../contract/defaults.ts';
import { formatState, stateLine } from '../ha/format.ts';
import { hasValue, isOn, isUnavailable, numericState, stateOf } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { cardName, nameOf } from '../ha/names.ts';
import { navigate, prebuild } from '../ha/navigation.ts';
import { UNAVAILABLE } from '../ha/rules.ts';
import { colorStyle, onPress, stateIcon } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import { marked, variant } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { renderControls, requireControls } from './parts/controls.ts';
import { ITEM_STYLE, itemRow } from './parts/item.ts';
import { CONTROLS, ITEM, PROBLEMS, STATE_ITEMS } from './schemas.ts';
import { BASE_STYLE } from './styles.ts';

const TILE_STYLE = css`
  .tile {
    cursor: pointer;
    transition: box-shadow 120ms ease-out;
    padding: 8px;
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
  }
  .tile > .row {
    grid-column: 1 / -1;
    min-height: 44px;
    padding: 4px;
    justify-content: space-between;
    background: var(--m-pill);
    border-radius: 16px;
  }
  .tile > .row > .pill {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: var(--card-background-color);
  }
  .tile > .row > .pill ha-state-icon {
    --mdc-icon-size: 20px;
  }
  .tile > .row .control.primary {
    background: var(--card-background-color);
  }
  @media (hover: hover) {
    .tile:hover:not(:has(.row.link:hover)) {
      box-shadow: inset 0 0 0 999px var(--m-hover);
    }
  }
  .tile:active:not(:has(.control:active, .pill.link:active, .row.link:active)) {
    box-shadow: inset 0 0 0 999px var(--m-hover);
  }
  .dot {
    position: absolute;
    top: -1px;
    right: -1px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--m-color);
    box-shadow: 0 0 0 2px var(--card-background-color);
  }
  @media (forced-colors: active) {
    .dot {
      background: Highlight;
      box-shadow: 0 0 0 2px Canvas;
    }
  }
`;

interface Problem {
  color: Color;
  text: string;
}

type Judge = (stateObj: HassEntity | undefined) => Color | undefined;

const leakColor: Judge = (stateObj) => {
  if (isUnavailable(stateObj)) {
    return UNAVAILABLE;
  }
  return isOn(stateObj) ? 'red' : undefined;
};

const batteryColor: Judge = (stateObj) => {
  if (isUnavailable(stateObj)) {
    return UNAVAILABLE;
  }
  const level = numericState(stateObj);
  if (!hasValue(stateObj) || level === undefined || level >= BATTERY_LOW) {
    return undefined;
  }
  return level < BATTERY_CRITICAL ? 'red' : 'orange';
};

function problems(hass: HomeAssistant, config: Problems | undefined): Problem[] {
  const found: Problem[] = [];
  const check = (entity: string, judge: Judge): void => {
    const stateObj = stateOf(hass, entity);
    const color = judge(stateObj);
    if (stateObj === undefined || color === undefined) {
      return;
    }
    const text = `${nameOf(hass, entity, { label: 'device' })}: ${formatState(hass, stateObj)}`;
    if (!found.some((problem) => problem.text === text)) {
      found.push({ color, text });
    }
  };
  for (const leak of config?.leaks ?? []) {
    check(leak, leakColor);
  }
  for (const battery of config?.batteries ?? []) {
    check(battery, batteryColor);
  }
  return found;
}

const NESTED = { state: STATE_ITEMS, chips: CONTROLS, item: ITEM, problems: PROBLEMS };

const SCHEMA = marked(
  {
    name: variant<Extract<TileCard, { name: string }>>(
      {
        type: true,
        popup: true,
        state: true,
        chips: true,
        item: true,
        problems: true,
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
      problems: true,
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
    const found = problems(hass, config.problems);
    const parts = [name, ...found.map((problem) => problem.text)];
    const dot: Color = found.some((problem) => problem.color === 'red') ? 'red' : 'orange';
    const open = (): void => {
      navigate(config.popup);
    };
    return html`<div
      class="card tile"
      @pointerdown=${() => {
        prebuild(config.popup);
      }}
      @click=${open}
    >
      <div
        class="pill"
        role="button"
        tabindex="0"
        aria-label=${found.length > 0 ? parts.join('. ') : name}
        title=${found.length > 0 ? parts.join('\n') : name}
        @keydown=${onPress(open)}
      >
        ${stateIcon(hass, stateOf(hass, config.entity), config.icon)}${
          found.length > 0
            ? html`<div class="dot colored" style=${styleMap(colorStyle(dot))}></div>`
            : nothing
        }
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
