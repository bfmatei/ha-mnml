import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { EntityCard } from '../contract/cards.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { nameOf } from '../ha/names.ts';
import { icon, quietly } from '../ha/templates.ts';
import { wordsFor } from '../words/words.ts';

import { MnmlCard } from './base.ts';
import {} from './parts/controls.ts';
import { ITEM_STYLE, itemRow } from './parts/item.ts';
import { tip } from './parts/tooltip.ts';
import { BASE_STYLE } from './styles.ts';

export class MnmlEntityCard extends MnmlCard<EntityCard> {
  static override styles = [BASE_STYLE, ...ITEM_STYLE];

  @state() private expanded = false;

  protected structure(): Structure {
    return CARD_STRUCTURES['custom:mnml-entity-card'];
  }

  protected draw(hass: HomeAssistant, config: EntityCard): TemplateResult {
    const items = config.items ?? [];
    if (items.length === 0) {
      return html`<div class="card">${itemRow(hass, config, this)}</div>`;
    }
    const name = nameOf(hass, config.entity, config);
    const words = wordsFor(hass.locale.language);
    const label = this.expanded ? words.hide(name) : words.entity.showLights(name);
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
