import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';
import { applyChanges, baseOf, changesOf } from '../templates/changes.ts';

import { entryOf, roundTrips, storedAs } from './data.ts';

const ROOM: Template = {
  description: 'A room.',
  slots: { name: { kind: 'text' }, window: { kind: 'flag' }, lock: { kind: 'flag' } },
  card: {
    type: 'custom:mnml-tile-card',
    name: '[[name]]',
    'chips?': [
      { id: 'window', if: 'window', type: 'indicator', color: 'orange' },
      { id: 'lock', if: 'lock', type: 'toggle', color: 'red' },
    ],
  },
};

const edited = (change: (template: Template) => void): Template => {
  const copy = structuredClone(ROOM);
  change(copy);
  return copy;
};
const chips = (template: Template): Record<string, unknown>[] =>
  (template.card as { 'chips?': Record<string, unknown>[] })['chips?'];

test("a template of the home's own is saved whole", () => {
  assert.deepEqual(entryOf('room', ROOM, undefined), { kind: 'own', template: ROOM });
});

test('a shipped template left as it was saves no change, so an edit undone resets it', () => {
  assert.equal(entryOf('room', structuredClone(ROOM), ROOM), undefined);
  const recoloured = edited((template) => {
    Object.assign(chips(template)[1] ?? {}, { color: 'amber' });
  });
  const entry = entryOf('room', recoloured, ROOM);
  assert.equal(entry?.kind, 'changes');
  assert.equal(
    entryOf('room', structuredClone(ROOM), ROOM),
    undefined,
    'and back to the shipped one',
  );
});

test('a shipped template edited is saved as the changes that turn the shipped one into the draft', () => {
  const draft = edited((template) => {
    chips(template).splice(1, 1);
    Object.assign(template.card as object, { name: 'Hall' });
  });
  const entry = entryOf('room', draft, ROOM);
  assert.ok(entry?.kind === 'changes');
  assert.deepEqual(applyChanges(ROOM, entry.changes).template, draft);
});

test('a customised template whose part a release removed saves only the changes that still apply', () => {
  const recolour = {
    op: 'set',
    path: ['card', 'chips?', '#lock'],
    key: 'color',
    value: 'amber',
    base: '',
  } as const;
  const rename = { op: 'set', path: ['card'], key: 'name', value: 'Hall', base: '' } as const;
  const changes = [
    { ...recolour, base: baseOf(ROOM, recolour) },
    { ...rename, base: baseOf(ROOM, rename) },
  ];
  const released = edited((template) => {
    chips(template).splice(1, 1);
  });
  const { template: draft, conflicts } = applyChanges(released, changes);
  assert.deepEqual(conflicts, [{ index: 0, reason: 'gone' }]);
  const entry = entryOf('room', draft, released);
  assert.ok(entry?.kind === 'changes');
  assert.deepEqual(entry.changes, changesOf(released, draft));
  assert.deepEqual(
    entry.changes.map((change) => change.op === 'set' && change.key),
    ['name'],
  );
});

test('a draft whose changes would not give it back, such as two parts with one id, is not kept as those changes', () => {
  const twice = edited((template) => {
    chips(template).push({ id: 'lock', if: 'lock', type: 'toggle', color: 'blue' });
  });
  const entry = entryOf('room', twice, ROOM);
  assert.equal(roundTrips('room', entry, twice, ROOM), false);
  const fine = edited((template) => {
    Object.assign(chips(template)[1] ?? {}, { color: 'amber' });
  });
  assert.equal(roundTrips('room', entryOf('room', fine, ROOM), fine, ROOM), true);
  assert.equal(roundTrips('room', undefined, structuredClone(ROOM), ROOM), true);
});

test('a save that would store what MNML keeps already is not sent', () => {
  const recolour = edited((template) => {
    Object.assign(chips(template)[1] ?? {}, { color: 'amber' });
  });
  const entry = entryOf('room', recolour, ROOM);
  assert.ok(entry?.kind === 'changes');
  assert.equal(storedAs(entry, { own: {}, changes: { room: entry.changes } }, 'room'), true);
  assert.equal(storedAs(entry, { own: {}, changes: {} }, 'room'), false);
  assert.equal(
    storedAs(
      { kind: 'own', template: ROOM },
      { own: { room: structuredClone(ROOM) }, changes: {} },
      'room',
    ),
    true,
  );
  assert.equal(
    storedAs(undefined, { own: {}, changes: {} }, 'room'),
    true,
    'no entry and none kept',
  );
});
