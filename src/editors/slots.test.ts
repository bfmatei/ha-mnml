import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';

import { kept, slotsForm } from './slots.ts';

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

test("a template's slots become a form: kinds to fields, required kept, defaults dropped when unchanged", () => {
  const form = slotsForm(LIGHT.slots ?? {}, 'light');
  assert.equal(form.fields['entity']?.kind, 'entity');
  assert.equal(form.fields['entity']?.required, true);
  assert.deepEqual(form.fields['entity']?.domains, ['light']);
  assert.equal(form.fields['title']?.default, 'Lights');
  assert.equal(form.fields['rows']?.kind, 'parts');
  assert.equal(form.fields['state'], undefined);
  assert.deepEqual(kept(LIGHT.slots ?? {}), ['state']);
});

test("each template's object slots have forms of their own, so a part pastes only where it fits", () => {
  const rows = {
    rows: { kind: 'objects' as const, fields: { entity: { kind: 'entity' as const } } },
  };
  const ofA = slotsForm(rows, 'garden').fields['rows']?.of;
  const ofB = slotsForm(rows, 'patio').fields['rows']?.of;
  assert.ok(ofA && ofB);
  assert.notEqual(ofA.id, ofB.id);
  assert.equal(slotsForm(rows, 'garden').fields['rows']?.of?.id, ofA.id);
});

test('an object slot inside an object slot has a form of its own, and a template overridden with other fields gets other ids', () => {
  const nested = {
    rooms: {
      kind: 'objects' as const,
      fields: {
        lights: { kind: 'objects' as const, fields: { entity: { kind: 'entity' as const } } },
      },
    },
  };
  const rooms = slotsForm(nested, 'home').fields['rooms']?.of;
  assert.ok(rooms?.kind === 'plain');
  const lights = rooms.fields['lights']?.of;
  assert.ok(lights);
  assert.notEqual(lights.id, rooms.id);
  const other = { rows: { kind: 'objects' as const, fields: { name: { kind: 'text' as const } } } };
  const mine = {
    rows: { kind: 'objects' as const, fields: { entity: { kind: 'entity' as const } } },
  };
  assert.notEqual(
    slotsForm(other, 'garden').fields['rows']?.of?.id,
    slotsForm(mine, 'garden').fields['rows']?.of?.id,
  );
});
