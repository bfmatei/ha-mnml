import assert from 'node:assert/strict';

import { html, nothing, render } from 'lit';
import { afterEach, test, vi } from 'vitest';

import type { Item, NavControl } from '../../contract/cards.ts';
import type { HomeAssistant } from '../../ha/hass.ts';
import { fakeHass, fakeHost } from '../../test/hass.ts';
import type { FakeState, ServiceCall } from '../../test/hass.ts';
import { define } from '../../test/render.ts';

import { MnmlSlider } from './slider.ts';
import { lightsButton, navButton } from './square-menu.ts';

define('mnml-slider', MnmlSlider);

afterEach(() => {
  vi.useRealTimers();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
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
  root: ShadowRoot;
  surface: HTMLElement;
  button: HTMLElement;
  opened: () => number;
  draw: (hass: HomeAssistant) => void;
}

function mounted(): { root: ShadowRoot; surface: HTMLElement; opened: () => number } {
  const card = document.createElement('div');
  document.body.append(card);
  const root = card.attachShadow({ mode: 'open' });
  const surface = document.createElement('div');
  surface.className = 'square';
  root.append(surface);
  let opened = 0;
  surface.addEventListener('click', () => {
    opened += 1;
  });
  return { root, surface, opened: () => opened };
}

function square(hass: HomeAssistant, item: Item = ITEM): Square {
  const { root, surface, opened } = mounted();
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
  return { root, surface, button, opened, draw };
}

function press(element: Element | null | undefined, detail = 1): void {
  element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
}

function escape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

function menuOf(root: ShadowRoot): HTMLElement | null {
  return root.querySelector<HTMLElement>('.square-menu');
}

function power(root: ShadowRoot): HTMLElement | null {
  return root.querySelector<HTMLElement>('.square-menu > .power');
}

function options(root: ShadowRoot): (string | null)[] {
  return [...root.querySelectorAll('.square-menu > .option')].map((each) =>
    each.getAttribute('aria-label'),
  );
}

function dimmed(root: ShadowRoot): (string | null)[] {
  return [...root.querySelectorAll('.square-menu > .option[aria-disabled="true"]')].map((each) =>
    each.getAttribute('aria-label'),
  );
}

function option(root: ShadowRoot, name: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`.square-menu > .option[aria-label="${name}"]`);
}

function back(root: ShadowRoot): HTMLElement | null {
  return root.querySelector<HTMLElement>('.square-menu.whole > .head > .back');
}

function slider(root: ShadowRoot): string | undefined {
  const each = root.querySelector('.square-menu.whole > mnml-slider');
  return each instanceof MnmlSlider ? each.label?.name : undefined;
}

function list(root: ShadowRoot): [string | null, (string | undefined)[]] | undefined {
  const rows = root.querySelector('.square-menu.whole > .rows');
  return rows === null
    ? undefined
    : [
        rows.getAttribute('aria-label'),
        [...rows.querySelectorAll('button')].map((each) => each.textContent?.trim()),
      ];
}

function row(root: ShadowRoot, name: string): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('.square-menu > .rows > button')].find(
    (each) => each.textContent?.trim() === name,
  );
}

test("a tap on the lights button opens its options inside the square: the toggle in the button's place, then the scenes, brightness, white and colour; it toggles nothing nor opens the pop-up", () => {
  const calls: ServiceCall[] = [];
  const { root, surface, button, opened } = square(hassWith(LIGHT, calls));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(button.getAttribute('aria-pressed'), null, 'it opens, so it is no toggle');
  press(button);
  const menu = menuOf(root);
  assert.ok(menu);
  assert.equal(menu.parentElement, surface, 'inside the square');
  assert.equal(menu.classList.contains('whole'), false);
  assert.equal(menu.getAttribute('aria-label'), 'Lights');
  assert.equal(
    menu.firstElementChild,
    power(root),
    "the toggle comes first, in the button's place",
  );
  assert.equal(power(root)?.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(options(root), ['Scenes', 'Brightness', 'White', 'Colour']);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(opened(), 0, 'the square does not open its pop-up');
  assert.deepEqual(calls, [], 'nor does the light toggle');
});

test('the toggle toggles the light and keeps the options open, and they follow the light as it changes, the sliders dimmed while it is off', () => {
  const calls: ServiceCall[] = [];
  const { root, button, opened, draw } = square(hassWith(LIGHT, calls));
  press(button);
  press(power(root));
  assert.deepEqual(
    calls.map(({ domain, service, target }) => [domain, service, target]),
    [['homeassistant', 'toggle', { entity_id: 'light.room' }]],
  );
  assert.equal(opened(), 0);
  const menu = menuOf(root);
  assert.ok(menu, 'still open');
  draw(hassWith({ ...LIGHT, state: 'off' }));
  assert.equal(menuOf(root), menu, 'the same options, redrawn');
  assert.deepEqual(options(root), ['Scenes', 'Brightness', 'White', 'Colour']);
  assert.deepEqual(dimmed(root), ['Brightness', 'White', 'Colour']);
  assert.equal(power(root)?.getAttribute('aria-pressed'), 'false');
  draw(hassWith(LIGHT));
  assert.deepEqual(dimmed(root), []);
  escape();
  assert.equal(menuOf(root), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('a slider option makes the square that slider, under a back button and the name, and back returns to the options', () => {
  const { root, button } = square(hassWith(LIGHT));
  press(button);
  press(option(root, 'Brightness'));
  assert.equal(menuOf(root)?.classList.contains('whole'), true);
  assert.equal(slider(root), 'Brightness');
  assert.equal(menuOf(root)?.querySelector('.head > .title')?.textContent, 'Lights');
  assert.equal(options(root).length, 0);
  press(back(root));
  assert.equal(menuOf(root)?.classList.contains('whole'), false);
  assert.deepEqual(options(root), ['Scenes', 'Brightness', 'White', 'Colour']);
  press(option(root, 'Colour'));
  assert.equal(slider(root), 'Colour');
  escape();
  assert.equal(menuOf(root), null, 'Escape closes it all');
});

test('a list option makes the square that list; a row acts and stays, and a part that goes away returns to the options', () => {
  const calls: ServiceCall[] = [];
  const { root, button, draw } = square(hassWith(LIGHT, calls));
  press(button);
  press(option(root, 'Scenes'));
  assert.deepEqual(list(root), ['Scenes', ['Relax', 'Night']]);
  press(row(root, 'Relax'));
  assert.deepEqual(
    calls.map(({ domain, service, target }) => [domain, service, target]),
    [['scene', 'turn_on', { entity_id: 'scene.relax' }]],
  );
  assert.ok(list(root), 'still the list');
  press(back(root));
  press(option(root, 'Brightness'));
  draw(hassWith({ ...LIGHT, state: 'off' }));
  assert.equal(menuOf(root)?.classList.contains('whole'), false, 'back to the options');
  assert.deepEqual(dimmed(root), ['Brightness', 'White', 'Colour']);
  escape();
});

test('a slider its state hides is a dimmed button that does nothing, until the light is on', () => {
  const calls: ServiceCall[] = [];
  const { root, button, opened, draw } = square(
    hassWith({ ...LIGHT, state: 'off' }, calls),
    DIMMED,
  );
  press(button);
  assert.ok(power(root));
  assert.deepEqual(options(root), ['Brightness']);
  assert.deepEqual(dimmed(root), ['Brightness']);
  press(option(root, 'Brightness'));
  assert.equal(menuOf(root)?.classList.contains('whole'), false, 'no slider');
  assert.equal(opened(), 0);
  assert.deepEqual(calls, []);
  press(power(root));
  assert.equal(calls.length, 1);
  draw(hassWith(LIGHT));
  assert.deepEqual(dimmed(root), []);
  press(option(root, 'Brightness'));
  assert.equal(slider(root), 'Brightness');
  escape();
});

test('a lights button with nothing to offer toggles the light on a tap and claims no options', () => {
  const calls: ServiceCall[] = [];
  const { root, button, opened } = square(hassWith(LIGHT, calls), {
    entity: 'light.room',
    controls: [{ type: 'toggle', entity: 'light.room' }],
  });
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.getAttribute('aria-expanded'), null);
  press(button);
  assert.deepEqual(
    calls.map(({ domain, service, target }) => [domain, service, target]),
    [['homeassistant', 'toggle', { entity_id: 'light.room' }]],
  );
  assert.equal(opened(), 0);
  assert.equal(menuOf(root), null);
});

test('the options stay open until they are dismissed, by Escape or a press outside, and the button is expanded while they are open', () => {
  vi.useFakeTimers();
  const { root, button } = square(hassWith(LIGHT));
  press(button);
  vi.advanceTimersByTime(10_000);
  assert.ok(menuOf(root), 'no idle close');
  escape();
  assert.equal(menuOf(root), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false', 'after Escape');
  press(button);
  power(root)?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
  assert.ok(menuOf(root), 'a press inside is not outside');
  document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  assert.equal(menuOf(root), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false', 'after a press outside');
});

test('a scenes list marks the active scene as the scenes menu does, and without an active-scene select its rows mark none', () => {
  const marked = square(hassWith(LIGHT), SCENED);
  press(marked.button);
  press(option(marked.root, 'Scenes'));
  assert.deepEqual(
    [...marked.root.querySelectorAll('.rows > button')].map((each) => [
      each.getAttribute('aria-pressed'),
      each.classList.contains('selected'),
    ]),
    [
      ['false', false],
      ['true', true],
      ['false', false],
    ],
  );
  escape();
  const plain = square(hassWith(LIGHT));
  press(plain.button);
  press(option(plain.root, 'Scenes'));
  assert.deepEqual(
    [...plain.root.querySelectorAll('.rows > button')].map((each) =>
      each.getAttribute('aria-pressed'),
    ),
    [null, null],
  );
  escape();
});

test('from the keyboard, the options focus the toggle, a list its current row, back the option it came from, and Escape the button; by a pointer, no focus moves', () => {
  const keyed = square(hassWith(LIGHT), SCENED);
  keyed.button.focus();
  press(keyed.button, 0);
  assert.equal(keyed.root.activeElement, power(keyed.root));
  press(option(keyed.root, 'Scenes'), 0);
  assert.equal(keyed.root.activeElement, row(keyed.root, 'Night'));
  press(back(keyed.root), 0);
  assert.equal(keyed.root.activeElement, option(keyed.root, 'Scenes'));
  escape();
  assert.equal(keyed.root.activeElement, keyed.button);
  const pointed = square(hassWith(LIGHT));
  pointed.button.focus();
  press(pointed.button);
  assert.equal(pointed.root.activeElement, pointed.button);
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
  const { root, surface, opened } = mounted();
  const draw = (now: HomeAssistant): void => {
    render(navButton(now, nav, fakeHost({ hass: now })) ?? nothing, surface);
  };
  draw(fakeHass({ states: { 'climate.room_ac': ac }, calls }));
  const button = surface.querySelector<HTMLElement>('button');
  assert.ok(button);
  return { root, surface, button, opened, draw };
}

test("a pop-up chip with controls opens its options with its mode in the button's place, named for the current one, then its target temperature", () => {
  history.replaceState(null, '', location.pathname);
  const calls: ServiceCall[] = [];
  const { root, button, opened, draw } = climate(AC, calls);
  press(button);
  assert.equal(power(root), null);
  const lead = root.querySelector<HTMLElement>('.square-menu > .lead');
  assert.equal(menuOf(root)?.firstElementChild, lead, "the mode, in the button's place");
  assert.deepEqual(options(root), ['AC: cool', 'Target temperature']);
  press(lead);
  assert.deepEqual(list(root), ['AC', ['off', 'cool', 'heat']]);
  assert.equal(row(root, 'cool')?.getAttribute('aria-pressed'), 'true');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(calls, []);
  assert.equal(opened(), 0);
  assert.equal(location.hash, '', 'nor does it open its pop-up');
  press(back(root));
  draw(fakeHass({ states: { 'climate.room_ac': { ...AC, state: 'off' } }, calls }));
  assert.deepEqual(options(root), ['AC: off', 'Target temperature']);
  assert.deepEqual(dimmed(root), ['Target temperature']);
  escape();
  assert.equal(menuOf(root), null);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test("a toggle among its controls takes the button's place, and turns the climate off and stays", () => {
  const calls: ServiceCall[] = [];
  const { root, button, draw } = climate(AC, calls, POWERED);
  press(button);
  assert.equal(power(root)?.getAttribute('aria-pressed'), 'true');
  press(power(root));
  assert.deepEqual(
    calls.map(({ service }) => service),
    ['turn_off'],
  );
  draw(fakeHass({ states: { 'climate.room_ac': { ...AC, state: 'off' } }, calls }));
  assert.equal(power(root)?.getAttribute('aria-pressed'), 'false');
  escape();
});

test('a named menu shows its name, its current option and its own icon, and dims with its show rule', () => {
  const calls: ServiceCall[] = [];
  const nav: NavControl = {
    ...AC_NAV,
    controls: [
      ...(AC_NAV.controls ?? []),
      {
        type: 'select',
        entity: 'climate.room_ac',
        attribute: 'fan_modes',
        name: 'Fan',
        icon: 'mdi:fan',
        show: { not: ['off'] },
      },
    ],
  };
  const fan = {
    ...AC,
    attributes: { ...AC.attributes, fan_modes: ['auto', 'low', 'high'], fan_mode: 'low' },
  };
  const { root, button, draw } = climate(fan, calls, nav);
  press(button);
  assert.deepEqual(options(root), ['AC: cool', 'Target temperature', 'Fan: Low']);
  assert.equal(
    Reflect.get(option(root, 'Fan: Low')?.querySelector('ha-icon') ?? {}, 'icon'),
    'mdi:fan',
  );
  press(option(root, 'Fan: Low'));
  assert.deepEqual(list(root), ['Fan', ['Auto', 'Low', 'High']]);
  assert.equal(menuOf(root)?.querySelector('.head > .title')?.textContent, 'Fan');
  press(row(root, 'High'));
  assert.deepEqual(calls.at(-1)?.data, { fan_mode: 'high' });
  press(back(root));
  draw(fakeHass({ states: { 'climate.room_ac': { ...fan, state: 'off' } }, calls }));
  assert.deepEqual(dimmed(root), ['Target temperature', 'Fan: Low']);
  escape();
});

test('a mode row sets the mode and leaves the list open', () => {
  const calls: ServiceCall[] = [];
  const { root, button } = climate({ ...AC, state: 'off' }, calls);
  press(button);
  press(option(root, 'AC: off'));
  press(row(root, 'cool'));
  assert.deepEqual(calls.at(-1)?.data, { hvac_mode: 'cool' });
  assert.ok(list(root));
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  escape();
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
