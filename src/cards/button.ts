import { css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { ButtonCard } from '../contract/cards.ts';
import { callService, run, stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { entityName } from '../ha/names.ts';
import { onPress, stateIcon } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { BASE_STYLE, ROW_STYLE } from './styles.ts';

const PRESS_FLASH = 600;

const BUTTON_STYLE = css`
  .card.button {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      transform 90ms ease-out,
      box-shadow 120ms ease-out;
  }
  .card.button .pill {
    transition: color 160ms ease-out;
  }
  .card.button:active {
    transform: scale(0.98);
  }
  .card.pressed .pill {
    color: var(--primary-color);
  }
  @media (hover: hover) {
    .card.button:hover {
      box-shadow: inset 0 0 0 999px var(--m-hover);
    }
  }
`;

const SCHEMA = schema<ButtonCard>({ type: true, entity: true, service: true });

export class MnmlButtonCard extends MnmlCard<ButtonCard> {
  static override styles = [BASE_STYLE, ROW_STYLE, BUTTON_STYLE];

  protected override readonly columns = 6;

  @state() private pressed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: ButtonCard): void {
    requireString('entity', config.entity);
    requireString('service', config.service);
  }

  protected draw(hass: HomeAssistant, config: ButtonCard): TemplateResult {
    const name = entityName(hass, config.entity);
    const press = (): void => {
      clearTimeout(this.timer);
      this.pressed = true;
      this.timer = setTimeout(() => {
        this.pressed = false;
      }, PRESS_FLASH);
      run(this, callService(hass, config.entity, config.service));
    };
    return html`<div
      class=${classMap({ card: true, row: true, button: true, pressed: this.pressed })}
      role="button"
      tabindex="0"
      aria-label=${name}
      title=${name}
      @click=${press}
      @keydown=${onPress(press)}
    >
      <div class="pill">${stateIcon(hass, stateOf(hass, config.entity))}</div>
      <div class="text"><div class="name">${name}</div></div>
    </div>`;
  }
}
