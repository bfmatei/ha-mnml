type Domain =
  | 'light'
  | 'sensor'
  | 'binary_sensor'
  | 'climate'
  | 'switch'
  | 'scene'
  | 'media_player'
  | 'lock'
  | 'vacuum'
  | 'select'
  | 'number'
  | 'button'
  | 'image'
  | 'camera'
  | 'device_tracker'
  | 'person'
  | 'input_boolean'
  | 'script'
  | 'update'
  | 'weather'
  | 'calendar'
  | 'cover'
  | 'fan'
  | 'humidifier'
  | 'alarm_control_panel';

export type EntityId<D extends Domain = Domain> = `${D}.${string}`;

export type LightId = EntityId<'light'>;
export type SensorId = EntityId<'sensor'>;
export type BinarySensorId = EntityId<'binary_sensor'>;
export type ClimateId = EntityId<'climate'>;
export type SwitchId = EntityId<'switch'>;
export type SceneId = EntityId<'scene'>;
export type MediaPlayerId = EntityId<'media_player'>;
export type LockId = EntityId<'lock'>;
export type VacuumId = EntityId<'vacuum'>;
export type SelectId = EntityId<'select'>;
export type NumberId = EntityId<'number'>;
export type ButtonId = EntityId<'button'>;
export type ImageId = EntityId<'image'>;
export type CameraId = EntityId<'camera'>;
export type DeviceTrackerId = EntityId<'device_tracker'>;
export type PersonId = EntityId<'person'>;
export type InputBooleanId = EntityId<'input_boolean'>;
export type ScriptId = EntityId<'script'>;
export type UpdateId = EntityId<'update'>;
export type WeatherId = EntityId<'weather'>;
export type CalendarId = EntityId<'calendar'>;
export type CoverId = EntityId<'cover'>;
export type FanId = EntityId<'fan'>;
export type HumidifierId = EntityId<'humidifier'>;
export type AlarmPanelId = EntityId<'alarm_control_panel'>;

export type MdiIcon = `mdi:${string}`;
export type PopupHash = `#${string}`;
export type Subnet = `${number}.${number}.${number}.${number}/${number}`;

export type ServiceName =
  | 'alarm_control_panel.alarm_arm_away'
  | 'alarm_control_panel.alarm_arm_home'
  | 'alarm_control_panel.alarm_arm_night'
  | 'alarm_control_panel.alarm_disarm'
  | 'button.press'
  | 'climate.set_fan_mode'
  | 'climate.set_hvac_mode'
  | 'climate.set_preset_mode'
  | 'climate.set_swing_horizontal_mode'
  | 'climate.set_swing_mode'
  | 'climate.set_temperature'
  | 'climate.turn_off'
  | 'climate.turn_on'
  | 'cover.close_cover'
  | 'cover.open_cover'
  | 'cover.set_cover_position'
  | 'cover.stop_cover'
  | 'fan.set_percentage'
  | 'homeassistant.toggle'
  | 'humidifier.set_humidity'
  | 'light.turn_off'
  | 'light.turn_on'
  | 'lock.lock'
  | 'lock.unlock'
  | 'media_player.media_next_track'
  | 'media_player.media_play_pause'
  | 'media_player.media_previous_track'
  | 'media_player.volume_set'
  | 'number.set_value'
  | 'scene.turn_on'
  | 'script.turn_on'
  | 'select.select_option'
  | 'vacuum.locate'
  | 'vacuum.return_to_base'
  | 'vacuum.start'
  | 'vacuum.stop';

export type Corners<T> = readonly [T, T, T, T];
