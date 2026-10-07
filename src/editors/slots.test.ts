import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';

import { drawsCard, kept, previewConfig, slotsShape } from './slots.ts';

const LIGHT: Template = {
  description: 'A light',
  slots: {
    entity: { kind: 'entity', required: true, discover: { domain: 'light' } },
    title: { kind: 'text', default: 'Lights' },
    rows: { kind: 'objects', fields: { entity: { kind: 'entity' } } },
    state: { kind: 'objects' },
  },
  card: { type: 'custom:mnml-entity-card', entity: '[[entity]]' },
  example: { entity: 'light.example' },
};

test("a template's slots become a shape: kinds to fields, required kept, defaults dropped when unchanged", () => {
  const shape = slotsShape(LIGHT.slots ?? {}, 'light');
  assert.equal(shape.fields['entity']?.kind, 'entity');
  assert.equal(shape.fields['entity']?.required, true);
  assert.deepEqual(shape.fields['entity']?.domains, ['light']);
  assert.equal(shape.fields['title']?.default, 'Lights');
  assert.equal(shape.fields['rows']?.kind, 'parts');
  assert.equal(shape.fields['state'], undefined);
  assert.deepEqual(kept(LIGHT.slots ?? {}), ['state']);
});

const home = {
  areas: { hall: { area_id: 'hall', name: 'Hall' }, den: { area_id: 'den', name: 'Den' } },
  devices: {},
  entities: { 'light.den': { entity_id: 'light.den', area_id: 'den' } },
  states: { 'light.den': { entity_id: 'light.den', state: 'on', attributes: {} } },
};

test('a preview fills its template from the first area that fills every required slot, else from its example', () => {
  assert.deepEqual(previewConfig('light', LIGHT, home as never), {
    type: 'custom:mnml-template-card',
    template: 'light',
    area: 'den',
  });
  assert.deepEqual(previewConfig('light', LIGHT, { ...home, entities: {}, states: {} } as never), {
    type: 'custom:mnml-template-card',
    template: 'light',
    slots: { entity: 'light.example' },
  });
});

test('only a template whose card has a type of its own is previewed', () => {
  assert.equal(drawsCard(LIGHT), true);
  assert.equal(drawsCard({ card: { type: '[[kind]]' } }), false);
  assert.equal(drawsCard({ card: [{ entity: '[[entity]]' }] }), false);
});

test("each template's object slots have shapes of their own, so a part pastes only where it fits", () => {
  const rows = {
    rows: { kind: 'objects' as const, fields: { entity: { kind: 'entity' as const } } },
  };
  const ofA = slotsShape(rows, 'garden').fields['rows']?.of;
  const ofB = slotsShape(rows, 'patio').fields['rows']?.of;
  assert.ok(ofA && ofB);
  assert.notEqual(ofA.id, ofB.id);
  assert.equal(slotsShape(rows, 'garden').fields['rows']?.of?.id, ofA.id);
});

test('an object slot inside an object slot has a shape of its own, and a template overridden with other fields gets other ids', () => {
  const nested = {
    rooms: {
      kind: 'objects' as const,
      fields: {
        lights: { kind: 'objects' as const, fields: { entity: { kind: 'entity' as const } } },
      },
    },
  };
  const rooms = slotsShape(nested, 'home').fields['rooms']?.of;
  assert.ok(rooms?.kind === 'plain');
  const lights = rooms.fields['lights']?.of;
  assert.ok(lights);
  assert.notEqual(lights.id, rooms.id);
  const other = { rows: { kind: 'objects' as const, fields: { name: { kind: 'text' as const } } } };
  const mine = {
    rows: { kind: 'objects' as const, fields: { entity: { kind: 'entity' as const } } },
  };
  assert.notEqual(
    slotsShape(other, 'garden').fields['rows']?.of?.id,
    slotsShape(mine, 'garden').fields['rows']?.of?.id,
  );
});

test('a template that draws a control, such as a chip, is a part and has no preview', () => {
  assert.equal(
    drawsCard({ card: { type: 'nav', entity: '[[entity]]', popup: '[[popup]]' } }),
    false,
  );
  assert.equal(drawsCard({ card: { type: 'toggle', entity: '[[entity]]' } }), false);
});

test('a preview prefers an area where discovery finds more than the required slots', () => {
  const roomish: Template = {
    slots: {
      key: { kind: 'text', required: true, discover: 'area.id' },
      lamp: { kind: 'entity', discover: { domain: 'light' } },
    },
    card: { type: 'custom:mnml-heading-card', title: '[[key]]', icon: 'mdi:sofa' },
  };
  assert.deepEqual(previewConfig('roomish', roomish, home as never), {
    type: 'custom:mnml-template-card',
    template: 'roomish',
    area: 'den',
  });
});
