export const LIGHTS_OFF: ReadonlySet<string> = new Set(['bathroom', 'dressing', 'entry', 'toilet']);

export const HEATING_ON: ReadonlySet<string> = new Set(['bathroom', 'kitchen', 'living']);

export const AWAY: ReadonlySet<string> = new Set([
  'device_tracker.jane_phone',
  'device_tracker.garage_suv_location',
]);

export const STATES: Readonly<Record<string, string>> = {
  'binary_sensor.living_window': 'on',
  'sensor.office_window_battery': '14',
  'sensor.kitchen_button_battery': '4',
  'sensor.garage_suv_doors': 'Unlocked',
  'sensor.garage_suv_window_rear_left': 'INTERMEDIATE',
  'sensor.garage_suv_tyre_pressure_front_right': '2.1',
  'binary_sensor.garage_suv_door_rear_right': 'on',
  'sensor.jane_phone_location_access': 'Authorized When In Use',
  'sensor.jane_phone_activity': 'Automotive',
  'binary_sensor.joe_phone_focus': 'on',
  'sensor.joe_phone_focus_name': 'Work',
  'binary_sensor.infrastructure_docs_status': 'off',
  'sensor.office_3d_printer': 'Printing',
  'sensor.office_3d_printer_progress': '40',
  'switch.kitchen_extractor_outlet': 'off',
  'light.hall_top_2': 'off',
  'sensor.infrastructure_server_checks_failed': '0',
  'sensor.infrastructure_server_checks_warnings': '0',
  'sensor.infrastructure_plex': '1',
  'sensor.infrastructure_jellyfin': '0',
  'sensor.office_3d_printer_nozzle_temperature': '215',
  'sensor.office_3d_printer_nozzle_target_temperature': '215',
  'sensor.office_3d_printer_heatbed_temperature': '60',
  'sensor.office_3d_printer_heatbed_target_temperature': '60',
};
