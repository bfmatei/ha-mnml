import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, StateItem } from '../contract/cards.ts';

import { hasValue, isUnavailable, numericState, stateOf } from './hass.ts';
import type { HassEntity, HomeAssistant } from './hass.ts';
import { deviceSerial, entityName } from './names.ts';
import { UNAVAILABLE, normalise, shown } from './rules.ts';
import { colorStyle, stateIcon } from './templates.ts';

export const SEPARATOR = ' • ';

export const DASH = '—';

export type Line = (TemplateResult | string)[];

export function unavailableValue(hass: HomeAssistant, stateObj: HassEntity): TemplateResult {
  return html`<span role="img" aria-label=${hass.formatEntityState(stateObj)}>${DASH}</span>`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function humanise(value: string): string {
  return capitalise(value.replaceAll('_', ' '));
}

export function formatState(
  hass: HomeAssistant,
  stateObj: HassEntity,
  words?: Record<string, string>,
): string {
  if (words === undefined) {
    return hass.formatEntityState(stateObj);
  }
  const key = normalise(stateObj.state);
  const word = Object.entries(words).find(([entry]) => normalise(entry) === key);
  return word?.[1] ?? capitalise(stateObj.state.toLowerCase().replaceAll(/[-_]/g, ' '));
}

export function formatAttribute(
  hass: HomeAssistant,
  stateObj: HassEntity,
  attribute: string,
  value?: unknown,
): string {
  const raw = value ?? stateObj.attributes[attribute];
  if (raw === undefined || raw === null) {
    return '';
  }
  const formatted = hass.formatEntityAttributeValue(stateObj, attribute, raw);
  return typeof raw === 'string' && formatted === raw ? humanise(raw) : formatted;
}

function formatMinutes(stateObj: HassEntity): string {
  const seconds = numericState(stateObj);
  return seconds === undefined ? '' : `${Math.round(seconds / 60)} min`;
}

function formatItem(hass: HomeAssistant, stateObj: HassEntity, item: StateItem): string {
  if (item.attribute !== undefined) {
    return formatAttribute(hass, stateObj, item.attribute);
  }
  return item.minutes ? formatMinutes(stateObj) : hass.formatEntityState(stateObj);
}

function textPart(text: string | undefined): TemplateResult | undefined {
  if (text === undefined || text === '') {
    return undefined;
  }
  return html`<span><span class="value">${text}</span></span>`;
}

function valuePart(
  hass: HomeAssistant,
  stateObj: HassEntity,
  item: StateItem,
  value: TemplateResult | string,
  color?: Color,
): TemplateResult {
  return html`<span
    class=${classMap({ colored: color !== undefined })}
    style=${styleMap(colorStyle(color))}
    >${item.icon ? stateIcon(hass, stateObj) : ''}<span class="value">${value}</span></span
  >`;
}

function itemPart(
  hass: HomeAssistant,
  entityId: string | undefined,
  item: StateItem,
): TemplateResult | undefined {
  if (!shown(hass, item.when, entityId)) {
    return undefined;
  }
  if (item.text !== undefined) {
    return textPart(item.text);
  }
  if (item.serial) {
    return textPart(entityId === undefined ? undefined : deviceSerial(hass, entityId));
  }
  if (item.name) {
    return textPart(entityId === undefined ? undefined : entityName(hass, entityId));
  }
  const stateObj = stateOf(hass, entityId);
  if (isUnavailable(stateObj)) {
    return valuePart(hass, stateObj, item, unavailableValue(hass, stateObj), UNAVAILABLE);
  }
  if (!hasValue(stateObj)) {
    return undefined;
  }
  const text = formatItem(hass, stateObj, item);
  return text === '' ? undefined : valuePart(hass, stateObj, item, text);
}

export function stateLine(
  hass: HomeAssistant,
  ownId: string | undefined,
  items: StateItem[] | undefined,
): Line {
  const line: Line = [];
  for (const item of items ?? []) {
    const part = itemPart(hass, item.entity ?? ownId, item);
    if (part === undefined) {
      continue;
    }
    if (line.length > 0) {
      line.push(SEPARATOR);
    }
    line.push(part);
  }
  return line;
}
