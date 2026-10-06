import type { MdiIcon } from '../src/contract/entities.ts';

export interface Trait {
  name?: string;
  icon?: MdiIcon;
  icons?: Record<string, MdiIcon>;
  unit?: string;
  device_class?: string;
  reading?: string;
}

export const TRAITS: Record<string, Trait> = {
  'binary_sensor.bedroom_window': {
    name: 'Window',
    device_class: 'window',
  },
  'binary_sensor.entry_door': {
    name: 'Door',
    device_class: 'door',
  },
  'binary_sensor.garage_sedan_alarm_active': {
    icon: 'mdi:alarm-light',
    name: 'Alarm active',
    device_class: 'sound',
  },
  'binary_sensor.garage_sedan_door_front_left': {
    icon: 'mdi:car-door',
    name: 'Door (front left)',
    device_class: 'door',
  },
  'binary_sensor.garage_sedan_door_front_right': {
    icon: 'mdi:car-door',
    name: 'Door (front right)',
    device_class: 'door',
  },
  'binary_sensor.garage_sedan_door_rear_left': {
    icon: 'mdi:car-door',
    name: 'Door (rear left)',
    device_class: 'door',
  },
  'binary_sensor.garage_sedan_door_rear_right': {
    icon: 'mdi:car-door',
    name: 'Door (rear right)',
    device_class: 'door',
  },
  'binary_sensor.garage_sedan_hood': {
    icon: 'mdi:car-windshield',
    name: 'Hood',
    device_class: 'door',
  },
  'binary_sensor.garage_sedan_tailgate': {
    icon: 'mdi:car-back',
    name: 'Tailgate',
    device_class: 'door',
  },
  'binary_sensor.garage_suv_alarm_active': {
    icon: 'mdi:alarm-light',
    name: 'Alarm active',
  },
  'binary_sensor.garage_suv_door_front_left': {
    icon: 'mdi:car-door',
    name: 'Door (front left)',
    device_class: 'door',
  },
  'binary_sensor.garage_suv_door_front_right': {
    icon: 'mdi:car-door',
    name: 'Door (front right)',
    device_class: 'door',
  },
  'binary_sensor.garage_suv_door_rear_left': {
    icon: 'mdi:car-door',
    name: 'Door (rear left)',
    device_class: 'door',
  },
  'binary_sensor.garage_suv_door_rear_right': {
    icon: 'mdi:car-door',
    name: 'Door (rear right)',
    device_class: 'door',
  },
  'binary_sensor.garage_suv_hood': {
    icon: 'mdi:car-windshield',
    name: 'Hood',
    device_class: 'door',
  },
  'binary_sensor.garage_suv_tailgate': {
    icon: 'mdi:car-back',
    name: 'Tailgate',
    device_class: 'door',
  },
  'binary_sensor.hall_laundry_water_leak': {
    name: 'Laundry water leak',
    device_class: 'moisture',
  },
  'binary_sensor.infrastructure_arr_status': {
    name: 'Arr',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_dns_status': {
    name: 'DNS',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_docs_status': {
    name: 'Docs',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_downloads_status': {
    name: 'Downloads',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_home_assistant_status': {
    name: 'Home Assistant',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_matter_server': {
    name: 'Matter Server',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_media_status': {
    name: 'Media',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_openthread_border_router': {
    name: 'OpenThread Border Router',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_radarr_health': {
    name: 'Radarr',
    device_class: 'problem',
  },
  'binary_sensor.infrastructure_server_backup_status': {
    name: 'Backup status',
    device_class: 'problem',
  },
  'binary_sensor.infrastructure_server_checks_overdue': {
    name: 'Checks overdue',
    device_class: 'problem',
  },
  'binary_sensor.infrastructure_tailscale_exit_node_connected_to_control': {
    name: 'Tailscale exit node',
    device_class: 'connectivity',
  },
  'binary_sensor.infrastructure_tailscale_router_connected_to_control': {
    name: 'Tailscale router',
    device_class: 'connectivity',
  },
  'binary_sensor.infrastructure_vpn_exit_node_status': {
    name: 'VPN exit node',
    device_class: 'running',
  },
  'binary_sensor.infrastructure_vpn_router_status': {
    name: 'VPN router',
    device_class: 'running',
  },
  'binary_sensor.jane_phone_focus': {
    icon: 'mdi:moon-waning-crescent',
    name: 'Focus',
  },
  'binary_sensor.joe_phone_focus': {
    icon: 'mdi:moon-waning-crescent',
    name: 'Focus',
  },
  'binary_sensor.joe_tablet_focus': {
    icon: 'mdi:moon-waning-crescent',
    name: 'Focus',
  },
  'binary_sensor.kitchen_window': {
    name: 'Window',
    device_class: 'window',
  },
  'binary_sensor.living_vacuum_dock_clean_water_box': {
    name: 'Clean water box',
    device_class: 'problem',
  },
  'binary_sensor.living_vacuum_dock_dirty_water_box': {
    name: 'Dirty water box',
    device_class: 'problem',
  },
  'binary_sensor.living_vacuum_mop_attached': {
    icon: 'mdi:square-rounded',
    name: 'Mop attached',
    device_class: 'connectivity',
  },
  'binary_sensor.living_vacuum_water_box_attached': {
    icon: 'mdi:water',
    name: 'Water box attached',
    device_class: 'connectivity',
  },
  'binary_sensor.living_vacuum_water_shortage': {
    icon: 'mdi:water',
    name: 'Water shortage',
    device_class: 'problem',
  },
  'binary_sensor.living_window': {
    name: 'Window',
    device_class: 'window',
  },
  'binary_sensor.office_window': {
    name: 'Window',
    device_class: 'window',
  },
  'button.living_vacuum_dock_reset_strainer': {
    icon: 'mdi:filter',
    name: 'Reset strainer',
  },
  'button.living_vacuum_office_daily': {
    name: 'Office (daily)',
  },
  'button.living_vacuum_office_weekly': {
    name: 'Office (weekly)',
  },
  'button.living_vacuum_open_space_daily': {
    name: 'Open space (daily)',
  },
  'button.living_vacuum_open_space_weekly': {
    name: 'Open space (weekly)',
  },
  'button.living_vacuum_personal_daily': {
    name: 'Personal (daily)',
  },
  'button.living_vacuum_personal_weekly': {
    name: 'Personal (weekly)',
  },
  'button.living_vacuum_reset_air_filter': {
    icon: 'mdi:air-filter',
    name: 'Reset air filter',
  },
  'button.living_vacuum_reset_main_brush': {
    icon: 'mdi:brush',
    name: 'Reset main brush',
  },
  'button.living_vacuum_reset_sensor': {
    icon: 'mdi:eye-outline',
    name: 'Reset sensor',
  },
  'button.living_vacuum_reset_side_brush': {
    icon: 'mdi:brush',
    name: 'Reset side brush',
  },
  'button.office_3d_printer_cancel_job': {
    icon: 'mdi:cancel',
    name: 'Cancel job',
  },
  'button.office_3d_printer_continue_job': {
    icon: 'mdi:play-circle',
    name: 'Continue job',
  },
  'button.office_3d_printer_pause_job': {
    icon: 'mdi:pause',
    name: 'Pause job',
  },
  'button.office_3d_printer_resume_job': {
    icon: 'mdi:play',
    name: 'Resume job',
  },
  'calendar.calendar_1': {
    name: 'Radarr',
  },
  'calendar.calendar_2': {
    name: 'Sonarr',
  },
  'camera.office_3d_printer_camera': {
    name: '3D printer camera',
  },
  'climate.bathroom_heating': {
    name: 'Heating',
  },
  'climate.bedroom_heating': {
    name: 'Heating',
  },
  'climate.ecobee': {
    icon: 'mdi:air-conditioner',
    name: 'AC',
  },
  'climate.hvac': {
    icon: 'mdi:air-conditioner',
    name: 'AC',
  },
  'climate.kitchen_heating': {
    name: 'Heating',
  },
  'climate.living_heating': {
    name: 'Heating',
  },
  'climate.office_heating': {
    name: 'Heating',
  },
  'climate.toilet_heating': {
    name: 'Heating',
  },
  'device_tracker.garage_sedan_location': {
    name: 'Location',
  },
  'device_tracker.garage_suv_location': {
    name: 'Location',
  },
  'device_tracker.jane_phone': {
    name: 'Phone',
  },
  'device_tracker.joe_phone': {
    name: 'Phone',
  },
  'device_tracker.joe_tablet': {
    name: 'Tablet',
  },
  'image.infrastructure_home_guests_qr_code': {
    icon: 'mdi:qrcode',
    name: 'QR code',
  },
  'image.infrastructure_home_iot_qr_code': {
    icon: 'mdi:qrcode',
    name: 'QR code',
  },
  'image.infrastructure_home_media_qr_code': {
    icon: 'mdi:qrcode',
    name: 'QR code',
  },
  'image.infrastructure_home_users_qr_code': {
    icon: 'mdi:qrcode',
    name: 'QR code',
  },
  'image.living_vacuum_home': {
    name: 'Home',
  },
  'input_boolean.infrastructure_vacation': {
    icon: 'mdi:palm-tree',
    name: 'Vacation',
  },
  'light.bathroom_lights': {
    icon: 'mdi:wall-sconce-round',
    name: 'Lights',
  },
  'light.bathroom_top': {
    icon: 'mdi:wall-sconce-round',
    name: 'Top',
  },
  'light.bedroom_lights': {
    icon: 'mdi:wall-sconce-flat',
    name: 'Lights',
  },
  'light.bedroom_top': {
    icon: 'mdi:wall-sconce-flat',
    name: 'Top',
  },
  'light.bedroom_top_1': {
    icon: 'mdi:lightbulb',
    name: 'Top 1',
  },
  'light.bedroom_top_2': {
    icon: 'mdi:lightbulb',
    name: 'Top 2',
  },
  'light.bedroom_top_3': {
    icon: 'mdi:lightbulb',
    name: 'Top 3',
  },
  'light.dressing_lights': {
    icon: 'mdi:track-light',
    name: 'Lights',
  },
  'light.dressing_top': {
    icon: 'mdi:track-light',
    name: 'Top',
  },
  'light.dressing_top_1': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 1',
  },
  'light.dressing_top_2': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 2',
  },
  'light.dressing_top_3': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 3',
  },
  'light.dressing_top_4': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 4',
  },
  'light.entry_lights': {
    icon: 'mdi:wall-sconce-flat',
    name: 'Lights',
  },
  'light.entry_top': {
    icon: 'mdi:wall-sconce-flat',
    name: 'Top',
  },
  'light.entry_top_1': {
    icon: 'mdi:lightbulb',
    name: 'Top 1',
  },
  'light.entry_top_2': {
    icon: 'mdi:lightbulb',
    name: 'Top 2',
  },
  'light.entry_top_3': {
    icon: 'mdi:lightbulb',
    name: 'Top 3',
  },
  'light.hall_lights': {
    icon: 'mdi:vanity-light',
    name: 'Lights',
  },
  'light.hall_top': {
    icon: 'mdi:vanity-light',
    name: 'Top',
  },
  'light.hall_top_1': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 1',
  },
  'light.hall_top_2': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 2',
  },
  'light.hall_top_3': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 3',
  },
  'light.hall_top_4': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 4',
  },
  'light.hall_top_5': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 5',
  },
  'light.hall_top_6': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 6',
  },
  'light.kitchen_countertop': {
    icon: 'mdi:led-strip',
    name: 'Countertop',
  },
  'light.kitchen_lights': {
    icon: 'mdi:ceiling-light',
    name: 'Lights',
  },
  'light.kitchen_top': {
    icon: 'mdi:ceiling-light',
    name: 'Top',
  },
  'light.kitchen_top_1': {
    icon: 'mdi:lightbulb',
    name: 'Top 1',
  },
  'light.kitchen_top_2': {
    icon: 'mdi:lightbulb',
    name: 'Top 2',
  },
  'light.kitchen_top_3': {
    icon: 'mdi:lightbulb',
    name: 'Top 3',
  },
  'light.living_lights': {
    icon: 'mdi:chandelier',
    name: 'Lights',
  },
  'light.living_top': {
    icon: 'mdi:chandelier',
    name: 'Top',
  },
  'light.living_top_1': {
    icon: 'mdi:lightbulb',
    name: 'Top 1',
  },
  'light.living_top_2': {
    icon: 'mdi:lightbulb',
    name: 'Top 2',
  },
  'light.living_top_3': {
    icon: 'mdi:lightbulb',
    name: 'Top 3',
  },
  'light.living_top_4': {
    icon: 'mdi:lightbulb',
    name: 'Top 4',
  },
  'light.living_top_5': {
    icon: 'mdi:lightbulb',
    name: 'Top 5',
  },
  'light.living_top_6': {
    icon: 'mdi:lightbulb',
    name: 'Top 6',
  },
  'light.living_tv': {
    icon: 'mdi:television-ambient-light',
    name: 'TV',
  },
  'light.living_tv_left': {
    icon: 'mdi:bulkhead-light',
    name: 'TV left',
  },
  'light.living_tv_right': {
    icon: 'mdi:bulkhead-light',
    name: 'TV right',
  },
  'light.office_lights': {
    icon: 'mdi:vanity-light',
    name: 'Lights',
  },
  'light.office_top': {
    icon: 'mdi:vanity-light',
    name: 'Top',
  },
  'light.office_top_1': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 1',
  },
  'light.office_top_2': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 2',
  },
  'light.office_top_3': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 3',
  },
  'light.office_top_4': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 4',
  },
  'light.office_top_5': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 5',
  },
  'light.office_top_6': {
    icon: 'mdi:lightbulb-spot',
    name: 'Top 6',
  },
  'light.toilet_lights': {
    icon: 'mdi:wall-sconce-round',
    name: 'Lights',
  },
  'light.toilet_top': {
    icon: 'mdi:wall-sconce-round',
    name: 'Top',
  },
  'lock.front_door': {
    name: 'Door lock',
  },
  'media_player.bedroom': {
    name: 'HomePod',
  },
  'media_player.living_room': {
    name: 'Sonos',
    device_class: 'speaker',
  },
  'media_player.lounge_room': {
    name: 'Apple TV',
  },
  'number.bedroom_ac_dehumidifier_level': {
    icon: 'mdi:water-percent',
    name: 'Dehumidifier level',
    unit: '%',
  },
  'number.entry_ac_dehumidifier_level': {
    icon: 'mdi:water-percent',
    name: 'Dehumidifier level',
    unit: '%',
  },
  'number.living_sonos_audio_delay': {
    name: 'Audio delay',
  },
  'number.living_sonos_balance': {
    name: 'Balance',
  },
  'number.living_sonos_bass': {
    name: 'Bass',
  },
  'number.living_sonos_music_surround_level': {
    name: 'Music surround level',
  },
  'number.living_sonos_sub_gain': {
    name: 'Sub gain',
  },
  'number.living_sonos_surround_level': {
    name: 'Surround level',
  },
  'number.living_sonos_treble': {
    name: 'Treble',
  },
  'number.office_perfume_diffuser_amount': {
    icon: 'mdi:gauge',
    name: 'Amount',
  },
  'person.jane': {
    icon: 'mdi:face-woman',
    name: 'Jane',
  },
  'person.joe': {
    icon: 'mdi:face-man',
    name: 'Joe',
  },
  'scene.bathroom_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.bathroom_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.bathroom_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.bathroom_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.bathroom_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.bathroom_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.bathroom_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'scene.bedroom_lights_adrift': {
    icon: 'mdi:sail-boat',
    name: 'Adrift',
  },
  'scene.bedroom_lights_arctic_aurora': {
    icon: 'mdi:snowflake',
    name: 'Arctic aurora',
  },
  'scene.bedroom_lights_chinatown': {
    icon: 'mdi:string-lights',
    name: 'Chinatown',
  },
  'scene.bedroom_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.bedroom_lights_disturbia': {
    icon: 'mdi:creation',
    name: 'Disturbia',
  },
  'scene.bedroom_lights_emerald_flutter': {
    icon: 'mdi:butterfly',
    name: 'Emerald flutter',
  },
  'scene.bedroom_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.bedroom_lights_galaxy': {
    icon: 'mdi:orbit',
    name: 'Galaxy',
  },
  'scene.bedroom_lights_lake_placid': {
    icon: 'mdi:waves',
    name: 'Lake Placid',
  },
  'scene.bedroom_lights_motown': {
    icon: 'mdi:music',
    name: 'Motown',
  },
  'scene.bedroom_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.bedroom_lights_nebula': {
    icon: 'mdi:blur',
    name: 'Nebula',
  },
  'scene.bedroom_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.bedroom_lights_osaka': {
    icon: 'mdi:temple-buddhist',
    name: 'Osaka',
  },
  'scene.bedroom_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.bedroom_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.bedroom_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'scene.bedroom_lights_soho': {
    icon: 'mdi:city-variant-outline',
    name: 'Soho',
  },
  'scene.bedroom_lights_tokyo': {
    icon: 'mdi:city',
    name: 'Tokyo',
  },
  'scene.dressing_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.dressing_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.dressing_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.dressing_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.dressing_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.dressing_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.dressing_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'scene.entry_lights_adrift': {
    icon: 'mdi:sail-boat',
    name: 'Adrift',
  },
  'scene.entry_lights_arctic_aurora': {
    icon: 'mdi:snowflake',
    name: 'Arctic aurora',
  },
  'scene.entry_lights_chinatown': {
    icon: 'mdi:string-lights',
    name: 'Chinatown',
  },
  'scene.entry_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.entry_lights_disturbia': {
    icon: 'mdi:creation',
    name: 'Disturbia',
  },
  'scene.entry_lights_emerald_flutter': {
    icon: 'mdi:butterfly',
    name: 'Emerald flutter',
  },
  'scene.entry_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.entry_lights_lake_placid': {
    icon: 'mdi:waves',
    name: 'Lake Placid',
  },
  'scene.entry_lights_motown': {
    icon: 'mdi:music',
    name: 'Motown',
  },
  'scene.entry_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.entry_lights_nebula': {
    icon: 'mdi:blur',
    name: 'Nebula',
  },
  'scene.entry_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.entry_lights_osaka': {
    icon: 'mdi:temple-buddhist',
    name: 'Osaka',
  },
  'scene.entry_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.entry_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.entry_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'scene.entry_lights_soho': {
    icon: 'mdi:city-variant-outline',
    name: 'Soho',
  },
  'scene.entry_lights_tokyo': {
    icon: 'mdi:city',
    name: 'Tokyo',
  },
  'scene.hall_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.hall_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.hall_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.hall_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.hall_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.hall_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.hall_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'scene.kitchen_lights_adrift': {
    icon: 'mdi:sail-boat',
    name: 'Adrift',
  },
  'scene.kitchen_lights_arctic_aurora': {
    icon: 'mdi:snowflake',
    name: 'Arctic aurora',
  },
  'scene.kitchen_lights_chinatown': {
    icon: 'mdi:string-lights',
    name: 'Chinatown',
  },
  'scene.kitchen_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.kitchen_lights_disturbia': {
    icon: 'mdi:creation',
    name: 'Disturbia',
  },
  'scene.kitchen_lights_emerald_flutter': {
    icon: 'mdi:butterfly',
    name: 'Emerald flutter',
  },
  'scene.kitchen_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.kitchen_lights_lake_placid': {
    icon: 'mdi:waves',
    name: 'Lake Placid',
  },
  'scene.kitchen_lights_motown': {
    icon: 'mdi:music',
    name: 'Motown',
  },
  'scene.kitchen_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.kitchen_lights_nebula': {
    icon: 'mdi:blur',
    name: 'Nebula',
  },
  'scene.kitchen_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.kitchen_lights_osaka': {
    icon: 'mdi:temple-buddhist',
    name: 'Osaka',
  },
  'scene.kitchen_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.kitchen_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.kitchen_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'scene.kitchen_lights_soho': {
    icon: 'mdi:city-variant-outline',
    name: 'Soho',
  },
  'scene.kitchen_lights_tokyo': {
    icon: 'mdi:city',
    name: 'Tokyo',
  },
  'scene.living_lights_adrift': {
    icon: 'mdi:sail-boat',
    name: 'Adrift',
  },
  'scene.living_lights_arctic_aurora': {
    icon: 'mdi:snowflake',
    name: 'Arctic aurora',
  },
  'scene.living_lights_chinatown': {
    icon: 'mdi:string-lights',
    name: 'Chinatown',
  },
  'scene.living_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.living_lights_disturbia': {
    icon: 'mdi:creation',
    name: 'Disturbia',
  },
  'scene.living_lights_emerald_flutter': {
    icon: 'mdi:butterfly',
    name: 'Emerald flutter',
  },
  'scene.living_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.living_lights_lake_placid': {
    icon: 'mdi:waves',
    name: 'Lake Placid',
  },
  'scene.living_lights_motown': {
    icon: 'mdi:music',
    name: 'Motown',
  },
  'scene.living_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.living_lights_nebula': {
    icon: 'mdi:blur',
    name: 'Nebula',
  },
  'scene.living_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.living_lights_osaka': {
    icon: 'mdi:temple-buddhist',
    name: 'Osaka',
  },
  'scene.living_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.living_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.living_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'scene.living_lights_soho': {
    icon: 'mdi:city-variant-outline',
    name: 'Soho',
  },
  'scene.living_lights_tokyo': {
    icon: 'mdi:city',
    name: 'Tokyo',
  },
  'scene.office_lights_adrift': {
    icon: 'mdi:sail-boat',
    name: 'Adrift',
  },
  'scene.office_lights_arctic_aurora': {
    icon: 'mdi:snowflake',
    name: 'Arctic aurora',
  },
  'scene.office_lights_chinatown': {
    icon: 'mdi:string-lights',
    name: 'Chinatown',
  },
  'scene.office_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.office_lights_disturbia': {
    icon: 'mdi:creation',
    name: 'Disturbia',
  },
  'scene.office_lights_emerald_flutter': {
    icon: 'mdi:butterfly',
    name: 'Emerald flutter',
  },
  'scene.office_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.office_lights_lake_placid': {
    icon: 'mdi:waves',
    name: 'Lake Placid',
  },
  'scene.office_lights_motown': {
    icon: 'mdi:music',
    name: 'Motown',
  },
  'scene.office_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.office_lights_nebula': {
    icon: 'mdi:blur',
    name: 'Nebula',
  },
  'scene.office_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.office_lights_osaka': {
    icon: 'mdi:temple-buddhist',
    name: 'Osaka',
  },
  'scene.office_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.office_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.office_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'scene.office_lights_soho': {
    icon: 'mdi:city-variant-outline',
    name: 'Soho',
  },
  'scene.office_lights_tokyo': {
    icon: 'mdi:city',
    name: 'Tokyo',
  },
  'scene.toilet_lights_concentrate': {
    icon: 'mdi:head-lightbulb-outline',
    name: 'Concentrate',
  },
  'scene.toilet_lights_energize': {
    icon: 'mdi:lightning-bolt',
    name: 'Energize',
  },
  'scene.toilet_lights_natural_light': {
    icon: 'mdi:white-balance-sunny',
    name: 'Natural light',
  },
  'scene.toilet_lights_nightlight': {
    icon: 'mdi:weather-night',
    name: 'Nightlight',
  },
  'scene.toilet_lights_read': {
    icon: 'mdi:book-open-page-variant',
    name: 'Read',
  },
  'scene.toilet_lights_relax': {
    icon: 'mdi:spa',
    name: 'Relax',
  },
  'scene.toilet_lights_rest': {
    icon: 'mdi:sleep',
    name: 'Rest',
  },
  'script.infrastructure_clear_proxmox_notifications': {
    name: 'Clear Proxmox notifications',
  },
  'select.bathroom_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'select.bedroom_ac_power_saving_mode': {
    icon: 'mdi:power-sleep',
    name: 'Power saving mode',
  },
  'select.bedroom_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'select.dressing_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'select.entry_ac_power_saving_mode': {
    icon: 'mdi:power-sleep',
    name: 'Power saving mode',
  },
  'select.entry_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'select.hall_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'select.kitchen_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'select.living_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'select.living_vacuum_cleaning_mode': {
    name: 'Cleaning mode',
  },
  'select.living_vacuum_mop_intensity': {
    name: 'Mop intensity',
  },
  'select.living_vacuum_mop_mode': {
    name: 'Mop mode',
  },
  'select.office_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'select.toilet_lights_scene': {
    icon: 'mdi:palette',
    name: 'Scene',
  },
  'sensor.bathroom_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.bathroom_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '40',
  },
  'sensor.bathroom_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '27.2',
  },
  'sensor.bathroom_switch_battery': {
    name: 'Switch',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.bathroom_thermostat_battery': {
    name: 'Thermostat',
    unit: '%',
    device_class: 'battery',
    reading: '55',
  },
  'sensor.bathroom_thermostat_valve_position': {
    icon: 'mdi:valve',
    name: 'Thermostat',
    unit: '%',
    reading: '0',
  },
  'sensor.bedroom_ac_energy': {
    name: 'Energy',
    unit: 'kWh',
    device_class: 'energy',
    reading: '1614',
  },
  'sensor.bedroom_ac_energy_daily': {
    icon: 'mdi:counter',
    name: 'Energy daily',
    unit: 'kWh',
    device_class: 'energy',
    reading: '0',
  },
  'sensor.bedroom_ac_power': {
    name: 'AC',
    unit: 'W',
    device_class: 'power',
    reading: '1',
  },
  'sensor.bedroom_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.bedroom_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '38',
  },
  'sensor.bedroom_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '26.9',
  },
  'sensor.bedroom_switch_battery': {
    name: 'Switch',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.bedroom_thermostat_1_battery': {
    name: 'Thermostat 1',
    unit: '%',
    device_class: 'battery',
    reading: '70',
  },
  'sensor.bedroom_thermostat_1_valve_position': {
    icon: 'mdi:valve',
    name: 'Thermostat 1',
    unit: '%',
    reading: '0',
  },
  'sensor.bedroom_thermostat_2_battery': {
    name: 'Thermostat 2',
    unit: '%',
    device_class: 'battery',
    reading: '60',
  },
  'sensor.bedroom_thermostat_2_valve_position': {
    icon: 'mdi:valve',
    name: 'Thermostat 2',
    unit: '%',
    reading: '0',
  },
  'sensor.bedroom_window_battery': {
    name: 'Window',
    unit: '%',
    device_class: 'battery',
    reading: '43',
  },
  'sensor.dressing_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '95',
  },
  'sensor.dressing_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '37',
  },
  'sensor.dressing_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '26.9',
  },
  'sensor.dressing_switch_battery': {
    name: 'Switch',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.entry_ac_energy': {
    name: 'Energy',
    unit: 'kWh',
    device_class: 'energy',
    reading: '2845.3',
  },
  'sensor.entry_ac_energy_daily': {
    icon: 'mdi:counter',
    name: 'Energy daily',
    unit: 'kWh',
    device_class: 'energy',
    reading: '0',
  },
  'sensor.entry_ac_power': {
    name: 'AC',
    unit: 'W',
    device_class: 'power',
    reading: '1',
  },
  'sensor.entry_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '96',
  },
  'sensor.entry_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '41',
  },
  'sensor.entry_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '26.7',
  },
  'sensor.entry_door_battery': {
    name: 'Door',
    unit: '%',
    device_class: 'battery',
    reading: '40',
  },
  'sensor.entry_door_lock_battery': {
    name: 'Door lock',
    unit: '%',
    device_class: 'battery',
    reading: '81',
  },
  'sensor.entry_switch_1_battery': {
    name: 'Switch 1',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.entry_switch_2_battery': {
    name: 'Switch 2',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.garage_sedan_alarm': {
    icon: 'mdi:shield-car',
    name: 'Alarm',
  },
  'sensor.garage_sedan_doors': {
    icon: 'mdi:lock-outline',
    name: 'Doors',
  },
  'sensor.garage_sedan_fuel': {
    icon: 'mdi:fuel',
    name: 'Fuel',
    unit: '%',
    reading: '100',
  },
  'sensor.garage_sedan_metadata': {
    icon: 'mdi:car-info',
    name: 'Sedan',
  },
  'sensor.garage_sedan_mileage': {
    icon: 'mdi:counter',
    name: 'Mileage',
    unit: 'km',
    device_class: 'distance',
    reading: '27441',
  },
  'sensor.garage_sedan_range': {
    icon: 'mdi:car-arrow-right',
    name: 'Range',
    unit: 'km',
    device_class: 'distance',
    reading: '422',
  },
  'sensor.garage_sedan_tyre_pressure_front_left': {
    icon: 'mdi:tire',
    name: 'Tyre pressure (front left)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_sedan_tyre_pressure_front_right': {
    icon: 'mdi:tire',
    name: 'Tyre pressure (front right)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_sedan_tyre_pressure_rear_left': {
    icon: 'mdi:tire',
    name: 'Tyre pressure (rear left)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_sedan_tyre_pressure_rear_right': {
    icon: 'mdi:tire',
    name: 'Tyre pressure (rear right)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_sedan_tyre_pressure_target_front_left': {
    name: 'Tyre pressure target (front left)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_sedan_tyre_pressure_target_front_right': {
    name: 'Tyre pressure target (front right)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_sedan_tyre_pressure_target_rear_left': {
    name: 'Tyre pressure target (rear left)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_sedan_tyre_pressure_target_rear_right': {
    name: 'Tyre pressure target (rear right)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_sedan_window_front_left': {
    icon: 'mdi:car-windshield',
    name: 'Window (front left)',
  },
  'sensor.garage_sedan_window_front_right': {
    icon: 'mdi:car-windshield',
    name: 'Window (front right)',
  },
  'sensor.garage_sedan_window_rear_left': {
    icon: 'mdi:car-windshield',
    name: 'Window (rear left)',
  },
  'sensor.garage_sedan_window_rear_right': {
    icon: 'mdi:car-windshield',
    name: 'Window (rear right)',
  },
  'sensor.garage_suv_alarm': {
    icon: 'mdi:shield-car',
    name: 'Alarm',
  },
  'sensor.garage_suv_doors': {
    icon: 'mdi:lock-outline',
    name: 'Doors',
  },
  'sensor.garage_suv_fuel': {
    icon: 'mdi:fuel',
    name: 'Fuel',
    unit: '%',
    reading: '88',
  },
  'sensor.garage_suv_metadata': {
    icon: 'mdi:car-info',
    name: 'SUV',
  },
  'sensor.garage_suv_mileage': {
    icon: 'mdi:counter',
    name: 'Mileage',
    unit: 'km',
    device_class: 'distance',
    reading: '3922',
  },
  'sensor.garage_suv_range': {
    icon: 'mdi:car-arrow-right',
    name: 'Range',
    unit: 'km',
    device_class: 'distance',
    reading: '572',
  },
  'sensor.garage_suv_sunroof': {
    icon: 'mdi:car-windshield-outline',
    name: 'Sunroof',
  },
  'sensor.garage_suv_tyre_pressure_front_left': {
    icon: 'mdi:tire',
    name: 'Tyre pressure (front left)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_suv_tyre_pressure_front_right': {
    icon: 'mdi:tire',
    name: 'Tyre pressure (front right)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_suv_tyre_pressure_rear_left': {
    icon: 'mdi:tire',
    name: 'Tyre pressure (rear left)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_suv_tyre_pressure_rear_right': {
    icon: 'mdi:tire',
    name: 'Tyre pressure (rear right)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_suv_tyre_pressure_target_front_left': {
    name: 'Tyre pressure target (front left)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_suv_tyre_pressure_target_front_right': {
    name: 'Tyre pressure target (front right)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_suv_tyre_pressure_target_rear_left': {
    name: 'Tyre pressure target (rear left)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_suv_tyre_pressure_target_rear_right': {
    name: 'Tyre pressure target (rear right)',
    unit: 'bar',
    device_class: 'pressure',
  },
  'sensor.garage_suv_window_front_left': {
    icon: 'mdi:car-windshield',
    name: 'Window (front left)',
  },
  'sensor.garage_suv_window_front_right': {
    icon: 'mdi:car-windshield',
    name: 'Window (front right)',
  },
  'sensor.garage_suv_window_rear_left': {
    icon: 'mdi:car-windshield',
    name: 'Window (rear left)',
  },
  'sensor.garage_suv_window_rear_right': {
    icon: 'mdi:car-windshield',
    name: 'Window (rear right)',
  },
  'sensor.hall_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.hall_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '37',
  },
  'sensor.hall_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '26.9',
  },
  'sensor.hall_laundry_water_leak_battery': {
    name: 'Laundry water leak',
    unit: '%',
    device_class: 'battery',
    reading: '40',
  },
  'sensor.hall_switch_battery': {
    name: 'Switch',
    unit: '%',
    device_class: 'battery',
    reading: '90',
  },
  'sensor.infrastructure_adguard_clients': {
    name: 'AdGuard clients',
    reading: '38',
  },
  'sensor.infrastructure_adguard_home_blocked': {
    icon: 'mdi:magnify-close',
    name: 'Blocked',
    unit: 'queries',
    reading: '96321',
  },
  'sensor.infrastructure_adguard_home_blocked_share': {
    icon: 'mdi:magnify-close',
    name: 'Blocked share',
    unit: '%',
    reading: '12.6',
  },
  'sensor.infrastructure_adguard_home_processing_time': {
    icon: 'mdi:speedometer',
    name: 'Processing time',
    unit: 'ms',
    reading: '12',
  },
  'sensor.infrastructure_adguard_home_queries': {
    icon: 'mdi:magnify',
    name: 'Queries',
    unit: 'queries',
    reading: '767667',
  },
  'sensor.infrastructure_adguard_home_rules_count': {
    icon: 'mdi:counter',
    name: 'Rules count',
    unit: 'rules',
    reading: '197343',
  },
  'sensor.infrastructure_ap_state': {
    icon: 'mdi:lan-connect',
    name: 'AP',
    device_class: 'enum',
  },
  'sensor.infrastructure_arr_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '0.2',
  },
  'sensor.infrastructure_arr_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Arr',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '2.3',
  },
  'sensor.infrastructure_arr_max_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Max disk usage',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '16',
  },
  'sensor.infrastructure_arr_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '16.8',
  },
  'sensor.infrastructure_dns_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '0.6',
  },
  'sensor.infrastructure_dns_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'DNS',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '0.5',
  },
  'sensor.infrastructure_dns_max_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Max disk usage',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '4',
  },
  'sensor.infrastructure_dns_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '11.3',
  },
  'sensor.infrastructure_docs_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '0',
  },
  'sensor.infrastructure_docs_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Docs',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '0.4',
  },
  'sensor.infrastructure_docs_max_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Max disk usage',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '8',
  },
  'sensor.infrastructure_docs_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '7.8',
  },
  'sensor.infrastructure_downloads_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '0',
  },
  'sensor.infrastructure_downloads_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Downloads',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '0.4',
  },
  'sensor.infrastructure_downloads_max_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Max disk usage',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '8',
  },
  'sensor.infrastructure_downloads_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '2.8',
  },
  'sensor.infrastructure_home_assistant_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '4.3',
  },
  'sensor.infrastructure_home_assistant_host_disk_free': {
    name: 'Disk free',
    unit: 'GB',
    device_class: 'data_size',
    reading: '20.4',
  },
  'sensor.infrastructure_home_assistant_host_disk_used': {
    name: 'Disk used',
    unit: 'GB',
    device_class: 'data_size',
    reading: '9.1',
  },
  'sensor.infrastructure_home_assistant_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '60.8',
  },
  'sensor.infrastructure_local_storage_used': {
    icon: 'mdi:harddisk',
    name: 'local',
    unit: '%',
    reading: '0.1',
  },
  'sensor.infrastructure_local_zfs_storage_used': {
    icon: 'mdi:harddisk',
    name: 'local-zfs',
    unit: '%',
    reading: '2.6',
  },
  'sensor.infrastructure_media_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '0',
  },
  'sensor.infrastructure_media_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Media',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '0.9',
  },
  'sensor.infrastructure_media_max_disk_usage': {
    icon: 'mdi:harddisk',
    name: 'Max disk usage',
    unit: 'GiB',
    device_class: 'data_size',
    reading: '32',
  },
  'sensor.infrastructure_media_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '1.6',
  },
  'sensor.infrastructure_offsite_storage_used': {
    icon: 'mdi:harddisk',
    name: 'offsite',
    unit: '%',
    reading: '14.5',
  },
  'sensor.infrastructure_plex': {
    icon: 'mdi:plex',
    name: 'Plex',
    unit: 'watching',
    reading: '0',
  },
  'sensor.infrastructure_proxmox_notifications': {
    icon: 'mdi:bell-outline',
    name: 'Notifications',
    reading: '2',
  },
  'sensor.infrastructure_radarr_free_space': {
    icon: 'mdi:harddisk',
    name: 'Free space',
    unit: 'GB',
    device_class: 'data_size',
    reading: '536',
  },
  'sensor.infrastructure_radarr_movies': {
    icon: 'mdi:movie-open-outline',
    name: 'Radarr',
    unit: 'movies',
    reading: '2',
  },
  'sensor.infrastructure_radarr_queue': {
    icon: 'mdi:download',
    name: 'Radarr',
    unit: 'movies',
    reading: '0',
  },
  'sensor.infrastructure_router_cloudflare': {
    name: 'Cloudflare',
    unit: 'ms',
    device_class: 'duration',
    reading: '2',
  },
  'sensor.infrastructure_router_cpu_temperature': {
    name: 'CPU temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '64',
  },
  'sensor.infrastructure_router_cpu_usage': {
    icon: 'mdi:chip',
    name: 'CPU usage',
    unit: '%',
    reading: '19.3',
  },
  'sensor.infrastructure_router_google': {
    name: 'Google',
    unit: 'ms',
    device_class: 'duration',
    reading: '34',
  },
  'sensor.infrastructure_router_isp_link_speed': {
    icon: 'mdi:speedometer',
    name: 'ISP  link speed',
    unit: 'Mbit/s',
    device_class: 'data_rate',
    reading: '10000',
  },
  'sensor.infrastructure_router_server_link_speed': {
    icon: 'mdi:speedometer',
    name: 'Server link speed',
    unit: 'Mbit/s',
    device_class: 'data_rate',
    reading: '10000',
  },
  'sensor.infrastructure_router_state': {
    icon: 'mdi:lan-connect',
    name: 'Router',
    device_class: 'enum',
  },
  'sensor.infrastructure_seerr_pending_requests': {
    icon: 'mdi:clock',
    name: 'Pending requests',
    unit: 'requests',
    reading: '0',
  },
  'sensor.infrastructure_seerr_processing_requests': {
    icon: 'mdi:sync',
    name: 'Processing requests',
    unit: 'requests',
    reading: '0',
  },
  'sensor.infrastructure_server_bucket_used': {
    icon: 'mdi:bucket-outline',
    name: 'Bucket used',
    unit: 'GB',
    device_class: 'data_size',
    reading: '10.35',
  },
  'sensor.infrastructure_server_checks_failed': {
    icon: 'mdi:clipboard-check-outline',
    name: 'Checks failed',
    reading: '8',
  },
  'sensor.infrastructure_server_checks_last_run': {
    name: 'Checks last run',
    device_class: 'timestamp',
  },
  'sensor.infrastructure_server_cpu_temperature': {
    name: 'CPU temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '50',
  },
  'sensor.infrastructure_server_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '0.7',
  },
  'sensor.infrastructure_server_disk_life_left': {
    icon: 'mdi:heart-pulse',
    name: 'Disk life left',
    unit: '%',
    reading: '98',
  },
  'sensor.infrastructure_server_disks_failing': {
    icon: 'mdi:harddisk-remove',
    name: 'Disks failing',
    reading: '0',
  },
  'sensor.infrastructure_server_last_backup': {
    name: 'Last backup',
    device_class: 'timestamp',
  },
  'sensor.infrastructure_server_last_boot': {
    name: 'Last boot',
    device_class: 'uptime',
  },
  'sensor.infrastructure_server_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '37.8',
  },
  'sensor.infrastructure_server_outlet_energy': {
    name: 'Energy',
    unit: 'kWh',
    device_class: 'energy',
    reading: '25.8',
  },
  'sensor.infrastructure_server_outlet_energy_daily': {
    icon: 'mdi:counter',
    name: 'Energy daily',
    unit: 'kWh',
    device_class: 'energy',
    reading: '0.4',
  },
  'sensor.infrastructure_server_outlet_power': {
    name: 'Server outlet',
    unit: 'W',
    device_class: 'power',
    reading: '24',
  },
  'sensor.infrastructure_server_pool_health': {
    icon: 'mdi:database-check-outline',
    name: 'Pool health',
  },
  'sensor.infrastructure_server_root_disk_temperature': {
    name: 'Root disk temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '50.9',
  },
  'sensor.infrastructure_sonarr_queue': {
    icon: 'mdi:download',
    name: 'Sonarr',
    unit: 'episodes',
    reading: '0',
  },
  'sensor.infrastructure_sonarr_shows': {
    icon: 'mdi:television-classic',
    name: 'Sonarr',
    unit: 'series',
    reading: '30',
  },
  'sensor.infrastructure_sonarr_upcoming': {
    icon: 'mdi:calendar-clock',
    name: 'Upcoming',
    unit: 'episodes',
    reading: '0',
  },
  'sensor.infrastructure_sonarr_wanted': {
    icon: 'mdi:television-off',
    name: 'Wanted',
    unit: 'episodes',
    reading: '123',
  },
  'sensor.infrastructure_storage_used': {
    icon: 'mdi:harddisk',
    name: 'storage',
    unit: '%',
    reading: '36.4',
  },
  'sensor.infrastructure_switch_1_state': {
    icon: 'mdi:lan-connect',
    name: 'Switch 1',
    device_class: 'enum',
  },
  'sensor.infrastructure_switch_2_state': {
    icon: 'mdi:lan-connect',
    name: 'Switch 2',
    device_class: 'enum',
  },
  'sensor.infrastructure_unifi_clients': {
    name: 'UniFi clients',
    reading: '28',
  },
  'sensor.infrastructure_vpn_exit_node_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '0.3',
  },
  'sensor.infrastructure_vpn_exit_node_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '54.8',
  },
  'sensor.infrastructure_vpn_router_cpu_usage': {
    icon: 'mdi:cpu-64-bit',
    name: 'CPU usage',
    unit: '%',
    reading: '0.4',
  },
  'sensor.infrastructure_vpn_router_memory_used': {
    icon: 'mdi:memory',
    name: 'Memory used',
    unit: '%',
    reading: '56',
  },
  'sensor.jane_phone_active_energy': {
    icon: 'mdi:fire',
    name: 'Active energy',
    unit: 'kcal',
    reading: '20',
  },
  'sensor.jane_phone_activity': {
    icon: 'mdi:walk',
    name: 'Activity',
  },
  'sensor.jane_phone_battery_level': {
    icon: 'mdi:battery-70',
    name: 'Battery level',
    unit: '%',
    device_class: 'battery',
    reading: '75',
  },
  'sensor.jane_phone_battery_state': {
    icon: 'mdi:battery-70',
    name: 'Battery state',
  },
  'sensor.jane_phone_connection': {
    icon: 'mdi:wifi',
    name: 'Connection',
  },
  'sensor.jane_phone_distance': {
    icon: 'mdi:walk',
    name: 'Distance',
    unit: 'km',
    device_class: 'distance',
    reading: '0.71',
  },
  'sensor.jane_phone_flights_climbed': {
    icon: 'mdi:stairs-up',
    name: 'Flights climbed',
    unit: 'floors',
  },
  'sensor.jane_phone_focus_name': {
    icon: 'mdi:moon-waning-crescent',
    name: 'Focus name',
  },
  'sensor.jane_phone_location_access': {
    icon: 'mdi:map',
    name: 'Location access',
  },
  'sensor.jane_phone_network': {
    icon: 'mdi:wifi',
    name: 'Network',
  },
  'sensor.jane_phone_resting_energy': {
    icon: 'mdi:fire',
    name: 'Resting energy',
    unit: 'kcal',
    reading: '816',
  },
  'sensor.jane_phone_steps': {
    icon: 'mdi:walk',
    name: 'Steps',
    unit: 'steps',
    reading: '1099',
  },
  'sensor.jane_phone_storage': {
    icon: 'mdi:database',
    name: 'Storage',
    unit: '% available',
    reading: '63',
  },
  'sensor.joe_phone_active_energy': {
    icon: 'mdi:fire',
    name: 'Active energy',
    unit: 'kcal',
    reading: '4',
  },
  'sensor.joe_phone_activity': {
    icon: 'mdi:human-male',
    name: 'Activity',
  },
  'sensor.joe_phone_battery_level': {
    icon: 'mdi:battery-70',
    name: 'Battery level',
    unit: '%',
    device_class: 'battery',
    reading: '70',
  },
  'sensor.joe_phone_battery_state': {
    icon: 'mdi:battery-70',
    name: 'Battery state',
  },
  'sensor.joe_phone_connection': {
    icon: 'mdi:wifi',
    name: 'Connection',
  },
  'sensor.joe_phone_distance': {
    icon: 'mdi:walk',
    name: 'Distance',
    unit: 'km',
    device_class: 'distance',
    reading: '0.18',
  },
  'sensor.joe_phone_flights_climbed': {
    icon: 'mdi:stairs-up',
    name: 'Flights climbed',
    unit: 'floors',
    reading: '1',
  },
  'sensor.joe_phone_focus_name': {
    icon: 'mdi:moon-waning-crescent',
    name: 'Focus name',
  },
  'sensor.joe_phone_location_access': {
    icon: 'mdi:map',
    name: 'Location access',
  },
  'sensor.joe_phone_network': {
    icon: 'mdi:wifi',
    name: 'Network',
  },
  'sensor.joe_phone_resting_energy': {
    icon: 'mdi:fire',
    name: 'Resting energy',
    unit: 'kcal',
    reading: '895',
  },
  'sensor.joe_phone_steps': {
    icon: 'mdi:walk',
    name: 'Steps',
    unit: 'steps',
    reading: '263',
  },
  'sensor.joe_phone_storage': {
    icon: 'mdi:database',
    name: 'Storage',
    unit: '% available',
    reading: '46.6',
  },
  'sensor.joe_tablet_activity': {
    icon: 'mdi:human-male',
    name: 'Activity',
  },
  'sensor.joe_tablet_battery_level': {
    icon: 'mdi:battery-80',
    name: 'Battery level',
    unit: '%',
    device_class: 'battery',
    reading: '85',
  },
  'sensor.joe_tablet_battery_state': {
    icon: 'mdi:battery-80',
    name: 'Battery state',
  },
  'sensor.joe_tablet_connection': {
    icon: 'mdi:wifi',
    name: 'Connection',
  },
  'sensor.joe_tablet_focus_name': {
    icon: 'mdi:moon-waning-crescent',
    name: 'Focus name',
  },
  'sensor.joe_tablet_location_access': {
    icon: 'mdi:map',
    name: 'Location access',
  },
  'sensor.joe_tablet_network': {
    icon: 'mdi:wifi',
    name: 'Network',
  },
  'sensor.joe_tablet_storage': {
    icon: 'mdi:database',
    name: 'Storage',
    unit: '% available',
    reading: '13',
  },
  'sensor.kitchen_button_battery': {
    name: 'Kitchen button',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.kitchen_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.kitchen_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '40',
  },
  'sensor.kitchen_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '27.4',
  },
  'sensor.kitchen_coffee_machine_button_battery': {
    name: 'Coffee machine button',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.kitchen_coffee_machine_outlet_energy': {
    name: 'Energy',
    unit: 'kWh',
    device_class: 'energy',
    reading: '27.8',
  },
  'sensor.kitchen_coffee_machine_outlet_energy_daily': {
    icon: 'mdi:counter',
    name: 'Energy daily',
    unit: 'kWh',
    device_class: 'energy',
    reading: '0.1',
  },
  'sensor.kitchen_coffee_machine_outlet_power': {
    name: 'Coffee machine outlet',
    unit: 'W',
    device_class: 'power',
    reading: '0',
  },
  'sensor.kitchen_entry_button_battery': {
    name: 'Entry button',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.kitchen_extractor_outlet_energy': {
    name: 'Energy',
    unit: 'kWh',
    device_class: 'energy',
    reading: '18.9',
  },
  'sensor.kitchen_extractor_outlet_energy_daily': {
    icon: 'mdi:counter',
    name: 'Energy daily',
    unit: 'kWh',
    device_class: 'energy',
    reading: '0.1',
  },
  'sensor.kitchen_extractor_outlet_power': {
    name: 'Extractor outlet',
    unit: 'W',
    device_class: 'power',
    reading: '8',
  },
  'sensor.kitchen_living_button_battery': {
    name: 'Living button',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.kitchen_thermostat_battery': {
    name: 'Thermostat',
    unit: '%',
    device_class: 'battery',
    reading: '65',
  },
  'sensor.kitchen_thermostat_valve_position': {
    icon: 'mdi:valve',
    name: 'Thermostat',
    unit: '%',
    reading: '0',
  },
  'sensor.kitchen_window_battery': {
    name: 'Window',
    unit: '%',
    device_class: 'battery',
    reading: '82',
  },
  'sensor.living_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.living_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '39',
  },
  'sensor.living_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '26.9',
  },
  'sensor.living_sonos_audio_input_format': {
    icon: 'mdi:import',
    name: 'Audio input format',
  },
  'sensor.living_thermostat_1_battery': {
    name: 'Thermostat 1',
    unit: '%',
    device_class: 'battery',
    reading: '70',
  },
  'sensor.living_thermostat_1_valve_position': {
    icon: 'mdi:valve',
    name: 'Thermostat 1',
    unit: '%',
    reading: '0',
  },
  'sensor.living_thermostat_2_battery': {
    name: 'Thermostat 2',
    unit: '%',
    device_class: 'battery',
    reading: '70',
  },
  'sensor.living_thermostat_2_valve_position': {
    icon: 'mdi:valve',
    name: 'Thermostat 2',
    unit: '%',
    reading: '0',
  },
  'sensor.living_vacuum_air_filter_time_left': {
    icon: 'mdi:air-filter',
    name: 'Air filter time left',
    unit: 'h',
    device_class: 'duration',
    reading: '38.09',
  },
  'sensor.living_vacuum_battery': {
    name: 'Battery',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.living_vacuum_cleaning_area': {
    icon: 'mdi:texture-box',
    name: 'Cleaning area',
    unit: 'm²',
    reading: '0.0',
  },
  'sensor.living_vacuum_cleaning_area_total': {
    icon: 'mdi:texture-box',
    name: 'Cleaning area (total)',
    unit: 'm²',
    reading: '8614.1',
  },
  'sensor.living_vacuum_cleaning_count': {
    icon: 'mdi:counter',
    name: 'Cleaning count',
    reading: '273',
  },
  'sensor.living_vacuum_cleaning_progress': {
    icon: 'mdi:progress-check',
    name: 'Cleaning progress',
    unit: '%',
    reading: '0',
  },
  'sensor.living_vacuum_cleaning_time': {
    icon: 'mdi:clock-outline',
    name: 'Cleaning time',
    unit: 'min',
    device_class: 'duration',
    reading: '0',
  },
  'sensor.living_vacuum_cleaning_time_total': {
    icon: 'mdi:history',
    name: 'Cleaning time (total)',
    unit: 'h',
    device_class: 'duration',
    reading: '174.98',
  },
  'sensor.living_vacuum_current_room': {
    name: 'Current room',
    device_class: 'enum',
  },
  'sensor.living_vacuum_dock_error': {
    icon: 'mdi:garage-open',
    name: 'Error',
    device_class: 'enum',
  },
  'sensor.living_vacuum_dock_mop_drying_time_left': {
    icon: 'mdi:clock-outline',
    name: 'Mop drying time left',
    unit: 's',
    device_class: 'duration',
    reading: '0',
  },
  'sensor.living_vacuum_dock_strainer_time_left': {
    icon: 'mdi:filter-variant',
    name: 'Strainer time left',
    unit: 'h',
    device_class: 'duration',
    reading: '122',
  },
  'sensor.living_vacuum_error': {
    icon: 'mdi:alert-circle',
    name: 'Error',
    device_class: 'enum',
  },
  'sensor.living_vacuum_last_clean_end': {
    icon: 'mdi:clock-time-twelve',
    name: 'Last clean end',
    device_class: 'timestamp',
  },
  'sensor.living_vacuum_main_brush_time_left': {
    icon: 'mdi:brush',
    name: 'Main brush time left',
    unit: 'h',
    device_class: 'duration',
    reading: '188.09',
  },
  'sensor.living_vacuum_sensor_time_left': {
    icon: 'mdi:radar',
    name: 'Sensor time left',
    unit: 'h',
    device_class: 'duration',
    reading: '10.31',
  },
  'sensor.living_vacuum_side_brush_time_left': {
    icon: 'mdi:brush',
    name: 'Side brush time left',
    unit: 'h',
    device_class: 'duration',
    reading: '25.02',
  },
  'sensor.living_vacuum_status': {
    icon: 'mdi:information-outline',
    name: 'Status',
    device_class: 'enum',
  },
  'sensor.living_window_battery': {
    name: 'Window',
    unit: '%',
    device_class: 'battery',
    reading: '43',
  },
  'sensor.office_3d_printer': {
    icon: 'mdi:printer-3d',
    name: '3D printer',
    device_class: 'enum',
  },
  'sensor.office_3d_printer_filename': {
    icon: 'mdi:file-image-outline',
    name: 'Filename',
  },
  'sensor.office_3d_printer_heatbed_target_temperature': {
    name: 'Heatbed target temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '0',
  },
  'sensor.office_3d_printer_heatbed_temperature': {
    name: 'Heatbed temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '30',
  },
  'sensor.office_3d_printer_material': {
    icon: 'mdi:palette-swatch-variant',
    name: 'Material',
  },
  'sensor.office_3d_printer_nozzle_target_temperature': {
    name: 'Nozzle target temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '0',
  },
  'sensor.office_3d_printer_nozzle_temperature': {
    name: 'Nozzle temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '30.8',
  },
  'sensor.office_3d_printer_outlet_energy': {
    name: 'Energy',
    unit: 'kWh',
    device_class: 'energy',
    reading: '2.4',
  },
  'sensor.office_3d_printer_outlet_energy_daily': {
    icon: 'mdi:counter',
    name: 'Energy daily',
    unit: 'kWh',
    device_class: 'energy',
    reading: '0.2',
  },
  'sensor.office_3d_printer_outlet_power': {
    name: '3D printer outlet',
    unit: 'W',
    device_class: 'power',
    reading: '15',
  },
  'sensor.office_3d_printer_print_finish': {
    icon: 'mdi:clock-end',
    name: 'Print finish',
    device_class: 'timestamp',
  },
  'sensor.office_3d_printer_print_speed': {
    icon: 'mdi:speedometer',
    name: 'Print speed',
    unit: '%',
    reading: '100',
  },
  'sensor.office_3d_printer_print_start': {
    icon: 'mdi:clock-start',
    name: 'Print start',
    device_class: 'timestamp',
  },
  'sensor.office_3d_printer_progress': {
    icon: 'mdi:progress-clock',
    name: 'Progress',
    unit: '%',
  },
  'sensor.office_button_1_battery': {
    name: 'Button 1',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.office_button_2_battery': {
    name: 'Button 2',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.office_button_3_battery': {
    name: 'Button 3',
    unit: '%',
    device_class: 'battery',
    reading: '99',
  },
  'sensor.office_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.office_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '43',
  },
  'sensor.office_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '26.5',
  },
  'sensor.office_switch_battery': {
    name: 'Switch',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.office_thermostat_battery': {
    name: 'Thermostat',
    unit: '%',
    device_class: 'battery',
    reading: '60',
  },
  'sensor.office_thermostat_valve_position': {
    icon: 'mdi:valve',
    name: 'Thermostat',
    unit: '%',
    reading: '0',
  },
  'sensor.office_window_battery': {
    name: 'Window',
    unit: '%',
    device_class: 'battery',
    reading: '82',
  },
  'sensor.toilet_climate_battery': {
    name: 'Climate',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.toilet_climate_humidity': {
    name: 'Humidity',
    unit: '%',
    device_class: 'humidity',
    reading: '42',
  },
  'sensor.toilet_climate_temperature': {
    name: 'Temperature',
    unit: '°C',
    device_class: 'temperature',
    reading: '26.4',
  },
  'sensor.toilet_switch_battery': {
    name: 'Switch',
    unit: '%',
    device_class: 'battery',
    reading: '100',
  },
  'sensor.toilet_thermostat_battery': {
    name: 'Thermostat',
    unit: '%',
    device_class: 'battery',
    reading: '70',
  },
  'sensor.toilet_thermostat_valve_position': {
    icon: 'mdi:valve',
    name: 'Thermostat',
    unit: '%',
    reading: '0',
  },
  'switch.infrastructure_adguard_home_protection': {
    icon: 'mdi:shield-check',
    icons: {
      off: 'mdi:shield-off',
    },
    name: 'AdGuard Home',
  },
  'switch.infrastructure_home_guests_enabled': {
    icon: 'mdi:wifi-check',
    icons: {
      off: 'mdi:wifi-off',
    },
    name: 'Home Guests',
    device_class: 'switch',
  },
  'switch.infrastructure_home_iot_enabled': {
    icon: 'mdi:wifi-check',
    icons: {
      off: 'mdi:wifi-off',
    },
    name: 'Home IoT',
    device_class: 'switch',
  },
  'switch.infrastructure_home_media_enabled': {
    icon: 'mdi:wifi-check',
    icons: {
      off: 'mdi:wifi-off',
    },
    name: 'Home Media',
    device_class: 'switch',
  },
  'switch.infrastructure_home_users_enabled': {
    icon: 'mdi:wifi-check',
    icons: {
      off: 'mdi:wifi-off',
    },
    name: 'Home Users',
    device_class: 'switch',
  },
  'switch.infrastructure_server_outlet': {
    name: 'Server outlet',
    device_class: 'outlet',
  },
  'switch.kitchen_coffee_machine_outlet': {
    name: 'Coffee machine outlet',
    device_class: 'outlet',
  },
  'switch.kitchen_extractor_outlet': {
    name: 'Extractor outlet',
    device_class: 'outlet',
  },
  'switch.living_sonos_loudness': {
    icon: 'mdi:bullhorn-variant',
    name: 'Loudness',
  },
  'switch.living_sonos_night_sound': {
    icon: 'mdi:chat-sleep',
    name: 'Night sound',
  },
  'switch.living_sonos_speech_enhancement': {
    icon: 'mdi:ear-hearing',
    name: 'Speech enhancement',
  },
  'switch.living_sonos_subwoofer_enabled': {
    icon: 'mdi:dog',
    name: 'Subwoofer enabled',
  },
  'switch.living_sonos_surround_enabled': {
    icon: 'mdi:surround-sound',
    name: 'Surround enabled',
  },
  'switch.living_sonos_surround_music_full_volume': {
    icon: 'mdi:music-note-plus',
    name: 'Surround music full volume',
  },
  'switch.living_vacuum_dock_dust_emptying': {
    icon: 'mdi:delete-empty',
    name: 'Dust emptying',
  },
  'switch.living_vacuum_dock_mop_drying': {
    icon: 'mdi:heat-wave',
    name: 'Mop drying',
  },
  'switch.living_vacuum_dock_mop_washing': {
    icon: 'mdi:water-sync',
    name: 'Mop washing',
  },
  'switch.office_3d_printer_outlet': {
    name: '3D printer outlet',
    device_class: 'outlet',
  },
  'switch.office_perfume_diffuser': {
    icon: 'mdi:fan',
    name: 'Perfume diffuser',
  },
  'update.bathroom_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.bathroom_thermostat_firmware': {
    name: 'Thermostat',
    device_class: 'firmware',
  },
  'update.bedroom_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.bedroom_thermostat_1_firmware': {
    name: 'Thermostat 1',
    device_class: 'firmware',
  },
  'update.bedroom_thermostat_2_firmware': {
    name: 'Thermostat 2',
    device_class: 'firmware',
  },
  'update.bedroom_window_firmware': {
    name: 'Window',
    device_class: 'firmware',
  },
  'update.dressing_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.entry_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.entry_door_firmware': {
    name: 'Door',
    device_class: 'firmware',
  },
  'update.hall_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.hall_laundry_water_leak_firmware': {
    name: 'Laundry water leak',
    device_class: 'firmware',
  },
  'update.infrastructure_adguard_home': {
    name: 'AdGuard Home',
  },
  'update.infrastructure_advanced_ssh_web_terminal_update': {
    name: 'Advanced SSH & Web Terminal',
  },
  'update.infrastructure_ap_firmware': {
    name: 'AP',
    device_class: 'firmware',
  },
  'update.infrastructure_better_thermostat_update': {
    name: 'Better Thermostat',
  },
  'update.infrastructure_car_data_update': {
    name: 'BMW CarData',
  },
  'update.infrastructure_file_editor_update': {
    name: 'File editor',
  },
  'update.infrastructure_hacs_update': {
    name: 'HACS',
  },
  'update.infrastructure_home_assistant_connect_zbt_2_firmware': {
    name: 'Home Assistant Connect ZBT-2',
    device_class: 'firmware',
  },
  'update.infrastructure_home_assistant_core_update': {
    name: 'Home Assistant Core',
  },
  'update.infrastructure_home_assistant_operating_system_update': {
    name: 'Home Assistant Operating System',
  },
  'update.infrastructure_home_assistant_supervisor_update': {
    name: 'Home Assistant Supervisor',
  },
  'update.infrastructure_let_s_encrypt_update': {
    name: "Let's Encrypt",
  },
  'update.infrastructure_matter_server_update': {
    name: 'Matter Server',
  },
  'update.infrastructure_mitsubishi_air_conditioner_update': {
    name: 'Mitsubishi Air Conditioner',
  },
  'update.infrastructure_openthread_border_router_update': {
    name: 'OpenThread Border Router',
  },
  'update.infrastructure_plex_update': {
    name: 'Plex',
  },
  'update.infrastructure_roborock_local_server_beta_update': {
    name: 'Roborock Local Server Beta',
  },
  'update.infrastructure_router_firmware': {
    name: 'Router',
    device_class: 'firmware',
  },
  'update.infrastructure_server_outlet_firmware': {
    name: 'Server outlet',
    device_class: 'firmware',
  },
  'update.infrastructure_switch_1_firmware': {
    name: 'Switch 1',
    device_class: 'firmware',
  },
  'update.infrastructure_switch_2_firmware': {
    name: 'Switch 2',
    device_class: 'firmware',
  },
  'update.kitchen_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.kitchen_coffee_machine_outlet_firmware': {
    name: 'Coffee machine outlet',
    device_class: 'firmware',
  },
  'update.kitchen_extractor_outlet_firmware': {
    name: 'Extractor outlet',
    device_class: 'firmware',
  },
  'update.kitchen_thermostat_firmware': {
    name: 'Thermostat',
    device_class: 'firmware',
  },
  'update.kitchen_window_firmware': {
    name: 'Window',
    device_class: 'firmware',
  },
  'update.living_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.living_thermostat_1_firmware': {
    name: 'Thermostat 1',
    device_class: 'firmware',
  },
  'update.living_thermostat_2_firmware': {
    name: 'Thermostat 2',
    device_class: 'firmware',
  },
  'update.living_window_firmware': {
    name: 'Window',
    device_class: 'firmware',
  },
  'update.office_3d_printer_outlet_firmware': {
    name: '3D printer outlet',
    device_class: 'firmware',
  },
  'update.office_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.office_thermostat_firmware': {
    name: 'Thermostat',
    device_class: 'firmware',
  },
  'update.office_window_firmware': {
    name: 'Window',
    device_class: 'firmware',
  },
  'update.toilet_climate_firmware': {
    name: 'Climate',
    device_class: 'firmware',
  },
  'update.toilet_thermostat_firmware': {
    name: 'Thermostat',
    device_class: 'firmware',
  },
  'vacuum.demo_vacuum_0_ground_floor': {
    name: 'Vacuum',
  },
  'weather.demo_weather_south': {
    name: 'Open-Meteo',
  },
};
