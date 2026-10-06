import assert from 'node:assert/strict';

import { test } from 'vitest';

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
