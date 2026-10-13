import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlMediaCard } from './media.ts';

define('mnml-media-card', MnmlMediaCard);

interface Call {
  domain: string;
  service: string;
  data: unknown;
  target: unknown;
}

const TRANSPORT = 1 | 16 | 32 | 16_384;

function hassWith(state: string, calls: Call[]): unknown {
  return {
    states: {
      'media_player.living_room': {
        entity_id: 'media_player.living_room',
        state,
        attributes: { friendly_name: 'Living room', supported_features: TRANSPORT },
      },
    },
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    callService: (domain: string, service: string, data: unknown, target: unknown) => {
      calls.push({ domain, service, data, target });
      return Promise.resolve();
    },
  };
}

async function transport(state: string, calls: Call[]): Promise<ShadowRoot> {
  const made = document.createElement('mnml-media-card');
  assert.ok(made instanceof MnmlMediaCard);
  made.setConfig({ type: 'custom:mnml-media-card', entity: 'media_player.living_room' });
  made.hass = hassWith(state, calls) as never;
  return mounted(made);
}

function press(root: ShadowRoot, label: string): void {
  const button = root.querySelector(`button[aria-label="${label}"]`);
  assert.ok(button instanceof HTMLButtonElement, `${label} is drawn`);
  button.click();
}

test('the transport buttons skip back, play or pause, and skip on, on the player', async () => {
  const calls: Call[] = [];
  const playing = await transport('playing', calls);
  press(playing, 'Previous');
  press(playing, 'Pause');
  press(playing, 'Next');
  const paused = await transport('paused', calls);
  press(paused, 'Play');
  const target = { entity_id: 'media_player.living_room' };
  assert.deepEqual(calls, [
    { domain: 'media_player', service: 'media_previous_track', data: undefined, target },
    { domain: 'media_player', service: 'media_play_pause', data: undefined, target },
    { domain: 'media_player', service: 'media_next_track', data: undefined, target },
    { domain: 'media_player', service: 'media_play_pause', data: undefined, target },
  ]);
});
