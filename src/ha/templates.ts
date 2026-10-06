import { html } from 'lit';
import type { TemplateResult } from 'lit';
import type { StyleInfo } from 'lit/directives/style-map.js';

import type { Color } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';

import type { HassEntity, HomeAssistant } from './hass.ts';

export function colorVar(color: Color | undefined): string | undefined {
  return color === undefined ? undefined : `var(--${color}-color)`;
}

export function colorStyle(color: Color | undefined): StyleInfo {
  return { '--m-color': colorVar(color) };
}

export function icon(name: MdiIcon): TemplateResult {
  return html`<ha-icon .icon=${name}></ha-icon>`;
}

export function stateIcon(
  hass: HomeAssistant,
  stateObj: HassEntity | undefined,
  override?: MdiIcon,
): TemplateResult {
  if (override !== undefined) {
    return icon(override);
  }
  if (stateObj === undefined) {
    return icon('mdi:help-circle-outline');
  }
  return html`<ha-state-icon .hass=${hass} .stateObj=${stateObj}></ha-state-icon>`;
}

export function attributeIcon(
  hass: HomeAssistant,
  stateObj: HassEntity,
  attribute: string,
  value: string,
): TemplateResult {
  return html`<ha-attribute-icon
    .hass=${hass}
    .stateObj=${stateObj}
    .attribute=${attribute}
    .attributeValue=${value}
  ></ha-attribute-icon>`;
}

export function relativeTime(hass: HomeAssistant, datetime: string): TemplateResult {
  return html`<ha-relative-time .hass=${hass} .datetime=${datetime}></ha-relative-time>`;
}

export function onPress(run: () => void): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      run();
    }
  };
}

export function quietly(run: (event: Event) => void): (event: Event) => void {
  return (event) => {
    event.stopPropagation();
    run(event);
  };
}
