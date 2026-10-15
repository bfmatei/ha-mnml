import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import type { Template } from '../contract/templates.ts';
import { readTemplates } from '../templates/shipped.ts';
import { fakeHass } from '../test/hass.ts';
import { configure } from '../test/render.ts';

import { MnmlCard } from './base.ts';
import { MnmlPopupsCard } from './popups.ts';
import './register.ts';
import { STUBS, previewOf, startOf, templateStub } from './stubs.ts';

const hass = (ids: string[]) =>
  fakeHass({ states: Object.fromEntries(ids.map((id) => [id, { state: 'on' }])) });

test("each card's stub picks a fitting entity of the home", () => {
  const home = hass([
    'sensor.power',
    'light.desk',
    'media_player.tv',
    'select.mode',
    'button.bell',
    'calendar.tv',
    'script.clear',
  ]);
  assert.equal(STUBS['mnml-slider-card']?.(home)['entity'], 'light.desk');
  assert.equal(STUBS['mnml-slider-card']?.(home)['slider'], 'brightness');
  assert.equal(STUBS['mnml-media-card']?.(home)['entity'], 'media_player.tv');
  assert.equal(STUBS['mnml-button-card']?.(home)['entity'], 'button.bell');
  assert.deepEqual(STUBS['mnml-select-card']?.(home), { entity: 'select.mode' });
});

test('every card takes its stub, in a home with fitting entities and in an empty one', () => {
  for (const home of [
    hass(['sensor.power', 'light.desk', 'media_player.tv', 'climate.hall']),
    hass([]),
  ]) {
    for (const [tag, stub] of Object.entries(STUBS)) {
      const card = document.createElement(tag);
      assert.ok(card instanceof MnmlCard || card instanceof MnmlPopupsCard, tag);
      configure(card, { type: `custom:${tag}`, ...stub(home) });
    }
  }
});

const TEMPLATES = readTemplates();
const KITCHEN_FIRST = {
  ...HOME,
  areas: {
    porch: { area_id: 'porch', name: 'Porch', icon: 'mdi:door' },
    ...HOME.areas,
  },
};

test("a template starts in the area where it finds the most, the area's own name and icon not counting", () => {
  const room = TEMPLATES['room'];
  assert.ok(room);
  assert.deepEqual(startOf('room', room, fakeHass(KITCHEN_FIRST)), {
    type: 'custom:mnml-template-card',
    template: 'room',
    area: 'living',
  });
  assert.deepEqual(previewOf('room', room, fakeHass(KITCHEN_FIRST)), {
    type: 'custom:mnml-template-card',
    template: 'room',
    area: 'living',
  });
});

const VACUUM: Template = {
  slots: {
    name: { kind: 'text' },
    entity: { kind: 'entity', required: true, discover: { domain: 'vacuum' } },
    dock: { kind: 'entity', required: true, discover: { domain: 'sensor', device_class: 'dock' } },
    map: { kind: 'entity', discover: { domain: 'image' } },
  },
  card: { type: 'custom:mnml-entity-card', entity: '[[entity]]' },
  example: {
    name: 'Robot',
    entity: 'vacuum.robot',
    dock: 'sensor.robot_dock',
    map: 'image.robot_map',
  },
};

const WITH_VACUUM = {
  ...HOME,
  entities: {
    ...HOME.entities,
    'vacuum.s8': { entity_id: 'vacuum.s8', area_id: 'kitchen', platform: 'roborock' },
  },
};

test('a preview fills from this home first, and from the example only what the home cannot fill and the card needs', () => {
  assert.deepEqual(previewOf('vacuum', VACUUM, fakeHass(WITH_VACUUM)), {
    type: 'custom:mnml-template-card',
    template: 'vacuum',
    area: 'kitchen',
    slots: { dock: 'sensor.robot_dock' },
  });
  assert.deepEqual(previewOf('vacuum', VACUUM, fakeHass(HOME)), {
    type: 'custom:mnml-template-card',
    template: 'vacuum',
    slots: VACUUM.example ?? {},
  });
});

test('a new card starts where the home fills it, or else takes from the example only what names no entity the home lacks', () => {
  assert.deepEqual(startOf('vacuum', VACUUM, fakeHass(WITH_VACUUM)), {
    type: 'custom:mnml-template-card',
    template: 'vacuum',
    area: 'kitchen',
  });
  assert.deepEqual(startOf('vacuum', VACUUM, fakeHass(HOME)), {
    type: 'custom:mnml-template-card',
    template: 'vacuum',
    slots: { name: 'Robot' },
  });
});

const WEATHER: Template = {
  slots: {
    entity: { kind: 'entity', required: true, discover: { domain: 'weather', scope: 'all' } },
  },
  card: { type: 'custom:mnml-weather-card', entity: '[[entity]]' },
};

test('a template whose rules look in the whole home starts there, before any area that finds as much', () => {
  const home = {
    ...HOME,
    entities: {
      ...HOME.entities,
      'weather.home': { entity_id: 'weather.home', area_id: 'kitchen', platform: 'met' },
    },
  };
  assert.deepEqual(startOf('weather', WEATHER, fakeHass(home)), {
    type: 'custom:mnml-template-card',
    template: 'weather',
  });
  assert.deepEqual(previewOf('weather', WEATHER, fakeHass(home)), {
    type: 'custom:mnml-template-card',
    template: 'weather',
  });
});

test("the template card's stub is the first tile that fills this home, the room first, else the gallery", () => {
  assert.deepEqual(templateStub(TEMPLATES, fakeHass(KITCHEN_FIRST)), {
    template: 'room',
    area: 'living',
  });
  assert.deepEqual(templateStub(TEMPLATES, fakeHass()), { template: '' });
});
