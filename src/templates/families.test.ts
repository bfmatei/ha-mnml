import assert from 'node:assert/strict';

import { test } from 'vitest';

import { COMMON, OWNER, SHAPES, loadFamily } from './families.ts';
import { SHIPPED } from './shipped.ts';

test('common holds the shared fragments, and every other shipped template belongs to one family', () => {
  assert.ok('section-heading' in COMMON);
  assert.ok('power' in COMMON);
  assert.equal(OWNER['room'], 'room');
  assert.equal(OWNER['car-popup'], 'car');
  assert.equal(OWNER['section-heading'], undefined, 'a common template is in no family');
  assert.deepEqual(
    [...Object.keys(COMMON), ...Object.keys(OWNER)].toSorted(),
    Object.keys(SHIPPED).toSorted(),
  );
});

test('a family loads its own templates, as the shipped ones', async () => {
  const room = await loadFamily('room');
  assert.deepEqual(Object.keys(room).toSorted(), ['room', 'room-media-card', 'room-popup']);
  assert.deepEqual(room['room'], SHIPPED['room']);
});

test('the index carries the literal type and grid size of each family template, for sizing before it loads', () => {
  assert.deepEqual(SHAPES['select-card'], { type: 'custom:mnml-select-card' });
  assert.deepEqual(SHAPES['room'], {
    type: 'custom:mnml-tile-card',
    grid_options: { columns: 12 },
  });
  assert.equal(
    SHAPES['room-popup'],
    undefined,
    'a template whose card is not a literal card has none',
  );
  assert.equal(SHAPES['section-heading'], undefined, 'a common template needs none');
});
