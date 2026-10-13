import { html } from 'lit';
import type { TemplateResult } from 'lit';

import type { SliderCard } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { SLIDER_KINDS } from '../contract/structure.ts';
import { hasValue, isUnavailable, stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { entityName } from '../ha/names.ts';

import { MnmlCard, requireOneOf, requireString } from './base.ts';
import type { KeySchema } from './keys.ts';
import { sliderSpec } from './parts/slider-spec.ts';
import { SLIDER_CARD } from './schemas.ts';

const FALLBACK_ICON: MdiIcon = 'mdi:tune-variant';

export class MnmlSliderCard extends MnmlCard<SliderCard> {
  protected override readonly columns = 6;

  protected schema(): KeySchema {
    return SLIDER_CARD;
  }

  protected override validate(config: SliderCard): void {
    requireString('entity', config.entity);
    requireOneOf('slider', config.slider, SLIDER_KINDS);
  }

  protected draw(hass: HomeAssistant, config: SliderCard): TemplateResult | undefined {
    const stateObj = stateOf(hass, config.entity);
    const label = {
      icon: config.icon ?? FALLBACK_ICON,
      name: config.name ?? entityName(hass, config.entity),
    };
    if (isUnavailable(stateObj)) {
      return html`<mnml-slider
        full
        .label=${label}
        .unavailable=${{ hass, stateObj }}
      ></mnml-slider>`;
    }
    const spec = hasValue(stateObj)
      ? sliderSpec(hass, config.entity, stateObj, config.slider, config)
      : undefined;
    if (spec === undefined) {
      return undefined;
    }
    return html`<mnml-slider
      full
      .spec=${spec}
      .label=${label}
      .color=${config.color}
      .owner=${this}
    ></mnml-slider>`;
  }
}
