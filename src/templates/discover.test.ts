import assert from 'node:assert/strict';

import { test } from 'vitest';
import { parse } from 'yaml';

import { isMapping, isTemplate } from '../contract/templates.ts';
import type { Filter, Rule, SlotSpec, Template } from '../contract/templates.ts';

import { TEXT_FILTERS, describe, discover, filterWords, fromDevice } from './discover.ts';
import type { Registries } from './discover.ts';

const R: Registries = {
  areas: {
    living: {
      area_id: 'living',
      name: 'Living',
      icon: 'mdi:sofa',
      temperature_entity_id: 'sensor.living_t',
    },
    kitchen: { area_id: 'kitchen', name: 'Kitchen', icon: null },
  },
  devices: {
    trv1: { id: 'trv1', area_id: 'living', name: 'Radiator 1' },
    trv2: { id: 'trv2', area_id: 'living', name: 'Radiator 2' },
    plug: { id: 'plug', area_id: 'kitchen', name: 'Plug' },
  },
  entities: {
    'light.living': { entity_id: 'light.living', area_id: 'living', platform: 'group' },
    'light.lamp': { entity_id: 'light.lamp', area_id: 'living', platform: 'hue' },
    'light.hidden': { entity_id: 'light.hidden', area_id: 'living', hidden: true },
    'sensor.trv1_valve': {
      entity_id: 'sensor.trv1_valve',
      device_id: 'trv1',
      translation_key: 'valve_position',
    },
    'sensor.trv1_battery': { entity_id: 'sensor.trv1_battery', device_id: 'trv1' },
    'sensor.trv2_battery': { entity_id: 'sensor.trv2_battery', device_id: 'trv2' },
    'sensor.living_t': { entity_id: 'sensor.living_t', area_id: 'living' },
    'update.plug_firmware': { entity_id: 'update.plug_firmware', device_id: 'plug' },
    'update.trv1_firmware': { entity_id: 'update.trv1_firmware', device_id: 'trv1' },
  },
  states: {
    'sensor.trv1_battery': { attributes: { device_class: 'battery' } },
    'sensor.trv2_battery': { attributes: { device_class: 'battery' } },
    'update.plug_firmware': { attributes: { device_class: 'firmware' } },
    'update.trv1_firmware': { attributes: { device_class: 'firmware' } },
  },
};

const ROOM: Template = {
  slots: {
    name: { kind: 'text', discover: 'area.name' },
    icon: { kind: 'icon', discover: 'area.icon' },
    temperature: { kind: 'entity', discover: 'area.temperature' },
    group: {
      kind: 'entity',
      discover: [{ domain: 'light', platform: 'group' }, { domain: 'light' }],
    },
    lights: { kind: 'entities', discover: { domain: 'light' } },
    batteries: { kind: 'entities', discover: { device_class: 'battery' } },
    thermostats: {
      kind: 'objects',
      fields: { valve: { kind: 'entity' }, battery: { kind: 'entity' } },
      discover: {
        per: 'device',
        where: { translation_key: 'valve_position' },
        fields: {
          valve: { translation_key: 'valve_position' },
          battery: { device_class: 'battery' },
        },
      },
    },
    firmware: {
      kind: 'objects',
      fields: { name: { kind: 'text' }, firmware: { kind: 'entities' } },
      discover: {
        per: 'area',
        scope: 'all',
        fields: { name: 'area.name', firmware: { domain: 'update', device_class: 'firmware' } },
      },
    },
    key: { kind: 'text' },
  },
  card: {},
};

test('an area fills the slots that have a rule, in entity id order, hidden entities skipped', () => {
  assert.deepEqual(discover(ROOM, 'living', R), {
    name: 'Living',
    icon: 'mdi:sofa',
    temperature: 'sensor.living_t',
    group: 'light.living',
    lights: ['light.lamp', 'light.living'],
    batteries: ['sensor.trv1_battery', 'sensor.trv2_battery'],
    thermostats: [{ valve: 'sensor.trv1_valve', battery: 'sensor.trv1_battery' }],
    firmware: [
      { name: 'Kitchen', firmware: ['update.plug_firmware'] },
      { name: 'Living', firmware: ['update.trv1_firmware'] },
    ],
  });
});

test('a rule that finds nothing leaves its slot out, and a fallback is tried next', () => {
  const found = discover(ROOM, 'kitchen', R);
  assert.equal(found['icon'], undefined);
  assert.equal(found['group'], undefined);
  assert.equal(found['lights'], undefined);
  assert.equal(found['name'], 'Kitchen');
});

test('an object slot is discovered field by field, and left out when no field is found', () => {
  const template: Template = {
    slots: {
      lights: {
        kind: 'object',
        fields: { group: { kind: 'entity' }, all: { kind: 'entities' } },
        discover: {
          fields: {
            group: [{ domain: 'light', platform: 'group' }, { domain: 'light' }],
            all: { domain: 'light' },
          },
        },
      },
    },
    card: {},
  };
  assert.deepEqual(discover(template, 'living', R), {
    lights: { group: 'light.living', all: ['light.lamp', 'light.living'] },
  });
  assert.deepEqual(discover(template, 'kitchen', R), {});
});

test('per: device objects come in device name order, a name given in Home Assistant first', () => {
  const registries: Registries = {
    areas: { hall: { area_id: 'hall', name: 'Hall' } },
    devices: {
      a1: { id: 'a1', area_id: 'hall', name: 'Zeta' },
      b2: { id: 'b2', area_id: 'hall', name: 'Beta' },
      c3: { id: 'c3', area_id: 'hall', name: 'Omega', name_by_user: 'Alpha' },
    },
    entities: {
      'switch.a1': { entity_id: 'switch.a1', device_id: 'a1' },
      'switch.b2': { entity_id: 'switch.b2', device_id: 'b2' },
      'switch.c3': { entity_id: 'switch.c3', device_id: 'c3' },
    },
    states: {},
  };
  const template: Template = {
    slots: {
      outlets: {
        kind: 'objects',
        fields: { entity: { kind: 'entity' } },
        discover: {
          per: 'device',
          where: { domain: 'switch' },
          fields: { entity: { domain: 'switch' } },
        },
      },
    },
    card: {},
  };
  assert.deepEqual(discover(template, 'hall', registries), {
    outlets: [{ entity: 'switch.c3' }, { entity: 'switch.b2' }, { entity: 'switch.a1' }],
  });
});

test('an entity slot prefers an entity without a category; an entities slot takes them all', () => {
  const registries: Registries = {
    areas: { hall: { area_id: 'hall', name: 'Hall' } },
    devices: {},
    entities: {
      'sensor.a_chip': {
        entity_id: 'sensor.a_chip',
        area_id: 'hall',
        entity_category: 'diagnostic',
      },
      'sensor.b_room': { entity_id: 'sensor.b_room', area_id: 'hall' },
    },
    states: {
      'sensor.a_chip': { attributes: { device_class: 'temperature' } },
      'sensor.b_room': { attributes: { device_class: 'temperature' } },
    },
  };
  const template: Template = {
    slots: {
      temperature: { kind: 'entity', discover: { domain: 'sensor', device_class: 'temperature' } },
      all: { kind: 'entities', discover: { domain: 'sensor', device_class: 'temperature' } },
    },
    card: {},
  };
  assert.deepEqual(discover(template, 'hall', registries), {
    temperature: 'sensor.b_room',
    all: ['sensor.a_chip', 'sensor.b_room'],
  });
});

test('without an area, only the rules over the whole home find anything', () => {
  assert.deepEqual(discover(ROOM, undefined, R), {
    firmware: [
      { name: 'Kitchen', firmware: ['update.plug_firmware'] },
      { name: 'Living', firmware: ['update.trv1_firmware'] },
    ],
  });
});

test('an object slot whose required field nothing fills is not found, even when other fields are', () => {
  const lighty: Template = {
    slots: {
      lights: {
        kind: 'object',
        fields: { group: { kind: 'entity', required: true }, scenes: { kind: 'entities' } },
        discover: { fields: { group: { domain: 'light' }, scenes: { domain: 'scene' } } },
      },
    },
    card: { type: 'x' },
  };
  const registries: Registries = {
    ...R,
    entities: {
      ...R.entities,
      'scene.kitchen_relax': { entity_id: 'scene.kitchen_relax', area_id: 'kitchen' },
    },
  };
  assert.deepEqual(discover(lighty, 'kitchen', registries), {});
  assert.deepEqual(discover(lighty, 'living', registries), { lights: { group: 'light.lamp' } });
});

const F: Registries = {
  areas: { den: { area_id: 'den', name: 'Den', icon: null } },
  devices: {
    hue: {
      id: 'hue',
      area_id: 'den',
      name: 'Lamp',
      manufacturer: 'Signify',
      model: 'Hue white',
      labels: ['guest'],
    },
    ikea: {
      id: 'ikea',
      area_id: 'den',
      name: 'Bulb',
      manufacturer: 'IKEA of Sweden',
      model: 'TRADFRI',
    },
  },
  entities: {
    'sensor.den_power': { entity_id: 'sensor.den_power', area_id: 'den', platform: 'tplink' },
    'sensor.den_energy': { entity_id: 'sensor.den_energy', area_id: 'den', platform: 'tplink' },
    'sensor.den_rssi': {
      entity_id: 'sensor.den_rssi',
      area_id: 'den',
      platform: 'tplink',
      entity_category: 'diagnostic',
    },
    'sensor.den_tagged': {
      entity_id: 'sensor.den_tagged',
      area_id: 'den',
      platform: 'mqtt',
      labels: ['mnml_temperature', 'main'],
    },
    'sensor.den_t1': { entity_id: 'sensor.den_t1', area_id: 'den', platform: 'zha' },
    'sensor.den_t2': { entity_id: 'sensor.den_t2', area_id: 'den', platform: 'zha' },
    'light.hue_lamp': { entity_id: 'light.hue_lamp', device_id: 'hue', platform: 'hue' },
    'light.ikea_bulb': { entity_id: 'light.ikea_bulb', device_id: 'ikea', platform: 'ikea' },
  },
  states: {
    'sensor.den_power': {
      attributes: {
        unit_of_measurement: 'W',
        state_class: 'measurement',
        friendly_name: 'Den power',
      },
    },
    'sensor.den_energy': {
      attributes: {
        unit_of_measurement: 'kWh',
        state_class: 'total_increasing',
        friendly_name: 'Den energy',
      },
    },
    'sensor.den_rssi': { attributes: { unit_of_measurement: 'dBm', friendly_name: 'Den signal' } },
    'sensor.den_tagged': { attributes: { friendly_name: 'Odd one out' } },
    'sensor.den_t1': {
      attributes: { device_class: 'temperature', friendly_name: 'Window temperature' },
    },
    'sensor.den_t2': {
      attributes: { device_class: 'temperature', friendly_name: 'Sofa temperature' },
    },
  },
};

function find(rule: Rule, kind: 'entity' | 'entities' = 'entities', slot = 'x'): unknown {
  return discover({ card: {}, slots: { [slot]: { kind, discover: rule } } }, 'den', F)[slot];
}

test('a filter takes an entity category: none for the primary ones, diagnostic or config', () => {
  assert.deepEqual(find({ domain: 'sensor', platform: 'tplink', entity_category: 'none' }), [
    'sensor.den_energy',
    'sensor.den_power',
  ]);
  assert.deepEqual(find({ domain: 'sensor', entity_category: 'diagnostic' }), ['sensor.den_rssi']);
});

test('a filter takes a unit and a state class, read from the state', () => {
  assert.deepEqual(find({ domain: 'sensor', unit: 'W' }), ['sensor.den_power']);
  assert.deepEqual(find({ domain: 'sensor', state_class: 'total_increasing' }), [
    'sensor.den_energy',
  ]);
});

test('a filter takes words of the name, any case, and every word must be in it', () => {
  assert.deepEqual(find({ domain: 'sensor', name: 'SOFA' }), ['sensor.den_t2']);
  assert.deepEqual(find({ domain: 'sensor', name: 'window temperature' }), ['sensor.den_t1']);
  assert.deepEqual(
    find({ domain: 'sensor', name: 'temperature sofa' }),
    ['sensor.den_t2'],
    'in any order',
  );
  assert.equal(find({ domain: 'sensor', name: 'nothing like it' }), undefined);
});

test("a filter takes a device's manufacturer or model, any case, as part of the text", () => {
  assert.deepEqual(find({ domain: 'light', manufacturer: 'signify' }), ['light.hue_lamp']);
  assert.deepEqual(find({ domain: 'light', model: 'tradfri' }), ['light.ikea_bulb']);
});

test('a filter takes a label of the entity or of its device', () => {
  assert.deepEqual(find({ label: 'main' }), ['sensor.den_tagged']);
  assert.deepEqual(find({ label: 'guest' }), ['light.hue_lamp'], "the device's label counts");
});

test('exclude removes what the other keys let through', () => {
  assert.deepEqual(
    find({ domain: 'sensor', platform: 'tplink', exclude: { entity_category: 'diagnostic' } }),
    ['sensor.den_energy', 'sensor.den_power'],
  );
  assert.deepEqual(find({ domain: 'light', exclude: { manufacturer: 'ikea' } }), [
    'light.hue_lamp',
  ]);
});

test('an entity labelled mnml_<slot> is that slot, ahead of any rule, inside the area', () => {
  assert.equal(
    find({ domain: 'sensor', device_class: 'temperature' }, 'entity', 'temperature'),
    'sensor.den_tagged',
  );
  assert.deepEqual(
    find({ domain: 'sensor' }, 'entities', 'temperature'),
    ['sensor.den_tagged'],
    'an entities slot takes every labelled one',
  );
  assert.equal(
    discover(
      {
        card: {},
        slots: {
          temperature: {
            kind: 'entity',
            discover: { domain: 'sensor', device_class: 'temperature' },
          },
        },
      },
      undefined,
      F,
    )['temperature'],
    'sensor.den_tagged',
    'with no area, the whole home is searched for the label',
  );
  assert.equal(
    find({ domain: 'sensor', device_class: 'temperature' }, 'entity', 'other'),
    'sensor.den_t1',
    'another slot is not affected',
  );
});

const LOCKED: Registries = {
  areas: { hall: { area_id: 'hall', name: 'Hall' } },
  devices: {
    nuki: { id: 'nuki', area_id: 'hall', name: 'Front lock', labels: ['mnml_lock'] },
    multi: { id: 'multi', area_id: 'hall', name: 'Hall sensor', labels: ['mnml_batteries'] },
  },
  entities: {
    'binary_sensor.front_door': { entity_id: 'binary_sensor.front_door', device_id: 'nuki' },
    'lock.front': { entity_id: 'lock.front', device_id: 'nuki' },
    'sensor.front_battery': { entity_id: 'sensor.front_battery', device_id: 'nuki' },
    'sensor.hall_battery': { entity_id: 'sensor.hall_battery', device_id: 'multi' },
    'sensor.hall_temperature': { entity_id: 'sensor.hall_temperature', device_id: 'multi' },
    'sensor.hall_odd': {
      entity_id: 'sensor.hall_odd',
      device_id: 'multi',
      labels: ['mnml_batteries'],
    },
  },
  states: {
    'binary_sensor.front_door': { attributes: { device_class: 'door' } },
    'sensor.front_battery': { attributes: { device_class: 'battery' } },
    'sensor.hall_battery': { attributes: { device_class: 'battery' } },
    'sensor.hall_temperature': { attributes: { device_class: 'temperature' } },
  },
};

test("a device labelled mnml_<slot> gives the slot those of its entities that fit the slot's rule", () => {
  const found = discover(
    {
      card: {},
      slots: {
        lock: { kind: 'entity', discover: { domain: 'lock' } },
        batteries: { kind: 'entities', discover: { domain: 'sensor', device_class: 'battery' } },
      },
    },
    'hall',
    LOCKED,
  );
  assert.equal(found['lock'], 'lock.front', 'not the door sensor of the same device');
  assert.deepEqual(
    found['batteries'],
    ['sensor.hall_battery', 'sensor.hall_odd'],
    "not the temperature beside it, while an entity's own label still counts whatever it is",
  );
});

const K: Registries = {
  areas: { den: { area_id: 'den', name: 'Den', icon: null } },
  devices: {},
  entities: {
    'sensor.a_gone': { entity_id: 'sensor.a_gone', area_id: 'den' },
    'sensor.b_unknown': { entity_id: 'sensor.b_unknown', area_id: 'den' },
    'sensor.c_named': { entity_id: 'sensor.c_named', area_id: 'den', name: 'Probe 2' },
    'sensor.d_main': { entity_id: 'sensor.d_main', area_id: 'den' },
    'sensor.e_diag': { entity_id: 'sensor.e_diag', area_id: 'den', entity_category: 'diagnostic' },
  },
  states: {
    'sensor.b_unknown': { state: 'unknown', attributes: { device_class: 'temperature' } },
    'sensor.c_named': { state: '20', attributes: { device_class: 'temperature' } },
    'sensor.d_main': { state: '21', attributes: { device_class: 'temperature' } },
    'sensor.e_diag': { state: '19', attributes: { device_class: 'temperature' } },
  },
};

function pick(drop: string[] = []): unknown {
  const entities = Object.fromEntries(
    Object.entries(K.entities).filter(([id]) => !drop.includes(id)),
  );
  return discover(
    { card: {}, slots: { t: { kind: 'entity', discover: { domain: 'sensor' } } } },
    'den',
    { ...K, entities },
  )['t'];
}

test('with several matches an entity slot ranks them: a primary category first, then a usable state over a blank one over none, then no name of its own, then the id', () => {
  assert.equal(pick(), 'sensor.d_main', 'primary, usable, no name of its own');
  assert.equal(
    pick(['sensor.d_main']),
    'sensor.c_named',
    'a usable state beats a blank one, though it has a name',
  );
  assert.equal(
    pick(['sensor.d_main', 'sensor.c_named']),
    'sensor.b_unknown',
    'a blank state beats none at all',
  );
  assert.equal(
    pick(['sensor.d_main', 'sensor.c_named', 'sensor.b_unknown']),
    'sensor.a_gone',
    'a primary entity beats a diagnostic one, whatever its state',
  );
  assert.equal(
    pick(['sensor.d_main', 'sensor.c_named', 'sensor.b_unknown', 'sensor.a_gone']),
    'sensor.e_diag',
  );
});

test('an entities slot keeps every match, in the order of their ids', () => {
  assert.deepEqual(
    discover(
      { card: {}, slots: { t: { kind: 'entities', discover: { domain: 'sensor' } } } },
      'den',
      K,
    )['t'],
    ['sensor.a_gone', 'sensor.b_unknown', 'sensor.c_named', 'sensor.d_main', 'sensor.e_diag'],
  );
});

const V: Registries = {
  areas: {
    living: { area_id: 'living', name: 'Living' },
    hall: { area_id: 'hall', name: 'Hall' },
  },
  devices: {
    robo: { id: 'robo', area_id: 'living', name: 'Robo', manufacturer: 'Roborock' },
    dock: { id: 'dock', area_id: 'hall', name: 'Robo dock', via_device_id: 'robo' },
    mini: { id: 'mini', area_id: 'living', name: 'Mini' },
    base: { id: 'base', area_id: 'living', name: 'Mini base', via_device_id: 'mini' },
    far: { id: 'far', area_id: 'hall', name: 'Far' },
    hub: { id: 'hub', area_id: 'hall', name: 'Hub' },
  },
  entities: {
    'vacuum.robo': { entity_id: 'vacuum.robo', device_id: 'robo' },
    'sensor.robo_battery': { entity_id: 'sensor.robo_battery', device_id: 'robo' },
    'sensor.robo_status': {
      entity_id: 'sensor.robo_status',
      device_id: 'robo',
      translation_key: 'status',
    },
    'switch.dock_empty': {
      entity_id: 'switch.dock_empty',
      device_id: 'dock',
      translation_key: 'dust_emptying',
    },
    'sensor.dock_status': {
      entity_id: 'sensor.dock_status',
      device_id: 'dock',
      translation_key: 'status',
    },
    'vacuum.mini': { entity_id: 'vacuum.mini', device_id: 'mini' },
    'switch.base_empty': {
      entity_id: 'switch.base_empty',
      device_id: 'base',
      translation_key: 'dust_emptying',
    },
    'vacuum.far': { entity_id: 'vacuum.far', device_id: 'far' },
    'sensor.hub_battery': { entity_id: 'sensor.hub_battery', device_id: 'hub' },
  },
  states: {
    'sensor.robo_battery': { attributes: { device_class: 'battery' } },
    'sensor.hub_battery': { attributes: { device_class: 'battery' } },
  },
};

const VACUUM_RULE: Rule = {
  device: { domain: 'vacuum' },
  fields: {
    entity: { domain: 'vacuum' },
    status: { translation_key: 'status' },
    battery: { device_class: 'battery' },
    dock: { fields: { empty: { translation_key: 'dust_emptying' } } },
  },
};

const VACUUM_FIELDS = {
  entity: { kind: 'entity', required: true },
  status: { kind: 'entity' },
  battery: { kind: 'entity' },
  dock: { kind: 'object', fields: { empty: { kind: 'entity' } } },
} as const;

function vacuums(
  kind: 'object' | 'objects',
  area: string | undefined,
  registries: Registries = V,
  rule: Rule = VACUUM_RULE,
): unknown {
  return discover(
    { card: {}, slots: { vacuum: { kind, fields: VACUUM_FIELDS, discover: rule } } },
    area,
    registries,
  )['vacuum'];
}

test('a device anchor fills the fields among the device and its via_device relatives, either way round', () => {
  assert.deepEqual(vacuums('objects', 'living'), [
    { entity: 'vacuum.mini', dock: { empty: 'switch.base_empty' } },
    {
      entity: 'vacuum.robo',
      status: 'sensor.robo_status',
      battery: 'sensor.robo_battery',
      dock: { empty: 'switch.dock_empty' },
    },
  ]);
  const flipped: Registries = {
    ...V,
    devices: {
      ...V.devices,
      dock: { id: 'dock', area_id: 'living', name: 'Robo dock' },
      robo: { id: 'robo', area_id: 'living', name: 'Robo', via_device_id: 'dock' },
      mini: { id: 'mini', area_id: 'living', name: 'Mini', via_device_id: 'base' },
      base: { id: 'base', area_id: 'living', name: 'Mini base' },
    },
  };
  assert.deepEqual(vacuums('objects', 'living', flipped), vacuums('objects', 'living'));
});

test('an object slot is filled from a device given, its fields found as its anchor finds them', () => {
  const spec: SlotSpec = { kind: 'object', fields: VACUUM_FIELDS, discover: VACUUM_RULE };
  assert.deepEqual(fromDevice(spec, 'mini', 'living', V), {
    entity: 'vacuum.mini',
    dock: { empty: 'switch.base_empty' },
  });
  assert.deepEqual(fromDevice(spec, 'robo', 'living', V), vacuums('object', 'living'));
  assert.equal(fromDevice(spec, 'hub', 'hall', V), undefined, 'it lacks the required entity');
  assert.equal(
    fromDevice({ kind: 'object', fields: VACUUM_FIELDS }, 'robo', 'living', V),
    undefined,
    'a slot without field rules is not filled',
  );
});

test("a field is taken from the anchor's own device first, and from a relative only when the device has none", () => {
  const found = vacuums('object', 'living');
  assert.ok(isMapping(found));
  assert.equal(found['status'], 'sensor.robo_status', "not the dock's status");
});

test('two devices of a kind give two objects, or the one that fills most for an object slot, never fields of both', () => {
  assert.deepEqual(vacuums('object', 'living'), {
    entity: 'vacuum.robo',
    status: 'sensor.robo_status',
    battery: 'sensor.robo_battery',
    dock: { empty: 'switch.dock_empty' },
  });
  const objects = vacuums('objects', 'living');
  assert.ok(Array.isArray(objects));
  assert.equal(
    JSON.stringify(objects[0]).includes('robo'),
    false,
    "the mini takes nothing of the robo's",
  );
});

test("the anchor device is looked for in the area, or in the whole home with scope: all; a relative's area does not matter", () => {
  assert.deepEqual(vacuums('objects', 'hall'), [{ entity: 'vacuum.far' }]);
  assert.equal(vacuums('object', undefined), undefined, 'without an area, nothing');
  const everywhere = vacuums('objects', undefined, V, { ...VACUUM_RULE, scope: 'all' });
  assert.ok(Array.isArray(everywhere));
  assert.deepEqual(
    everywhere.map((each) => (isMapping(each) ? each['entity'] : undefined)),
    ['vacuum.far', 'vacuum.mini', 'vacuum.robo'],
  );
});

test('an anchor entity with no device makes an object of its own, its fields found on it alone', () => {
  const registries: Registries = {
    areas: { hall: { area_id: 'hall', name: 'Hall' } },
    devices: {},
    entities: {
      'climate.helper': { entity_id: 'climate.helper', area_id: 'hall' },
      'sensor.hall_battery': { entity_id: 'sensor.hall_battery', area_id: 'hall' },
    },
    states: { 'sensor.hall_battery': { attributes: { device_class: 'battery' } } },
  };
  const found = discover(
    {
      card: {},
      slots: {
        heating: {
          kind: 'object',
          fields: { entity: { kind: 'entity' }, battery: { kind: 'entity' } },
          discover: {
            device: { domain: 'climate' },
            fields: { entity: { domain: 'climate' }, battery: { device_class: 'battery' } },
          },
        },
      },
    },
    'hall',
    registries,
  );
  assert.deepEqual(found, { heating: { entity: 'climate.helper' } });
});

const dock = (scope?: 'area'): Rule => ({
  device: { domain: 'vacuum' },
  fields: {
    entity: { domain: 'vacuum' },
    dock: {
      device: { translation_key: 'dock_error' },
      ...(scope === undefined ? {} : { scope }),
      fields: { error: { translation_key: 'dock_error' } },
    },
  },
});

test("inside a device, scope: area searches the device's area: a part that is not linked, or a sensor of another device", () => {
  const registries: Registries = {
    areas: { living: { area_id: 'living', name: 'Living' } },
    devices: {
      robo: { id: 'robo', area_id: 'living', name: 'Robo' },
      station: { id: 'station', area_id: 'living', name: 'Robo station' },
    },
    entities: {
      'vacuum.robo': { entity_id: 'vacuum.robo', device_id: 'robo' },
      'sensor.station_error': {
        entity_id: 'sensor.station_error',
        device_id: 'station',
        translation_key: 'dock_error',
      },
    },
    states: {},
  };
  assert.deepEqual(vacuums('object', 'living', registries, dock()), { entity: 'vacuum.robo' });
  assert.deepEqual(vacuums('object', 'living', registries, dock('area')), {
    entity: 'vacuum.robo',
    dock: { error: 'sensor.station_error' },
  });
});

const STATIONS: Registries = {
  areas: { living: { area_id: 'living', name: 'Living' } },
  devices: {
    alpha: { id: 'alpha', area_id: 'living', name: 'Alpha' },
    beta: { id: 'beta', area_id: 'living', name: 'Beta' },
    station: {
      id: 'station',
      area_id: 'living',
      name: 'Beta station',
      model: 'Dock',
      via_device_id: 'beta',
    },
  },
  entities: {
    'vacuum.alpha': { entity_id: 'vacuum.alpha', device_id: 'alpha' },
    'vacuum.beta': { entity_id: 'vacuum.beta', device_id: 'beta' },
    'sensor.beta_error': { entity_id: 'sensor.beta_error', device_id: 'beta' },
    'switch.station_empty': {
      entity_id: 'switch.station_empty',
      device_id: 'station',
      translation_key: 'dust_emptying',
    },
    'binary_sensor.station_dirty': {
      entity_id: 'binary_sensor.station_dirty',
      device_id: 'station',
    },
  },
  states: { 'binary_sensor.station_dirty': { attributes: { device_class: 'problem' } } },
};

const STATION_RULE: Rule = {
  device: { domain: 'vacuum' },
  fields: {
    entity: { domain: 'vacuum' },
    error: { domain: 'sensor', name: 'error' },
    warnings: { domain: 'binary_sensor', device_class: 'problem' },
    dock: {
      device: { model: 'dock' },
      scope: 'area',
      fields: {
        error: { domain: 'sensor', name: 'error' },
        empty: { translation_key: 'dust_emptying' },
        warnings: { domain: 'binary_sensor', device_class: 'problem' },
      },
    },
  },
};

function stations(registries: Registries = STATIONS): unknown {
  return discover(
    {
      card: {},
      slots: {
        vacuum: {
          kind: 'objects',
          fields: {
            entity: { kind: 'entity', required: true },
            error: { kind: 'entity' },
            warnings: { kind: 'entities' },
            dock: {
              kind: 'object',
              fields: {
                error: { kind: 'entity' },
                empty: { kind: 'entity' },
                warnings: { kind: 'entities' },
              },
            },
          },
          discover: STATION_RULE,
        },
      },
    },
    'living',
    registries,
  )['vacuum'];
}

function stationOf(entity: string, registries: Registries = STATIONS): unknown {
  const found = stations(registries);
  return Array.isArray(found)
    ? found.find((each) => isMapping(each) && each['entity'] === entity)
    : undefined;
}

test('a nested anchor never takes from the device it is inside: the dock has no error of the vacuum', () => {
  assert.deepEqual(stationOf('vacuum.beta'), {
    entity: 'vacuum.beta',
    error: 'sensor.beta_error',
    dock: { empty: 'switch.station_empty', warnings: ['binary_sensor.station_dirty'] },
  });
});

test("the device a nested anchor takes is the anchor's: the vacuum takes none of its dock's warnings", () => {
  const found = stationOf('vacuum.beta');
  assert.ok(isMapping(found));
  assert.equal(found['warnings'], undefined, 'the warnings are listed once, under the dock');
});

test("the area's devices that Home Assistant links to another device are not a nested anchor's", () => {
  assert.deepEqual(stationOf('vacuum.alpha'), { entity: 'vacuum.alpha' }, "not Beta's dock");
  const unlinked: Registries = {
    ...STATIONS,
    devices: {
      ...STATIONS.devices,
      station: { id: 'station', area_id: 'living', name: 'Station', model: 'Dock' },
    },
  };
  assert.deepEqual(stationOf('vacuum.alpha', unlinked), {
    entity: 'vacuum.alpha',
    dock: { empty: 'switch.station_empty', warnings: ['binary_sensor.station_dirty'] },
  });
});

const C: Registries = {
  areas: { den: { area_id: 'den', name: 'Den' } },
  devices: {
    ac: { id: 'ac', area_id: 'den', name: 'AC', manufacturer: 'Daikin', model: 'FTXM25' },
    trv: { id: 'trv', area_id: 'den', name: 'Valve' },
    plug: { id: 'plug', area_id: 'den', name: 'Plug' },
    cloud: { id: 'cloud', area_id: 'den', name: 'Forecast', entry_type: 'service' },
  },
  entities: {
    'climate.ac': { entity_id: 'climate.ac', device_id: 'ac', platform: 'daikin' },
    'climate.valve': { entity_id: 'climate.valve', device_id: 'trv', platform: 'zha' },
    'climate.unknown': { entity_id: 'climate.unknown', area_id: 'den', platform: 'template' },
    'sensor.plug_energy': {
      entity_id: 'sensor.plug_energy',
      device_id: 'plug',
      platform: 'shelly',
    },
    'sensor.plug_daily': {
      entity_id: 'sensor.plug_daily',
      device_id: 'plug',
      platform: 'utility_meter',
    },
    'sensor.forecast': { entity_id: 'sensor.forecast', device_id: 'cloud', platform: 'met' },
  },
  states: {
    'climate.ac': {
      attributes: {
        hvac_modes: ['off', 'heat', 'cool', 'dry'],
        min_temp: 16,
        swing: true,
        fan_speed: '3',
      },
    },
    'climate.valve': { attributes: { hvac_modes: ['off', 'heat'], min_temp: 5 } },
  },
};

function among(filter: Filter): unknown {
  return discover({ card: {}, slots: { x: { kind: 'entities', discover: filter } } }, 'den', C)[
    'x'
  ];
}

test('a filter on an attribute holds for its value, or for a list that contains it, and exclude turns it round', () => {
  assert.deepEqual(among({ domain: 'climate', attribute: { hvac_modes: 'cool' } }), ['climate.ac']);
  assert.deepEqual(among({ domain: 'climate', attribute: { min_temp: '5' } }), ['climate.valve']);
  assert.deepEqual(among({ attribute: { swing: 'true' } }), ['climate.ac']);
  assert.deepEqual(
    among({ domain: 'climate', attribute: { hvac_modes: 'heat', min_temp: '16' } }),
    ['climate.ac'],
    'every attribute must hold',
  );
  assert.deepEqual(
    among({ domain: 'climate', exclude: { attribute: { hvac_modes: 'cool' } } }),
    ['climate.unknown', 'climate.valve'],
    'a climate whose modes are not known lacks cool too',
  );
});

function amongWritten(filter: string): unknown {
  const template: unknown = parse(
    `card: {}\nslots:\n  x: { kind: entities, discover: ${filter} }\n`,
  );
  assert.ok(isTemplate(template));
  return discover(template, 'den', C)['x'];
}

test("an attribute's value written in YAML as a number or a flag is compared as the attribute's type", () => {
  assert.deepEqual(amongWritten('{ domain: climate, attribute: { min_temp: 5 } }'), [
    'climate.valve',
  ]);
  assert.deepEqual(amongWritten('{ attribute: { swing: true } }'), ['climate.ac']);
  assert.deepEqual(
    amongWritten('{ attribute: { fan_speed: 3 } }'),
    ['climate.ac'],
    'a number written holds for an attribute that is that text',
  );
  assert.deepEqual(
    amongWritten("{ attribute: { min_temp: '5.0' } }"),
    ['climate.valve'],
    'a text written holds for an attribute that is that number',
  );
  assert.deepEqual(amongWritten("{ attribute: { fan_speed: '3.0' } }"), undefined);
});

test("a filter on the device: its entry type, maker and model, and the integration of the device's entities", () => {
  assert.deepEqual(among({ entry_type: 'service' }), ['sensor.forecast']);
  assert.deepEqual(among({ domain: 'sensor', entry_type: 'none' }), [
    'sensor.plug_daily',
    'sensor.plug_energy',
  ]);
  assert.deepEqual(among({ manufacturer: 'daikin', model: 'ftxm' }), ['climate.ac']);
  assert.deepEqual(
    among({ integration: 'shelly' }),
    ['sensor.plug_daily', 'sensor.plug_energy'],
    "the utility meter is on the Shelly's device",
  );
  assert.deepEqual(
    among({ integration: 'template' }),
    ['climate.unknown'],
    'a lone entity is its own',
  );
});

test('a device labelled mnml_<slot> fills an object slot with that device, its fields found by the rule', () => {
  const labelled: Registries = {
    ...V,
    devices: {
      ...V.devices,
      mini: { id: 'mini', area_id: 'living', name: 'Mini', labels: ['mnml_vacuum'] },
    },
  };
  assert.deepEqual(vacuums('object', 'living', labelled), {
    entity: 'vacuum.mini',
    dock: { empty: 'switch.base_empty' },
  });
  const both: Registries = {
    ...labelled,
    entities: {
      ...labelled.entities,
      'vacuum.robo': { entity_id: 'vacuum.robo', device_id: 'robo', labels: ['mnml_vacuum'] },
    },
  };
  const objects = vacuums('objects', 'living', both);
  assert.ok(Array.isArray(objects));
  assert.equal(objects.length, 2, "an entity's label names its device");
  assert.deepEqual(
    vacuums('object', 'hall', labelled),
    { entity: 'vacuum.far' },
    'a label in another area does not count',
  );
});

test("the rule's sentence and the panel's words come from one vocabulary", () => {
  assert.equal(
    describe({ domain: 'binary_sensor', device_class: 'window' }),
    `binary_sensor ${filterWords('device_class')} window`,
  );
  assert.equal(
    describe({ domain: 'sensor', translation_key: 'status', entity_category: 'none' }),
    `sensor ${filterWords('translation_key')} status, ${filterWords('entity_category')} primary`,
  );
  assert.equal(
    describe({ domain: 'climate', exclude: { attribute: { hvac_modes: 'cool' } } }),
    'climate but not with attribute hvac_modes cool',
  );
  assert.equal(describe({ label: 'main' }), 'any entity labelled main');
  assert.deepEqual(
    TEXT_FILTERS.map((key) => filterWords(key)),
    [
      'with device class',
      'from the integration',
      'with translation key',
      'in the category',
      'with unit',
      'with state class',
      'named like',
      'made by',
      'of model',
      'on a device of type',
      'on a device of the integration',
      'labelled',
    ],
  );
});
