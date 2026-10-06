import type { AgendaSource, Color, ModeAttribute, SliderKind } from '../contract/cards.ts';
import type { ServiceName } from '../contract/entities.ts';

export const COLORS: readonly string[] = Object.keys({
  red: true,
  orange: true,
  amber: true,
  blue: true,
} satisfies Record<Color, true>);

export const SLIDER_KINDS: readonly string[] = Object.keys({
  brightness: true,
  color_temp: true,
  hue: true,
  temperature: true,
  value: true,
  volume: true,
} satisfies Record<SliderKind, true>);

export const MODE_ATTRIBUTES: readonly string[] = Object.keys({
  hvac_modes: true,
  preset_modes: true,
  fan_modes: true,
  swing_modes: true,
  swing_horizontal_modes: true,
} satisfies Record<ModeAttribute, true>);

export const AGENDA_KINDS: readonly string[] = Object.keys({
  episodes: true,
  movies: true,
} satisfies Record<AgendaSource['kind'], true>);

export const SERVICES: readonly string[] = Object.keys({
  'button.press': true,
  'climate.set_fan_mode': true,
  'climate.set_hvac_mode': true,
  'climate.set_preset_mode': true,
  'climate.set_swing_horizontal_mode': true,
  'climate.set_swing_mode': true,
  'climate.set_temperature': true,
  'climate.turn_off': true,
  'climate.turn_on': true,
  'homeassistant.toggle': true,
  'light.turn_off': true,
  'light.turn_on': true,
  'lock.lock': true,
  'lock.unlock': true,
  'media_player.media_next_track': true,
  'media_player.media_play_pause': true,
  'media_player.media_previous_track': true,
  'media_player.volume_set': true,
  'number.set_value': true,
  'scene.turn_on': true,
  'script.turn_on': true,
  'select.select_option': true,
  'vacuum.locate': true,
  'vacuum.return_to_base': true,
  'vacuum.start': true,
  'vacuum.stop': true,
} satisfies Record<ServiceName, true>);

export const CORNER_NAMES: readonly string[] = [
  'front left',
  'front right',
  'rear left',
  'rear right',
];
