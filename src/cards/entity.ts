import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';

import type { EntityCard } from '../contract/cards.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { nameOf } from '../ha/names.ts';
import { icon, quietly } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { requireControls } from './parts/controls.ts';
import { ITEM_STYLE, itemRow } from './parts/item.ts';
import { CONTROLS, ITEM, STATE_ITEMS, STATE_RULE } from './schemas.ts';
import { BASE_STYLE } from './styles.ts';

const SCHEMA = schema<EntityCard>(
  {
    type: true,
    items: true,
    entity: true,
    name: true,
    label: true,
    strip_word: true,
    icon: true,
    color: true,
    when: true,
    state: true,
    popup: true,
    controls: true,
  },
  { items: ITEM, when: STATE_RULE, state: STATE_ITEMS, controls: CONTROLS },
);

export class MnmlEntityCard extends MnmlCard<EntityCard> {
  static override styles = [BASE_STYLE, ...ITEM_STYLE];

  @state() private expanded = false;

  protected schema(): KeySchema {
    return SCHEMA;
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
      title=${label}
      aria-expanded=${String(this.expanded)}
      @click=${quietly(() => {
        this.expanded = !this.expanded;
      })}
    >
      ${icon(this.expanded ? 'mdi:chevron-up' : 'mdi:chevron-down')}
    </button>`;
    return html`<div class="card">
      ${itemRow(hass, config, this, toggle)}
      <div class="children ${this.expanded ? '' : 'hidden'}">
        ${items.map((item) => itemRow(hass, item, this))}
      </div>
    </div>`;
  }
}
