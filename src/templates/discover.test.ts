import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Rule, Template } from '../contract/templates.ts';

import { discover } from './discover.ts';
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
