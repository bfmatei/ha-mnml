import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fakeHass } from '../test/hass.ts';
import type { ServiceCall } from '../test/hass.ts';
import { define, mounted } from '../test/render.ts';

import { MnmlButtonCard } from './button.ts';

define('mnml-button-card', MnmlButtonCard);

const STATES = {
  'button.restart': {
    entity_id: 'button.restart',
    state: 'unknown',
    attributes: { friendly_name: 'Restart' },
  },
};

test('a press calls the service on the entity, through the hass of the moment', async () => {
  const drawn: ServiceCall[] = [];
  const now: ServiceCall[] = [];
  const made = document.createElement('mnml-button-card');
  assert.ok(made instanceof MnmlButtonCard);
  made.setConfig({
    type: 'custom:mnml-button-card',
    entity: 'button.restart',
    service: 'button.press',
  });
  made.hass = fakeHass({ states: STATES, calls: drawn });
  const root = await mounted(made);
  made.hass = fakeHass({ states: STATES, calls: now });
  const button = root.querySelector('[role="button"]');
  assert.ok(button instanceof HTMLElement);
  assert.equal(button.getAttribute('aria-label'), 'Restart');
  button.click();
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.deepEqual(drawn, [], 'not the hass it was drawn with');
  const call = {
    domain: 'button',
    service: 'press',
    data: undefined,
    target: { entity_id: 'button.restart' },
  };
  assert.deepEqual(now, [call, call], 'once for the click and once for Enter');
  made.remove();
});
