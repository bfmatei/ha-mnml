import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/plan.ts';

import {
  changesIn,
  movedBy,
  planChanges,
  slotsWith,
  trimmed,
  withDeclared,
  withDevice,
  withGlances,
  sectionsWithLook,
  withOrder,
  withoutDevice,
} from './plan-edits.ts';

const PLAN: Plan = {
  title: 'Home',
  icon: 'mdi:home-variant',
  rooms: [{ area: 'kitchen', slots: { name: 'Cook', lights: [] } }, { area: 'hall' }],
  people: [],
  cars: [],
  system: [],
  open: {},
};

test('a row moves up or down by one, and stays where it is at either end', () => {
  assert.deepEqual(movedBy(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(movedBy(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  assert.deepEqual(movedBy(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(movedBy(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
});

test("a section's look keeps only what differs from its default, and an icon only once it is one", () => {
  assert.deepEqual(sectionsWithLook(PLAN, 'rooms', { title: 'Spaces', icon: 'mdi:floor-plan' }), {
    rooms: { title: 'Spaces' },
  });
  assert.deepEqual(sectionsWithLook(PLAN, 'rooms', { icon: 'floor' }), undefined);
  assert.deepEqual(
    sectionsWithLook({ ...PLAN, sections: { people: { title: 'Us' } } }, 'rooms', {
      template: 'room',
    }),
    { people: { title: 'Us' } },
  );
});

test('a template changed drops the slots of the rows it does not declare', () => {
  assert.deepEqual(withDeclared(PLAN, 'rooms', new Set(['name'])).rooms, [
    { area: 'kitchen', slots: { name: 'Cook' } },
    { area: 'hall' },
  ]);
  assert.deepEqual(withDeclared(PLAN, 'rooms', new Set()).rooms, [
    { area: 'kitchen' },
    { area: 'hall' },
  ]);
});

test('the order is kept only when it is not the default, and titles are trimmed when saved', () => {
  assert.equal(
    withOrder(PLAN, ['rooms', 'devices', 'people', 'garage', 'system']).order,
    undefined,
  );
  assert.deepEqual(withOrder(PLAN, ['people', 'rooms', 'devices', 'garage', 'system']).order, [
    'people',
    'rooms',
    'devices',
    'garage',
    'system',
  ]);
  assert.deepEqual(trimmed({ rooms: { title: '  Spaces ' }, people: { title: ' ' } }), {
    rooms: { title: 'Spaces' },
  });
});

test('a template changed keeps a spelled row spelled, with the slots it declares', () => {
  const plan: Plan = {
    ...PLAN,
    rooms: [{ slots: { name: 'Office', lights: [] }, spelled: true }],
    people: [{ entity: 'person.jane', slots: { key: 'jane', low: 30 }, spelled: true }],
  };
  assert.deepEqual(withDeclared(plan, 'rooms', new Set(['lights'])).rooms, [
    { slots: { lights: [] }, spelled: true },
  ]);
  assert.deepEqual(withDeclared(plan, 'people', new Set(['name'])).people, [
    { entity: 'person.jane', slots: {}, spelled: true },
  ]);
});

test('the Glances strip shown keeps what it had, and hidden is left out', () => {
  assert.deepEqual(withGlances(PLAN, true).glances, {});
  const kept = { slots: { weather: 'weather.home' } };
  assert.deepEqual(withGlances({ ...PLAN, glances: kept }, true).glances, kept);
  assert.equal('glances' in withGlances({ ...PLAN, glances: kept }, false), false);
});

test('a device ticked takes its place in the listed order, a card switched stays in place, and none left is no key', () => {
  const listed = ['ac', 'vacuum', 'tv', 'printer'];
  const tv = { device: 'tv', template: 'media-card' };
  const printer = { device: 'printer', template: '3d-printer-card' };
  const one = withDevice({ ...PLAN, devices: [tv] }, printer, listed);
  assert.deepEqual(one.devices, [tv, printer]);
  const two = withDevice(one, { device: 'ac', template: 'ac-item' }, listed);
  assert.deepEqual(two.devices, [{ device: 'ac', template: 'ac-item' }, tv, printer]);
  const camera = withDevice(two, { device: 'printer', template: 'camera-card' }, listed);
  assert.deepEqual(camera.devices?.at(-1), { device: 'printer', template: 'camera-card' });
  assert.equal(camera.devices?.length, 3);
  const gone = { device: 'gone', template: 'vacuum-card' };
  assert.deepEqual(
    withDevice({ ...PLAN, devices: [gone] }, { device: 'vacuum', template: 'vacuum-card' }, listed)
      .devices,
    [gone, { device: 'vacuum', template: 'vacuum-card' }],
  );
  assert.deepEqual(withDevice(PLAN, tv, listed).devices, [tv]);
  assert.deepEqual(withoutDevice(two, 'tv').devices, [
    { device: 'ac', template: 'ac-item' },
    printer,
  ]);
  assert.equal('devices' in withoutDevice({ ...PLAN, devices: [tv] }, 'tv'), false);
});

test('the changes from what was built count each field and each row once, and a new order once', () => {
  assert.equal(planChanges(PLAN, structuredClone(PLAN)), 0);
  assert.equal(planChanges(PLAN, { ...PLAN, title: 'Flat' }), 1);
  assert.equal(planChanges(PLAN, { ...PLAN, title: ' Home ', sections: { rooms: {} } }), 0);
  const rooms = [{ area: 'kitchen' }, { area: 'living', slots: { name: 'Lounge' } }];
  assert.equal(
    planChanges({ ...PLAN, rooms: [{ area: 'living' }, { area: 'kitchen' }] }, { ...PLAN, rooms }),
    2,
  );
  assert.equal(
    planChanges(
      { ...PLAN, rooms: [{ area: 'living' }, { area: 'kitchen' }] },
      { ...PLAN, rooms: [{ area: 'living' }], system: [{ template: 'adguard' }] },
    ),
    2,
  );
  const tv = { device: 'tv', template: 'media-card' };
  assert.equal(planChanges(PLAN, { ...PLAN, devices: [] }), 0);
  assert.equal(planChanges(PLAN, { ...PLAN, devices: [tv] }), 1);
  assert.equal(
    planChanges(
      { ...PLAN, devices: [tv, { device: 'ac', template: 'ac-item' }] },
      {
        ...PLAN,
        devices: [
          { device: 'ac', template: 'ac-item' },
          { ...tv, template: 'tv' },
        ],
      },
    ),
    2,
  );
});

test("a row's slot is written, set to none, or dropped, and no slot left leaves no slots", () => {
  assert.deepEqual(slotsWith(undefined, 'ac', null), { ac: null });
  assert.deepEqual(slotsWith({ name: 'Cook' }, 'temperature', 'sensor.a'), {
    name: 'Cook',
    temperature: 'sensor.a',
  });
  assert.deepEqual(slotsWith({ name: 'Cook', ac: null }, 'ac', undefined), { name: 'Cook' });
  assert.equal(slotsWith({ ac: null }, 'ac', undefined), undefined);
});

test('the changes since the build are listed by field, by row with its name, and by a new order', () => {
  const tv = { device: 'tv', template: 'media-card' };
  const before: Plan = { ...PLAN, devices: [tv], system: [{ template: 'adguard' }] };
  const after: Plan = {
    ...PLAN,
    title: 'Flat',
    rooms: [{ area: 'hall' }, { area: 'kitchen', slots: { name: 'Cook' } }, { area: 'attic' }],
    system: [],
  };
  const names = {
    rooms: (room: { area?: string }) => `room ${room.area ?? ''}`,
    devices: ({ device }: { device: string }) => `device ${device}`,
    people: ({ entity }: { entity: string }) => entity,
    garage: ({ key }: { key: string }) => key,
    system: ({ template }: { template: string }) => `system ${template}`,
  };
  assert.deepEqual(changesIn(before, after, names), [
    { field: 'title' },
    { section: 'rooms', name: 'room kitchen', how: 'changed' },
    { section: 'rooms', name: 'room attic', how: 'added' },
    { section: 'rooms', how: 'moved' },
    { section: 'devices', name: 'device tv', how: 'removed' },
    { section: 'system', name: 'system adguard', how: 'removed' },
  ]);
  assert.deepEqual(changesIn(PLAN, { ...PLAN, system: [{ template: 'adguard' }] }), [
    { section: 'system', name: 'adguard', how: 'added' },
  ]);
});
