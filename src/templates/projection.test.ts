import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Templates, Value } from '../contract/templates.ts';

import { TemplateError, expand } from './expand.ts';

const DEVICES: Templates = {
  net: {
    slots: {
      devices: {
        kind: 'objects',
        fields: {
          connected: { kind: 'entity', required: true },
          essential: { kind: 'flag' },
          update: { kind: 'entity' },
          firmware: { kind: 'entities' },
          parts: {
            kind: 'objects',
            fields: { name: { kind: 'text' }, sensors: { kind: 'entities' } },
          },
        },
      },
      outlet: { kind: 'object', fields: { entity: { kind: 'entity' } } },
    },
    card: {
      type: 'x',
      updates: '[[devices.*.update]]',
      'firmware?': '[[devices.*.firmware]]',
      sensors: '[[devices.*.parts.*.sensors]]',
      essential: '[[devices.?essential.connected]]',
      personal: '[[devices.!essential.connected]]',
      entities: ['[[devices.*.update]]', 'binary_sensor.extra'],
      'chips?': [
        { id: 'update', if: 'devices.*.update', name: 'Update' },
        { id: 'quiet', unless: 'devices.*.update', name: 'Quiet' },
        { id: 'offline', if: 'devices.?essential', name: 'Offline' },
      ],
      'names?': [{ each: 'devices.*.parts', as: 'part', if: 'part.name', name: '[[part.name]]' }],
    },
  },
};

function draw(slots: Record<string, Value>): Value {
  return expand(DEVICES, { template: 'net', slots }).card;
}

const ROUTER: Record<string, Value> = {
  connected: 'binary_sensor.router',
  essential: true,
  update: 'binary_sensor.router_update',
  firmware: ['update.router_a', 'update.router_b'],
  parts: [{ name: 'Fan', sensors: ['sensor.router_fan'] }, { sensors: ['sensor.router_cpu'] }],
};

const PHONE = { connected: 'binary_sensor.phone', firmware: ['update.phone'] };

const LAPTOP = { connected: 'binary_sensor.laptop', update: 'binary_sensor.laptop_update' };

test('a * in a path projects it over a list, skipping the elements that lack the rest, in order', () => {
  const card = draw({ devices: [ROUTER, PHONE, LAPTOP] });
  assert.deepEqual(
    card,
    {
      type: 'x',
      updates: ['binary_sensor.router_update', 'binary_sensor.laptop_update'],
      firmware: ['update.router_a', 'update.router_b', 'update.phone'],
      sensors: ['sensor.router_fan', 'sensor.router_cpu'],
      essential: ['binary_sensor.router'],
      personal: ['binary_sensor.phone', 'binary_sensor.laptop'],
      entities: [
        'binary_sensor.router_update',
        'binary_sensor.laptop_update',
        'binary_sensor.extra',
      ],
      chips: [{ name: 'Update' }, { name: 'Offline' }],
      names: [{ name: 'Fan' }],
    },
    'lists flatten, and nested projections and each: over one reach every element',
  );
});

test('a projection over an empty list is an empty list, and over an unfilled slot is unfilled', () => {
  const empty = draw({ devices: [] });
  assert.deepEqual(empty, {
    type: 'x',
    updates: [],
    sensors: [],
    essential: [],
    personal: [],
    entities: ['binary_sensor.extra'],
    chips: [{ name: 'Quiet' }],
  });
  assert.deepEqual(draw({}), {
    type: 'x',
    entities: ['binary_sensor.extra'],
    chips: [{ name: 'Quiet' }],
  });
});

test('if: and unless: hold on a projection while it finds something', () => {
  const card = draw({ devices: [PHONE] });
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  assert.deepEqual(card['chips'], [{ name: 'Quiet' }]);
  assert.deepEqual(card['updates'], []);
  assert.deepEqual(card['essential'], []);
  assert.deepEqual(card['personal'], ['binary_sensor.phone']);
});

function failure(card: Value, slots: Record<string, Value> = { devices: [ROUTER] }): string {
  const templates: Templates = { net: { ...DEVICES['net'], card } };
  try {
    expand(templates, { template: 'net', slots });
  } catch (error) {
    assert.ok(error instanceof TemplateError);
    return error.message;
  }
  return 'no error';
}

test('a projection over what is not a list, a field the elements lack, or inside text is an error', () => {
  assert.equal(
    failure({ type: 'x', entity: '[[outlet.*.entity]]' }, { outlet: { entity: 'switch.a' } }),
    'net at card.entity: outlet is not a list',
  );
  assert.equal(
    failure({ type: 'x', entity: '[[devices.*.updates]]' }),
    'net at card.entity: devices.* has no field named updates',
  );
  assert.equal(
    failure({ type: 'x', entity: '[[devices.?vital.connected]]' }),
    'net at card.entity: devices has no field named vital',
  );
  assert.equal(
    failure({ type: 'x', name: 'Updates: [[devices.*.update]]' }),
    'net at card.name: devices.*.update is not text',
  );
  assert.equal(
    failure({ type: 'x', name: '[[devices.*.update.*]]' }),
    'net at card.name: devices.*.update is not a list',
  );
});

test('keeping the elements of a list of entities or texts by a field is an error naming the path, filled or not', () => {
  const templates: Templates = {
    words: {
      slots: { words: { kind: 'texts' } },
      card: { type: 'x', kept: '[[words.?big]]' },
    },
    loose: {
      slots: { loose: { kind: 'object' } },
      card: { type: 'x', kept: '[[loose.names.!big]]' },
    },
  };
  const message = (template: string, slots: Record<string, Value>): string => {
    try {
      expand(templates, { template, slots });
    } catch (error) {
      assert.ok(error instanceof TemplateError);
      return error.message;
    }
    return 'no error';
  };
  assert.equal(
    failure({ type: 'x', entity: '[[devices.*.firmware.?vital]]' }),
    'net at card.entity: devices.*.firmware is of kind entities, whose elements have no field vital',
  );
  assert.equal(
    failure({ type: 'x', entity: '[[devices.*.firmware.!vital]]' }, {}),
    'net at card.entity: devices.*.firmware is of kind entities, whose elements have no field vital',
  );
  assert.equal(
    message('words', { words: ['a', 'b'] }),
    'words at card.kept: words is of kind texts, whose elements have no field big',
  );
  assert.equal(
    message('loose', { loose: { names: ['a', { big: true }] } }),
    'loose at card.kept: loose.names holds an element that is not an object, so it has no field big',
  );
  assert.deepEqual(expand(templates, { template: 'loose', slots: { loose: { names: [] } } }).card, {
    type: 'x',
    kept: [],
  });
});
