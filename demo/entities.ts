import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { MdiIcon } from '../src/contract/entities.ts';
import type { Value } from '../src/contract/templates.ts';
import { toYaml } from '../src/contract/yaml.ts';
import type { Home } from '../src/home/types.ts';

import { DEMO } from './home.ts';
import { AWAY, HEATING_ON, LIGHTS_OFF, STATES } from './states.ts';
import { TRAITS } from './traits.ts';

export const SUPPLIED: ReadonlyMap<string, string> = new Map([
  ['climate.hvac', 'AC'],
  ['climate.ecobee', 'AC'],
  ['media_player.living_room', 'Sonos'],
  ['media_player.lounge_room', 'Apple TV'],
  ['media_player.bedroom', 'HomePod'],
  ['calendar.calendar_1', 'Radarr'],
  ['calendar.calendar_2', 'Sonarr'],
  ['vacuum.demo_vacuum_0_ground_floor', 'Vacuum'],
  ['weather.demo_weather_south', 'Weather'],
  ['lock.front_door', 'Lock'],
  ['light.kitchen_lights', 'Lights'],
]);

const ID = /^[a-z_]+\.[a-z0-9_]+$/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;
const IMAGES: Record<string, string> = {
  map: 'http://localhost:8123/local/map.png',
};
const QR = 'http://localhost:8123/local/qr.png';
const IMAGES_ON_DISK = ['qr.png', 'map.png', '3d-printer.png'];
const SCENE_LIGHT = 'light.ceiling_lights';

interface Reading {
  state: string;
  unit?: string;
  device_class?: string;
  state_class?: string;
}

const ago = (hours: number): string => `{{ (now() - timedelta(hours=${hours})).isoformat() }}`;
const ahead = (hours: number): string => `{{ (now() + timedelta(hours=${hours})).isoformat() }}`;
const WORDS = new Set(['windows']);

const SENSORS: Record<string, Reading> = {
  battery: { state: '80', unit: '%', device_class: 'battery' },
  batteries: { state: '80', unit: '%', device_class: 'battery' },
  temperature: { state: '21.5', unit: '°C', device_class: 'temperature' },
  humidity: { state: '45', unit: '%', device_class: 'humidity' },
  power: { state: '120', unit: 'W', device_class: 'power' },
  today: { state: '1.2', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  total: { state: '340', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  cpu: { state: '12', unit: '%' },
  memory: { state: '40', unit: '%' },
  steps: { state: '6400', unit: 'steps' },
  distance: { state: '4.2', unit: 'km', device_class: 'distance' },
  flightsClimbed: { state: '6', unit: 'floors' },
  activeEnergy: { state: '320', unit: 'kcal' },
  restingEnergy: { state: '1500', unit: 'kcal' },
  fuel: { state: '60', unit: '%' },
  range: { state: '420', unit: 'km', device_class: 'distance' },
  mileage: { state: '24000', unit: 'km', device_class: 'distance' },
  tyres: { state: '2.4', unit: 'bar', device_class: 'pressure' },
  tyreTargets: { state: '2.5', unit: 'bar', device_class: 'pressure' },
  progress: { state: '40', unit: '%' },
  used: { state: '20', unit: 'GB', device_class: 'data_size' },
  size: { state: '64', unit: 'GB', device_class: 'data_size' },
  diskFree: { state: '48', unit: 'GB', device_class: 'data_size' },
  diskUsed: { state: '35', unit: '%' },
  storage: { state: '35', unit: '%' },
  lifeLeft: { state: '96', unit: '%' },
  amount: { state: '70', unit: '%' },
  level: { state: '70', unit: '%' },
};

const BY_SUFFIX: [string, Reading][] = [
  ['_battery_state', { state: 'Not Charging' }],
  ['_battery', { state: '80', unit: '%', device_class: 'battery' }],
  ['_battery_level', { state: '80', unit: '%', device_class: 'battery' }],
  ['_valve_position', { state: '40', unit: '%' }],
  ['_time_left', { state: '120', unit: 'h', device_class: 'duration' }],
  ['_drying_time_left', { state: '0', unit: 'min', device_class: 'duration' }],
  ['_link_speed', { state: '1000', unit: 'Mbit/s', device_class: 'data_rate' }],
  ['_router_cloudflare', { state: '12', unit: 'ms', device_class: 'duration' }],
  ['_router_google', { state: '14', unit: 'ms', device_class: 'duration' }],
  ['_state', { state: 'Connected' }],
  ['_doors', { state: 'Secured' }],
  ['_alarm', { state: 'doorsTiltCabin' }],
  ['_sunroof', { state: 'CLOSED' }],
  ['_metadata', { state: 'Parked' }],
  ['_blocked_share', { state: '8', unit: '%' }],
  ['_blocked', { state: '1200' }],
  ['_queries', { state: '15000' }],
  ['_processing_time', { state: '14', unit: 'ms', device_class: 'duration' }],
  ['_rules_count', { state: '120000' }],
  ['_adguard_clients', { state: '1' }],
  ['_unifi_clients', { state: '5' }],
  ['_plex', { state: '1' }],
  ['_jellyfin', { state: '0' }],
  ['_free_space', { state: '500', unit: 'GB', device_class: 'data_size' }],
  ['_bucket_used', { state: '12', unit: 'GB', device_class: 'data_size' }],
  ['_movies', { state: '240' }],
  ['_shows', { state: '80' }],
  ['_upcoming', { state: '3' }],
  ['_wanted', { state: '2' }],
  ['_queue', { state: '0' }],
  ['_pending_requests', { state: '1' }],
  ['_processing_requests', { state: '0' }],
  ['_checks_failed', { state: '0' }],
  ['_checks_warnings', { state: '0' }],
  ['_disks_failing', { state: '0' }],
  ['_pool_health', { state: 'ONLINE' }],
  ['_last_run', { state: ago(3), device_class: 'timestamp' }],
  ['_last_backup', { state: ago(5), device_class: 'timestamp' }],
  ['_last_successful_automatic_backup', { state: ago(9), device_class: 'timestamp' }],
  ['_last_attempted_automatic_backup', { state: ago(9), device_class: 'timestamp' }],
  ['_last_boot', { state: ago(170), device_class: 'timestamp' }],
  ['_last_clean_end', { state: ago(20), device_class: 'timestamp' }],
  ['_print_start', { state: ago(2), device_class: 'timestamp' }],
  ['_print_finish', { state: ahead(1), device_class: 'timestamp' }],
  ['_activity', { state: 'Stationary' }],
  ['_connection', { state: 'Wi-Fi' }],
  ['_focus_name', { state: 'None' }],
  ['_location_access', { state: 'Authorized Always' }],
  ['_network', { state: 'Home' }],
  ['_cleaning_area', { state: '24', unit: 'm²', device_class: 'area' }],
  ['_cleaning_area_total', { state: '2400', unit: 'm²', device_class: 'area' }],
  ['_cleaning_count', { state: '120' }],
  ['_cleaning_time', { state: '35', unit: 'min', device_class: 'duration' }],
  ['_cleaning_time_total', { state: '70', unit: 'h', device_class: 'duration' }],
  ['_current_room', { state: 'Living' }],
  ['_dock_error', { state: 'Ok' }],
  ['_error', { state: 'None' }],
  ['_status', { state: 'Charging' }],
  ['_3d_printer', { state: 'Idle' }],
  ['_filename', { state: 'benchy.gcode' }],
  ['_material', { state: 'PLA' }],
  ['_print_speed', { state: '100', unit: '%' }],
  ['_target_temperature', { state: '60', unit: '°C', device_class: 'temperature' }],
  ['_audio_input_format', { state: 'Dolby Digital 5.1' }],
];

const NAMES: Record<string, string> = {
  'switch.infrastructure_adguard_home_protection': 'AdGuard Home',
};

const BINARY_CLASSES: Record<string, string> = {
  window: 'window',
  door: 'door',
  doors: 'door',
  hood: 'opening',
  tailgate: 'opening',
  leaks: 'moisture',
  status: 'running',
  services: 'running',
  vpn: 'connectivity',
};

const ON_BINARY = new Set([
  'status',
  'services',
  'vpn',
  'connected',
  'mopAttached',
  'waterBoxAttached',
]);
const ON_SWITCHES = new Set(['enabled', 'protection', 'entity', 'outlet']);

const CAPITALS = new Map([
  ['ac', 'AC'],
  ['cpu', 'CPU'],
  ['tv', 'TV'],
  ['qr', 'QR'],
  ['wan', 'WAN'],
  ['vpn', 'VPN'],
  ['zfs', 'ZFS'],
  ['dns', 'DNS'],
  ['iot', 'IoT'],
  ['suv', 'SUV'],
  ['adguard', 'AdGuard'],
  ['3d', '3D'],
]);

interface Found {
  id: string;
  key: string;
  parent: string;
}

interface Override {
  name: string;
  icon?: MdiIcon;
}

function collect(value: unknown, key: string, parent: string, out: Map<string, Found>): void {
  if (typeof value === 'string') {
    if (ID.test(value) && !out.has(value)) {
      out.set(value, { id: value, key, parent });
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, key, parent, out);
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [field, item] of Object.entries(value)) {
      collect(item, field, key, out);
    }
  }
}

function found(home: Home): Found[] {
  const out = new Map<string, Found>();
  collect(home, 'home', 'home', out);
  return [...out.values()].toSorted((a, b) => a.id.localeCompare(b.id));
}

function prefixes(home: Home): Set<string> {
  return new Set([
    'infrastructure',
    'garage',
    ...home.rooms.map((room) => room.key),
    ...home.people.map((person) => person.key),
    ...home.cars.map((car) => car.key),
  ]);
}

function sentence(words: readonly string[]): string {
  const text = words.map((word) => CAPITALS.get(word) ?? word).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function nameOf(id: string, areas: ReadonlySet<string>): string {
  const words = (id.split('.')[1] ?? id).split('_');
  const inArea = words.length > 1 && areas.has(words[0] ?? '') ? words.slice(1) : words;
  return sentence(inArea.length > 1 && areas.has(inArea[0] ?? '') ? inArea.slice(1) : inArea);
}

function slugName(id: string): string {
  return sentence((id.split('.')[1] ?? id).split('_'));
}

function sceneName(id: string, home: Home): string {
  const object = id.split('.')[1] ?? id;
  const room = home.rooms.find((each) => object.startsWith(`${each.key}_lights_`));
  return sentence(
    (room === undefined ? object : object.slice(`${room.key}_lights_`.length)).split('_'),
  );
}

function jinja(value: Value): string {
  return `{{ ${JSON.stringify(value)} }}`;
}

function iconOf(id: string, state: string): MdiIcon | undefined {
  const trait = TRAITS[id];
  return trait?.icons?.[state.toLowerCase()] ?? trait?.icon;
}

function lightRooms(home: Home): Map<string, string> {
  const rooms = new Map<string, string>();
  for (const room of home.rooms) {
    rooms.set(room.lights.group, room.key);
    for (const member of room.lights.members ?? []) {
      for (const light of typeof member === 'string'
        ? [member]
        : [member.group, member.members].flat()) {
        rooms.set(light, room.key);
      }
    }
  }
  return rooms;
}

function heatingRooms(home: Home): Map<string, string> {
  const rooms = new Map<string, string>();
  for (const room of home.rooms) {
    if (room.heating !== undefined) {
      rooms.set(room.heating.entity, room.key);
    }
  }
  return rooms;
}

function attributesOf(entry: Found, home: Home): Record<string, string> | undefined {
  const network = home.system.network;
  if (entry.id === network?.clients?.entity) {
    return {
      data: jinja([
        { name: 'Laptop', ipAddress: '10.1.0.12', type: 'WIRELESS' },
        { name: 'Television', ipAddress: '10.4.0.20', type: 'WIRED' },
        { name: 'Thermostat', ipAddress: '10.3.0.31', type: 'WIRELESS' },
        { name: 'Server', ipAddress: '10.5.0.2', type: 'WIRED' },
        { name: 'Phone', ipAddress: '10.6.0.4', type: 'VPN' },
      ]),
    };
  }
  if (entry.id === network?.clients?.names) {
    return {
      auto_clients: jinja([{ ip: '10.5.0.2', name: 'server.home.arpa', source: 'rDNS' }]),
    };
  }
  if (entry.id === home.system.proxmox?.notifications?.messages) {
    return {
      messages: [
        '{{ [',
        "{'id': 'backup', 'title': 'Backup finished', 'message': 'Every guest was backed up.', 'severity': 'info', 'source': 'pbs', 'time': (now() - timedelta(hours=5)).isoformat()},",
        "{'id': 'update', 'title': 'Updates available', 'message': 'Three packages can be upgraded.', 'severity': 'notice', 'source': 'pve', 'time': (now() - timedelta(hours=9)).isoformat()}",
        '] }}',
      ].join(' '),
    };
  }
  return undefined;
}

function readingOf(entry: Found): Reading {
  const trait = TRAITS[entry.id];
  const key = entry.parent === 'temperatures' ? 'temperature' : entry.key;
  const suffix = BY_SUFFIX.filter(([end]) => entry.id.endsWith(end)).toSorted(
    ([a], [b]) => b.length - a.length,
  )[0]?.[1];
  const word: Reading | undefined = WORDS.has(entry.key) ? { state: 'CLOSED' } : undefined;
  const fallback: Reading = { state: 'Ok' };
  const table = word ?? suffix ?? SENSORS[key] ?? SENSORS[entry.parent] ?? fallback;
  const live = /^-?\d/.test(table.state) ? trait?.reading : undefined;
  const unit = live === undefined ? table.unit : (trait?.unit ?? table.unit);
  const deviceClass = trait?.device_class ?? table.device_class;
  return {
    state: STATES[entry.id] ?? live ?? table.state,
    ...(unit === undefined ? {} : { unit }),
    ...(deviceClass === undefined ? {} : { device_class: deviceClass }),
    ...(table.state_class === undefined ? {} : { state_class: table.state_class }),
  };
}

function base(entry: Found, name: string, state: string): Record<string, Value> {
  return {
    name,
    unique_id: `demo_${entry.id.replace('.', '_')}`,
    default_entity_id: entry.id,
    icon: iconOf(entry.id, state) ?? null,
  };
}

function compact(value: Record<string, Value>): Record<string, Value> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null));
}

const flag = (on: boolean): string => `{{ ${on ? 'true' : 'false'} }}`;

export function packageOf(home: Home): Record<string, Value> {
  const areas = prefixes(home);
  const lights = lightRooms(home);
  const heating = heatingRooms(home);
  const outdated = new Set<string | undefined>([home.system.updates[0], home.system.firmware[0]]);
  const groups: Record<string, Record<string, Value>[]> = {};
  const scenes: Value[] = [];
  const scripts: Record<string, Value> = {};
  const booleans: Record<string, Value> = {};
  const climates: Value[] = [];
  const add = (domain: string, entry: Record<string, Value>): void => {
    (groups[domain] ??= []).push(compact(entry));
  };
  for (const entry of found(home)) {
    const [domain = '', object = ''] = entry.id.split('.');
    if (
      SUPPLIED.has(entry.id) ||
      domain === 'person' ||
      domain === 'device_tracker' ||
      domain === 'camera'
    ) {
      continue;
    }
    const car = home.cars.find((each) => each.metadata === entry.id);
    const name =
      NAMES[entry.id] ??
      TRAITS[entry.id]?.name ??
      (car === undefined ? nameOf(entry.id, areas) : nameOf(`car.${car.key}`, areas));
    switch (domain) {
      case 'sensor': {
        const reading = readingOf(entry);
        const messages = entry.id === home.system.proxmox?.notifications?.messages;
        add('sensor', {
          ...base(entry, name, reading.state),
          state: messages ? '2' : reading.state,
          unit_of_measurement: reading.unit ?? null,
          device_class: reading.device_class ?? null,
          state_class: reading.state_class ?? null,
          attributes: attributesOf(entry, home) ?? null,
        });
        break;
      }
      case 'binary_sensor': {
        const on = ON_BINARY.has(entry.key) || ON_BINARY.has(entry.parent);
        const state = STATES[entry.id] ?? (on ? 'on' : 'off');
        add('binary_sensor', {
          ...base(entry, name, state),
          state,
          device_class:
            TRAITS[entry.id]?.device_class ??
            BINARY_CLASSES[entry.key] ??
            BINARY_CLASSES[entry.parent] ??
            null,
        });
        break;
      }
      case 'switch': {
        const state = STATES[entry.id] ?? (ON_SWITCHES.has(entry.key) ? 'on' : 'off');
        add('switch', {
          ...base(entry, name, state),
          state: flag(state === 'on'),
          turn_on: [],
          turn_off: [],
        });
        break;
      }
      case 'light': {
        const room = lights.get(entry.id) ?? '';
        const state = STATES[entry.id] ?? (LIGHTS_OFF.has(room) ? 'off' : 'on');
        add('light', {
          ...base(entry, name, state),
          state: flag(state === 'on'),
          level: `{{ ${room === 'bedroom' ? 90 : 178} }}`,
          temperature: '{{ 300 }}',
          turn_on: [],
          turn_off: [],
          set_level: [],
          set_temperature: [],
        });
        break;
      }
      case 'select':
        add('select', {
          ...base(entry, name, 'Auto'),
          state: "{{ 'Auto' }}",
          options: "{{ ['Auto', 'Manual'] }}",
          select_option: [],
        });
        break;
      case 'number':
        add('number', {
          ...base(entry, name, '50'),
          state: '{{ 50 }}',
          min: 0,
          max: 100,
          step: 1,
          set_value: [],
        });
        break;
      case 'button':
        add('button', { ...base(entry, name, 'unknown'), press: [] });
        break;
      case 'image':
        add('image', { ...base(entry, name, 'idle'), url: IMAGES[entry.key] ?? QR });
        break;
      case 'update':
        add('update', {
          ...base(entry, name, 'off'),
          installed_version: '1.0',
          latest_version: outdated.has(entry.id) ? '1.1' : '1.0',
        });
        break;
      case 'scene':
        scenes.push({
          name: slugName(entry.id),
          id: `demo_${object}`,
          entities: { [SCENE_LIGHT]: 'on' },
        });
        break;
      case 'script':
        scripts[object] = { alias: name, sequence: [] };
        break;
      case 'input_boolean':
        booleans[object] = { name };
        break;

      case 'climate': {
        const on = HEATING_ON.has(heating.get(entry.id) ?? '');
        climates.push({
          platform: 'generic_thermostat',
          name: slugName(entry.id),
          unique_id: `demo_${object}`,
          heater: `switch.${object}_heater`,
          target_sensor: `sensor.${object}_current`,
          target_temp: on ? 22 : 18,
          initial_hvac_mode: on ? 'heat' : 'off',
          away_temp: 16,
          comfort_temp: 21,
          eco_temp: 18,
        });
        add('switch', {
          name: `${slugName(entry.id)} heater`,
          unique_id: `demo_${object}_heater`,
          default_entity_id: `switch.${object}_heater`,
          state: flag(on),
          turn_on: [],
          turn_off: [],
        });
        add('sensor', {
          name: `${slugName(entry.id)} current`,
          unique_id: `demo_${object}_current`,
          default_entity_id: `sensor.${object}_current`,
          state: on ? '20.5' : '19',
          unit_of_measurement: '°C',
          device_class: 'temperature',
        });
        break;
      }
      default:
        throw new Error(`the demo cannot make ${entry.id}`);
    }
  }
  return {
    template: Object.entries(groups)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([domain, entries]) => ({ [domain]: entries })),
    scene: scenes,
    script: scripts,
    input_boolean: booleans,
    climate: climates,
    homeassistant: { customize: customizeEntries(home) },
  };
}

function named(id: string, name: string): Override {
  const icon = TRAITS[id]?.icon;
  return { name: TRAITS[id]?.name ?? name, ...(icon === undefined ? {} : { icon }) };
}

function customizeEntries(home: Home): Record<string, Value> {
  const entries: Record<string, Value> = {};
  for (const [id, { name, icon }] of customizeOf(home)) {
    entries[id] = compact({ friendly_name: name, icon: icon ?? null });
  }
  return entries;
}

export function customizeOf(home: Home): Map<string, Override> {
  const overrides = new Map<string, Override>();
  for (const [id, name] of SUPPLIED) {
    overrides.set(id, named(id, name));
  }
  for (const entry of found(home)) {
    if (entry.id.startsWith('scene.')) {
      overrides.set(entry.id, named(entry.id, sceneName(entry.id, home)));
    } else if (entry.id.startsWith('climate.') && !SUPPLIED.has(entry.id)) {
      overrides.set(entry.id, named(entry.id, 'Heating'));
    } else if (entry.id.startsWith('camera.') && !SUPPLIED.has(entry.id)) {
      overrides.set(entry.id, named(entry.id, 'Camera'));
    }
  }
  return overrides;
}

export function camerasOf(home: Home): Map<string, { name: string; file: string }> {
  return new Map(
    found(home)
      .filter((entry) => entry.id.startsWith('camera.') && !SUPPLIED.has(entry.id))
      .map((entry) => [entry.id, { name: slugName(entry.id), file: '3d-printer.png' }] as const),
  );
}

export function precisionsOf(home: Home): Map<string, number> {
  const precisions = new Map<string, number>();
  for (const group of entries(packageOf(home)['template'])) {
    for (const sensor of entries(group['sensor'])) {
      const id = sensor['default_entity_id'];
      const state = sensor['state'];
      if (typeof id === 'string' && typeof state === 'string' && NUMBER.test(state)) {
        precisions.set(id, state.split('.')[1]?.length ?? 0);
      }
    }
  }
  return precisions;
}

export function trackersOf(home: Home): Map<string, 'home' | 'not_home'> {
  return new Map(
    found(home)
      .filter((entry) => entry.id.startsWith('device_tracker.'))
      .map((entry) => [entry.id, AWAY.has(entry.id) ? 'not_home' : 'home'] as const),
  );
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_|_$/g, '');
}

function entries(value: Value | undefined): Record<string, Value>[] {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === 'object' && item !== null && !Array.isArray(item) ? [item] : [],
      )
    : [];
}

function keysOf(value: Value | undefined): string[] {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.keys(value)
    : [];
}

export function created(pack: Value): Set<string> {
  const made = new Set<string>();
  if (typeof pack !== 'object' || pack === null || Array.isArray(pack)) {
    return made;
  }
  for (const group of entries(pack['template'])) {
    for (const entry of Object.values(group).flatMap((list) => entries(list))) {
      const id = entry['default_entity_id'];
      if (typeof id === 'string') {
        made.add(id);
      }
    }
  }
  for (const [domain, key] of [
    ['scene', 'name'],
    ['climate', 'name'],
  ] as const) {
    for (const entry of entries(pack[domain])) {
      const name = entry[key];
      if (typeof name === 'string') {
        made.add(`${domain}.${slug(name)}`);
      }
    }
  }
  for (const domain of ['script', 'input_boolean'] as const) {
    for (const object of keysOf(pack[domain])) {
      made.add(`${domain}.${object}`);
    }
  }
  return made;
}

if (import.meta.main) {
  const out = resolve(import.meta.dirname, '../.ha/packages/demo.yaml');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, toYaml(packageOf(DEMO)), 'utf8');
  const www = resolve(import.meta.dirname, '../.ha/www');
  mkdirSync(www, { recursive: true });
  for (const image of IMAGES_ON_DISK) {
    copyFileSync(resolve(import.meta.dirname, image), resolve(www, image));
  }
  console.log(`wrote ${out}, and the images to ${www}`);
}
