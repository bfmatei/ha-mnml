import assert from 'node:assert/strict';

import { test } from 'vitest';

import { rolesOf } from './roles.ts';
import { readTemplates } from './shipped.ts';

const SHIPPED = readTemplates();
const ROLES = rolesOf(SHIPPED);
const TILES = Object.entries(SHIPPED).filter(([name]) => ROLES[name] === 'tile');

test("every required slot of a tile says what it is for, so the card editor's fields explain themselves", () => {
  const silent = TILES.flatMap(([name, template]) =>
    Object.entries(template.slots ?? {})
      .filter(([, spec]) => spec.required === true && spec.help === undefined)
      .map(([slot]) => `${name}.${slot}`),
  );
  assert.deepEqual(silent, []);
});

test('every slot of a tile whose name is not a plain word has a label', () => {
  const unnamed = TILES.flatMap(([name, template]) =>
    Object.entries(template.slots ?? {})
      .filter(([slot, spec]) => (slot.includes('_') || slot === 'key') && spec.label === undefined)
      .map(([slot]) => `${name}.${slot}`),
  );
  assert.deepEqual(unnamed, []);
});
