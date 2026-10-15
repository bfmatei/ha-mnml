import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/plan.ts';
import type { Registries } from '../ha/registries.ts';
import { homes } from '../templates/corpus.ts';
import { readTemplates } from '../templates/shipped.ts';
import { templateIndex } from '../templates/stands.ts';

import { offersIn, roomFound, shownBy } from './devices.ts';
import { defaultPlan } from './plan.ts';

const TEMPLATES = readTemplates();
const INDEX = templateIndex(TEMPLATES);

function devicesHome(): Registries {
  const home = homes()['devices'];
  assert.ok(home);
  return home;
}

function unplaced(home: Registries, device: string): Registries {
  const placed = home.devices[device];
  assert.ok(placed);
  return {
    ...home,
    devices: { ...home.devices, [device]: { ...placed, area_id: null } },
    entities: Object.fromEntries(
      Object.entries(home.entities).map(([id, entry]) => [
        id,
        entry.device_id === device ? { ...entry, area_id: null } : entry,
      ]),
    ),
  };
}

function marks(plan: Plan, home: Registries): Record<string, string | undefined> {
  const rooms = plan.rooms.map((room) => ({
    name: room.area ?? 'spelled',
    found: roomFound(room, 'room', home, TEMPLATES),
  }));
  return Object.fromEntries(
    offersIn(home, INDEX).map((offer) => [
      offer.device,
      shownBy(offer.device, INDEX[offer.templates[0] ?? '']?.anchor, rooms, home),
    ]),
  );
}

test('the devices a template stands for are offered by area, in the order Home Assistant lists them, each with its cards best first', () => {
  assert.deepEqual(offersIn(devicesHome(), INDEX), [
    { device: 'daikin_ac', name: 'Bedroom AC', area: 'bedroom', templates: ['ac-item'] },
    {
      device: 'better_thermostat',
      name: 'Bedroom heating',
      area: 'bedroom',
      templates: ['heating-item'],
    },
    { device: 'sonos_arc', name: 'Living room', area: 'living', templates: ['media-card'] },
    { device: 'apple_tv', name: 'Living room TV', area: 'living', templates: ['media-card'] },
    { device: 'roborock_s8', name: 'Roborock S8', area: 'living', templates: ['vacuum-card'] },
    {
      device: 'prusa_mk4',
      name: 'Prusa MK4',
      area: 'office',
      templates: ['3d-printer-card', 'camera-card'],
    },
  ]);
});

test('a device in no area comes last, and one chosen keeps its card whether a template stands for it or not', () => {
  const home = unplaced(devicesHome(), 'roborock_s8');
  const offers = offersIn(home, INDEX, [
    { device: 'washer', template: 'switch-card' },
    { device: 'prusa_mk4', template: 'my-printer' },
    { device: 'gone', template: 'vacuum-card' },
  ]);
  assert.deepEqual(
    offers.map((offer) => [offer.device, offer.area]),
    [
      ['daikin_ac', 'bedroom'],
      ['better_thermostat', 'bedroom'],
      ['washer', 'laundry'],
      ['sonos_arc', 'living'],
      ['apple_tv', 'living'],
      ['prusa_mk4', 'office'],
      ['roborock_s8', undefined],
    ],
  );
  assert.deepEqual(offers.find((offer) => offer.device === 'washer')?.templates, ['switch-card']);
  assert.deepEqual(offers.find((offer) => offer.device === 'prusa_mk4')?.templates, [
    '3d-printer-card',
    'camera-card',
    'my-printer',
  ]);
});

test('a device is shown by the room of the plan that draws its own entities, and by none once out of it', () => {
  const home = devicesHome();
  const plan = defaultPlan(home, TEMPLATES);
  assert.deepEqual(marks(plan, home), {
    daikin_ac: 'bedroom',
    better_thermostat: 'bedroom',
    sonos_arc: 'living',
    apple_tv: 'living',
    roborock_s8: 'living',
    prusa_mk4: 'office',
  });
  assert.deepEqual(marks({ ...plan, rooms: [{ area: 'bedroom' }] }, home), {
    daikin_ac: 'bedroom',
    better_thermostat: 'bedroom',
    sonos_arc: undefined,
    apple_tv: undefined,
    roborock_s8: undefined,
    prusa_mk4: undefined,
  });
  const away = unplaced(home, 'roborock_s8');
  assert.equal(marks(defaultPlan(away, TEMPLATES), away)['roborock_s8'], undefined);
});

test("a spelled room shows the devices whose entities it spells, and a room's overrides count", () => {
  const home = devicesHome();
  const spelled: Plan = {
    ...defaultPlan(home, TEMPLATES),
    rooms: [
      {
        slots: { key: 'den', name: 'Den', vacuum: { entity: 'vacuum.roborock_s8' } },
        spelled: true,
      },
      { area: 'office', slots: { cameras: [] } },
    ],
  };
  const shown = marks(spelled, home);
  assert.equal(shown['roborock_s8'], 'spelled');
  assert.equal(shown['prusa_mk4'], 'office');
  assert.equal(shown['apple_tv'], undefined);
});
