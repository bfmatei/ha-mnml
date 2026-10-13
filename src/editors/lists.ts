import type { ServiceName } from '../contract/entities.ts';

export { COLORS } from '../contract/structure.ts';

export const SERVICES: readonly string[] = Object.keys({
  'alarm_control_panel.alarm_arm_away': true,
  'alarm_control_panel.alarm_arm_home': true,
  'alarm_control_panel.alarm_arm_night': true,
  'alarm_control_panel.alarm_disarm': true,
  'button.press': true,
  'climate.set_fan_mode': true,
  'climate.set_hvac_mode': true,
  'climate.set_preset_mode': true,
  'climate.set_swing_horizontal_mode': true,
  'climate.set_swing_mode': true,
  'climate.set_temperature': true,
  'climate.turn_off': true,
  'climate.turn_on': true,
  'cover.close_cover': true,
  'cover.open_cover': true,
  'cover.set_cover_position': true,
  'cover.stop_cover': true,
  'fan.set_percentage': true,
  'homeassistant.toggle': true,
  'humidifier.set_humidity': true,
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
