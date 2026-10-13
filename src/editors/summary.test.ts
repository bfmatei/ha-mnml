import assert from 'node:assert/strict';

import { test } from 'vitest';

import { entities, entity, icon, need, part, parts, plain, text } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';

import { describer } from './cards.ts';
import type { PlainShape } from './shape.ts';
import { nameOf, summarize } from './summary.ts';

const hass = {
  states: {
    'climate.living': {
      entity_id: 'climate.living',
      state: 'heat',
      attributes: { friendly_name: 'Living Heating' },
    },
  },
} as never;

const describe = describer({
  t: { label: 'T', keys: {} },
  h: { label: 'Heating', keys: {} },
  r: { label: 'Row', keys: {} },
  l: { label: 'L', keys: { glasses: 'Glass' } },
});

const plainOf = (structure: Structure): PlainShape => {
  const shape = describe(structure);
  assert.ok(shape.kind === 'plain');
  return shape;
};

const SHAPE = plainOf(
  plain<{
    name?: string;
    icon?: string;
    heating?: { entity: string };
    scenes?: string[];
    rows?: { entity: string }[];
    window?: string;
  }>('t', {
    name: text(),
    icon: icon(),
    heating: part(plain<{ entity: string }>('h', { entity: need(entity()) })),
    scenes: entities(),
    rows: parts(plain<{ entity: string }>('r', { entity: need(entity()) })),
    window: entity(),
  }),
);

test('an entity reads as its friendly name, falling back to its id', () => {
  assert.equal(nameOf(hass, 'climate.living'), 'Living Heating');
  assert.equal(nameOf(hass, 'sensor.gone'), 'sensor.gone');
  assert.equal(nameOf(undefined, 'sensor.gone'), 'sensor.gone');
});

test('a summary names what is set, counts lists, and says not set when nothing is', () => {
  assert.equal(
    summarize(SHAPE, ['name', 'icon'], { name: 'Living', icon: 'mdi:sofa' }, hass),
    'Living, mdi:sofa',
  );
  assert.equal(
    summarize(SHAPE, ['heating'], { heating: { entity: 'climate.living' } }, hass),
    'Living Heating',
  );
  assert.equal(
    summarize(
      SHAPE,
      ['scenes', 'rows'],
      { scenes: ['scene.a', 'scene.b'], rows: [{ entity: 'x.y' }] },
      hass,
    ),
    '2 scenes, 1 row',
  );
  assert.equal(summarize(SHAPE, ['window'], {}, hass), 'not set');
  assert.equal(
    summarize(
      SHAPE,
      ['name', 'icon', 'heating', 'scenes'],
      { name: 'A', icon: 'mdi:b', heating: { entity: 'climate.living' }, scenes: ['s.c'] },
      hass,
    ),
    'A, mdi:b, Living Heating, ...',
  );
});

test('a count of one names the item as singular does, so a word ending in ss keeps it', () => {
  const lists = plainOf(
    plain<{ glasses?: string[]; batteries?: string[] }>('l', {
      glasses: entities(),
      batteries: entities(),
    }),
  );
  assert.equal(summarize(lists, ['glasses'], { glasses: ['sensor.a'] }, hass), '1 glass');
  assert.equal(summarize(lists, ['batteries'], { batteries: ['sensor.a'] }, hass), '1 battery');
});
