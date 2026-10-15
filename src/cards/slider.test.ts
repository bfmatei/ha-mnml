import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { HomeAssistant } from '../ha/hass.ts';
import { fakeHass } from '../test/hass.ts';
import { configure, created, define, mounted } from '../test/render.ts';

import { MnmlSlider } from './parts/slider.ts';
import { MnmlSliderCard } from './slider.ts';

define('mnml-slider', MnmlSlider);
define('mnml-slider-card', MnmlSliderCard);

const card = (): MnmlSliderCard => created('mnml-slider-card', MnmlSliderCard);

function hassWith(state: string): HomeAssistant {
  return fakeHass({
    states: { 'light.a': { state, attributes: { brightness: 128 } } },
    formatEntityAttributeValue: (_stateObj, _name, value) => String(value),
  });
}

test('a slider of a kind the card does not know is an error card that lists the kinds', () => {
  const made = card();
  const slider = { type: 'custom:mnml-slider-card', entity: 'light.a' };
  assert.throws(() => {
    configure(made, { ...slider, slider: 'brightnes' });
  }, /slider must be one of brightness, color_temp, hue, temperature, value, volume, position, percentage, humidity/);
  assert.doesNotThrow(() => {
    configure(made, { ...slider, slider: 'brightness' });
  });
});

test('the slider card is one full slider over its entity, a disabled one while it is unavailable', async () => {
  const made = card();
  configure(made, {
    type: 'custom:mnml-slider-card',
    entity: 'light.a',
    slider: 'brightness',
    name: 'Desk',
  });
  made.hass = hassWith('on');
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
  made.hass = hassWith('unavailable');
  await made.updateComplete;
  const off = root.querySelector('mnml-slider');
  assert.ok(off instanceof MnmlSlider);
  await off.updateComplete;
  const disabled = off.shadowRoot?.querySelector('.slider');
  assert.ok(disabled instanceof HTMLElement);
  assert.ok(disabled.classList.contains('full'));
  assert.equal(disabled.getAttribute('aria-disabled'), 'true');
});
