import assert from 'node:assert/strict';

import { test } from 'vitest';

import { expand } from './expand.ts';
import { SHIPPED } from './shipped.ts';

const SUBJECTS: readonly (readonly [string, string])[] = [
  ['power', 'entity'],
  ['nav-chip', 'entity'],
  ['nav-chip', 'popup'],
  ['nav-chip', 'color'],
  ['heating-controls', 'entity'],
  ['light-controls', 'entity'],
  ['light-item', 'entity'],
  ['3d-printer-actions', 'entity'],
  ['pending-row', 'entity'],
  ['stopped-row', 'entity'],
  ['link-row', 'entity'],
  ['room-media-card', 'key'],
  ['section-heading', 'icon'],
  ['heating-popup', 'name'],
  ['ac-popup', 'name'],
  ['lights-popup', 'name'],
  ['3d-printer-popup', 'name'],
  ['vacuum-popup', 'name'],
  ['speaker-popup', 'name'],
];

test('a part placed without its subject names the slot it needs, rather than drawing a broken part', () => {
  const silent: string[] = [];
  for (const [name, slot] of SUBJECTS) {
    const template = SHIPPED[name];
    assert.ok(template, name);
    const slots = Object.fromEntries(
      Object.entries(template.example ?? {}).filter(([key]) => key !== slot),
    );
    try {
      expand(SHIPPED, { template: name, slots });
      silent.push(`${name}.${slot}`);
    } catch (error) {
      if (
        !String(error instanceof Error ? error.message : error).includes(
          `the slot ${slot} is required`,
        )
      ) {
        silent.push(`${name}.${slot}: ${String(error)}`);
      }
    }
  }
  assert.deepEqual(silent, []);
});
