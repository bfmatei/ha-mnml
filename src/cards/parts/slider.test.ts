import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';
import { define, mounted } from '../../test/render.ts';

import { MnmlSlider, openSliderOverlay, sliderSpec } from './slider.ts';

interface Call {
  service: string;
  data: unknown;
}

function recorder(): { hass: HomeAssistant; calls: Call[] } {
  const calls: Call[] = [];
  const hass = {
    states: {},
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: HassEntity): string => stateObj.state,
    formatEntityAttributeValue: (_stateObj: HassEntity, _name: string, value: unknown): string =>
      String(value),
    callService: (domain: string, service: string, data: unknown): Promise<unknown> => {
      calls.push({ service: `${domain}.${service}`, data });
      return Promise.resolve();
    },
  } as unknown as HomeAssistant;
  return { hass, calls };
}

function entity(state: string, attributes: Record<string, unknown>): HassEntity {
  return { entity_id: 'light.a', state, attributes, last_changed: '', last_updated: '' };
}

test('brightness runs 0 to 100 from the 0 to 255 attribute, and 0 turns the light off', async () => {
  const { hass, calls } = recorder();
  const spec = sliderSpec(hass, 'light.a', entity('on', { brightness: 128 }), 'brightness');
  assert.ok(spec);
  assert.equal(spec.value, 50);
  assert.equal(sliderSpec(hass, 'light.a', entity('off', {}), 'brightness')?.value, 0);
  await spec.commit(0);
  await spec.commit(40);
  assert.deepEqual(calls, [
    { service: 'light.turn_off', data: undefined },
    { service: 'light.turn_on', data: { brightness_pct: 40 } },
  ]);
});

test('colour temperature reads the lamp range and dims while it has no reading', () => {
  const { hass } = recorder();
  const lamp = entity('on', { min_color_temp_kelvin: 2200, max_color_temp_kelvin: 4000 });
  const spec = sliderSpec(hass, 'light.a', lamp, 'color_temp');
  assert.ok(spec);
  assert.deepEqual([spec.min, spec.max, spec.value, spec.dimmed], [2200, 4000, 2200, true]);
});

test('a target temperature turns the climate on first only when asked to', async () => {
  const { hass, calls } = recorder();
  const off = entity('off', { min_temp: 16, max_temp: 30, target_temp_step: 1, temperature: 21 });
  const plain = sliderSpec(hass, 'climate.a', off, 'temperature');
  const waking = sliderSpec(hass, 'climate.a', off, 'temperature', { turn_on: true });
  assert.ok(plain && waking);
  assert.deepEqual([plain.min, plain.max, plain.step, plain.value], [16, 30, 1, 21]);
  await plain.commit(22);
  await waking.commit(23);
  assert.deepEqual(
    calls.map((call) => call.service),
    ['climate.set_temperature', 'climate.turn_on', 'climate.set_temperature'],
  );
});

test('the slider shows the value it is dragged to, and commits it once the drag ends', async () => {
  const { hass, calls } = recorder();
  const spec = sliderSpec(hass, 'light.a', entity('on', { brightness: 128 }), 'brightness');
  assert.ok(spec);
  define('mnml-slider', MnmlSlider);
  const slider = document.createElement('mnml-slider');
  assert.ok(slider instanceof MnmlSlider);
  let held = 0;
  let released = 0;
  slider.spec = spec;
  slider.label = { icon: 'mdi:brightness-6', name: 'Brightness' };
  slider.owner = {
    hass,
    hold: () => {
      held += 1;
      return () => {
        released += 1;
      };
    },
    register: () => () => {},
    notify: () => {},
  };
  const root = await mounted(slider);
  const track = root.querySelector('.slider');
  assert.ok(track instanceof HTMLElement);
  assert.equal(track.getAttribute('aria-valuenow'), '50');
  track.getBoundingClientRect = () => ({
    left: 0,
    width: 200,
    top: 0,
    height: 40,
    right: 200,
    bottom: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  track.setPointerCapture = () => {};
  track.dispatchEvent(
    new PointerEvent('pointerdown', { clientX: 150, pointerId: 1, bubbles: true }),
  );
  await slider.updateComplete;
  assert.equal(track.getAttribute('aria-valuenow'), '75', 'the value follows the pointer');
  assert.equal(held, 1, 'the card holds its redraws while the slider is dragged');
  track.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [{ service: 'light.turn_on', data: { brightness_pct: 75 } }]);
  assert.equal(released, 0, 'and keeps holding until the new state can arrive');
});

test('a value set by key is sent even when the slider closes before the pause ends', async () => {
  const { hass, calls } = recorder();
  const spec = sliderSpec(hass, 'light.a', entity('on', { brightness: 128 }), 'brightness');
  assert.ok(spec);
  define('mnml-slider', MnmlSlider);
  const slider = document.createElement('mnml-slider');
  assert.ok(slider instanceof MnmlSlider);
  let released = 0;
  slider.spec = spec;
  slider.label = { icon: 'mdi:brightness-6', name: 'Brightness' };
  slider.owner = {
    hass,
    hold: () => () => {
      released += 1;
    },
    register: () => () => {},
    notify: () => {},
  };
  const root = await mounted(slider);
  const track = root.querySelector('.slider');
  assert.ok(track instanceof HTMLElement);
  track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await slider.updateComplete;
  slider.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [{ service: 'light.turn_on', data: { brightness_pct: 51 } }]);
  assert.equal(released, 1, 'and the card is not left held');
});

test('the slider opened from a control closes on its X, giving the focus back to the control', async () => {
  const { hass } = recorder();
  const spec = sliderSpec(hass, 'light.a', entity('on', { brightness: 128 }), 'brightness');
  assert.ok(spec);
  define('mnml-slider', MnmlSlider);
  const card = document.createElement('div');
  document.body.append(card);
  const root = card.attachShadow({ mode: 'open' });
  const surface = document.createElement('div');
  const opener = document.createElement('button');
  surface.append(opener);
  root.append(surface);
  opener.focus();
  let held = 0;
  let released = 0;
  openSliderOverlay(surface, spec, { icon: 'mdi:brightness-6', name: 'Brightness' }, undefined, {
    hass,
    hold: () => {
      held += 1;
      return () => {
        released += 1;
      };
    },
    register: () => () => {},
    notify: () => {},
  });
  const overlay = surface.querySelector('.overlay');
  assert.ok(overlay, 'the slider opens over the row');
  const close = overlay.lastElementChild;
  assert.ok(close instanceof HTMLButtonElement, 'the X comes last, after the slider');
  assert.equal(close.getAttribute('aria-label'), 'Close');
  assert.ok(close.classList.contains('control'));
  close.click();
  assert.equal(surface.querySelector('.overlay'), null);
  assert.equal([held, released].join(), '1,1', 'and the card is not left held');
  assert.equal(root.activeElement, opener);
  card.remove();
});
