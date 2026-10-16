import assert from 'node:assert/strict';

import { html, nothing, render } from 'lit';
import { afterEach, test, vi } from 'vitest';

import type { Item, NavControl } from '../../contract/cards.ts';
import type { HomeAssistant } from '../../ha/hass.ts';
import { fakeHass, fakeHost } from '../../test/hass.ts';
import type { FakeState, ServiceCall } from '../../test/hass.ts';

import { lightsButton, navButton, squareOptions } from './square-menu.ts';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const LIGHT: FakeState = {
  state: 'on',
  attributes: {
    friendly_name: 'Lights',
    brightness: 128,
    supported_color_modes: ['color_temp'],
    color_temp_kelvin: 3000,
  },
};

const ITEM: Item = {
  entity: 'light.room',
  popup: '#room-lights',
  controls: [
    {
      type: 'scenes',
      scenes: ['scene.relax', 'scene.night'],
      name: 'Scenes',
      icon: 'mdi:palette-swatch',
    },
    {
      type: 'slider',
      entity: 'light.room',
      slider: 'brightness',
      name: 'Brightness',
      icon: 'mdi:brightness-6',
      show: { is: ['on'] },
    },
    {
      type: 'slider',
      entity: 'light.room',
      slider: 'color_temp',
      name: 'White',
      icon: 'mdi:thermometer',
      show: { is: ['on'] },
    },
    {
      type: 'slider',
      entity: 'light.room',
      slider: 'hue',
      name: 'Colour',
      icon: 'mdi:palette',
      show: { is: ['on'] },
    },
    { type: 'toggle', entity: 'light.room', icon: 'mdi:power', primary: true },
  ],
};

const SCENED: Item = {
  entity: 'light.room',
  controls: [
    {
      type: 'scenes',
      scenes: ['scene.relax', 'scene.night', 'scene.read'],
      active_scene: 'select.room_scene',
      name: 'Scenes',
      icon: 'mdi:palette-swatch',
    },
    {
      type: 'slider',
      entity: 'light.room',
      slider: 'brightness',
      name: 'Brightness',
      icon: 'mdi:brightness-6',
    },
  ],
};

const DIMMED: Item = {
  entity: 'light.room',
  controls: [
    {
      type: 'slider',
      entity: 'light.room',
      slider: 'brightness',
      name: 'Brightness',
      icon: 'mdi:brightness-6',
      show: { is: ['on'] },
    },
  ],
};

function hassWith(light: FakeState, calls: ServiceCall[] = []): HomeAssistant {
  return fakeHass({
    states: {
      'light.room': light,
      'scene.relax': { state: '2026-10-12T07:00:00+00:00', attributes: { friendly_name: 'Relax' } },
      'scene.night': { state: 'unknown', attributes: { friendly_name: 'Night' } },
      'scene.read': { state: 'unknown', attributes: { friendly_name: 'Read' } },
      'select.room_scene': { state: 'Night', attributes: { options: ['Relax', 'Night', 'Read'] } },
    },
    calls,
  });
}

interface Square {
  surface: HTMLElement;
  button: HTMLElement;
  opened: () => number;
  draw: (hass: HomeAssistant) => void;
}

function square(hass: HomeAssistant, item: Item = ITEM): Square {
  const surface = document.createElement('div');
  surface.className = 'square';
  let opened = 0;
  surface.addEventListener('click', () => {
    opened += 1;
  });
  document.body.append(surface);
  const draw = (now: HomeAssistant): void => {
    render(
      html`<div class="name">Room</div>
        ${lightsButton(now, item, fakeHost({ hass: now }))}`,
      surface,
    );
  };
  draw(hass);
  const button = surface.querySelector<HTMLElement>('button.lights');
  assert.ok(button);
  return { surface, button, opened: () => opened, draw };
}

function press(element: Element | null | undefined, detail = 1): void {
  element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
}

function labels(root: ParentNode, selector: string): (string | null)[] {
  return [...root.querySelectorAll(selector)].map((each) => each.getAttribute('aria-label'));
}

function escape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

function pick(surface: HTMLElement, name: string, detail: number): void {
  press(surface.querySelector(`.options [aria-label="${name}"]`), detail);
}

function power(surface: HTMLElement): HTMLElement | null {
  return surface.querySelector<HTMLElement>('.options > button:first-child');
}

function sceneRows(surface: HTMLElement): HTMLElement[] {
  return [...surface.querySelectorAll<HTMLElement>('.overlay.scenes [role="menu"] button')];
}

test('the options of a lights button are its scenes, then its brightness and white sliders, in the order of the item, as their show rules allow', () => {
  const on = squareOptions(hassWith(LIGHT), ITEM.controls, fakeHost());
  assert.deepEqual(
    on.map((option) => option.name),
    ['Scenes', 'Brightness', 'White'],
  );
  const off = squareOptions(hassWith({ ...LIGHT, state: 'off' }), ITEM.controls, fakeHost());
  assert.deepEqual(
    off.map((option) => option.name),
    ['Scenes'],
  );
});

test('a tap on the lights button opens its options in its place, the light toggle first where the button is, and toggles nothing nor opens the pop-up', () => {
  const calls: ServiceCall[] = [];
  const { surface, button, opened } = square(hassWith(LIGHT, calls));
  assert.equal(button.getAttribute('aria-haspopup'), 'true');
  assert.equal(button.getAttribute('aria-pressed'), null, 'it opens, so it is no toggle');
  press(button);
  const options = surface.querySelector('.options');
  assert.ok(options);
  assert.deepEqual(labels(options, 'button'), ['Lights', 'Scenes', 'Brightness', 'White']);
  assert.equal(power(surface)?.getAttribute('aria-pressed'), 'true');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(opened(), 0, 'the square does not open its pop-up');
  assert.deepEqual(calls, [], 'nor does the light toggle');
});

test('the toggle in the options toggles the light and keeps them open, and the options follow the light as it changes', () => {
  const calls: ServiceCall[] = [];
  const { surface, button, opened, draw } = square(hassWith(LIGHT, calls));
  press(button);
  press(power(surface));
  assert.deepEqual(
    calls.map(({ domain, service, target }) => [domain, service, target]),
    [['homeassistant', 'toggle', { entity_id: 'light.room' }]],
  );
  assert.equal(opened(), 0);
  const options = surface.querySelector('.options');
  assert.ok(options, 'still open');
  draw(hassWith({ ...LIGHT, state: 'off' }));
  assert.equal(surface.querySelector('.options'), options, 'the same options, redrawn');
  assert.deepEqual(labels(options, 'button'), ['Lights', 'Scenes']);
  assert.equal(power(surface)?.getAttribute('aria-pressed'), 'false');
  draw(hassWith(LIGHT));
  assert.deepEqual(labels(options, 'button'), ['Lights', 'Scenes', 'Brightness', 'White']);
  escape();
  assert.equal(surface.querySelector('.options'), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('a light whose options its state hides opens the toggle alone, and the options it shows once it is on', () => {
  const calls: ServiceCall[] = [];
  const { surface, button, draw } = square(hassWith({ ...LIGHT, state: 'off' }, calls), DIMMED);
  press(button);
  assert.deepEqual(labels(surface, '.options > button'), ['Lights']);
  press(power(surface));
  assert.equal(calls.length, 1);
  draw(hassWith(LIGHT));
  assert.deepEqual(labels(surface, '.options > button'), ['Lights', 'Brightness']);
  escape();
});

test('a lights button with nothing to offer toggles the light on a tap and claims no pop-up', () => {
  const calls: ServiceCall[] = [];
  const { surface, button, opened } = square(hassWith(LIGHT, calls), {
    entity: 'light.room',
    controls: [{ type: 'toggle', entity: 'light.room' }],
  });
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.getAttribute('aria-haspopup'), null);
  assert.equal(button.getAttribute('aria-expanded'), null);
  press(button);
  assert.deepEqual(
    calls.map(({ domain, service, target }) => [domain, service, target]),
    [['homeassistant', 'toggle', { entity_id: 'light.room' }]],
  );
  assert.equal(opened(), 0);
  assert.equal(surface.querySelector('.options, .overlay'), null);
});

test('an option turns the square into its slider, and the scenes into a list that picks one and gives the square back', () => {
  const calls: ServiceCall[] = [];
  const { surface, button } = square(hassWith(LIGHT, calls));
  press(button);
  pick(surface, 'Brightness', 1);
  assert.equal(surface.querySelector('.options'), null);
  assert.ok(surface.querySelector('.overlay mnml-slider'));
  escape();
  assert.equal(surface.querySelector('.overlay'), null);
  press(button);
  pick(surface, 'Scenes', 1);
  const list = surface.querySelector('.overlay.scenes [role="menu"]');
  assert.ok(list);
  assert.deepEqual(
    [...list.querySelectorAll('[role="menuitem"]')].map((row) => row.textContent?.trim()),
    ['Relax', 'Night'],
  );
  press(list.querySelector('[role="menuitem"]'));
  assert.deepEqual(
    calls.map(({ target }) => target),
    [{ entity_id: 'scene.relax' }],
  );
  assert.equal(surface.querySelector('.overlay'), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('the lights button is expanded while anything it opened is open, a slider picked from its options included, and collapses by every way out', () => {
  vi.useFakeTimers();
  const { surface, button } = square(hassWith(LIGHT));
  press(button);
  vi.advanceTimersByTime(3000);
  assert.equal(surface.querySelector('.options'), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false', 'after the idle close');
  press(button);
  pick(surface, 'Brightness', 1);
  assert.ok(surface.querySelector('.overlay mnml-slider'));
  assert.equal(button.getAttribute('aria-expanded'), 'true', 'handed from the options on');
  escape();
  assert.equal(surface.querySelector('.overlay'), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  press(button);
  document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  assert.equal(surface.querySelector('.options'), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false', 'after a press outside');
});

test('a tap on the toggle in the options restarts their idle close', () => {
  vi.useFakeTimers();
  const { surface, button } = square(hassWith(LIGHT));
  press(button);
  vi.advanceTimersByTime(2500);
  press(power(surface));
  vi.advanceTimersByTime(2500);
  assert.ok(surface.querySelector('.options'));
  vi.advanceTimersByTime(500);
  assert.equal(surface.querySelector('.options'), null);
});

test('the scenes list marks the active scene as the scenes menu does, and without an active-scene select its rows are plain menu items', () => {
  const marked = square(hassWith(LIGHT), SCENED);
  press(marked.button);
  pick(marked.surface, 'Scenes', 1);
  assert.deepEqual(
    sceneRows(marked.surface).map((row) => [
      row.getAttribute('role'),
      row.getAttribute('aria-checked'),
      row.classList.contains('selected'),
    ]),
    [
      ['menuitemradio', 'false', false],
      ['menuitemradio', 'true', true],
      ['menuitemradio', 'false', false],
    ],
  );
  escape();
  const plain = square(hassWith(LIGHT));
  press(plain.button);
  pick(plain.surface, 'Scenes', 1);
  assert.deepEqual(
    sceneRows(plain.surface).map((row) => [
      row.getAttribute('role'),
      row.getAttribute('aria-checked'),
    ]),
    [
      ['menuitem', null],
      ['menuitem', null],
    ],
  );
  escape();
});

test('scenes picked from the keyboard open with the focus on the active scene, and the arrows, Home, End and Tab work the list as they work the scenes menu; picked by pointer, the list leaves the focus alone', () => {
  const { surface, button } = square(hassWith(LIGHT), SCENED);
  press(button);
  pick(surface, 'Scenes', 0);
  const rows = sceneRows(surface);
  assert.equal(rows.length, 3);
  const key = (name: string): number => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
    );
    return rows.findIndex((row) => row === document.activeElement);
  };
  assert.equal(document.activeElement, rows[1], 'the active scene has the focus');
  assert.deepEqual(
    ['ArrowDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowDown'].map(key),
    [2, 0, 2, 1, 2, 0],
  );
  key('Tab');
  assert.equal(surface.querySelector('.overlay'), null, 'Tab leaves the list, closing it');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  press(button);
  pick(surface, 'Scenes', 1);
  const list = surface.querySelector('.overlay.scenes [role="menu"]');
  assert.ok(list);
  assert.equal(list.contains(document.activeElement), false);
  escape();
});

test('an option picked from the options hands the focus back to the lights button, so its overlay returns it there', () => {
  const card = document.createElement('div');
  document.body.append(card);
  const root = card.attachShadow({ mode: 'open' });
  const surface = document.createElement('div');
  surface.className = 'square';
  root.append(surface);
  const hass = hassWith(LIGHT);
  render(lightsButton(hass, ITEM, fakeHost({ hass })), surface);
  const button = surface.querySelector<HTMLElement>('button.lights');
  assert.ok(button);
  button.focus();
  press(button);
  const brightness = surface.querySelector<HTMLElement>('.options [aria-label="Brightness"]');
  assert.ok(brightness);
  brightness.focus();
  pick(surface, 'Brightness', 0);
  assert.ok(surface.querySelector('.overlay mnml-slider'));
  assert.equal(root.activeElement, button, 'the options give it back as they close');
  escape();
  assert.equal(surface.querySelector('.overlay'), null);
  assert.equal(root.activeElement, button, 'and so does the slider');
});

test('the lights button opened from the keyboard puts the focus on the toggle in its place, and opened by a pointer moves no focus', () => {
  const keyed = square(hassWith(LIGHT));
  keyed.button.focus();
  press(keyed.button, 0);
  assert.equal(document.activeElement, power(keyed.surface));
  escape();
  const pointed = square(hassWith(LIGHT));
  pointed.button.focus();
  press(pointed.button);
  assert.equal(document.activeElement, pointed.button);
  escape();
});

const AC: FakeState = {
  state: 'cool',
  attributes: {
    friendly_name: 'AC',
    hvac_modes: ['off', 'cool', 'heat'],
    temperature: 24,
    min_temp: 16,
    max_temp: 30,
  },
};

const AC_NAV: NavControl = {
  type: 'nav',
  entity: 'climate.room_ac',
  popup: '#room-ac',
  color: 'blue',
  when: { not: ['off'] },
  controls: [
    {
      type: 'slider',
      entity: 'climate.room_ac',
      slider: 'temperature',
      name: 'Target temperature',
      icon: 'mdi:thermometer',
      color: 'blue',
      show: { not: ['off'] },
    },
    { type: 'select', entity: 'climate.room_ac', attribute: 'hvac_modes', primary: true },
  ],
};

const POWERED: NavControl = {
  ...AC_NAV,
  controls: [...(AC_NAV.controls ?? []), { type: 'toggle', entity: 'climate.room_ac' }],
};

function climate(ac: FakeState, calls: ServiceCall[] = [], nav: NavControl = AC_NAV): Square {
  const surface = document.createElement('div');
  surface.className = 'square';
  let opened = 0;
  surface.addEventListener('click', () => {
    opened += 1;
  });
  document.body.append(surface);
  const draw = (now: HomeAssistant): void => {
    render(navButton(now, nav, fakeHost({ hass: now })) ?? nothing, surface);
  };
  const hass = fakeHass({ states: { 'climate.room_ac': ac }, calls });
  draw(hass);
  const button = surface.querySelector<HTMLElement>('button');
  assert.ok(button);
  return { surface, button, opened: () => opened, draw };
}

test("a pop-up chip with controls opens, in its place, its target temperature, its mode under the current mode's name, and Details, with no toggle of its own", () => {
  history.replaceState(null, '', location.pathname);
  const calls: ServiceCall[] = [];
  const { surface, button, opened, draw } = climate(AC, calls);
  assert.equal(button.getAttribute('aria-haspopup'), 'true');
  press(button);
  assert.deepEqual(labels(surface, '.options > button'), ['Target temperature', 'cool', 'Details']);
  assert.equal(surface.querySelector('.options > [aria-pressed]'), null);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(calls, []);
  assert.equal(opened(), 0);
  assert.equal(location.hash, '', 'nor does it open its pop-up');
  draw(fakeHass({ states: { 'climate.room_ac': { ...AC, state: 'off' } }, calls }));
  assert.deepEqual(labels(surface, '.options > button'), ['off', 'Details']);
  escape();
});

test('a toggle among its controls is the toggle at the foot of its menu, which turns the climate off and stays', () => {
  const calls: ServiceCall[] = [];
  const { surface, button, draw } = climate(AC, calls, POWERED);
  press(button);
  assert.deepEqual(labels(surface, '.options > button'), [
    'AC',
    'Target temperature',
    'cool',
    'Details',
  ]);
  assert.equal(power(surface)?.getAttribute('aria-pressed'), 'true');
  press(power(surface));
  assert.deepEqual(
    calls.map(({ service }) => service),
    ['turn_off'],
  );
  draw(fakeHass({ states: { 'climate.room_ac': { ...AC, state: 'off' } }, calls }));
  assert.deepEqual(labels(surface, '.options > button'), ['AC', 'off', 'Details']);
  assert.equal(power(surface)?.getAttribute('aria-pressed'), 'false');
  escape();
});

test('the mode is a list that sets it, and Details opens the pop-up and gives the button back', () => {
  history.replaceState(null, '', location.pathname);
  const calls: ServiceCall[] = [];
  const { surface, button } = climate({ ...AC, state: 'off' }, calls);
  press(button);
  pick(surface, 'off', 1);
  const list = surface.querySelector('.overlay.scenes [role="menu"]');
  assert.ok(list);
  assert.equal(list.getAttribute('aria-label'), 'AC');
  press([...list.querySelectorAll('button')].find((row) => row.textContent?.trim() === 'cool'));
  assert.deepEqual(calls.at(-1)?.data, { hvac_mode: 'cool' });
  assert.equal(surface.querySelector('.overlay'), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  press(button);
  pick(surface, 'Details', 1);
  assert.equal(location.hash, '#room-ac');
  assert.equal(surface.querySelector('.options'), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  history.replaceState(null, '', location.pathname);
});

test('a pop-up chip with nothing a square opens, or no controls at all, stays a link to its pop-up', () => {
  const hass = fakeHass({ states: { 'climate.room_ac': AC } });
  assert.equal(navButton(hass, { ...AC_NAV, controls: undefined }, fakeHost({ hass })), undefined);
  assert.equal(
    navButton(
      hass,
      { ...AC_NAV, controls: [{ type: 'toggle', entity: 'climate.room_ac' }] },
      fakeHost({ hass }),
    ),
    undefined,
  );
});
