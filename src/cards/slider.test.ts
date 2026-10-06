import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlSlider } from './parts/slider.ts';
import { MnmlSliderCard } from './slider.ts';

define('mnml-slider', MnmlSlider);
define('mnml-slider-card', MnmlSliderCard);

function card(): MnmlSliderCard {
  const made = document.createElement('mnml-slider-card');
  assert.ok(made instanceof MnmlSliderCard);
  return made;
}

function hassWith(state: string): unknown {
  return {
    states: {
      'light.a': { entity_id: 'light.a', state, attributes: { brightness: 128 } },
    },
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    formatEntityAttributeValue: (_stateObj: unknown, _name: string, value: unknown): string =>
      String(value),
  };
}

test('a slider of a kind the card does not know is an error card that lists the kinds', () => {
  const made = card();
  const slider = { type: 'custom:mnml-slider-card', entity: 'light.a' };
  assert.throws(() => {
    made.setConfig({ ...slider, slider: 'brightnes' } as never);
  }, /slider must be one of brightness, color_temp, hue, temperature, value, volume/);
  assert.doesNotThrow(() => {
    made.setConfig({ ...slider, slider: 'brightness' } as never);
  });
});

test('the slider card is one full slider over its entity, a disabled one while it is unavailable', async () => {
  const made = card();
  made.setConfig({
    type: 'custom:mnml-slider-card',
    entity: 'light.a',
    slider: 'brightness',
    name: 'Desk',
  } as never);
  made.hass = hassWith('on') as never;
  const root = await mounted(made);
  const slider = root.querySelector('mnml-slider');
  assert.ok(slider instanceof MnmlSlider);
  assert.equal(slider.full, true);
  await slider.updateComplete;
  const track = slider.shadowRoot?.querySelector('.slider');
  assert.ok(track instanceof HTMLElement);
  assert.ok(track.classList.contains('full'));
  assert.equal(track.getAttribute('aria-label'), 'Desk');
  assert.equal(track.getAttribute('aria-valuenow'), '50');
  made.hass = hassWith('unavailable') as never;
  await made.updateComplete;
  const off = root.querySelector('mnml-slider');
  assert.ok(off instanceof MnmlSlider);
  await off.updateComplete;
  const disabled = off.shadowRoot?.querySelector('.slider');
  assert.ok(disabled instanceof HTMLElement);
  assert.ok(disabled.classList.contains('full'));
  assert.equal(disabled.getAttribute('aria-disabled'), 'true');
});
