import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template, Value } from '../contract/templates.ts';

import { expand } from './expand.ts';
import { SHIPPED } from './shipped.ts';

function drawn(template: string, slots: Record<string, Value>, own: Record<string, Template> = {}) {
  return expand({ ...SHIPPED, ...own }, { template, slots });
}

test('the slots removed while MNML is 0.x are retired on their templates', () => {
  const retired = Object.fromEntries(
    Object.entries(SHIPPED).flatMap(([name, template]) =>
      template.retired === undefined ? [] : [[name, template.retired]],
    ),
  );
  assert.deepEqual(retired, {
    'heating-popup': ['batteries'],
    person: ['activities', 'focuses', 'batteries'],
    room: ['meters', 'heating.batteries'],
    'room-popup': ['meters', 'heating.batteries'],
    'proxmox-server': ['guest_statuses'],
    'proxmox-popup': ['guest_statuses'],
    tailscale: ['essential', 'personal', 'updates', 'direct'],
    'tailscale-popup': ['essential', 'personal'],
  });
});

test('a person card the panel wrote with activities, focuses and batteries draws as a person tile', () => {
  const person = { key: 'alex', entity: 'person.alex' };
  const old = drawn('person', {
    ...person,
    activities: ['sensor.alex_phone_activity'],
    focuses: ['binary_sensor.alex_phone_focus'],
    batteries: ['sensor.alex_phone_battery'],
  });
  assert.deepEqual(old, drawn('person', person));
  assert.ok(typeof old.card === 'object' && old.card !== null && !Array.isArray(old.card));
  assert.equal(old.card['type'], 'custom:mnml-tile-card');
});

test('the system tiles take their retired slots, and draw as without them', () => {
  const devices: Value[] = [
    { connected: 'binary_sensor.router_connected', essential: true },
    { connected: 'binary_sensor.phone_connected', update: 'binary_sensor.phone_client' },
  ];
  assert.deepEqual(
    drawn('tailscale', {
      devices,
      essential: ['binary_sensor.router_connected'],
      personal: ['binary_sensor.phone_connected'],
      updates: ['binary_sensor.phone_client'],
      direct: [],
    }),
    drawn('tailscale', { devices }),
  );
  assert.deepEqual(
    drawn('proxmox-server', { guest_statuses: ['binary_sensor.vm_status'] }),
    drawn('proxmox-server', {}),
  );
});

test("a template of the home's own that passes retired slots to shipped pop-ups draws", () => {
  const room: Template = {
    slots: {
      key: { kind: 'text', required: true },
      name: { kind: 'text', required: true },
      meters: { kind: 'objects', fields: { power: { kind: 'entity' } } },
      heating: {
        kind: 'object',
        fields: { entity: { kind: 'entity' }, batteries: { kind: 'entities' } },
      },
    },
    card: { type: 'custom:mnml-tile-card', name: '[[name]]', popup: '#[[key]]' },
    popups: [
      {
        template: 'room-popup',
        slots: { key: '[[key]]', name: '[[name]]', meters: '[[meters]]', heating: '[[heating]]' },
      },
      {
        template: 'heating-popup',
        slots: {
          key: '[[key]]',
          name: '[[name]]',
          entity: '[[heating.entity]]',
          batteries: '[[heating.batteries]]',
        },
      },
    ],
  };
  const tailscale: Template = {
    slots: {
      devices: { kind: 'objects' },
      essential: { kind: 'entities' },
      personal: { kind: 'entities' },
    },
    card: { type: 'custom:mnml-tile-card', name: 'Tailscale' },
    popups: [
      {
        template: 'tailscale-popup',
        slots: {
          devices: '[[devices]]',
          essential: '[[essential]]',
          personal: '[[personal]]',
        },
      },
    ],
  };
  const own = { room, tailscale };
  const hall = { key: 'hall', name: 'Hall', heating: { entity: 'climate.hall' } };
  assert.deepEqual(
    drawn(
      'room',
      {
        ...hall,
        meters: [{ power: 'sensor.hall_power' }],
        heating: { entity: 'climate.hall', batteries: ['sensor.valve_battery'] },
      },
      own,
    ),
    drawn('room', hall, own),
  );
  const devices = [{ connected: 'binary_sensor.router_connected' }];
  assert.deepEqual(
    drawn(
      'tailscale',
      { devices, essential: ['binary_sensor.router_connected'], personal: [] },
      own,
    ),
    drawn('tailscale', { devices }, own),
  );
});
