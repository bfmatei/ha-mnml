import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';

import { homes } from './corpus.ts';
import { bestFit, byFit, fillsHome, fitOf } from './rank.ts';

const DEVICES = homes()['devices'];

const areas = (...names: string[]): { area: string }[] => names.map((area) => ({ area }));

const ROOMISH: Template = {
  slots: {
    key: { kind: 'text', required: true, discover: 'area.id' },
    name: { kind: 'text', discover: 'area.name' },
    climate: { kind: 'entity', required: true, discover: { domain: 'climate' } },
    players: { kind: 'entities', discover: { domain: 'media_player' } },
    plugs: { kind: 'entities', discover: { domain: 'switch' } },
  },
  card: {},
};

test("a template fills a place by the slots it finds there, the area's own name, icon and id not counting", () => {
  assert.ok(DEVICES);
  assert.equal(fillsHome(ROOMISH, { key: 'living', name: 'Living', climate: 'climate.a' }), 1);
  const living = fitOf(ROOMISH, { area: 'living' }, DEVICES);
  assert.equal(living.count, 2, 'players and plugs, no climate');
  assert.equal(living.complete, false);
  const bedroom = fitOf(ROOMISH, { area: 'bedroom' }, DEVICES);
  assert.equal(bedroom.complete, true);
  const ac = fitOf(ROOMISH, { device: 'daikin_ac' }, DEVICES);
  assert.deepEqual(ac.found, {
    key: 'bedroom_ac',
    name: 'Bedroom AC',
    climate: 'climate.bedroom_ac',
  });
  assert.equal(ac.complete, true);
});

test('the best place fills every required slot before one that finds more, then finds the most, the first on a tie', () => {
  assert.ok(DEVICES);
  const best = (...names: string[]) => bestFit(ROOMISH, areas(...names), DEVICES)?.scope.area;
  assert.equal(best('living', 'kitchen', 'bedroom'), 'bedroom', 'complete before richer');
  assert.equal(best('kitchen', 'living'), 'living');
  assert.equal(best('hall', 'bedroom'), 'hall');
  assert.equal(best('bedroom', 'hall'), 'bedroom');
  assert.equal(best('laundry'), undefined, 'nothing found');
  const fits = areas('kitchen', 'living', 'bedroom')
    .map((scope) => fitOf(ROOMISH, scope, DEVICES))
    .toSorted(byFit);
  assert.deepEqual(
    fits.map((fit) => fit.scope.area),
    ['bedroom', 'living', 'kitchen'],
  );
});
