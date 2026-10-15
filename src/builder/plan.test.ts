import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isPlan } from '../contract/plan.ts';
import type { Filter, Rule, Template } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';
import { homes } from '../templates/corpus.ts';
import { discover } from '../templates/discover.ts';
import { describe, matches } from '../templates/filters.ts';
import { readTemplates } from '../templates/shipped.ts';

import { HOME, HOUSE } from './fixture.ts';
import { areaKinds, defaultPlan, unplaced } from './plan.ts';

const TEMPLATES = readTemplates();

test('the default plan has the rooms with something to show, in the order Home Assistant lists them', () => {
  assert.deepEqual(defaultPlan(HOME, TEMPLATES).rooms, [{ area: 'kitchen' }, { area: 'living' }]);
});

test('the default plan ticks only the areas that are rooms, not those of phones or of system devices', () => {
  const room = TEMPLATES['room'];
  assert.ok(room);
  assert.ok(Object.keys(discover(room, 'jane', HOUSE)).includes('batteries'));
  assert.ok(Object.keys(discover(room, 'infrastructure', HOUSE)).includes('temperature'));
  assert.deepEqual(defaultPlan(HOUSE, TEMPLATES).rooms, [{ area: 'living' }]);
});

test('an area is a room by what it holds, and says why it is not', () => {
  assert.deepEqual(areaKinds(HOUSE), {
    jane: 'phones',
    infrastructure: 'system',
    living: 'room',
    attic: 'empty',
  });
  assert.deepEqual(areaKinds(HOME), { kitchen: 'room', hallway: 'empty', living: 'room' });
});

test("a reading on no device makes a room only when it is the area's own", () => {
  const reading: Registries = {
    areas: { porch: { area_id: 'porch', name: 'Porch' } },
    devices: {},
    entities: {
      'sensor.porch_temperature': {
        entity_id: 'sensor.porch_temperature',
        area_id: 'porch',
        platform: 'template',
      },
    },
    states: { 'sensor.porch_temperature': { attributes: { device_class: 'temperature' } } },
  };
  assert.deepEqual(areaKinds(reading), { porch: 'empty' });
  const named: Registries = {
    ...reading,
    areas: {
      porch: { area_id: 'porch', name: 'Porch', temperature_entity_id: 'sensor.porch_temperature' },
    },
  };
  assert.deepEqual(areaKinds(named), { porch: 'room' });
});

test("a reading on a service device, a server's or an integration's own, does not make a room", () => {
  const service: Registries = {
    areas: { closet: { area_id: 'closet', name: 'Closet' } },
    devices: {
      monitor: { id: 'monitor', area_id: 'closet', name: 'System Monitor', entry_type: 'service' },
    },
    entities: {
      'sensor.cpu_temperature': {
        entity_id: 'sensor.cpu_temperature',
        device_id: 'monitor',
        platform: 'systemmonitor',
      },
    },
    states: { 'sensor.cpu_temperature': { attributes: { device_class: 'temperature' } } },
  };
  assert.deepEqual(areaKinds(service), { closet: 'system' });
  const measured: Registries = {
    ...service,
    devices: { monitor: { id: 'monitor', area_id: 'closet', name: 'Thermometer' } },
  };
  assert.deepEqual(areaKinds(measured), { closet: 'room' });
});

test('the devices in no area are counted when they hold something a room shows', () => {
  assert.equal(
    unplaced(HOUSE).devices,
    2,
    'the bulb and the thermometer; not the car, which moves, nor the plug, whose switch is no outlet',
  );
  const outlet: Registries = {
    ...HOUSE,
    states: { ...HOUSE.states, 'switch.plug': { attributes: { device_class: 'outlet' } } },
  };
  assert.equal(unplaced(outlet).devices, 3, 'an outlet is something a room shows');
  assert.deepEqual(unplaced(HOME), { devices: 0, entities: 0, share: 0 });
});

test('the entities with no device in no area are counted, and the share of what a room shows that is in no area', () => {
  const loose: Registries = {
    ...HOUSE,
    entities: {
      ...HOUSE.entities,
      'light.porch': { entity_id: 'light.porch' },
      'light.shed': { entity_id: 'light.shed', area_id: 'living' },
    },
  };
  assert.equal(unplaced(HOUSE).share, 2 / 3, 'the bulb and the thermometer, beside the lamp');
  assert.deepEqual(unplaced(loose), { devices: 2, entities: 1, share: 3 / 5 });
});

function single(
  device: string,
  entities: readonly (readonly [string, Record<string, unknown>, string?, string?])[],
): Registries {
  return {
    areas: { here: { area_id: 'here', name: 'Here' } },
    devices: { [device]: { id: device, area_id: 'here', name: device } },
    entities: Object.fromEntries(
      entities.map(([entity_id, , platform, translation_key]) => [
        entity_id,
        { entity_id, device_id: device, platform, translation_key },
      ]),
    ),
    states: Object.fromEntries(
      entities.map(([entity_id, attributes]) => [entity_id, { attributes }]),
    ),
  };
}

const kinds = (registries: Registries): string | undefined => areaKinds(registries)['here'];

test("an area is a room when it holds an outlet, a plug's power, a camera, a humidifier, or a device the room template finds", () => {
  assert.equal(kinds(single('plug', [['switch.plug', { device_class: 'outlet' }]])), 'room');
  assert.equal(
    kinds(
      single('plug', [
        ['switch.plug', {}],
        ['sensor.plug_power', { device_class: 'power' }],
      ]),
    ),
    'room',
  );
  assert.equal(
    kinds(single('meter', [['sensor.meter_power', { device_class: 'power' }]])),
    'system',
    'a meter with no switch is no plug',
  );
  assert.equal(kinds(single('cam', [['camera.cam', {}]])), 'room');
  assert.equal(kinds(single('air', [['humidifier.air', {}]])), 'room');
  assert.equal(kinds(single('robot', [['vacuum.robot', {}]])), 'room');
  assert.equal(kinds(single('nest', [['media_player.nest', { device_class: 'speaker' }]])), 'room');
  assert.equal(
    kinds(single('prusa', [['sensor.prusa', { device_class: 'enum' }, 'prusalink']])),
    'room',
  );
  for (const [platform, key] of [
    ['smartthings', 'washer_machine_state'],
    ['smartthings', 'dryer_machine_state'],
    ['smartthings', 'dishwasher_machine_state'],
    ['home_connect', 'operation_state'],
  ] as const) {
    assert.equal(
      kinds(single('appliance', [['sensor.appliance_state', {}, platform, key]])),
      'room',
      key,
    );
  }
});

test('on the corpus home of devices, the kitchen of plugs and the laundry of a washer are rooms, and the quick start offers them', () => {
  const devices = homes()['devices'];
  assert.ok(devices);
  assert.deepEqual(areaKinds(devices), {
    bedroom: 'room',
    hall: 'room',
    kitchen: 'room',
    laundry: 'room',
    living: 'room',
    office: 'room',
  });
  assert.deepEqual(
    defaultPlan(devices, TEMPLATES).rooms.map((each) => each.area),
    ['bedroom', 'hall', 'kitchen', 'laundry', 'living', 'office'],
  );
});

test('the quick start draws each device through its room, and none on a card of its own', () => {
  for (const [name, home] of Object.entries(homes())) {
    const plan = defaultPlan(home, TEMPLATES);
    assert.equal('devices' in plan, false, name);
    assert.equal(isPlan(plan), true, name);
  }
});

function holding(filter: Filter): Registries {
  const entity_id = `${filter.domain ?? 'sensor'}.thing`;
  return {
    areas: { here: { area_id: 'here', name: 'Here' } },
    devices: {
      thing: {
        id: 'thing',
        area_id: 'here',
        name: 'Thing',
        manufacturer: filter.manufacturer,
        model: filter.model,
        entry_type: filter.entry_type === 'service' ? 'service' : undefined,
        labels: filter.label === undefined ? [] : [filter.label],
      },
    },
    entities: {
      [entity_id]: {
        entity_id,
        device_id: 'thing',
        platform: filter.platform ?? filter.integration,
        translation_key: filter.translation_key,
        entity_category: filter.entity_category === 'none' ? undefined : filter.entity_category,
      },
    },
    states: {
      [entity_id]: {
        state: 'on',
        attributes: {
          device_class: filter.device_class,
          unit_of_measurement: filter.unit,
          state_class: filter.state_class,
          friendly_name: filter.name ?? 'Thing',
          ...filter.attribute,
        },
      },
    },
  };
}

function lookedFor(rule: Rule | undefined, path: string): (readonly [string, Filter])[] {
  if (rule === undefined || typeof rule === 'string') {
    return [];
  }
  if (Array.isArray(rule)) {
    return rule.flatMap((each) => lookedFor(each, path));
  }
  if ('per' in rule) {
    return rule.where === undefined ? [] : [[path, rule.where]];
  }
  if ('fields' in rule) {
    return rule.device === undefined
      ? Object.entries(rule.fields).flatMap(([field, each]) => lookedFor(each, `${path}.${field}`))
      : [rule.device].flat().map((anchor) => [path, anchor] as const);
  }
  return [[path, rule]];
}

test('everything the room template looks for in an area makes the area a room, but its batteries, its scenes, its schedules and its timers', () => {
  const room = TEMPLATES['room'];
  assert.ok(room);
  const sought = Object.entries(room.slots ?? {}).flatMap(([slot, spec]) =>
    lookedFor(spec.discover, slot),
  );
  const apart = ['batteries', 'lights.scenes', 'schedules', 'timers'];
  assert.ok(sought.length > 20);
  assert.deepEqual(
    apart.filter((path) => sought.some(([each]) => each === path)),
    apart,
  );
  for (const [path, filter] of sought) {
    const home = holding(filter);
    const [entry] = Object.values(home.entities);
    assert.ok(entry && matches(entry, filter, home), `${path}: the thing fits ${describe(filter)}`);
    assert.equal(kinds(home) === 'room', !apart.includes(path), `${path}: ${describe(filter)}`);
  }
});

test("a router's tracker on a speaker or a bulb does not make it move with someone; a GPS tracker does", () => {
  const living: Registries = {
    areas: { living: { area_id: 'living', name: 'Living' } },
    devices: {
      sonos: { id: 'sonos', area_id: 'living', name: 'Sonos' },
      bulb: { id: 'bulb', area_id: 'living', name: 'Bulb' },
    },
    entities: {
      'media_player.sonos': { entity_id: 'media_player.sonos', device_id: 'sonos' },
      'device_tracker.sonos': {
        entity_id: 'device_tracker.sonos',
        device_id: 'sonos',
        platform: 'unifi',
      },
      'light.bulb': { entity_id: 'light.bulb', device_id: 'bulb' },
      'device_tracker.bulb': {
        entity_id: 'device_tracker.bulb',
        device_id: 'bulb',
        platform: 'unifi',
      },
    },
    states: {
      'device_tracker.sonos': { state: 'home', attributes: { source_type: 'router' } },
      'device_tracker.bulb': { state: 'home', attributes: {} },
    },
  };
  assert.deepEqual(areaKinds(living), { living: 'room' });
  const tracked: Registries = {
    ...living,
    states: {
      ...living.states,
      'device_tracker.sonos': { state: 'home', attributes: { source_type: 'gps' } },
      'device_tracker.bulb': { state: 'home', attributes: { source_type: 'gps' } },
    },
  };
  assert.deepEqual(areaKinds(tracked), { living: 'phones' });
});

test('the default plan has every person, and pop-ups that unfold on tablet and desktop', () => {
  const plan = defaultPlan(HOME, TEMPLATES);
  assert.deepEqual(plan.people, [{ entity: 'person.jane' }, { entity: 'person.bob' }]);
  assert.deepEqual(plan.open, { tablet: 'unfold', desktop: 'unfold' });
  assert.equal(plan.title, 'Home');
  assert.equal(plan.icon, 'mdi:home-variant');
  assert.deepEqual(plan.cars, []);
  assert.equal(isPlan(plan), true);
});

test('the default plan has each system template that draws, and whose entities discovery finds some of', () => {
  assert.deepEqual(defaultPlan(HOME, TEMPLATES).system, []);
  const adguard: Template = {
    slots: {
      protection: {
        kind: 'entity',
        required: true,
        discover: { domain: 'light', platform: 'hue', scope: 'all' },
      },
    },
    card: { type: 'custom:mnml-tile-card', entity: '[[protection]]' },
  };
  assert.deepEqual(defaultPlan(HOME, { ...TEMPLATES, adguard }).system, [{ template: 'adguard' }]);
});

function withEntities(
  registries: Registries,
  entities: readonly (readonly [string, string, string | undefined])[],
): Registries {
  return {
    ...registries,
    entities: {
      ...registries.entities,
      ...Object.fromEntries(
        entities.map(([entity_id, platform, translation_key]) => [
          entity_id,
          { entity_id, platform, translation_key },
        ]),
      ),
    },
  };
}

const MONITOR = [
  ['sensor.system_monitor_processor_use', 'systemmonitor', 'processor_use'],
  ['sensor.system_monitor_memory_usage', 'systemmonitor', 'memory_use_percent'],
  ['sensor.system_monitor_disk_free', 'systemmonitor', 'disk_free'],
  ['sensor.system_monitor_disk_use', 'systemmonitor', 'disk_use'],
] as const;
const SUPERVISOR = [
  ['sensor.home_assistant_host_disk_free', 'hassio', 'disk_free'],
  ['sensor.home_assistant_host_disk_used', 'hassio', 'disk_used'],
  ['update.home_assistant_core_update', 'hassio', undefined],
] as const;
const ADGUARD = [
  ['switch.adguard_home_protection', 'adguard', 'protection'],
  ['switch.adguard_home_filtering', 'adguard', 'filtering'],
  ['sensor.adguard_home_dns_queries', 'adguard', 'dns_queries'],
  ['sensor.adguard_home_dns_queries_blocked', 'adguard', 'dns_queries_blocked'],
  ['sensor.adguard_home_dns_queries_blocked_ratio', 'adguard', 'dns_queries_blocked_ratio'],
  ['sensor.adguard_home_average_processing_speed', 'adguard', 'average_processing_speed'],
  ['sensor.adguard_home_rules_count', 'adguard', 'rules_count'],
  ['update.adguard_home', 'adguard', undefined],
] as const;

test('a home with System Monitor and AdGuard Home gets their system cards, found in the whole home', () => {
  const home = withEntities(HOME, [...MONITOR, ...SUPERVISOR, ...ADGUARD]);
  assert.deepEqual(defaultPlan(home, TEMPLATES).system, [
    { template: 'home-assistant' },
    { template: 'adguard' },
  ]);
  const system = TEMPLATES['home-assistant'];
  const adguard = TEMPLATES['adguard'];
  assert.ok(system && adguard);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(discover(system, undefined, home)).filter(
        ([slot]) => !slot.endsWith('firmware'),
      ),
    ),
    {
      cpu: 'sensor.system_monitor_processor_use',
      memory: 'sensor.system_monitor_memory_usage',
      disk_free: 'sensor.home_assistant_host_disk_free',
      disk_used: 'sensor.home_assistant_host_disk_used',
      updates: ['update.home_assistant_core_update'],
    },
  );
  assert.deepEqual(discover(adguard, undefined, home), {
    protection: 'switch.adguard_home_protection',
    queries: 'sensor.adguard_home_dns_queries',
    blocked: 'sensor.adguard_home_dns_queries_blocked',
    ratio: 'sensor.adguard_home_dns_queries_blocked_ratio',
    speed: 'sensor.adguard_home_average_processing_speed',
    rules: 'sensor.adguard_home_rules_count',
    update: 'update.adguard_home',
  });
});

test("without the Supervisor, Home Assistant's disk comes from System Monitor", () => {
  const system = TEMPLATES['home-assistant'];
  assert.ok(system);
  const found = discover(system, undefined, withEntities(HOME, MONITOR));
  assert.equal(found['disk_free'], 'sensor.system_monitor_disk_free');
  assert.equal(found['disk_used'], 'sensor.system_monitor_disk_use');
});

test('a system card is offered only when its tile shows something, not for a firmware update alone', () => {
  const home = withEntities(HOME, [['update.plug_firmware', 'matter', undefined]]);
  const firmware: Registries = {
    ...home,
    states: {
      ...home.states,
      'update.plug_firmware': { attributes: { device_class: 'firmware' } },
    },
  };
  assert.deepEqual(defaultPlan(firmware, TEMPLATES).system, []);
});
