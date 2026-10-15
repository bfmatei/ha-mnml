import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type { HeadingCard } from '../contract/cards.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import { stateLine } from '../ha/format.ts';
import type { HomeAssistant } from '../ha/hass.ts';

import { MnmlCard } from './base.ts';
import { renderControls } from './parts/controls.ts';
import { MENU_STYLE } from './parts/menu.ts';
import { heading } from './parts/section.ts';
import { OVERLAY_STYLE } from './parts/slider.ts';
import { BASE_STYLE, CONTROL_STYLE, HEADING_STYLE } from './styles.ts';

export class MnmlHeadingCard extends MnmlCard<HeadingCard> {
  static override styles = [BASE_STYLE, HEADING_STYLE, CONTROL_STYLE, MENU_STYLE, OVERLAY_STYLE];

  protected structure(): Structure {
    return CARD_STRUCTURES['custom:mnml-heading-card'];
  }

  protected draw(hass: HomeAssistant, config: HeadingCard): TemplateResult {
    const line = stateLine(hass, undefined, config.state);
    const lane = renderControls(config.controls, { hass, host: this });
    const trail =
      line.length === 0 && lane === undefined
        ? nothing
        : html`<div class="trail">
            ${line.length === 0 ? nothing : html`<div class="state">${line}</div>`}${lane ?? nothing}
          </div>`;
    return heading(config.title, config.icon, undefined, trail);
  }
}
