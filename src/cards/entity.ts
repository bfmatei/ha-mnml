import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { EntityCard } from '../contract/cards.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { nameOf } from '../ha/names.ts';
import { icon, quietly } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import type { KeySchema } from './keys.ts';
import { requireControls } from './parts/controls.ts';
import { ITEM_STYLE, itemRow } from './parts/item.ts';
import { tip } from './parts/tooltip.ts';
import { ENTITY_CARD } from './schemas.ts';
import { BASE_STYLE } from './styles.ts';

export class MnmlEntityCard extends MnmlCard<EntityCard> {
  static override styles = [BASE_STYLE, ...ITEM_STYLE];

  @state() private expanded = false;

  protected schema(): KeySchema {
    return ENTITY_CARD;
  }

  protected override validate(config: EntityCard): void {
    requireString('entity', config.entity);
    requireControls('controls', config.controls);
    for (const [index, item] of (config.items ?? []).entries()) {
      requireControls(`items[${index}].controls`, item.controls);
    }
  }

  protected draw(hass: HomeAssistant, config: EntityCard): TemplateResult {
    const items = config.items ?? [];
    if (items.length === 0) {
      return html`<div class="card">${itemRow(hass, config, this)}</div>`;
    }
    const name = nameOf(hass, config.entity, config);
    const label = this.expanded ? `Hide ${name}` : `Show the lights of ${name}`;
    const toggle = html`<button
      type="button"
      class="control"
      aria-label=${label}
      ${tip(label)}
      aria-expanded=${String(this.expanded)}
      @click=${quietly(() => {
        this.expanded = !this.expanded;
      })}
    >
      ${icon(this.expanded ? 'mdi:chevron-up' : 'mdi:chevron-down')}
    </button>`;
    return html`<div class="card">
      ${itemRow(hass, config, this, toggle)}
      <div class=${classMap({ children: true, hidden: !this.expanded })}>
        ${items.map((item) => itemRow(hass, item, this))}
      </div>
    </div>`;
  }
}
