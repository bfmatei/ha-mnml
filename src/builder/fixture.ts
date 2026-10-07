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
