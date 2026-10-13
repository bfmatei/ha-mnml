import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';
import { define, mounted } from '../../test/render.ts';
import type { Host } from '../base.ts';

import { sliderSpec } from './slider-spec.ts';
import type { SliderSpec } from './slider-spec.ts';
import { MnmlSlider, openSliderOverlay } from './slider.ts';

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
    refresh: () => {},
    isConnected: true,
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
    refresh: () => {},
    isConnected: true,
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
  openSliderOverlay(
    surface,
    spec,
    { icon: 'mdi:brightness-6', name: 'Brightness' },
    undefined,
    {
      hass,
      hold: () => {
        held += 1;
        return () => {
          released += 1;
        };
      },
      register: () => () => {},
      notify: () => {},
      refresh: () => {},
      isConnected: true,
    },
    true,
  );
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

function keyedSlider(spec: SliderSpec, owner: Host): MnmlSlider {
  define('mnml-slider', MnmlSlider);
  const slider = document.createElement('mnml-slider');
  assert.ok(slider instanceof MnmlSlider);
  slider.spec = spec;
  slider.label = { icon: 'mdi:brightness-6', name: 'Brightness' };
  slider.owner = owner;
  return slider;
}

function press(track: Element, key: string): void {
  track.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

test('keys pressed in a row send one value after a pause, and a key pressed while it is on its way is sent after its own', async () => {
  vi.useFakeTimers();
  try {
    const calls: number[] = [];
    let released = 0;
    const spec: SliderSpec = {
      min: 0,
      max: 100,
      step: 1,
      value: 50,
      format: (value) => `${value} %`,
      commit: (value) => {
        calls.push(value);
        return new Promise((resolve) => setTimeout(resolve, 300));
      },
    };
    const slider = keyedSlider(spec, {
      hass: undefined,
      hold: () => () => {
        released += 1;
      },
      register: () => () => {},
      notify: () => {},
      refresh: () => {},
      isConnected: true,
    });
    const root = await mounted(slider);
    const track = root.querySelector('.slider');
    assert.ok(track instanceof HTMLElement);
    press(track, 'ArrowRight');
    await vi.advanceTimersByTimeAsync(400);
    assert.deepEqual(calls, [], 'nothing goes while another key may follow');
    press(track, 'ArrowRight');
    await vi.advanceTimersByTimeAsync(400);
    assert.deepEqual(calls, [], 'and each key starts the pause again');
    await vi.advanceTimersByTimeAsync(200);
    assert.deepEqual(calls, [52], 'then the last value goes, once');
    press(track, 'ArrowRight');
    await vi.advanceTimersByTimeAsync(400);
    assert.deepEqual(calls, [52], 'a key pressed while it is on its way waits for its own pause');
    await vi.advanceTimersByTimeAsync(3000);
    assert.deepEqual(calls, [52, 53]);
    assert.equal(released, 1, 'the card is held until the last value has landed');
    slider.remove();
  } finally {
    vi.useRealTimers();
  }
});

test('a value set by key that fails as the slider closes reaches the user as a message', async () => {
  const notified: string[] = [];
  const spec: SliderSpec = {
    min: 0,
    max: 100,
    step: 1,
    value: 50,
    format: (value) => `${value} %`,
    commit: () => Promise.reject(new Error('The light is offline')),
  };
  const slider = keyedSlider(spec, {
    hass: undefined,
    hold: () => () => {},
    register: () => () => {},
    notify: (message) => {
      notified.push(message);
    },
    refresh: () => {},
    isConnected: true,
  });
  const root = await mounted(slider);
  const track = root.querySelector('.slider');
  assert.ok(track instanceof HTMLElement);
  press(track, 'ArrowRight');
  slider.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(notified, ['The light is offline']);
});

function overlayOn(keyboard: boolean): { root: ShadowRoot; opener: HTMLElement; card: Element } {
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
  openSliderOverlay(
    surface,
    spec,
    { icon: 'mdi:brightness-6', name: 'Brightness' },
    undefined,
    {
      hass,
      hold: () => () => {},
      register: () => () => {},
      notify: () => {},
      refresh: () => {},
      isConnected: true,
    },
    keyboard,
  );
  return { root, opener, card };
}

test('a slider opened from the keyboard takes the focus once it is drawn, and one opened by touch leaves it', async () => {
  const focused: (Element | null | undefined)[] = [];
  const spy = vi.spyOn(MnmlSlider.prototype, 'focus').mockImplementation(function focus(
    this: MnmlSlider,
  ): void {
    focused.push(this.shadowRoot?.querySelector('[role="slider"]'));
  });
  try {
    const typed = overlayOn(true);
    const slider = typed.root.querySelector('mnml-slider');
    assert.ok(slider instanceof MnmlSlider);
    await slider.updateComplete;
    await Promise.resolve();
    assert.equal(focused.length, 1, 'the keyboard open moves the focus');
    assert.ok(focused[0] instanceof HTMLElement, 'onto a slider already drawn');
    typed.card.remove();
    const touched = overlayOn(false);
    const other = touched.root.querySelector('mnml-slider');
    assert.ok(other instanceof MnmlSlider);
    await other.updateComplete;
    await Promise.resolve();
    assert.equal(focused.length, 1, 'a touch open leaves it, so the overlay closes on its own');
    assert.equal(touched.root.activeElement, touched.opener);
    touched.card.remove();
  } finally {
    spy.mockRestore();
  }
});
