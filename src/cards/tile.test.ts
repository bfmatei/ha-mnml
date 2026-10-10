import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import { MnmlSlider } from './parts/slider.ts';
import { MnmlTileCard } from './tile.ts';

define('mnml-tile-card', MnmlTileCard);
define('mnml-slider', MnmlSlider);

const JANE = {
  entity_id: 'person.jane',
  state: 'home',
  attributes: { friendly_name: 'Jane' },
};

const HASS = {
  states: { 'person.jane': JANE },
  entities: {},
  devices: {},
  locale: { language: 'en' },
  formatEntityState: (stateObj: { state: string }): string => stateObj.state,
};

function card(): MnmlTileCard {
  const made = document.createElement('mnml-tile-card');
  assert.ok(made instanceof MnmlTileCard);
  return made;
}

async function paint(config: unknown, hass: unknown = HASS): Promise<ShadowRoot> {
  const made = card();
  made.setConfig(config as never);
  made.hass = hass as never;
  return mounted(made);
}

test('a tile with an entity and no icon takes the name and the icon from the entity', async () => {
  const out = await paint({
    type: 'custom:mnml-tile-card',
    entity: 'person.jane',
    popup: '#jane',
    state: [{}],
  });
  assert.equal(text(out.querySelector('.name')), 'Jane');
  assert.equal(text(out.querySelector('.state')), 'home');
  const pill = out.querySelector('.pill');
  const icon = pill?.querySelector('ha-state-icon') as unknown as { stateObj: unknown } | null;
  assert.equal(icon?.stateObj, JANE, "the icon follows the entity's state");
  assert.equal(pill?.querySelector('ha-icon'), null);
});

test('a named tile keeps the icon it is given', async () => {
  const out = await paint({
    type: 'custom:mnml-tile-card',
    name: 'System',
    icon: 'mdi:server',
    popup: '#system',
  });
  const icon = out.querySelector('.pill ha-icon') as unknown as { icon: string } | null;
  assert.equal(icon?.icon, 'mdi:server');
});

test("a name item prints another entity's name in the state line", async () => {
  const out = await paint({
    type: 'custom:mnml-tile-card',
    name: 'Phone',
    icon: 'mdi:cellphone',
    popup: '#phone',
    state: [{ entity: 'person.jane', name: true }],
  });
  assert.equal(text(out.querySelector('.state')), 'Jane');
});

test('a watched battery that goes unavailable raises the dot, once per device', async () => {
  const offline = { state: 'unavailable', attributes: {} };
  const out = await paint(
    {
      type: 'custom:mnml-tile-card',
      name: 'Hall',
      icon: 'mdi:door',
      popup: '#hall',
      problems: {
        leaks: ['binary_sensor.hall_leak'],
        batteries: ['sensor.hall_leak_battery', 'sensor.hall_climate_battery'],
      },
    },
    {
      ...HASS,
      states: {
        'binary_sensor.hall_leak': { entity_id: 'binary_sensor.hall_leak', ...offline },
        'sensor.hall_leak_battery': { entity_id: 'sensor.hall_leak_battery', ...offline },
        'sensor.hall_climate_battery': {
          entity_id: 'sensor.hall_climate_battery',
          state: '80',
          attributes: {},
        },
      },
      entities: {
        'binary_sensor.hall_leak': { device_id: 'leak' },
        'sensor.hall_leak_battery': { device_id: 'leak' },
      },
      devices: { leak: { name: 'Leak sensor' } },
    },
  );
  const pill = out.querySelector<HTMLElement>('.pill');
  const dot = pill?.querySelector('.dot');
  assert.ok(dot?.classList.contains('colored'), 'the dot is there, painted');
  assert.equal(pill?.title, 'Hall\nLeak sensor: unavailable', 'the device is named once');
});

test('a text in the state line follows its when rule, like a value does', async () => {
  const out = await paint({
    type: 'custom:mnml-tile-card',
    entity: 'person.jane',
    popup: '#jane',
    state: [
      { text: 'Away', when: { not: ['home'] } },
      { text: 'Here', when: { is: ['home'] } },
    ],
  });
  assert.equal(text(out.querySelector('.state')), 'Here');
});

test('a chip, or a control of the item, of a type the tile does not know is an error card', () => {
  const made = card();
  const tile = { type: 'custom:mnml-tile-card', entity: 'person.jane', popup: '#jane' };
  assert.throws(() => {
    made.setConfig({ ...tile, chips: [{ type: 'toggel', entity: 'light.a' }] } as never);
  }, /chips\[0\]\.type must be one of toggle, /);
  assert.throws(() => {
    made.setConfig({
      ...tile,
      item: {
        entity: 'light.a',
        controls: [{ type: 'nav', entity: 'light.a', popup: '#a' }, { type: 'slide' }],
      },
    } as never);
  }, /item\.controls\[1\]\.type must be one of toggle, /);
});

test('a tile with a name of its own takes no label', () => {
  const made = card();
  assert.throws(() => {
    made.setConfig({
      type: 'custom:mnml-tile-card',
      name: 'Hall',
      icon: 'mdi:door',
      label: 'device',
      popup: '#hall',
    } as never);
  }, /unknown key: label/);
});

test('each state part keeps its text in a box of its own, so a narrow tile can cut it short', async () => {
  const out = await paint({
    type: 'custom:mnml-tile-card',
    entity: 'person.jane',
    popup: '#jane',
    state: [{ icon: true }, { text: 'Here' }],
  });
  const parts = [...(out.querySelector('.state')?.children ?? [])];
  assert.deepEqual(
    parts
      .filter((part) => part.localName === 'span')
      .map((part) => text(part.querySelector('.value'))),
    ['home', 'Here'],
  );
});

test('the slider of the lights row opens over that row, and not over the whole tile', async () => {
  const light = {
    entity_id: 'light.a',
    state: 'on',
    attributes: { friendly_name: 'A', brightness: 128, supported_color_modes: ['brightness'] },
  };
  const out = await paint(
    {
      type: 'custom:mnml-tile-card',
      entity: 'person.jane',
      popup: '#jane',
      item: {
        entity: 'light.a',
        controls: [
          {
            type: 'slider',
            entity: 'light.a',
            slider: 'brightness',
            name: 'Brightness',
            icon: 'mdi:brightness-6',
          },
        ],
      },
    },
    {
      ...HASS,
      states: { ...HASS.states, 'light.a': light },
      formatEntityAttributeValue: (_stateObj: unknown, _name: string, value: unknown): string =>
        String(value),
    },
  );
  const row = out.querySelector('.tile > .row');
  assert.ok(row, 'the lights row');
  const button = row.querySelector<HTMLButtonElement>('button.control');
  assert.ok(button);
  button.click();
  assert.equal(row.querySelector('.overlay')?.parentElement, row, 'in the row');
  assert.equal(out.querySelector('.tile > .overlay'), null, 'not over the tile');
});
