import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, Control, TileCard } from '../contract/cards.ts';
import type { SensorId } from '../contract/entities.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import { stateLine } from '../ha/format.ts';
import { numberAttribute, stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { DAY, subscribeDay } from '../ha/history.ts';
import type { Point } from '../ha/history.ts';
import { cardName } from '../ha/names.ts';
import { navigate, offerOrigin, prebuild } from '../ha/navigation.ts';
import { active } from '../ha/rules.ts';
import { onPress, stateIcon } from '../ha/templates.ts';
import { wordsFor } from '../words/words.ts';

import { MnmlCard } from './base.ts';
import { chipsOf, renderControls } from './parts/controls.ts';
import type { Chip } from './parts/controls.ts';
import { ITEM_STYLE, itemLine } from './parts/item.ts';
import { lightsButton, navButton } from './parts/square-menu.ts';
import { tip } from './parts/tooltip.ts';
import { TREND_STYLE, samples, trendLine, trendPath } from './parts/trend.ts';
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

const SQUARE_STYLE = css`
  .tile.square {
    display: block;
    aspect-ratio: 1;
    padding: 0;
  }
  .tile.square.large {
    container-type: inline-size;
  }
  .square > .glow {
    position: absolute;
    bottom: -75%;
    inset-inline-end: -75%;
    z-index: -1;
    width: 150%;
    height: 150%;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--amber-color) var(--m-glow), transparent),
      transparent
    );
    pointer-events: none;
  }
  .square.large > .pill {
    position: absolute;
    top: 10px;
    inset-inline-start: 10px;
  }
  .square > .strip {
    position: absolute;
    top: 0;
    inset-inline-end: 0;
    display: flex;
    flex-direction: row-reverse;
    overflow: hidden;
    border-end-start-radius: 16px;
  }
  .square > .strip > .control {
    width: 32px;
    min-width: 32px;
    border-radius: 0;
    background: color-mix(in srgb, var(--m-color, var(--secondary-text-color)) 16%, var(--m-pill));
  }
  .square > .strip > .more {
    background: var(--m-pill);
    font-size: 12px;
    font-weight: 600;
  }
  .square > .strip ha-icon,
  .square > .strip ha-state-icon {
    --mdc-icon-size: 18px;
  }
  .square.large > .trend {
    position: absolute;
    top: 58px;
    inset-inline-start: 10px;
    width: calc(100% - 64px);
    height: calc(100% - 136px);
  }
  .square.large > .text {
    position: absolute;
    bottom: 10px;
    inset-inline: 10px 54px;
  }
  .square.large > .text > .name {
    font-size: 18px;
  }
  .square.large > .text > .hero {
    font-size: 15px;
    line-height: 1.25;
    color: var(--primary-text-color);
  }
  .square.large > .column {
    position: absolute;
    bottom: 6px;
    inset-inline-end: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .square.large > .column > .control,
  .square-menu > .control,
  .square-menu > .head > .control {
    position: relative;
    background: var(--m-pill);
    box-shadow: var(--m-well);
  }
  .square-menu {
    position: absolute;
    bottom: var(--m-from, 2px);
    inset-inline-end: 2px;
    z-index: 1;
    display: flex;
    flex-direction: row-reverse;
    flex-wrap: wrap-reverse;
    gap: 8px;
    box-sizing: border-box;
    max-width: calc(100% - 4px);
    padding: 4px;
    border-radius: 16px;
    background: var(--card-background-color);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.3);
    cursor: default;
  }
  .square-menu > .option.off {
    opacity: 0.5;
    cursor: default;
  }
  .square-menu > .option.off:active {
    transform: none;
  }
  .square-menu.whole {
    inset: 0;
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 6px;
    max-width: none;
    padding: 6px;
    border-radius: inherit;
    background: none;
    box-shadow: none;
  }
  .square.large:has(> .square-menu.whole) > :not(.glow, .square-menu) {
    visibility: hidden;
  }
  .square-menu > .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .square-menu > .head > .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 600;
  }
  .square-menu > mnml-slider {
    display: block;
    flex: none;
    margin-top: auto;
  }
  .square-menu > .rows {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    font-size: 13px;
  }
  @media (pointer: coarse) {
    .square.large > .column > .control::after,
    .square-menu > .control::after {
      content: '';
      position: absolute;
      inset: -4px;
    }
  }
  .tile.square.small {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 6px;
  }
  .square.small > .well {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--m-pill);
    box-shadow: var(--m-well);
  }
  .square.small > .well ha-icon,
  .square.small > .well ha-state-icon {
    --mdc-icon-size: 22px;
  }
  .square.small > .name {
    max-width: 100%;
    font-size: 11px;
    font-weight: 500;
  }
  .square.small > .strip {
    border-end-start-radius: 11px;
  }
  .square.small > .strip > .control {
    width: 22px;
    min-width: 22px;
    height: 24px;
    font-size: 10px;
  }
  .square.small > .strip ha-icon,
  .square.small > .strip ha-state-icon {
    --mdc-icon-size: 14px;
  }
  @container (width < 180px) {
    .square.large > .text > .name {
      font-size: 17px;
    }
    .square.large > .strip > .control {
      height: 32px;
    }
    .square.large > .column,
    .square-menu {
      gap: 4px;
    }
  }
  @container (width < 156px) {
    .square.large > .text > .name {
      font-size: 16px;
    }
    .square.large > .text > .hero {
      font-size: 14px;
    }
    .square.large > .trend {
      height: calc(100% - 130px);
    }
    .square.large > .column > .control,
    .square-menu > .control {
      min-width: 32px;
      height: 32px;
    }
  }
`;

const CELLS: ReadonlySet<Control['type']> = new Set(['indicator', 'status', 'tyres', 'messages']);
const BUTTONS: ReadonlySet<Control['type']> = new Set(['toggle', 'nav']);
const WORST: Readonly<Record<Color, number>> = { red: 0, orange: 1, amber: 2, blue: 3 };
const ROOM_CELLS = 3;
const SMALL_CELLS = 2;
const COLUMN = 3;
const HERO = 2;
const FULL = 255;

interface Issue extends Chip {
  color: Color;
}

function isIssue(chip: Chip): chip is Issue {
  return chip.color !== undefined;
}

function rank(chip: Issue): number {
  return WORST[chip.color];
}

function issues(
  hass: HomeAssistant,
  cells: readonly Issue[],
  capacity: number,
): TemplateResult | typeof nothing {
  if (cells.length === 0) {
    return nothing;
  }
  const sorted = cells.toSorted((a, b) => rank(a) - rank(b));
  const drawn = sorted.length > capacity ? sorted.slice(0, capacity - 1) : sorted;
  const rest = sorted.slice(drawn.length);
  const more = wordsFor(hass.locale.language).more(rest.length);
  return html`<div class="strip">
    ${drawn.map((chip) => chip.cell)}
    ${
      rest.length === 0
        ? nothing
        : html`<div
            class="control inert more"
            role="img"
            aria-label=${more}
            ${tip([more, ...rest.map((chip) => chip.title)].join('\n'))}
          >
            +${rest.length}
          </div>`
    }
  </div>`;
}

function glow(hass: HomeAssistant, config: TileCard): TemplateResult | typeof nothing {
  const light = config.item === undefined ? undefined : stateOf(hass, config.item.entity);
  if (light?.state !== 'on') {
    return nothing;
  }
  const share = (numberAttribute(light, 'brightness') ?? FULL) / FULL;
  return html`<div
    class="glow"
    style=${styleMap({ '--m-glow': `${Math.round(15 + 25 * share)}%` })}
  ></div>`;
}

export class MnmlTileCard extends MnmlCard<TileCard> {
  static override styles = [BASE_STYLE, ...ITEM_STYLE, TILE_STYLE, TREND_STYLE, SQUARE_STYLE];

  protected override readonly columns = 6;

  @state() private points: Point[] | undefined;
  private followed = '';

  private follow(hass: HomeAssistant, entity: SensorId): void {
    if (entity === this.followed) {
      return;
    }
    this.followed = entity;
    this.points = undefined;
    const stop = subscribeDay(hass, entity, (points) => {
      this.points = points;
    });
    this.register(() => {
      this.followed = '';
      stop();
    });
  }

  private trend(hass: HomeAssistant, config: TileCard): TemplateResult | typeof nothing {
    const trend = config.trend;
    if (trend === undefined) {
      return nothing;
    }
    if (this.isConnected) {
      this.follow(hass, trend.entity);
    }
    const points = this.points;
    if (points === undefined) {
      return nothing;
    }
    const end = Date.now();
    const when = trend.when;
    const color = active(when, stateOf(hass, when?.entity ?? trend.entity))
      ? trend.color
      : undefined;
    const path = trendPath(samples(points, end - DAY, end));
    return path === '' ? nothing : trendLine(path, color);
  }

  private room(
    hass: HomeAssistant,
    config: TileCard,
    name: string,
    open: () => void,
  ): TemplateResult {
    const chips = chipsOf(config.chips, { hass, host: this });
    const cells = chips.filter((chip) => CELLS.has(chip.control.type)).filter(isIssue);
    const buttons = chips
      .filter((chip) => BUTTONS.has(chip.control.type))
      .slice(0, config.item === undefined ? COLUMN : COLUMN - 1);
    return html`<div
      class="card tile square large"
      @pointerdown=${() => {
        prebuild(config.popup);
      }}
      @click=${open}
    >
      ${glow(hass, config)}
      <div class="pill" role="button" tabindex="0" aria-label=${name} @keydown=${onPress(open)}>
        ${stateIcon(hass, stateOf(hass, config.entity), config.icon)}
      </div>
      ${issues(hass, cells, ROOM_CELLS)} ${this.trend(hass, config)}
      <div class="text">
        <div class="name">${name}</div>
        ${(config.state ?? [])
          .slice(0, HERO)
          .map(
            (item) => html`<div class="state hero">${stateLine(hass, config.entity, [item])}</div>`,
          )}
      </div>
      <div class="column">
        ${buttons.map((chip) =>
          chip.control.type === 'nav'
            ? (navButton(hass, chip.control, this) ?? chip.drawn)
            : chip.drawn,
        )}
        ${config.item === undefined ? nothing : lightsButton(hass, config.item, this)}
      </div>
    </div>`;
  }

  private small(
    hass: HomeAssistant,
    config: TileCard,
    name: string,
    open: () => void,
  ): TemplateResult {
    const cells = chipsOf(config.chips, { hass, host: this })
      .filter((chip) => CELLS.has(chip.control.type) || BUTTONS.has(chip.control.type))
      .filter(isIssue);
    return html`<div
      class="card tile square small"
      @pointerdown=${() => {
        prebuild(config.popup);
      }}
      @click=${open}
    >
      <div class="well" role="button" tabindex="0" aria-label=${name} @keydown=${onPress(open)}>
        ${stateIcon(hass, stateOf(hass, config.entity), config.icon)}
      </div>
      <div class="name">${name}</div>
      ${issues(hass, cells, SMALL_CELLS)}
    </div>`;
  }

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
    if (config.square === 'large') {
      return this.room(hass, config, name, open);
    }
    if (config.square === 'small') {
      return this.small(hass, config, name, open);
    }
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
