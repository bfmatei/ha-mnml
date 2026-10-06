import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Control, MediaCard } from '../contract/cards.ts';
import type { MediaPlayerId } from '../contract/entities.ts';
import { numberAttribute, stateOf, stringAttribute } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { entityName } from '../ha/names.ts';
import { stateIcon } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { renderControls } from './parts/controls.ts';
import type { ControlContext } from './parts/controls.ts';
import { ITEM_STYLE, linkTo } from './parts/item.ts';
import { BASE_STYLE } from './styles.ts';

const MEDIA_STYLE = css`
  .pill.art {
    background-size: cover;
    background-position: center;
  }
  .lanes {
    display: flex;
    align-items: center;
    flex: none;
  }
  @media (max-width: 480px) {
    .phone-hidden {
      display: none;
    }
  }
`;

const FEATURE = {
  pause: 1,
  volume: 4,
  previous: 16,
  next: 32,
  turnOn: 128,
  turnOff: 256,
  play: 16384,
} as const;

const ACTIVE = new Set(['playing', 'paused', 'buffering', 'on']);

function supports(stateObj: HassEntity, feature: number): boolean {
  const features = numberAttribute(stateObj, 'supported_features') ?? 0;
  return (features & feature) !== 0;
}

function mediaLine(hass: HomeAssistant, stateObj: HassEntity): string {
  if (!ACTIVE.has(stateObj.state)) {
    return hass.formatEntityState(stateObj);
  }
  const parts = [
    stringAttribute(stateObj, 'media_title') ?? stringAttribute(stateObj, 'app_name'),
    stringAttribute(stateObj, 'media_artist') ?? stringAttribute(stateObj, 'media_series_title'),
  ].filter((part): part is string => part !== undefined && part !== '');
  return parts.length > 0 ? parts.join(' • ') : hass.formatEntityState(stateObj);
}

function lanes(entity: MediaPlayerId, stateObj: HassEntity, ctx: ControlContext): TemplateResult {
  const playing = stateObj.state === 'playing';
  const drawn: (TemplateResult | undefined)[] = [];
  const append = (controls: Control[], phoneHidden: boolean): void => {
    drawn.push(renderControls(controls, ctx, phoneHidden ? 'lane phone-hidden' : 'lane'));
  };
  if (supports(stateObj, FEATURE.previous)) {
    append(
      [
        {
          type: 'service',
          entity,
          service: 'media_player.media_previous_track',
          name: 'Previous',
          icon: 'mdi:skip-previous',
        },
      ],
      true,
    );
  }
  if (supports(stateObj, FEATURE.play) || supports(stateObj, FEATURE.pause)) {
    append(
      [
        {
          type: 'service',
          entity,
          service: 'media_player.media_play_pause',
          name: playing ? 'Pause' : 'Play',
          icon: playing ? 'mdi:pause' : 'mdi:play',
          primary: true,
        },
      ],
      false,
    );
  }
  if (supports(stateObj, FEATURE.next)) {
    append(
      [
        {
          type: 'service',
          entity,
          service: 'media_player.media_next_track',
          name: 'Next',
          icon: 'mdi:skip-next',
        },
      ],
      true,
    );
  }
  const tail: Control[] = [];
  if (supports(stateObj, FEATURE.volume)) {
    tail.push({
      type: 'slider',
      entity,
      slider: 'volume',
      name: 'Volume',
      icon: 'mdi:volume-high',
    });
  }
  if (supports(stateObj, FEATURE.turnOn) && supports(stateObj, FEATURE.turnOff)) {
    tail.push({
      type: 'toggle',
      entity,
      icon: 'mdi:power',
      color: 'amber',
      when: { not: ['off'] },
    });
  }
  append(tail, false);
  return html`<div class="lanes">${drawn.map((lane) => lane ?? nothing)}</div>`;
}

const SCHEMA = schema<MediaCard>({ type: true, entity: true, popup: true });

export class MnmlMediaCard extends MnmlCard<MediaCard> {
  static override styles = [BASE_STYLE, ...ITEM_STYLE, MEDIA_STYLE];

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: MediaCard): void {
    requireString('entity', config.entity);
  }

  protected draw(hass: HomeAssistant, config: MediaCard): TemplateResult {
    const stateObj = stateOf(hass, config.entity);
    const picture = stringAttribute(stateObj, 'entity_picture');
    const art = stateObj !== undefined && picture !== undefined && ACTIVE.has(stateObj.state);
    const name = entityName(hass, config.entity);
    const link = config.popup === undefined ? undefined : linkTo(config.popup);
    return html`<div
      class=${classMap({ card: true, row: true, link: link !== undefined })}
      @pointerdown=${link?.pointerdown ?? nothing}
      @click=${link?.click ?? nothing}
    >
      <div
        class=${classMap({ pill: true, art, link: link !== undefined })}
        style=${styleMap({ 'background-image': art ? `url("${picture}")` : undefined })}
        role=${link === undefined ? nothing : 'button'}
        tabindex=${link === undefined ? nothing : 0}
        aria-label=${link === undefined ? nothing : name}
        title=${link === undefined ? nothing : name}
        @pointerdown=${link?.pointerdown ?? nothing}
        @click=${link?.click ?? nothing}
        @keydown=${link?.keydown ?? nothing}
      >
        ${art ? nothing : stateIcon(hass, stateObj)}
      </div>
      <div class="text">
        <div class="name">${name}</div>
        <div class="state">${stateObj === undefined ? '' : mediaLine(hass, stateObj)}</div>
      </div>
      ${stateObj === undefined ? nothing : lanes(config.entity, stateObj, { hass, host: this })}
    </div>`;
  }
}
