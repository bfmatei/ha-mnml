import { css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import type { SelectCard } from '../contract/cards.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import { formatState, unavailableValue } from '../ha/format.ts';
import { hasValue, isUnavailable, stateOf } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { entityName } from '../ha/names.ts';
import { UNAVAILABLE } from '../ha/rules.ts';
import { colorStyle, icon, quietly, stateIcon } from '../ha/templates.ts';
import { wordsFor } from '../words/words.ts';

import { MnmlCard } from './base.ts';
import { MENU_STYLE, modeChoice, openMenu, optionChoice, sceneChoice } from './parts/menu.ts';
import type { Choice } from './parts/menu.ts';
import { tip } from './parts/tooltip.ts';
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

export class MnmlSelectCard extends MnmlCard<SelectCard> {
  static override styles = [BASE_STYLE, ROW_STYLE, CONTROL_STYLE, MENU_STYLE, SELECT_STYLE];

  protected override readonly columns = 6;

  protected structure(): Structure {
    return CARD_STRUCTURES['custom:mnml-select-card'];
  }

  private shell(
    hass: HomeAssistant,
    choice: Choice,
    name: string,
    pillIcon: TemplateResult,
    line: string | undefined,
  ): TemplateResult {
    const label = wordsFor(hass.locale.language).choose(name);
    const fromCard = (event: Event): void => {
      const card = event.currentTarget;
      const arrow = card instanceof HTMLElement ? card.querySelector('button.control') : null;
      if (card instanceof HTMLElement && arrow instanceof HTMLElement) {
        openMenu(arrow, choice, this, card);
      }
    };
    const fromArrow = (event: Event): void => {
      const arrow = event.currentTarget;
      const card = arrow instanceof HTMLElement ? arrow.closest('.card') : null;
      if (arrow instanceof HTMLElement && card instanceof HTMLElement) {
        openMenu(arrow, choice, this, card);
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
        ${tip(label)}
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
      return this.shell(hass, choice, config.name, icon(config.icon), active?.label);
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
      hass,
      choice,
      config.name ?? entityName(hass, config.entity),
      config.icon === undefined
        ? (choice.currentIcon() ?? stateIcon(hass, stateObj))
        : icon(config.icon),
      current?.label ?? formatState(hass, stateObj),
    );
  }
}
