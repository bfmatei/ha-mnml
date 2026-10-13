import type { SliderKind } from '../../contract/cards.ts';
import type { EntityId } from '../../contract/entities.ts';
import { formatAttribute } from '../../ha/format.ts';
import { callService, numberAttribute, numericState } from '../../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';

export interface SliderSpec {
  min: number;
  max: number;
  step: number;
  value: number;
  gradient?: string;
  dimmed?: true;
  format(value: number): string;
  commit(value: number): Promise<unknown>;
}

const WHITE_GRADIENT = 'linear-gradient(90deg, #ffb057 0%, #fff1dc 55%, #cfe1ff 100%)';
const HUE_GRADIENT =
  'linear-gradient(90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))';

interface SpecOptions {
  turn_on?: true;
}

export function sliderSpec(
  hass: HomeAssistant,
  id: EntityId,
  stateObj: HassEntity,
  kind: SliderKind,
  options: SpecOptions = {},
): SliderSpec | undefined {
  switch (kind) {
    case 'brightness': {
      const brightness = numberAttribute(stateObj, 'brightness') ?? 0;
      return {
        min: 0,
        max: 100,
        step: 1,
        value: stateObj.state === 'on' ? Math.round((brightness / 255) * 100) : 0,
        format: (value) => formatAttribute(hass, stateObj, 'brightness', (value / 100) * 255),
        commit: (value) =>
          value === 0
            ? callService(hass, id, 'light.turn_off')
            : callService(hass, id, 'light.turn_on', { brightness_pct: value }),
      };
    }
    case 'color_temp': {
      const min = numberAttribute(stateObj, 'min_color_temp_kelvin') ?? 2000;
      const kelvin = numberAttribute(stateObj, 'color_temp_kelvin');
      return {
        min,
        max: numberAttribute(stateObj, 'max_color_temp_kelvin') ?? 6500,
        step: 50,
        value: kelvin ?? min,
        gradient: WHITE_GRADIENT,
        dimmed: stateObj.state === 'on' && kelvin !== undefined ? undefined : true,
        format: (value) => formatAttribute(hass, stateObj, 'color_temp_kelvin', value),
        commit: (value) => callService(hass, id, 'light.turn_on', { color_temp_kelvin: value }),
      };
    }
    case 'hue': {
      const hs = stateObj.attributes['hs_color'];
      const hue = Array.isArray(hs) && typeof hs[0] === 'number' ? hs[0] : undefined;
      return {
        min: 0,
        max: 360,
        step: 1,
        value: Math.round(hue ?? 0),
        gradient: HUE_GRADIENT,
        dimmed: stateObj.state === 'on' && hue !== undefined ? undefined : true,
        format: (value) => `${value}°`,
        commit: (value) => callService(hass, id, 'light.turn_on', { hs_color: [value, 100] }),
      };
    }
    case 'temperature': {
      const min = numberAttribute(stateObj, 'min_temp') ?? 7;
      return {
        min,
        max: numberAttribute(stateObj, 'max_temp') ?? 35,
        step: numberAttribute(stateObj, 'target_temp_step') ?? 0.5,
        value: numberAttribute(stateObj, 'temperature') ?? min,
        format: (value) => formatAttribute(hass, stateObj, 'temperature', value),
        commit: async (value) => {
          if (options.turn_on && stateObj.state === 'off') {
            await callService(hass, id, 'climate.turn_on');
          }
          return callService(hass, id, 'climate.set_temperature', { temperature: value });
        },
      };
    }
    case 'value': {
      const min = numberAttribute(stateObj, 'min') ?? 0;
      return {
        min,
        max: numberAttribute(stateObj, 'max') ?? 100,
        step: numberAttribute(stateObj, 'step') ?? 1,
        value: numericState(stateObj) ?? min,
        format: (value) => hass.formatEntityState(stateObj, String(value)),
        commit: (value) => callService(hass, id, 'number.set_value', { value }),
      };
    }
    case 'volume': {
      const level = numberAttribute(stateObj, 'volume_level') ?? 0;
      return {
        min: 0,
        max: 100,
        step: 1,
        value: Math.round(level * 100),
        format: (value) => `${value} %`,
        commit: (value) =>
          callService(hass, id, 'media_player.volume_set', { volume_level: value / 100 }),
      };
    }
    case 'position': {
      const position = numberAttribute(stateObj, 'current_position');
      return {
        min: 0,
        max: 100,
        step: 1,
        value: position ?? (stateObj.state === 'open' ? 100 : 0),
        format: (value) => `${value} %`,
        commit: (value) => callService(hass, id, 'cover.set_cover_position', { position: value }),
      };
    }
    case 'percentage': {
      const percentage = numberAttribute(stateObj, 'percentage') ?? 0;
      return {
        min: 0,
        max: 100,
        step: numberAttribute(stateObj, 'percentage_step') ?? 1,
        value: stateObj.state === 'on' ? percentage : 0,
        format: (value) => `${value} %`,
        commit: (value) => callService(hass, id, 'fan.set_percentage', { percentage: value }),
      };
    }
    case 'humidity': {
      const min = numberAttribute(stateObj, 'min_humidity') ?? 0;
      return {
        min,
        max: numberAttribute(stateObj, 'max_humidity') ?? 100,
        step: 1,
        value: numberAttribute(stateObj, 'humidity') ?? min,
        format: (value) => `${value} %`,
        commit: (value) => callService(hass, id, 'humidifier.set_humidity', { humidity: value }),
      };
    }
    default:
      return undefined;
  }
}
