import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';

import { CORPUS_DIR, discoveries, homes } from './corpus.ts';
import { discover, fromDevice } from './discover.ts';
import type { Registries } from './discover.ts';
import { expand } from './expand.ts';
import { SHIPPED } from './shipped.ts';

const room = SHIPPED['room'];

function roomIn(home: string, area: string): Record<string, unknown> {
  const registries = homes()[home];
  assert.ok(registries && room, `${home} exists`);
  return discover(room, area, registries);
}

test('what every shipped template discovers in every corpus home is what was last accepted', () => {
  const expected: unknown = JSON.parse(readFileSync(join(CORPUS_DIR, 'expected.json'), 'utf8'));
  assert.deepEqual(
    discoveries(),
    expected,
    'What the shipped templates discover in the corpus is not what was last accepted. If the change is meant, run `pnpm run accept:corpus` and check the diff of src/templates/corpus/expected.json.',
  );
});

test('the corpus has the tidy and the messy home, and a room finds its things in the tidy one', () => {
  assert.ok(Object.keys(homes()).includes('tidy') && Object.keys(homes()).includes('messy'));
  const found = roomIn('tidy', 'living');
  assert.equal(found['name'], 'Living');
  assert.equal(found['temperature'], 'sensor.living_temperature');
  assert.equal(found['window'], 'binary_sensor.living_window');
  assert.equal(found['door'], 'binary_sensor.living_door');
  assert.equal(found['lock'], 'lock.front_door');
  assert.deepEqual(found['heating'], { entity: 'climate.radiator' });
  assert.deepEqual(found['batteries'], ['sensor.window_battery']);
});

test('a hidden entity, an entity with no area and an entity with no device class are not found', () => {
  const found = roomIn('messy', 'den');
  assert.equal(
    found['window'],
    'binary_sensor.den_window_a',
    'not the hidden one, and not the vent',
  );
  assert.equal(found['humidity'], undefined);
  assert.equal(found['lock'], undefined);
  assert.equal(found['temperature'], 'sensor.multi_temperature', 'not the unavailable one');
});

test("an entity's own area beats its device's, and a device in no area has nothing in any room", () => {
  assert.deepEqual(roomIn('messy', 'loft')['batteries'], ['sensor.multi_battery']);
  assert.equal(roomIn('messy', 'den')['batteries'], undefined);
  const everywhere = Object.values(discoveries()['messy']?.['room'] ?? {}).flatMap((slots) =>
    Object.values(slots),
  );
  assert.ok(!JSON.stringify(everywhere).includes('orphan_temperature'));
  assert.ok(!JSON.stringify(everywhere).includes('light.floating'));
});

test('with two matches an entity slot takes the first, a diagnostic one last, and a device lists once', () => {
  const found = roomIn('messy', 'den');
  assert.equal(
    found['temperature'],
    'sensor.multi_temperature',
    'the diagnostic probe comes second',
  );
  assert.equal(
    found['heating'] === undefined ? '' : JSON.stringify(found['heating']),
    '{"entity":"climate.ac"}',
  );
  assert.deepEqual(found['cameras'], [{ entity: 'camera.cams_front' }]);
});

test("a user's own mnml_ labels decide their slots, even over the ranking and an entity with no class", () => {
  const found = roomIn('labelled', 'den');
  assert.equal(found['window'], 'binary_sensor.den_window_b', 'not the first by id');
  assert.equal(found['temperature'], 'sensor.multi_probe_temperature', 'not the primary one');
  assert.equal(
    found['humidity'],
    'sensor.den_unavailable_temperature',
    'an entity with no state at all',
  );
  assert.equal(
    roomIn('messy', 'den')['window'],
    'binary_sensor.den_window_a',
    'and the home without labels is unchanged',
  );
});

test("a tailnet's devices are found with their sensors, from the integration's own keys", () => {
  const registries = homes()['systems'];
  const tailscale = SHIPPED['tailscale'];
  assert.ok(registries && tailscale);
  const found = discover(tailscale, undefined, registries);
  assert.deepEqual(found['devices'], [
    {
      connected: 'binary_sensor.ts_phone_connected',
      ip_address: 'sensor.ts_phone_ip',
      last_seen: 'sensor.ts_phone_last_seen',
      expires: 'sensor.ts_phone_expires',
      update: 'binary_sensor.ts_phone_update',
      udp: 'binary_sensor.ts_phone_udp',
    },
    {
      connected: 'binary_sensor.ts_router_connected',
      ip_address: 'sensor.ts_router_ip',
      last_seen: 'sensor.ts_router_last_seen',
      expires: 'sensor.ts_router_expires',
      update: 'binary_sensor.ts_router_update',
      udp: 'binary_sensor.ts_router_udp',
    },
  ]);
});

test("a UniFi network's devices, latency probes, router load and firmware are found from the integration's own keys", () => {
  const registries = homes()['systems'];
  const unifi = SHIPPED['unifi-network'];
  assert.ok(registries && unifi);
  const found = discover(unifi, undefined, registries);
  assert.deepEqual(found['devices'], ['sensor.ap_state', 'sensor.gateway_state']);
  assert.deepEqual(found['latency'], ['sensor.gateway_cloudflare', 'sensor.gateway_google']);
  assert.deepEqual(found['router'], {
    cpu: 'sensor.gateway_cpu',
    temperature: 'sensor.gateway_cpu_temperature',
  });
  assert.deepEqual(found['firmware'], ['update.ap_firmware', 'update.gateway_firmware']);
});

test("a Proxmox host's load, backups and guests are found from the integration's own keys", () => {
  const registries = homes()['systems'];
  const server = SHIPPED['proxmox-server'];
  assert.ok(registries && server);
  const found = discover(server, undefined, registries);
  assert.equal(found['cpu'], 'sensor.server_cpu');
  assert.equal(found['memory'], 'sensor.server_memory');
  assert.equal(found['last_boot'], 'sensor.server_boot');
  assert.deepEqual(found['backups'], {
    last: 'sensor.server_last_backup',
    problem: 'binary_sensor.server_backup_status',
  });
  assert.deepEqual(found['guests'], [
    {
      status: 'binary_sensor.router_vm_status',
      cpu: 'sensor.router_vm_cpu',
      memory: 'sensor.router_vm_memory',
    },
    {
      status: 'binary_sensor.torrents_status',
      cpu: 'sensor.torrents_cpu',
      memory: 'sensor.torrents_memory',
    },
  ]);
});

test("a media server's streams, requests, movies and shows are found from the integrations' own keys", () => {
  const registries = homes()['systems'];
  const media = SHIPPED['media-server'];
  assert.ok(registries && media);
  const found = discover(media, undefined, registries);
  assert.equal(found['streams'], 'sensor.jellyfin_clients');
  assert.deepEqual(found['requests'], {
    pending: 'sensor.seerr_pending',
    processing: 'sensor.seerr_processing',
  });
  assert.deepEqual(found['movies'], {
    queue: 'sensor.radarr_queue',
    count: 'sensor.radarr_movies',
    health: 'binary_sensor.radarr_health',
    calendar: 'calendar.radarr',
  });
  assert.deepEqual(found['shows'], {
    queue: 'sensor.sonarr_queue',
    count: 'sensor.sonarr_shows',
    wanted: 'sensor.sonarr_wanted',
    upcoming: 'sensor.sonarr_upcoming',
    calendar: 'calendar.sonarr',
  });
});

function placed(template: string, home: string): { card: Value; popups: Value[] } {
  const registries = homes()[home];
  const found = SHIPPED[template];
  assert.ok(registries && found, `${template} in ${home}`);
  return expand(SHIPPED, { template }, discover(found, undefined, registries));
}

function chips(card: Value): Record<string, Value>[] {
  const list = isMapping(card) ? card['chips'] : undefined;
  return Array.isArray(list) ? list.filter(isMapping) : [];
}

function counted(chip: Record<string, Value> | undefined): Value[] {
  const rules = chip?.['rules'];
  return (Array.isArray(rules) ? rules.filter(isMapping) : []).flatMap((rule) => {
    const entities = rule['entities'];
    return Array.isArray(entities) ? entities : [];
  });
}

test("a tailnet's Relayed chip, and a Proxmox host's Guests chip, are found with the tile; its Offline and Update chips wait for the devices marked essential", () => {
  const tailscale = placed('tailscale', 'systems').card;
  const names = chips(tailscale).map((chip) => chip['name']);
  assert.deepEqual(names, ['Relayed']);
  assert.deepEqual(counted(chips(tailscale)[0]), [
    'binary_sensor.ts_phone_udp',
    'binary_sensor.ts_router_udp',
  ]);
  const guests = chips(placed('proxmox-server', 'systems').card).find(
    (chip) => chip['name'] === 'Guests',
  );
  assert.deepEqual(counted(guests), [
    'binary_sensor.router_vm_status',
    'binary_sensor.torrents_status',
  ]);
});

test("Home Assistant's Firmware chip counts every firmware update discovery finds, those in no area included", () => {
  assert.deepEqual(
    counted(
      chips(placed('home-assistant', 'demo').card).find((each) => each['name'] === 'Firmware'),
    ),
    [
      'update.demo_living_room_bulb_update',
      'update.demo_update_with_decimal_progress',
      'update.demo_update_with_progress',
    ],
  );
  assert.deepEqual(
    counted(
      chips(placed('home-assistant', 'tidy').card).find((each) => each['name'] === 'Firmware'),
    ),
    ['update.plug_firmware'],
  );
});

test('a robot vacuum and its dock are one vacuum, the dock found through its via_device and filled from its own entities', () => {
  assert.deepEqual(roomIn('devices', 'living')['vacuum'], {
    entity: 'vacuum.roborock_s8',
    status: 'sensor.roborock_s8_status',
    error: 'sensor.roborock_s8_vacuum_error',
    battery: 'sensor.roborock_s8_battery',
    current_room: 'sensor.roborock_s8_current_room',
    progress: 'sensor.roborock_s8_cleaning_progress',
    area: 'sensor.roborock_s8_cleaning_area',
    time: 'sensor.roborock_s8_cleaning_time',
    last_clean: 'sensor.roborock_s8_last_clean_end',
    mop_attached: 'binary_sensor.roborock_s8_mop_attached',
    water_box_attached: 'binary_sensor.roborock_s8_water_box_attached',
    totals: {
      count: 'sensor.roborock_s8_total_cleaning_count',
      area: 'sensor.roborock_s8_total_cleaning_area',
      time: 'sensor.roborock_s8_total_cleaning_time',
    },
    map: 'image.roborock_s8_downstairs',
    routines: ['button.roborock_s8_daily_clean'],
    settings: ['select.roborock_s8_mop_intensity', 'select.roborock_s8_mop_mode'],
    warnings: ['binary_sensor.roborock_s8_water_shortage'],
    dock: {
      error: 'sensor.roborock_s8_dock_dock_error',
      dust_emptying: 'switch.roborock_s8_dock_dust_emptying',
      mop_drying: 'switch.roborock_s8_dock_mop_drying',
      mop_drying_time_left: 'sensor.roborock_s8_dock_mop_drying_remaining_time',
      mop_washing: 'switch.roborock_s8_dock_mop_washing',
      warnings: [
        'binary_sensor.roborock_s8_dock_clean_water_box',
        'binary_sensor.roborock_s8_dock_dirty_water_box',
      ],
    },
  });
});

test('a climate that cools is the air conditioning, with its meter, and the heater beside it is the heating, with its valve', () => {
  const found = roomIn('devices', 'bedroom');
  assert.deepEqual(found['ac'], {
    entity: 'climate.bedroom_ac',
    energy: {
      power: 'sensor.bedroom_ac_estimated_power_consumption',
      today: 'sensor.bedroom_ac_energy_today',
      total: 'sensor.bedroom_ac_energy_consumption',
    },
  });
  assert.deepEqual(found['heating'], {
    entity: 'climate.bedroom_heating',
    thermostats: [
      { valve: 'sensor.radiator_valve_valve_position', battery: 'sensor.radiator_valve_battery' },
    ],
  });
  assert.deepEqual(
    roomIn('devices', 'hall')['heating'],
    { entity: 'climate.hall_heater' },
    'a heater with no device is a heating of its own',
  );
});

test('no corpus home files a climate that cools as a heating', () => {
  for (const [home, registries] of Object.entries(homes())) {
    for (const [area, slots] of Object.entries(discoveries()[home]?.['room'] ?? {})) {
      const heating = slots['heating'];
      const entity = isMapping(heating) ? heating['entity'] : undefined;
      const modes =
        typeof entity === 'string'
          ? registries.states[entity]?.attributes['hvac_modes']
          : undefined;
      assert.ok(
        !(Array.isArray(modes) && modes.includes('cool')),
        `${home} ${area}: ${JSON.stringify(entity)} cools`,
      );
    }
  }
});

test('a metered plug is an outlet with its power and energy, a plain one an outlet alone', () => {
  assert.deepEqual(roomIn('devices', 'kitchen')['outlets'], [
    {
      entity: 'switch.kettle_plug',
      energy: {
        power: 'sensor.kettle_plug_power',
        today: 'sensor.kettle_plug_energy_today',
        total: 'sensor.kettle_plug_energy',
      },
    },
    { entity: 'switch.radio_plug' },
  ]);
});

test('a 3D printer is found from its integration, with its job, its heaters and its buttons', () => {
  assert.deepEqual(roomIn('devices', 'office')['printer3d'], {
    entity: 'sensor.prusa_mk4',
    progress: 'sensor.prusa_mk4_progress',
    filename: 'sensor.prusa_mk4_filename',
    material: 'sensor.prusa_mk4_material',
    speed: 'sensor.prusa_mk4_print_speed',
    start: 'sensor.prusa_mk4_print_start',
    finish: 'sensor.prusa_mk4_print_finish',
    nozzle: {
      temperature: 'sensor.prusa_mk4_nozzle_temperature',
      target: 'sensor.prusa_mk4_nozzle_target_temperature',
    },
    bed: {
      temperature: 'sensor.prusa_mk4_heatbed_temperature',
      target: 'sensor.prusa_mk4_heatbed_target_temperature',
    },
    camera: 'camera.prusa_mk4_preview',
    actions: {
      pause: 'button.prusa_mk4_pause_job',
      resume: 'button.prusa_mk4_resume_job',
      cancel: 'button.prusa_mk4_cancel_job',
    },
  });
});

test('a speaker is found with its sound settings, and its player in the media opens its pop-up', () => {
  const registries = homes()['devices'];
  assert.ok(registries && room);
  const found = discover(room, 'living', registries);
  assert.deepEqual(found['speakers'], [
    {
      key: 'media_player.living_room',
      entity: 'media_player.living_room',
      bass: 'number.living_room_bass',
      treble: 'number.living_room_treble',
      balance: 'number.living_room_balance',
      loudness: 'switch.living_room_loudness',
      tv: {
        input_format: 'sensor.living_room_audio_input_format',
        night_sound: 'switch.living_room_night_sound',
        speech_enhancement: 'switch.living_room_speech_enhancement',
        audio_delay: 'number.living_room_audio_delay',
      },
      subwoofer: {
        enabled: 'switch.living_room_subwoofer_enabled',
        gain: 'number.living_room_sub_gain',
      },
      surround: {
        enabled: 'switch.living_room_surround_enabled',
        level: 'number.living_room_surround_level',
        music_level: 'number.living_room_music_surround_level',
        music_full_volume: 'switch.living_room_surround_music_full_volume',
      },
    },
  ]);
  assert.deepEqual(found['media'], [
    { entity: 'media_player.living_room', key: 'media_player.living_room' },
    { entity: 'media_player.living_room_tv' },
  ]);
  const hashes = new Set(
    expand(SHIPPED, { template: 'room', slots: found }, {}).popups.map((popup) =>
      isMapping(popup) ? popup['hash'] : undefined,
    ),
  );
  assert.ok(hashes.has('#living-media_player.living_room'), 'the speaker pop-up is there');
});

test('a washer is an appliance, found from its state and the time its programme ends', () => {
  assert.deepEqual(roomIn('devices', 'laundry')['appliances'], [
    { entity: 'sensor.washer_operation_state', remaining: 'sensor.washer_program_finish_time' },
  ]);
});

const BASIC: Registries = {
  areas: { den: { area_id: 'den', name: 'Den' } },
  devices: {
    robot: { id: 'robot', area_id: 'den', name: 'Robot', manufacturer: 'Xiaomi' },
    nest: { id: 'nest', area_id: 'den', name: 'Den speaker', manufacturer: 'Google' },
  },
  entities: {
    'vacuum.robot': { entity_id: 'vacuum.robot', device_id: 'robot', platform: 'xiaomi_miio' },
    'sensor.robot_battery': {
      entity_id: 'sensor.robot_battery',
      device_id: 'robot',
      platform: 'xiaomi_miio',
    },
    'media_player.den_speaker': {
      entity_id: 'media_player.den_speaker',
      device_id: 'nest',
      platform: 'cast',
    },
  },
  states: {
    'sensor.robot_battery': { attributes: { device_class: 'battery' } },
    'media_player.den_speaker': { attributes: { device_class: 'speaker' } },
  },
};

test('a vacuum with no more than a battery, and a speaker with no sound settings, are found, and their pop-ups draw', () => {
  assert.ok(room);
  const found = discover(room, 'den', BASIC);
  assert.deepEqual(found['vacuum'], { entity: 'vacuum.robot', battery: 'sensor.robot_battery' });
  assert.deepEqual(found['speakers'], [
    { key: 'media_player.den_speaker', entity: 'media_player.den_speaker' },
  ]);
  const hashes = new Set(
    expand(SHIPPED, { template: 'room', slots: found }, {}).popups.map((popup) =>
      isMapping(popup) ? popup['hash'] : undefined,
    ),
  );
  assert.ok(hashes.has('#den-vacuum'));
  assert.ok(hashes.has('#den-media_player.den_speaker'));
});

const DOCKED: Registries = {
  areas: { living: { area_id: 'living', name: 'Living' } },
  devices: {
    solo: { id: 'solo', area_id: 'living', name: 'Solo' },
    robo: { id: 'robo', area_id: 'living', name: 'Robo' },
    robo_dock: {
      id: 'robo_dock',
      area_id: 'living',
      name: 'Robo Dock',
      model: 'S8 Dock',
      via_device_id: 'robo',
    },
  },
  entities: {
    'vacuum.solo': { entity_id: 'vacuum.solo', device_id: 'solo', platform: 'roborock' },
    'sensor.solo_vacuum_error': {
      entity_id: 'sensor.solo_vacuum_error',
      device_id: 'solo',
      platform: 'roborock',
      translation_key: 'vacuum_error',
    },
    'vacuum.robo': { entity_id: 'vacuum.robo', device_id: 'robo', platform: 'roborock' },
    'sensor.robo_vacuum_error': {
      entity_id: 'sensor.robo_vacuum_error',
      device_id: 'robo',
      platform: 'roborock',
      translation_key: 'vacuum_error',
    },
    'switch.robo_dock_dust_emptying': {
      entity_id: 'switch.robo_dock_dust_emptying',
      device_id: 'robo_dock',
      platform: 'roborock',
      translation_key: 'dust_emptying',
    },
    'binary_sensor.robo_dock_dirty_water_box': {
      entity_id: 'binary_sensor.robo_dock_dirty_water_box',
      device_id: 'robo_dock',
      platform: 'roborock',
      translation_key: 'dirty_water_box',
    },
  },
  states: {
    'sensor.solo_vacuum_error': { attributes: { friendly_name: 'Solo Vacuum error' } },
    'sensor.robo_vacuum_error': { attributes: { friendly_name: 'Robo Vacuum error' } },
    'binary_sensor.robo_dock_dirty_water_box': {
      attributes: { friendly_name: 'Robo Dock Dirty water box', device_class: 'problem' },
    },
  },
};

test("a vacuum and its dock take nothing of each other's: the dock's warnings are listed once, and the dock has no error of the vacuum's", () => {
  assert.ok(room);
  const found = discover(room, 'living', DOCKED);
  assert.deepEqual(found['vacuum'], {
    entity: 'vacuum.robo',
    error: 'sensor.robo_vacuum_error',
    dock: {
      dust_emptying: 'switch.robo_dock_dust_emptying',
      warnings: ['binary_sensor.robo_dock_dirty_water_box'],
    },
  });
  const popup = expand(SHIPPED, { template: 'room', slots: found }, {}).popups.find(
    (each) => isMapping(each) && each['hash'] === '#living-vacuum',
  );
  assert.equal(
    JSON.stringify(popup).split('binary_sensor.robo_dock_dirty_water_box').length - 1,
    1,
    'Maintenance lists the dirty water box once',
  );
});

test("a vacuum with no dock of its own does not take another vacuum's dock in its area", () => {
  const spec = room?.slots?.['vacuum'];
  assert.ok(spec);
  assert.deepEqual(fromDevice(spec, 'solo', 'living', DOCKED), {
    entity: 'vacuum.solo',
    error: 'sensor.solo_vacuum_error',
  });
});

const LOCKS: Registries = {
  areas: {
    entry: { area_id: 'entry', name: 'Entry' },
    garage: { area_id: 'garage', name: 'Garage' },
  },
  devices: {
    front: { id: 'front', area_id: 'entry', name: 'Front door' },
    back: { id: 'back', area_id: 'entry', name: 'Back door' },
    shed: { id: 'shed', area_id: null, name: 'Shed' },
  },
  entities: {
    'lock.front': { entity_id: 'lock.front', device_id: 'front' },
    'lock.back': { entity_id: 'lock.back', device_id: 'back' },
    'lock.shed': { entity_id: 'lock.shed', device_id: 'shed' },
    'lock.garage': { entity_id: 'lock.garage', area_id: 'garage', platform: 'template' },
  },
  states: {},
};

test('the glances strip has one item per lock, anywhere in the home, opening the room of its own area', () => {
  const glances = SHIPPED['glances'];
  assert.ok(glances);
  const locks = [
    { entity: 'lock.back', room: 'entry' },
    { entity: 'lock.front', room: 'entry' },
    { entity: 'lock.shed' },
    { entity: 'lock.garage', room: 'garage' },
  ];
  assert.deepEqual(discover(glances, undefined, LOCKS)['locks'], locks);
  assert.deepEqual(
    discover(glances, 'garage', LOCKS)['locks'],
    locks,
    'placed in an area, each lock keeps its own',
  );
  const card = expand(SHIPPED, { template: 'glances' }, discover(glances, undefined, LOCKS)).card;
  const items = isMapping(card) && Array.isArray(card['items']) ? card['items'] : [];
  assert.deepEqual(
    items.filter(isMapping).map((item) => [item['entities'], item['popup']]),
    [
      [['lock.back'], '#entry'],
      [['lock.front'], '#entry'],
      [['lock.garage'], '#garage'],
      [['lock.shed'], undefined],
    ],
  );
});

test('the guests labelled mnml_guests are the only ones the glances strip and the Proxmox tile count', () => {
  const systems = homes()['systems'];
  const glances = SHIPPED['glances'];
  const server = SHIPPED['proxmox-server'];
  assert.ok(systems && glances && server);
  const labelled: Registries = {
    ...systems,
    devices: {
      ...systems.devices,
      pve_vm: { id: 'pve_vm', area_id: null, name: 'Router VM', labels: ['mnml_guests'] },
    },
  };
  assert.deepEqual(discover(glances, undefined, labelled)['guests'], [
    'binary_sensor.router_vm_status',
  ]);
  assert.deepEqual(discover(server, undefined, labelled)['guests'], [
    {
      status: 'binary_sensor.router_vm_status',
      cpu: 'sensor.router_vm_cpu',
      memory: 'sensor.router_vm_memory',
    },
  ]);
});
