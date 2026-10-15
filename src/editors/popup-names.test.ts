import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fakeHass } from '../test/hass.ts';

import { popupChoices } from './popup-names.ts';

const header = (fields: Record<string, unknown>): Record<string, unknown> => ({
  type: 'custom:mnml-header-card',
  ...fields,
});

const HASS = fakeHass({
  states: {
    'person.ana': { state: 'home', attributes: { friendly_name: 'Ana' } },
    'media_player.living_speaker': {
      state: 'off',
      attributes: { friendly_name: 'Living speaker' },
    },
  },
});

test("a pop-up is named by its header: the header's name, else the name of its entity, else its hash in words", () => {
  const choices = popupChoices(
    [
      { hash: '#energy', cards: [header({ name: 'Energy', icon: 'mdi:lightning-bolt' })] },
      { hash: '#person-ana', cards: [header({ entity: 'person.ana' })] },
      { hash: '#guest-room', cards: [] },
    ],
    HASS,
  );
  assert.deepEqual(choices, [
    { value: '#energy', label: 'Energy' },
    { value: '#person-ana', label: 'Ana' },
    { value: '#guest-room', label: 'Guest room' },
  ]);
});

test('a pop-up opened from another is named after it, without repeating its name', () => {
  const choices = popupChoices(
    [
      { hash: '#living', cards: [header({ name: 'Living', icon: 'mdi:sofa' })] },
      { hash: '#living-lights', cards: [header({ entity: 'light.living' })] },
      {
        hash: '#living-media_player.living_speaker',
        cards: [header({ entity: 'media_player.living_speaker' })],
      },
    ],
    HASS,
  );
  assert.deepEqual(
    choices.map((choice) => choice.label),
    ['Living', 'Living: lights', 'Living: speaker'],
  );
});

test('without Home Assistant, a header that names only an entity falls back to the hash', () => {
  assert.deepEqual(
    popupChoices([{ hash: '#person-ana', cards: [header({ entity: 'person.ana' })] }], undefined),
    [{ value: '#person-ana', label: 'Person ana' }],
  );
});
