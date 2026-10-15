import assert from 'node:assert/strict';

import { test } from 'vitest';

import { COMMON, OWNER, SIZES, loadFamily } from './families.ts';
import { familyTitle } from './family-titles.ts';
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

test('every family has a title in plain words, and the common one too', () => {
  const families = [...new Set(['common', ...Object.values(OWNER)])];
  assert.deepEqual(
    families.filter((family) => familyTitle(family) === family),
    [],
  );
  assert.equal(familyTitle('3d-printer'), '3D printer');
  assert.equal(familyTitle('garden'), 'garden');
});

test('a family loads its own templates, as the shipped ones', async () => {
  const room = await loadFamily('room');
  assert.deepEqual(Object.keys(room).toSorted(), ['room', 'room-media-card', 'room-popup']);
  assert.deepEqual(room['room'], SHIPPED['room']);
});

test('the index carries the literal type and grid size of each family template, for sizing before it loads', () => {
  assert.deepEqual(SIZES['select-card'], { type: 'custom:mnml-select-card' });
  assert.deepEqual(SIZES['room'], {
    type: 'custom:mnml-tile-card',
    grid_options: { columns: 12 },
  });
  assert.equal(
    SIZES['room-popup'],
    undefined,
    'a template whose card is not a literal card has none',
  );
  assert.equal(SIZES['section-heading'], undefined, 'a common template needs none');
});
