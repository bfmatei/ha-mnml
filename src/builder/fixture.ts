import type { Registries } from '../templates/discover.ts';

const PHONE = [
  'sensor.jane_phone_battery_level',
  'sensor.jane_phone_battery_state',
  'sensor.jane_phone_connection_type',
  'sensor.jane_phone_ssid',
  'sensor.jane_phone_storage',
  'binary_sensor.jane_phone_focus',
  'sensor.jane_phone_activity',
  'sensor.jane_phone_location_permission',
];

export const HOUSE: Registries = {
  areas: {
    jane: { area_id: 'jane', name: 'Jane' },
    infrastructure: { area_id: 'infrastructure', name: 'Infrastructure' },
    living: { area_id: 'living', name: 'Living' },
    attic: { area_id: 'attic', name: 'Attic' },
  },
  devices: {
    phone: { id: 'phone', area_id: 'jane', name: "Jane's phone" },
    server: { id: 'server', area_id: 'infrastructure', name: 'Server' },
    router: { id: 'router', area_id: 'infrastructure', name: 'Router' },
    lamp: { id: 'lamp', area_id: 'living', name: 'Lamp' },
    car: { id: 'car', name: 'Car' },
    plug: { id: 'plug', name: 'Plug' },
    bulb: { id: 'bulb', name: 'Attic bulb' },
    thermometer: { id: 'thermometer', name: 'Attic thermometer' },
  },
  entities: {
    'device_tracker.jane_phone': {
      entity_id: 'device_tracker.jane_phone',
      device_id: 'phone',
      platform: 'mobile_app',
      entity_category: 'diagnostic',
    },
    'sensor.jane_phone_battery_level': {
      entity_id: 'sensor.jane_phone_battery_level',
      device_id: 'phone',
      platform: 'mobile_app',
    },
    'sensor.jane_phone_battery_temperature': {
      entity_id: 'sensor.jane_phone_battery_temperature',
      device_id: 'phone',
      platform: 'mobile_app',
    },
    'sensor.server_processor_use': {
      entity_id: 'sensor.server_processor_use',
      device_id: 'server',
      platform: 'systemmonitor',
    },
    'sensor.server_disk_free': {
      entity_id: 'sensor.server_disk_free',
      device_id: 'server',
      platform: 'systemmonitor',
    },
    'update.server_os': { entity_id: 'update.server_os', device_id: 'server', platform: 'hassio' },
    'sensor.server_cpu_temperature': {
      entity_id: 'sensor.server_cpu_temperature',
      area_id: 'infrastructure',
      platform: 'template',
    },
    'sensor.router_temperature': {
      entity_id: 'sensor.router_temperature',
      device_id: 'router',
      platform: 'unifi',
      entity_category: 'diagnostic',
    },
    'update.router': { entity_id: 'update.router', device_id: 'router', platform: 'unifi' },
    'light.living_lamp': { entity_id: 'light.living_lamp', device_id: 'lamp', platform: 'hue' },
    'device_tracker.car': { entity_id: 'device_tracker.car', device_id: 'car', platform: 'bmw' },
    'binary_sensor.car_door': {
      entity_id: 'binary_sensor.car_door',
      device_id: 'car',
      platform: 'bmw',
    },
    'switch.plug': { entity_id: 'switch.plug', device_id: 'plug', platform: 'tasmota' },
    'light.attic_bulb': { entity_id: 'light.attic_bulb', device_id: 'bulb', platform: 'hue' },
    'sensor.attic_temperature': {
      entity_id: 'sensor.attic_temperature',
      device_id: 'thermometer',
      platform: 'zha',
    },
  },
  states: {
    'sensor.jane_phone_battery_level': { attributes: { device_class: 'battery' } },
    'sensor.jane_phone_battery_temperature': { attributes: { device_class: 'temperature' } },
    'sensor.server_disk_free': { attributes: { device_class: 'data_size' } },
    'sensor.server_cpu_temperature': { attributes: { device_class: 'temperature' } },
    'sensor.router_temperature': { attributes: { device_class: 'temperature' } },
    'device_tracker.car': { attributes: { source_type: 'gps' } },
    'binary_sensor.car_door': { attributes: { device_class: 'door' } },
    'switch.plug': { attributes: { device_class: 'switch' } },
    'sensor.attic_temperature': { attributes: { device_class: 'temperature' } },
  },
};

export const HOME: Registries = {
  areas: {
    kitchen: { area_id: 'kitchen', name: 'Kitchen', icon: 'mdi:stove' },
    hallway: { area_id: 'hallway', name: 'Hallway', icon: null },
    living: {
      area_id: 'living',
      name: 'Living',
      icon: 'mdi:sofa',
      temperature_entity_id: 'sensor.living_temperature',
    },
  },
  devices: {
    phone: { id: 'phone', name: 'iPhone', name_by_user: "Jane's iPhone" },
    watch: { id: 'watch', name: 'Watch' },
    router: { id: 'router', name: 'Router' },
  },
  entities: {
    'light.kitchen': { entity_id: 'light.kitchen', area_id: 'kitchen', platform: 'hue' },
    'light.living': { entity_id: 'light.living', area_id: 'living', platform: 'hue' },
    'sensor.living_temperature': {
      entity_id: 'sensor.living_temperature',
      area_id: 'living',
      platform: 'zha',
    },
    'device_tracker.jane_phone': {
      entity_id: 'device_tracker.jane_phone',
      device_id: 'phone',
      platform: 'mobile_app',
    },
    ...Object.fromEntries(
      PHONE.map((entity_id) => [
        entity_id,
        { entity_id, device_id: 'phone', platform: 'mobile_app' },
      ]),
    ),
    'device_tracker.jane_watch': {
      entity_id: 'device_tracker.jane_watch',
      device_id: 'watch',
      platform: 'mobile_app',
    },
    'sensor.jane_watch_battery_level': {
      entity_id: 'sensor.jane_watch_battery_level',
      device_id: 'watch',
      platform: 'mobile_app',
    },
    'device_tracker.router_jane': {
      entity_id: 'device_tracker.router_jane',
      device_id: 'router',
      platform: 'unifi',
    },
    'person.jane': { entity_id: 'person.jane', platform: 'person' },
    'person.bob': { entity_id: 'person.bob', platform: 'person' },
  },
  states: {
    'sensor.living_temperature': { attributes: { device_class: 'temperature' } },
    'sensor.jane_phone_battery_level': { attributes: { device_class: 'battery' } },
    'person.jane': {
      attributes: {
        device_trackers: [
          'device_tracker.jane_phone',
          'device_tracker.jane_watch',
          'device_tracker.router_jane',
        ],
      },
    },
    'person.bob': { attributes: {} },
  },
};
