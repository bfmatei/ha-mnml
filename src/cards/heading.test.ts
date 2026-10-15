import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { HomeAssistant } from '../ha/hass.ts';
import { fakeConnection, fakeHass } from '../test/hass.ts';
import type { ServiceCall } from '../test/hass.ts';
import { configure, created, define, mounted, paint as painted, text } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlHeadingCard } from './heading.ts';

define('mnml-heading-card', MnmlHeadingCard);

const CONFIG = {
  type: 'custom:mnml-heading-card',
  title: 'Rooms',
  icon: 'mdi:floor-plan',
  state: [{ entity: 'weather.infrastructure_open_meteo', attribute: 'temperature', icon: true }],
};

function hassWith(state: string, temperature: unknown): HomeAssistant {
  return fakeHass({
    states:
      state === ''
        ? {}
        : { 'weather.infrastructure_open_meteo': { state, attributes: { temperature } } },
    formatEntityAttributeValue: (stateObj, attribute) =>
      `${String(stateObj.attributes[attribute])} °C`,
  });
}

const card = (): MnmlHeadingCard => created('mnml-heading-card', MnmlHeadingCard);

const paint = (hass: HomeAssistant): Promise<ShadowRoot> => painted(card(), CONFIG, hass);

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
  configure(made, CONFIG);
  made.hass = hassWith('cloudy', 14.3);
  const shadow = await mounted(made);
  assert.match(text(shadow), /14\.3/);
  made.hass = hassWith('sunny', 21.8);
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
    configure(made, { ...CONFIG, controls: [{ type: 'toggel', entity: 'light.a' }] });
  }, /controls\[0\]\.type must be one of toggle, /);
});

test('a key of another variant is unknown: a toggle with a slider, a text with an attribute', () => {
  const made = card();
  assert.throws(() => {
    configure(made, {
      ...CONFIG,
      controls: [{ type: 'toggle', entity: 'light.a', slider: 'brightness' }],
    });
  }, /unknown key: controls\[0\]\.slider/);
  assert.throws(() => {
    configure(made, { ...CONFIG, state: [{ text: 'None', attribute: 'temperature' }] });
  }, /unknown key: state\[0\]\.attribute/);
});

function withRule(rule: Record<string, unknown>): unknown {
  return {
    ...CONFIG,
    controls: [{ type: 'status', name: 'Doors', icon: 'mdi:door', rules: [rule] }],
  };
}

test('a status control whose rule lists no entities is an error card that names it', () => {
  const made = card();
  assert.throws(() => {
    configure(made, withRule({ color: 'red', is: ['on'] }));
  }, /controls\[0\]\.rules\[0\]\.entities is required/);
  assert.throws(() => {
    configure(made, withRule({ entities: 'binary_sensor.door', color: 'red', is: ['on'] }));
  }, /controls\[0\]\.rules\[0\]\.entities must be a list/);
});

test('a heading without its icon, or a control without a key its kind needs, is an error card that names it', () => {
  const made = card();
  const { icon: _icon, ...untitled } = CONFIG;
  assert.throws(() => {
    configure(made, untitled);
  }, /^Error: icon is required$/);
  assert.throws(() => {
    configure(made, {
      ...CONFIG,
      controls: [
        { type: 'slider', entity: 'light.a', slider: 'brightness' },
        { type: 'nav', entity: 'light.a' },
        { type: 'indicator', entity: 'light.a' },
      ],
    });
  }, /controls\[0\]\.name is required; controls\[0\]\.icon is required; controls\[1\]\.popup is required; controls\[2\]\.color is required/);
});

test('a slider on a heading opens over the heading, which holds it at the height of its controls', async () => {
  const { MnmlSlider } = await import('./parts/slider.ts');
  define('mnml-slider', MnmlSlider);
  const made = card();
  configure(made, {
    type: 'custom:mnml-heading-card',
    title: 'Lights',
    icon: 'mdi:lightbulb-group',
    controls: [
      {
        type: 'slider',
        entity: 'light.a',
        slider: 'brightness',
        name: 'Brightness',
        icon: 'mdi:brightness-6',
      },
    ],
  });
  made.hass = fakeHass({
    states: { 'light.a': { state: 'on', attributes: { brightness: 128 } } },
    formatEntityAttributeValue: (_stateObj, _name, value) => String(value),
  });
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
    configure(made, {
      type: 'custom:mnml-heading-card',
      title: 'Keys',
      icon: 'mdi:key-chain',
      controls: [
        {
          type: 'status',
          name: 'Key',
          icon: 'mdi:key',
          silent: true,
          rules: [{ entities: ['sensor.key'], within_days: 14, color: 'red' }],
        },
      ],
    });
    made.hass = fakeHass({ states: { 'sensor.key': { state: '2026-10-15T03:00:00Z' } } });
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

test("a select control on a timer offers Home Assistant's presets for it, and starts the timer for the one picked", async () => {
  if (typeof HTMLElement.prototype.showPopover !== 'function') {
    Object.assign(HTMLElement.prototype, {
      showPopover: () => undefined,
      hidePopover: () => undefined,
    });
  }
  const sent: unknown[] = [];
  const calls: ServiceCall[] = [];
  const made = card();
  made.setConfig({
    type: 'custom:mnml-heading-card',
    title: 'Kitchen',
    icon: 'mdi:stove',
    controls: [{ type: 'select', entity: 'timer.tea' }],
  });
  made.hass = fakeHass({
    states: { 'timer.tea': { state: 'idle' } },
    connection: fakeConnection({
      sendMessagePromise: (message) => {
        sent.push(message);
        return Promise.resolve({
          entity_id: 'timer.tea',
          options: { timer: { presets: [300, 60, 300, 0, 90.5] } },
        });
      },
    }),
    calls,
  });
  const root = await mounted(made);
  assert.equal(root.querySelector('button.control'), null, 'nothing until the presets are known');
  await until(() => root.querySelector('button.control') !== null, 'the presets');
  assert.deepEqual(sent, [{ type: 'config/entity_registry/get', entity_id: 'timer.tea' }]);
  const trigger = root.querySelector('button.control');
  assert.ok(trigger instanceof HTMLElement);
  trigger.click();
  const offered = [...root.querySelectorAll('.menu button')];
  assert.deepEqual(
    offered.map((button) => text(button)),
    ['5:00', '1:00', '1:30'],
  );
  assert.ok(offered[0] instanceof HTMLElement);
  offered[0].click();
  assert.deepEqual(calls, [
    {
      domain: 'timer',
      service: 'start',
      data: { duration: 300 },
      target: { entity_id: 'timer.tea' },
    },
  ]);
  made.remove();
});
