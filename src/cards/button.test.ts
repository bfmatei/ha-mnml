import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlButtonCard } from './button.ts';

define('mnml-button-card', MnmlButtonCard);

interface Call {
  domain: string;
  service: string;
  data: unknown;
  target: unknown;
}

const STATES = {
  'button.restart': {
    entity_id: 'button.restart',
    state: 'unknown',
    attributes: { friendly_name: 'Restart' },
  },
};

function recorder(calls: Call[]): unknown {
  return {
    states: STATES,
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    callService: (
      domain: string,
      service: string,
      data: unknown,
      target: unknown,
    ): Promise<unknown> => {
      calls.push({ domain, service, data, target });
      return Promise.resolve();
    },
  };
}

test('a press calls the service on the entity, through the hass of the moment', async () => {
  const drawn: Call[] = [];
  const now: Call[] = [];
  const made = document.createElement('mnml-button-card');
  assert.ok(made instanceof MnmlButtonCard);
  made.setConfig({
    type: 'custom:mnml-button-card',
    entity: 'button.restart',
    service: 'button.press',
  });
  made.hass = recorder(drawn) as never;
  const root = await mounted(made);
  made.hass = recorder(now) as never;
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
