import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';

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
