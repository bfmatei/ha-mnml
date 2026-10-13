import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import { MnmlHeadingCard } from './heading.ts';

define('mnml-heading-card', MnmlHeadingCard);

const CONFIG = {
  type: 'custom:mnml-heading-card',
  title: 'Rooms',
  icon: 'mdi:floor-plan',
  state: [{ entity: 'weather.infrastructure_open_meteo', attribute: 'temperature', icon: true }],
};

function hassWith(state: string, temperature: unknown): unknown {
  return {
    states:
      state === ''
        ? {}
        : {
            'weather.infrastructure_open_meteo': {
              entity_id: 'weather.infrastructure_open_meteo',
              state,
              attributes: { temperature },
            },
          },
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    formatEntityAttributeValue: (
      stateObj: { attributes: Record<string, unknown> },
      attribute: string,
    ): string => `${String(stateObj.attributes[attribute])} °C`,
  };
}

function card(): MnmlHeadingCard {
  const made = document.createElement('mnml-heading-card');
  assert.ok(made instanceof MnmlHeadingCard);
  return made;
}

async function paint(hass: unknown): Promise<ShadowRoot> {
  const made = card();
  made.setConfig(CONFIG as never);
  made.hass = hass as never;
  return mounted(made);
}

test('the Rooms heading renders the outdoor temperature', async () => {
  const out = await paint(hassWith('cloudy', 14.3));
  const state = out.querySelector('.state');
  assert.ok(state, 'a .state node exists');
  assert.match(text(state), /14\.3 °C/, 'HA formats the attribute');
  assert.ok(state.querySelector('ha-state-icon'), 'and the weather condition icon is there');
  assert.match(text(out), /Rooms/);
});

test('the heading repaints when the temperature changes', async () => {
  const made = card();
  made.setConfig(CONFIG as never);
  made.hass = hassWith('cloudy', 14.3) as never;
  const shadow = await mounted(made);
  assert.match(text(shadow), /14\.3/);
  made.hass = hassWith('sunny', 21.8) as never;
  await made.updateComplete;
  assert.match(text(shadow), /21\.8/);
});

test('an absent weather entity leaves out the state node, rather than an empty one', async () => {
  const out = await paint(hassWith('', undefined));
  assert.equal(out.querySelector('.state'), null);
  assert.match(text(out), /Rooms/);
});

test('an unavailable weather entity keeps its place as an orange dash', async () => {
  const out = await paint(hassWith('unavailable', undefined));
  const state = out.querySelector('.state');
  assert.ok(state, 'the state node stays');
  const part = state.children[0];
  assert.ok(part, 'with one part');
  assert.ok(part.classList.contains('colored'), 'painted');
  assert.match(text(part), /—/, 'a dash where the value would be');
  assert.doesNotMatch(text(part), /unavailable/, 'and no state word in the line');
  assert.ok(part.querySelector('ha-state-icon'), 'the icon still says which entity');
  const dash = part.querySelector('.value > span');
  assert.equal(dash?.getAttribute('role'), 'img');
  assert.equal(dash?.getAttribute('aria-label'), 'unavailable', "spoken as HA's word for it");
});

test('a control of a type the card does not know is an error card that names it', () => {
  const made = card();
  assert.throws(() => {
    made.setConfig({ ...CONFIG, controls: [{ type: 'toggel', entity: 'light.a' }] } as never);
  }, /controls\[0\]\.type must be one of toggle, /);
});

test('a key of another variant is unknown: a toggle with a slider, a text with an attribute', () => {
  const made = card();
  assert.throws(() => {
    made.setConfig({
      ...CONFIG,
      controls: [{ type: 'toggle', entity: 'light.a', slider: 'brightness' }],
    } as never);
  }, /unknown key: controls\[0\]\.slider/);
  assert.throws(() => {
    made.setConfig({ ...CONFIG, state: [{ text: 'None', attribute: 'temperature' }] } as never);
  }, /unknown key: state\[0\]\.attribute/);
});

test('a status control whose rule lists no entities is an error card that names it', () => {
  const made = card();
  assert.throws(() => {
    made.setConfig({
      ...CONFIG,
      controls: [
        { type: 'status', name: 'Doors', icon: 'mdi:door', rules: [{ color: 'red', is: ['on'] }] },
      ],
    } as never);
  }, /controls\[0\]\.rules\[0\]\.entities must be a list/);
});

test('a slider on a heading opens over the heading, which holds it at the height of its controls', async () => {
  const { MnmlSlider } = await import('./parts/slider.ts');
  define('mnml-slider', MnmlSlider);
  const made = card();
  made.setConfig({
    type: 'custom:mnml-heading-card',
    title: 'Lights',
    controls: [
      {
        type: 'slider',
        entity: 'light.a',
        slider: 'brightness',
        name: 'Brightness',
        icon: 'mdi:brightness-6',
      },
    ],
  } as never);
  made.hass = {
    states: {
      'light.a': { entity_id: 'light.a', state: 'on', attributes: { brightness: 128 } },
    },
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    formatEntityAttributeValue: (_stateObj: unknown, _name: string, value: unknown): string =>
      String(value),
  } as never;
  const root = await mounted(made);
  const button = root.querySelector('.heading button.control');
  assert.ok(button instanceof HTMLElement);
  button.click();
  const overlay = root.querySelector('.heading > .overlay');
  assert.ok(overlay instanceof HTMLElement, 'the overlay opens on the heading');
  const heading = overlay.parentElement;
  assert.ok(heading);
  assert.equal(getComputedStyle(heading).position, 'relative', 'which places it');
  assert.equal(getComputedStyle(overlay).paddingTop, '0px', 'with no inset to clip');
  assert.equal(
    getComputedStyle(overlay).getPropertyValue('--m-slider-height').trim(),
    '36px',
    'and a slider as tall as the heading',
  );
  made.remove();
});

test('a card taken off the page keeps no wake-up for a key, and takes it again when it returns', async () => {
  vi.useFakeTimers({ now: Date.parse('2026-10-01T00:00:00Z') });
  try {
    const made = card();
    made.setConfig({
      type: 'custom:mnml-heading-card',
      title: 'Keys',
      controls: [
        {
          type: 'status',
          name: 'Key',
          icon: 'mdi:key',
          silent: true,
          rules: [{ entities: ['sensor.key'], within_days: 14, color: 'red' }],
        },
      ],
    } as never);
    made.hass = {
      states: {
        'sensor.key': { entity_id: 'sensor.key', state: '2026-10-15T03:00:00Z', attributes: {} },
      },
      entities: {},
      devices: {},
      locale: { language: 'en' },
      formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    } as never;
    const root = await mounted(made);
    assert.equal(root.querySelector('.control'), null, 'not drawn while the key is further off');
    const refresh = vi.spyOn(made, 'refresh');
    made.remove();
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    assert.equal(refresh.mock.calls.length, 0, 'nothing wakes a card that is off the page');
    document.body.append(made);
    await made.updateComplete;
    assert.equal(root.querySelector('.control'), null, 'back on the page an hour early, not yet');
    await vi.advanceTimersByTimeAsync(3_600_000);
    await made.updateComplete;
    assert.ok(root.querySelector('.control.colored'), 'and red on time, with no new state');
    made.remove();
  } finally {
    vi.useRealTimers();
  }
});
