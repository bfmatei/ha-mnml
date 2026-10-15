import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Item } from '../../contract/cards.ts';
import type { PopupHash } from '../../contract/entities.ts';
import { stateLine } from '../../ha/format.ts';
import { stateOf } from '../../ha/hass.ts';
import type { HomeAssistant } from '../../ha/hass.ts';
import { nameOf } from '../../ha/names.ts';
import { navigate, openedFrom, prebuild } from '../../ha/navigation.ts';
import { partOf } from '../../ha/part.ts';
import { tint } from '../../ha/rules.ts';
import { colorStyle, onPress, quietly, stateIcon } from '../../ha/templates.ts';
import type { Host } from '../base.ts';
import { CONTROL_STYLE, ROW_STYLE } from '../styles.ts';

import { controlsOf } from './controls.ts';
import { MENU_STYLE } from './menu.ts';
import { OVERLAY_STYLE } from './slider.ts';

export const ITEM_STYLE = [
  ROW_STYLE,
  CONTROL_STYLE,
  MENU_STYLE,
  OVERLAY_STYLE,
  css`
    .children {
      display: flex;
      flex-direction: column;
    }
    .children > .row {
      padding-inline-start: 60px;
    }
    .row .control.primary {
      background: transparent;
      box-shadow: none;
    }
  `,
];

export interface Link {
  pointerdown: (event: Event) => void;
  click: (event: Event) => void;
  keydown: (event: KeyboardEvent) => void;
}

export function linkTo(popup: PopupHash): Link {
  return {
    pointerdown: quietly(() => {
      prebuild(popup);
    }),
    click: quietly((event) => {
      navigate(popup, openedFrom(event));
    }),
    keydown: (event) => {
      onPress(() => {
        navigate(popup, openedFrom(event));
      })(event);
    },
  };
}

function row(item: Item, link: Link | undefined, content: TemplateResult): TemplateResult {
  return html`<div
    class=${classMap({ row: true, link: link !== undefined })}
    data-part=${partOf(item)}
    @pointerdown=${link?.pointerdown ?? nothing}
    @click=${link?.click ?? nothing}
  >
    ${content}
  </div>`;
}

function pill(
  hass: HomeAssistant,
  item: Item,
  name: string,
  link: Link | undefined,
): TemplateResult {
  const stateObj = stateOf(hass, item.entity);
  const color = tint(item.color, item.when, stateObj);
  return html`<div
    class=${classMap({ pill: true, link: link !== undefined, colored: color !== undefined })}
    style=${styleMap(colorStyle(color))}
    role=${link === undefined ? nothing : 'button'}
    tabindex=${link === undefined ? nothing : 0}
    aria-label=${link === undefined ? nothing : name}
    @pointerdown=${link?.pointerdown ?? nothing}
    @click=${link?.click ?? nothing}
    @keydown=${link?.keydown ?? nothing}
  >
    ${stateIcon(hass, stateObj, item.icon)}
  </div>`;
}

export function itemRow(
  hass: HomeAssistant,
  item: Item,
  host: Host,
  extra?: TemplateResult,
): TemplateResult {
  const name = nameOf(hass, item.entity, item);
  const link = item.popup === undefined ? undefined : linkTo(item.popup);
  const lane = controlsOf(item.controls, { hass, host });
  return row(
    item,
    link,
    html`${pill(hass, item, name, link)}
      <div class="text">
        <div class="name">${name}</div>
        <div class="state">${stateLine(hass, item.entity, item.state ?? [{}])}</div>
      </div>
      ${
        extra === undefined && lane.length === 0
          ? nothing
          : html`<div class="lane">${extra ?? nothing}${lane}</div>`
      }`,
  );
}

function between(event: Event): void {
  if (event.target === event.currentTarget) {
    event.stopPropagation();
  }
}

export function itemLine(hass: HomeAssistant, item: Item, host: Host): TemplateResult {
  const name = nameOf(hass, item.entity, item);
  const link = item.popup === undefined ? undefined : linkTo(item.popup);
  const line = stateLine(hass, item.entity, item.state ?? [{}]);
  const lane = controlsOf(item.controls, { hass, host });
  return row(
    item,
    link,
    html`${pill(hass, item, name, link)}
      <div class="line"><span class="state">${line}</span></div>
      ${lane.length === 0 ? nothing : html`<div class="lane" @click=${between}>${lane}</div>`}`,
  );
}
