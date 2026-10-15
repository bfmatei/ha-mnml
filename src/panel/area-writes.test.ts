import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Suggestion } from '../builder/areas.ts';
import type { Registries } from '../ha/registries.ts';

import { assignAreas, isEmptyUndo, joinedUndo, undoAreas } from './area-writes.ts';
import type { Call } from './building.ts';

const HOME: Registries = {
  areas: { kitchen: { area_id: 'kitchen', name: 'Kitchen' } },
  devices: { hue: { id: 'hue', name: 'Hue', area_id: null } },
  entities: {
    'sensor.office_door': { entity_id: 'sensor.office_door' },
    'light.kitchen': { entity_id: 'light.kitchen' },
  },
  states: {},
};

const PICKED: Suggestion[] = [
  { kind: 'device', id: 'hue', name: 'Hue', to: { create: 'Office' }, by: 'entities' },
  {
    kind: 'entity',
    id: 'sensor.office_door',
    name: 'Door',
    to: { create: 'Office' },
    by: 'name',
  },
  { kind: 'entity', id: 'light.kitchen', name: 'Kitchen', to: { area: 'kitchen' }, by: 'name' },
];

type Message = Parameters<Call>[0];

function recorder(refuse: (message: Message) => boolean = () => false): {
  call: Call;
  sent: Message[];
} {
  const sent: Message[] = [];
  return {
    sent,
    call: (message) => {
      sent.push(message);
      if (refuse(message)) {
        return Promise.reject(new Error(`No ${message.type}`));
      }
      return Promise.resolve(
        message.type === 'config/area_registry/create'
          ? { area_id: String(message['name']).toLowerCase(), name: message['name'] }
          : null,
      );
    },
  };
}

test('assigning makes each new area once, then places each device and entity in its area, and keeps what each was before', async () => {
  const { call, sent } = recorder();
  const { undo, failure } = await assignAreas(call, PICKED, HOME);
  assert.equal(failure, undefined);
  assert.deepEqual(sent, [
    { type: 'config/area_registry/create', name: 'Office' },
    { type: 'config/device_registry/update', device_id: 'hue', area_id: 'office' },
    { type: 'config/entity_registry/update', entity_id: 'sensor.office_door', area_id: 'office' },
    { type: 'config/entity_registry/update', entity_id: 'light.kitchen', area_id: 'kitchen' },
  ]);
  assert.deepEqual(undo, {
    created: ['office'],
    devices: [{ id: 'hue', area: null }],
    entities: [
      { id: 'sensor.office_door', area: null },
      { id: 'light.kitchen', area: null },
    ],
  });
});

test('undo puts every device and entity back, then deletes the areas it made', async () => {
  const { call, sent } = recorder();
  const { undo } = await assignAreas(call, PICKED, HOME);
  sent.length = 0;
  assert.equal(await undoAreas(call, undo), undefined);
  assert.deepEqual(sent, [
    { type: 'config/device_registry/update', device_id: 'hue', area_id: null },
    { type: 'config/entity_registry/update', entity_id: 'sensor.office_door', area_id: null },
    { type: 'config/entity_registry/update', entity_id: 'light.kitchen', area_id: null },
    { type: 'config/area_registry/delete', area_id: 'office' },
  ]);
});

test('an area Home Assistant refuses to make stops before anything is placed, and says why', async () => {
  const { call, sent } = recorder((message) => message.type === 'config/area_registry/create');
  const { undo, failure } = await assignAreas(call, PICKED, HOME);
  assert.equal(failure, 'No config/area_registry/create');
  assert.ok(isEmptyUndo(undo));
  assert.equal(sent.length, 1);
});

test('a placement refused part way keeps the record of what was written, so undo still puts it back', async () => {
  const { call } = recorder((message) => message['entity_id'] === 'light.kitchen');
  const { undo, failure } = await assignAreas(call, PICKED, HOME);
  assert.equal(failure, 'No config/entity_registry/update');
  assert.deepEqual(undo.created, ['office']);
  assert.deepEqual(
    undo.entities.map(({ id }) => id),
    ['sensor.office_door'],
  );
  assert.ok(!isEmptyUndo(undo));
});

test('an undo that cannot put a device back keeps the areas it made, and says why', async () => {
  const { call } = recorder();
  const { undo } = await assignAreas(call, PICKED, HOME);
  const refusing = recorder((message) => message.type === 'config/device_registry/update');
  assert.equal(await undoAreas(refusing.call, undo), 'No config/device_registry/update');
  assert.ok(!refusing.sent.some((message) => message.type === 'config/area_registry/delete'));
});

test('two assigns in one session undo to what was before the first', () => {
  const first = {
    created: ['office'],
    devices: [{ id: 'lamp', area: null }],
    entities: [{ id: 'light.porch', area: null }],
  };
  const then = {
    created: ['hall'],
    devices: [
      { id: 'lamp', area: 'office' },
      { id: 'fan', area: 'kitchen' },
    ],
    entities: [],
  };
  assert.equal(joinedUndo(undefined, then), then);
  assert.deepEqual(joinedUndo(first, then), {
    created: ['office', 'hall'],
    devices: [
      { id: 'lamp', area: null },
      { id: 'fan', area: 'kitchen' },
    ],
    entities: [{ id: 'light.porch', area: null }],
  });
});
