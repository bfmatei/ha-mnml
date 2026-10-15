import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fakeHass } from '../test/hass.ts';
import type { ServiceCall } from '../test/hass.ts';
import { define, mounted } from '../test/render.ts';

import { MnmlMediaCard } from './media.ts';

define('mnml-media-card', MnmlMediaCard);

const TRANSPORT = 1 | 16 | 32 | 16_384;

function hassWith(state: string, calls: ServiceCall[]) {
  return fakeHass({
    states: {
      'media_player.living_room': {
        state,
        attributes: { friendly_name: 'Living room', supported_features: TRANSPORT },
      },
    },
    calls,
  });
}

async function transport(state: string, calls: ServiceCall[]): Promise<ShadowRoot> {
  const made = document.createElement('mnml-media-card');
  assert.ok(made instanceof MnmlMediaCard);
  made.setConfig({ type: 'custom:mnml-media-card', entity: 'media_player.living_room' });
  made.hass = hassWith(state, calls);
  return mounted(made);
}

function press(root: ShadowRoot, label: string): void {
  const button = root.querySelector(`button[aria-label="${label}"]`);
  assert.ok(button instanceof HTMLButtonElement, `${label} is drawn`);
  button.click();
}

test('the transport buttons skip back, play or pause, and skip on, on the player', async () => {
  const calls: ServiceCall[] = [];
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
