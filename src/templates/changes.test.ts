import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';

import { applyChanges, baseOf, changesOf, isChange, nodeHash } from './changes.ts';
import type { Change } from './changes.ts';

const ROOM: Template = {
  description: 'A room.',
  card: {
    type: 'custom:mnml-tile-card',
    name: '[[name]]',
    'chips?': [
      { id: 'window', if: 'window', type: 'indicator', color: 'orange' },
      { id: 'lock', if: 'lock', type: 'toggle', color: 'red' },
      { id: 'ac', if: 'ac', template: 'nav-chip' },
    ],
  },
};

const chips = (template: Template): string[] => {
  const card = template.card as { 'chips?': { id: string }[] };
  return card['chips?'].map((chip) => chip.id);
};
const chip = (template: Template, id: string): Record<string, unknown> | undefined =>
  (template.card as { 'chips?': Record<string, unknown>[] })['chips?'].find(
    (each) => each['id'] === id,
  );
const based = (change: Change, template: Template = ROOM): Change => ({
  ...change,
  base: baseOf(template, change),
});

test('a set changes one key of a part, and leaves the shipped template as it was', () => {
  const path = ['card', 'chips?', '#lock'];
  const change = based({ op: 'set', path, key: 'color', value: 'amber', base: '' });
  const { template, conflicts } = applyChanges(ROOM, [change]);
  assert.equal(chip(template, 'lock')?.['color'], 'amber');
  assert.equal(chip(ROOM, 'lock')?.['color'], 'red');
  assert.deepEqual(conflicts, []);
});

test('a remove takes a part, or a key, away', () => {
  const lock = ['card', 'chips?', '#lock'];
  const name = ['card', 'name'];
  const { template, conflicts } = applyChanges(ROOM, [
    based({ op: 'remove', path: lock, base: '' }),
    based({ op: 'remove', path: name, base: '' }),
  ]);
  assert.deepEqual(chips(template), ['window', 'ac']);
  assert.ok(!Object.hasOwn(template.card as object, 'name'));
  assert.deepEqual(conflicts, []);
});

test('an insert puts a part after another, or first, and a move reorders', () => {
  const list = ['card', 'chips?'];
  const { template, conflicts } = applyChanges(ROOM, [
    based({
      op: 'insert',
      path: list,
      after: 'window',
      value: { id: 'door', type: 'indicator' },
      base: '',
    }),
    based({
      op: 'insert',
      path: list,
      after: null,
      value: { id: 'first', type: 'indicator' },
      base: '',
    }),
    based({ op: 'move', path: list, id: 'ac', after: 'first', base: '' }),
  ]);
  assert.deepEqual(chips(template), ['first', 'ac', 'window', 'door', 'lock']);
  assert.deepEqual(conflicts, []);
});

test('a change whose part a release took away is gone and skipped, and the rest applies', () => {
  const gone = ['card', 'chips?', '#heating'];
  const lock = ['card', 'chips?', '#lock'];
  const { template, conflicts } = applyChanges(ROOM, [
    { op: 'set', path: gone, key: 'color', value: 'blue', base: 'x' },
    based({ op: 'remove', path: lock, base: '' }),
  ]);
  assert.deepEqual(conflicts, [{ index: 0, reason: 'gone' }]);
  assert.deepEqual(chips(template), ['window', 'ac']);
});

test('a change to a part a release changed still applies, marked changed', () => {
  const lock = ['card', 'chips?', '#lock'];
  const { template, conflicts } = applyChanges(ROOM, [
    { op: 'set', path: lock, key: 'color', value: 'amber', base: 'from-an-older-release' },
  ]);
  assert.equal(chip(template, 'lock')?.['color'], 'amber');
  assert.deepEqual(conflicts, [{ index: 0, reason: 'changed' }]);
});

test('a node hash does not depend on the order of keys', () => {
  assert.equal(
    nodeHash({ a: 1, b: [2, { c: 3, d: 4 }] }),
    nodeHash({ b: [2, { d: 4, c: 3 }], a: 1 }),
  );
  assert.notEqual(nodeHash({ a: 1 }), nodeHash({ a: 2 }));
});

test('two changes to the same part, or a remove and a set beside it, are neither a conflict', () => {
  const lock = ['card', 'chips?', '#lock'];
  const { conflicts } = applyChanges(ROOM, [
    based({ op: 'set', path: lock, key: 'color', value: 'amber', base: '' }),
    based({ op: 'set', path: lock, key: 'icon', value: 'mdi:lock', base: '' }),
    based({ op: 'remove', path: ['card', 'chips?', '#window'], base: '' }),
    based({ op: 'set', path: ['card'], key: 'name', value: 'Hall', base: '' }),
  ]);
  assert.deepEqual(conflicts, []);
});

test('a set is judged by the key it sets: a release that changes another part is no conflict, one that changes that key is', () => {
  const change = based({ op: 'set', path: ['card'], key: 'name', value: 'Hall', base: '' });
  const recoloured = structuredClone(ROOM);
  Object.assign(chip(recoloured, 'lock') ?? {}, { color: 'blue' });
  assert.deepEqual(applyChanges(recoloured, [change]).conflicts, []);
  const renamed = structuredClone(ROOM);
  Object.assign(renamed.card as object, { name: '[[title]]' });
  assert.deepEqual(applyChanges(renamed, [change]).conflicts, [{ index: 0, reason: 'changed' }]);
});

test('a move or an insert is judged by the order of the parts, not by what is inside them', () => {
  const list = ['card', 'chips?'];
  const change = based({ op: 'move', path: list, id: 'ac', after: null, base: '' });
  const recoloured = structuredClone(ROOM);
  Object.assign(chip(recoloured, 'lock') ?? {}, { color: 'blue' });
  assert.deepEqual(applyChanges(recoloured, [change]).conflicts, []);
  const grown = structuredClone(ROOM);
  (grown.card as { 'chips?': unknown[] })['chips?'].push({ id: 'door', type: 'indicator' });
  assert.deepEqual(applyChanges(grown, [change]).conflicts, [{ index: 0, reason: 'changed' }]);
});

test('a change of the wrong shape for its op is not a change', () => {
  const path = ['card', 'chips?'];
  for (const wrong of [
    { op: 'set', path: ['card'], value: 'x', base: 'b' },
    { op: 'set', path: ['card'], key: 'name', base: 'b' },
    { op: 'insert', path, after: null, value: 'chip', base: 'b' },
    { op: 'insert', path, after: null, value: { type: 'indicator' }, base: 'b' },
    { op: 'insert', path, value: { id: 'door' }, base: 'b' },
    { op: 'move', path, after: null, base: 'b' },
    { op: 'move', path, id: 'ac', after: 3, base: 'b' },
    { op: 'remove', path: [], base: 'b' },
    { op: 'set', path: ['__proto__'], key: 'polluted', value: true, base: 'b' },
    { op: 'set', path: ['card'], key: 'constructor', value: true, base: 'b' },
    { op: 'remove', path: ['card', ''], base: 'b' },
    { op: 'remove', path: ['card'], base: 'b' },
    { op: 'move', path, id: 'ac', after: 'ac', base: 'b' },
  ]) {
    assert.equal(isChange(wrong), false, JSON.stringify(wrong));
  }
  for (const right of [
    { op: 'set', path: ['card'], key: 'name', value: null, base: 'b' },
    { op: 'remove', path: ['card', 'name'], base: 'b' },
    { op: 'insert', path, after: 'lock', value: { id: 'door' }, base: 'b' },
    { op: 'move', path, id: 'ac', after: null, base: 'b' },
  ]) {
    assert.equal(isChange(right), true, JSON.stringify(right));
  }
});

test('a path through __proto__ reaches nothing, and the prototype stays as it was', () => {
  applyChanges(ROOM, [
    { op: 'set', path: ['__proto__'], key: 'polluted', value: true, base: '' },
    { op: 'set', path: ['card', '__proto__'], key: 'polluted', value: true, base: '' },
  ]);
  assert.equal(Reflect.get({}, 'polluted'), undefined);
});

test('the changes worked out from an edit lay back over the shipped template to give the edit', () => {
  const edited: Template = {
    description: 'A room, mine.',
    card: {
      type: 'custom:mnml-tile-card',
      'chips?': [
        { id: 'door', type: 'indicator' },
        { id: 'ac', if: 'ac', template: 'nav-chip' },
        { id: 'window', if: 'window', type: 'indicator', color: 'amber' },
      ],
      icon: 'mdi:sofa',
    },
  };
  const changes = changesOf(ROOM, edited);
  assert.deepEqual(applyChanges(ROOM, changes), { template: edited, conflicts: [] });
  assert.deepEqual(
    changes.map((change) => change.op),
    ['set', 'remove', 'insert', 'move', 'set', 'set', 'remove'],
  );
  assert.ok(changes.every(isChange));
});

test('an unchanged template gives no change', () => {
  assert.deepEqual(changesOf(ROOM, structuredClone(ROOM)), []);
});

test('an insert whose id a release has since given a part of its own is left out, and says so', () => {
  const list = ['card', 'chips?'];
  const insert = based({
    op: 'insert',
    path: list,
    after: null,
    value: { id: 'door', type: 'indicator' },
    base: '',
  });
  const released = structuredClone(ROOM);
  (released.card as { 'chips?': unknown[] })['chips?'].push({ id: 'door', type: 'toggle' });
  const { template, conflicts } = applyChanges(released, [insert]);
  assert.deepEqual(conflicts, [{ index: 0, reason: 'taken' }]);
  assert.deepEqual(chips(template), ['window', 'lock', 'ac', 'door']);
});

test('a key set to null where the shipped template has none is a change, and lays back over', () => {
  const edited = structuredClone(ROOM);
  Object.assign(edited.card as object, { tap_action: null });
  const changes = changesOf(ROOM, edited);
  assert.deepEqual(
    changes.map((change) => [change.op, change.op === 'set' ? change.key : '']),
    [['set', 'tap_action']],
  );
  assert.deepEqual(applyChanges(ROOM, changes).template, edited);
});
