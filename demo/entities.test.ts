import assert from 'node:assert/strict';

import { test } from 'vitest';

import { drawn } from '../src/home/view.ts';

import {
  SUPPLIED,
  camerasOf,
  created,
  customizeOf,
  packageOf,
  precisionsOf,
  trackersOf,
} from './entities.ts';
import { DEMO } from './home.ts';
import { AWAY, STATES } from './states.ts';

const ID = /^[a-z_]+\.[a-z0-9_]+$/;

function withoutCards(value: unknown, type: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => withoutCards(item, type));
  }
  if (typeof value === 'object' && value !== null) {
    if ((value as Record<string, unknown>)['type'] === type) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withoutCards(item, type)]),
    );
  }
  return value;
}

function ids(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string' && ID.test(value) && value !== 'button.press') {
    into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      ids(item, into);
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key !== 'service') {
        ids(item, into);
      }
    }
  }
  return into;
}

test('every id the demo draws is supplied by the demo integration, the package, or the setup script', () => {
  const made = created(packageOf(DEMO));
  const missing = [...ids(drawn(DEMO))].filter(
    (id) =>
      !SUPPLIED.has(id) &&
      !made.has(id) &&
      !id.startsWith('person.') &&
      !id.startsWith('device_tracker.') &&
      !camerasOf(DEMO).has(id),
  );
  assert.deepEqual(missing, []);
});

test('the package makes no entity the demo integration supplies', () => {
  const made = created(packageOf(DEMO));
  assert.deepEqual(
    [...SUPPLIED.keys()].filter((id) => made.has(id)),
    [],
  );
});

test('the package is the same for the same home', () => {
  assert.equal(JSON.stringify(packageOf(DEMO)), JSON.stringify(packageOf(DEMO)));
});

test("the demo integration's kitchen light is supplied, not made a second time", () => {
  assert.ok(SUPPLIED.has('light.kitchen_lights'));
  assert.ok(!created(packageOf(DEMO)).has('light.kitchen_lights'));
});

type Entry = Record<string, unknown>;

function entryOf(id: string): Entry | undefined {
  const pack = packageOf(DEMO);
  const groups = Array.isArray(pack['template']) ? pack['template'] : [];
  for (const group of groups) {
    for (const list of Object.values(group as Record<string, unknown>)) {
      const found = (list as Entry[]).find((entry) => entry['default_entity_id'] === id);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

test("a window sensor's battery reads as a battery; only a car's windows read as words", () => {
  const battery = entryOf('sensor.bedroom_window_battery');
  assert.match(String(battery?.['state']), /^\d+(\.\d+)?$/);
  assert.equal(battery?.['unit_of_measurement'], '%');
  assert.equal(entryOf('sensor.garage_sedan_window_front_left')?.['state'], 'CLOSED');
});

test("the vacuum's map is a map, and a Wi-Fi network's QR code a QR code", () => {
  const vacuum = DEMO.rooms.find((room) => room.vacuum)?.vacuum;
  assert.ok(vacuum);
  assert.match(String(entryOf(vacuum.map)?.['url']), /map\.png$/);
  const wifi = DEMO.system.network?.wifi?.[0];
  assert.ok(wifi);
  assert.match(String(entryOf(wifi.qr)?.['url']), /qr\.png$/);
});

test('words read as Home Assistant shows them, and as the templates compare them', () => {
  assert.equal(entryOf('sensor.office_3d_printer')?.['state'], 'Printing');
  assert.equal(entryOf('sensor.joe_phone_location_access')?.['state'], 'Authorized Always');
  assert.equal(entryOf('sensor.jane_phone_location_access')?.['state'], 'Authorized When In Use');
  assert.equal(entryOf('sensor.infrastructure_router_state')?.['state'], 'Connected');
});

test('icons come from the home the demo was made from, by state where they change', () => {
  assert.equal(entryOf('light.bathroom_lights')?.['icon'], 'mdi:wall-sconce-round');
  assert.equal(entryOf('switch.infrastructure_home_users_enabled')?.['icon'], 'mdi:wifi-check');
  assert.equal(
    entryOf('switch.infrastructure_adguard_home_protection')?.['icon'],
    'mdi:shield-check',
  );
  assert.equal(customizeOf(DEMO).get('climate.hvac')?.icon, 'mdi:air-conditioner');
});

test('scenes and thermostats are named as the home names them, without the room', () => {
  const registry = customizeOf(DEMO);
  assert.equal(registry.get('scene.living_lights_relax')?.name, 'Relax');
  assert.equal(registry.get('scene.bedroom_lights_arctic_aurora')?.name, 'Arctic aurora');
  assert.equal(registry.get('climate.living_heating')?.name, 'Heating');
  assert.equal(registry.get('media_player.living_room')?.name, 'Sonos');
});

test('the demo home is lived in: dark rooms and lit ones, heating on and off, someone away', () => {
  assert.equal(entryOf('light.bathroom_lights')?.['state'], '{{ false }}');
  assert.equal(entryOf('light.living_lights')?.['state'], '{{ true }}');
  const climates = packageOf(DEMO)['climate'] as Entry[];
  const modes = new Set(climates.map((climate) => climate['initial_hvac_mode']));
  assert.deepEqual(
    [...modes].map(String).toSorted((a, b) => a.localeCompare(b)),
    ['heat', 'off'],
  );
  assert.equal(trackersOf(DEMO).get('device_tracker.jane_phone'), 'not_home');
  assert.equal(trackersOf(DEMO).get('device_tracker.joe_phone'), 'home');
  assert.equal(entryOf('binary_sensor.living_window')?.['state'], 'on');
  const vacuum = DEMO.rooms.find((room) => room.vacuum)?.vacuum;
  assert.ok(vacuum?.mopAttached);
  assert.equal(entryOf(vacuum.mopAttached)?.['state'], 'on', 'the mop is attached');
});

test('every state the demo sets names an entity it draws', () => {
  const drawnIds = ids(drawn(DEMO));
  assert.deepEqual(
    [...Object.keys(STATES), ...AWAY].filter((id) => !drawnIds.has(id)),
    [],
  );
});

test("the 3D printer's camera is a still of a print, not the demo integration's camera", () => {
  const camera = DEMO.rooms.find((room) => room.printer3d)?.printer3d?.camera;
  assert.equal(camera, 'camera.office_3d_printer_camera');
  assert.ok(!SUPPLIED.has('camera.demo_camera'));
  assert.equal(camerasOf(DEMO).get(camera)?.file, '3d-printer.png');
});

test('every numeric reading is shown with as many decimals as it has', () => {
  const precisions = precisionsOf(DEMO);
  const pack = packageOf(DEMO);
  const sensors = (pack['template'] as Record<string, Entry[]>[]).flatMap(
    (group) => group['sensor'] ?? [],
  );
  let checked = 0;
  for (const sensor of sensors) {
    const state = String(sensor['state']);
    if (/^-?\d+(\.\d+)?$/.test(state)) {
      assert.equal(
        precisions.get(String(sensor['default_entity_id'])),
        state.split('.')[1]?.length ?? 0,
        String(sensor['default_entity_id']),
      );
      checked += 1;
    }
  }
  assert.ok(checked > 100);
  assert.equal(precisions.get('sensor.infrastructure_plex'), 0, '1 watching, not 1.0');
});

test("a car's parts are named as parts, the car's name being on its pop-up", () => {
  assert.equal(entryOf('sensor.garage_suv_fuel')?.['name'], 'Fuel');
  assert.equal(entryOf('sensor.garage_sedan_doors')?.['name'], 'Doors');
});

test('every sensor the demo draws with its icon has an icon or a device class, so none falls back to the eye', () => {
  const drawnIds = ids(withoutCards(drawn(DEMO), 'custom:mnml-clients-card'));
  const template = packageOf(DEMO)['template'];
  const sensors = (Array.isArray(template) ? template : []).flatMap((group) => {
    const entries = (group as Record<string, unknown>)['sensor'];
    return Array.isArray(entries) ? (entries as Record<string, unknown>[]) : [];
  });
  assert.deepEqual(
    sensors
      .filter((sensor) => drawnIds.has(String(sensor['default_entity_id'])))
      .filter((sensor) => sensor['icon'] === undefined && sensor['device_class'] === undefined)
      .map((sensor) => sensor['default_entity_id']),
    [],
  );
});

test('every sensor with a unit or a device class other than enum reads a number, since Home Assistant refuses any other state for it', () => {
  const template = packageOf(DEMO)['template'];
  const sensors = (Array.isArray(template) ? template : []).flatMap((group) => {
    const entries = (group as Record<string, unknown>)['sensor'];
    return Array.isArray(entries) ? (entries as Record<string, unknown>[]) : [];
  });
  assert.deepEqual(
    sensors
      .filter(
        (sensor) =>
          sensor['device_class'] !== 'enum' &&
          (sensor['unit_of_measurement'] !== undefined || sensor['device_class'] !== undefined),
      )
      .filter((sensor) => !/^-?\d+(?:\.\d+)?$|^\{\{/.test(String(sensor['state'])))
      .map((sensor) => `${String(sensor['default_entity_id'])}: ${String(sensor['state'])}`),
    [],
  );
});
