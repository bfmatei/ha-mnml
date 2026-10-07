import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';

import { rolesOf } from './roles.ts';
import { readTemplates } from './shipped.ts';

const SHIPPED = readTemplates();

test('the shipped tiles are the templates no other template uses, pop-ups aside', () => {
  const roles = rolesOf(SHIPPED);
  assert.deepEqual(
    Object.keys(roles)
      .filter((name) => roles[name] === 'tile')
      .toSorted(),
    [
      'adguard',
      'car',
      'home-assistant',
      'media-server',
      'person',
      'proxmox-server',
      'room',
      'section-heading',
      'unifi-network',
    ],
  );
  assert.equal(roles['room-popup'], 'popup');
  assert.equal(roles['light-card'], 'part');
});

test("a home's own template that uses a tile makes it a part, and one with a hash and no type is a pop-up", () => {
  const wrapper: Template = {
    card: { type: 'vertical-stack', cards: [{ template: 'room', slots: {} }] },
  };
  const sheet: Template = { card: { hash: '#garden', cards: [] } };
  const roles = rolesOf({ ...SHIPPED, wrapper, sheet });
  assert.equal(roles['room'], 'part');
  assert.equal(roles['wrapper'], 'tile');
  assert.equal(roles['sheet'], 'popup');
});
