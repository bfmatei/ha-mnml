import { css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import type { SelectCard } from '../contract/cards.ts';
import { formatState, unavailableValue } from '../ha/format.ts';
import { hasValue, isUnavailable, stateOf } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { entityName } from '../ha/names.ts';
import { UNAVAILABLE } from '../ha/rules.ts';
import { colorStyle, icon, quietly, stateIcon } from '../ha/templates.ts';

import { MnmlCard, requireList, requireOneOf, requireString } from './base.ts';
import { marked, variant } from './keys.ts';
import type { KeySchema } from './keys.ts';
import {
  MENU_STYLE,
  MODE_ATTRIBUTES,
  modeChoice,
  openMenu,
  optionChoice,
  sceneChoice,
} from './parts/menu.ts';
import type { Choice } from './parts/menu.ts';
import { BASE_STYLE, CONTROL_STYLE, ROW_STYLE } from './styles.ts';

const SELECT_STYLE = css`
  .card.select {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
`;

function unavailableRow(
  hass: HomeAssistant,
  stateObj: HassEntity,
  name: string,
  pillIcon: TemplateResult,
): TemplateResult {
  const painted = styleMap(colorStyle(UNAVAILABLE));
  return html`<div class="card row">
    <div class="pill colored" style=${painted}>${pillIcon}</div>
    <div class="text">
      <div class="name">${name}</div>
      <div class="state">
        <span class="colored" style=${painted}>${unavailableValue(hass, stateObj)}</span>
      </div>
    </div>
  </div>`;
}

const SCHEMA = marked(
  {
    scenes: variant<Extract<SelectCard, { scenes: unknown[] }>>({
      type: true,
      scenes: true,
      active_scene: true,
      name: true,
      icon: true,
    }),
  },
  variant<Extract<SelectCard, { scenes?: never }>>({
    type: true,
    entity: true,
    attribute: true,
    name: true,
    icon: true,
  }),
);

export class MnmlSelectCard extends MnmlCard<SelectCard> {
  static override styles = [BASE_STYLE, ROW_STYLE, CONTROL_STYLE, MENU_STYLE, SELECT_STYLE];

  protected override readonly columns = 6;

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: SelectCard): void {
    if (config.scenes !== undefined) {
      requireList('scenes', config.scenes);
      requireString('name', config.name);
      return;
    }
    requireString('entity', config.entity);
    if (config.attribute !== undefined) {
      requireOneOf('attribute', config.attribute, MODE_ATTRIBUTES);
    }
  }

  private shell(
    choice: Choice,
    name: string,
    pillIcon: TemplateResult,
    line: string | undefined,
  ): TemplateResult {
    const label = `${name}: choose`;
    const fromCard = (event: Event): void => {
      const card = event.currentTarget;
      const arrow = card instanceof HTMLElement ? card.querySelector('button.control') : null;
      if (arrow instanceof HTMLElement) {
        openMenu(arrow, choice, this);
      }
    };
    const fromArrow = (event: Event): void => {
      const arrow = event.currentTarget;
      if (arrow instanceof HTMLElement) {
        openMenu(arrow, choice, this);
      }
    };
    return html`<div class="card row select" @click=${fromCard}>
      <div class="pill">${pillIcon}</div>
      <div class="text">
        <div class="name">${name}</div>
        <div class="state">${line ?? ''}</div>
      </div>
      <button
        type="button"
        class="control"
        aria-label=${label}
        title=${label}
        aria-haspopup="menu"
        aria-expanded="false"
        @click=${quietly(fromArrow)}
      >
        ${icon('mdi:chevron-down')}
      </button>
    </div>`;
  }

  protected draw(hass: HomeAssistant, config: SelectCard): TemplateResult | undefined {
    if (config.scenes !== undefined) {
      const choice = sceneChoice(hass, config.scenes, config.active_scene);
      if (choice.options.length === 0) {
        return undefined;
      }
      const active = choice.options.find((option) => option.value === choice.current);
      return this.shell(choice, config.name, icon(config.icon), active?.label);
    }
    const stateObj = stateOf(hass, config.entity);
    if (isUnavailable(stateObj)) {
      return unavailableRow(
        hass,
        stateObj,
        config.name ?? entityName(hass, config.entity),
        config.icon === undefined ? stateIcon(hass, stateObj) : icon(config.icon),
      );
    }
    if (!hasValue(stateObj)) {
      return undefined;
    }
    const choice =
      config.attribute === undefined
        ? optionChoice(hass, config.entity, stateObj)
        : modeChoice(hass, config.entity, stateObj, config.attribute);
    if (choice.options.length === 0) {
      return undefined;
    }
    const current = choice.options.find((option) => option.value === choice.current);
    return this.shell(
      choice,
      config.name ?? entityName(hass, config.entity),
      config.icon === undefined
        ? (choice.currentIcon() ?? stateIcon(hass, stateObj))
        : icon(config.icon),
      current?.label ?? formatState(hass, stateObj),
    );
  }
}
