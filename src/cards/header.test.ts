import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fakeHass } from '../test/hass.ts';
import { configure, created, define, mounted, text } from '../test/render.ts';
import { notified, wire } from '../test/wire.ts';

import { MnmlHeaderCard } from './header.ts';

define('mnml-header-card', MnmlHeaderCard);

test("a header with messages ends its state line with Home Assistant's count, or None, coloured only while there are any", async () => {
  const line = wire();
  const made = created('mnml-header-card', MnmlHeaderCard);
  configure(made, {
    type: 'custom:mnml-header-card',
    name: 'Messages',
    icon: 'mdi:bell-outline',
    messages: true,
    color: 'amber',
    state: [{ text: 'Home Assistant' }],
  });
  made.hass = { ...fakeHass(), connection: line.connection };
  const root = await mounted(made);
  assert.equal(text(root.querySelector('.state')), 'Home Assistant', 'no count until it is known');
  line.push(notified(0));
  await made.updateComplete;
  assert.equal(text(root.querySelector('.state')), 'Home Assistant • None');
  assert.equal(root.querySelector('.pill.colored'), null);
  line.push(notified(4));
  await made.updateComplete;
  assert.equal(text(root.querySelector('.state')), 'Home Assistant • 4');
  assert.ok(root.querySelector('.pill.colored'));
  made.remove();
});
