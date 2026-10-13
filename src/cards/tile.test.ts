import assert from 'node:assert/strict';

import { test } from 'vitest';

import { originOf } from '../ha/navigation.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlEntityCard } from './entity.ts';
import { MnmlTileCard } from './tile.ts';

define('mnml-tile-card', MnmlTileCard);
define('mnml-entity-card', MnmlEntityCard);

const JANE = {
  entity_id: 'person.jane',
  state: 'home',
  attributes: { friendly_name: 'Jane' },
};

const LAST_RUN = {
  entity_id: 'sensor.last_run',
  state: '2026-10-12T07:00:00+00:00',
  attributes: { friendly_name: 'Last run', device_class: 'timestamp' },
};

const HASS = {
  states: { 'person.jane': JANE, 'sensor.last_run': LAST_RUN },
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

test('a relative item prints a timestamp as a relative time', async () => {
  const out = await paint({
    type: 'custom:mnml-tile-card',
    name: 'Checks',
    icon: 'mdi:clipboard-check-outline',
    popup: '#checks',
    state: [{ entity: 'sensor.last_run', relative: true }],
  });
  const time = out.querySelector('.state ha-relative-time') as unknown as {
    datetime: string;
  } | null;
  assert.equal(time?.datetime, '2026-10-12T07:00:00+00:00');
});

test('a relative item takes the entity of its card, and nothing prints while the entity has no value', async () => {
  const own = await paint({
    type: 'custom:mnml-tile-card',
    entity: 'sensor.last_run',
    popup: '#checks',
    state: [{ relative: true }],
  });
  assert.ok(own.querySelector('.state ha-relative-time'));
  const none = await paint({
    type: 'custom:mnml-tile-card',
    entity: 'sensor.missing',
    popup: '#checks',
    state: [{ relative: true }],
  });
  assert.equal(none.querySelector('.state ha-relative-time'), null);
});

const CORNERS = ['front_left', 'front_right', 'rear_left', 'rear_right'] as const;

function tyreHass(pressures: Record<string, string>): unknown {
  const states: Record<string, unknown> = {};
  for (const corner of CORNERS) {
    states[`sensor.tyre_${corner}`] = {
      entity_id: `sensor.tyre_${corner}`,
      state: pressures[corner] ?? '2.4',
      attributes: { friendly_name: `Tyre ${corner}` },
    };
    states[`sensor.target_${corner}`] = {
      entity_id: `sensor.target_${corner}`,
      state: '2.4',
      attributes: { friendly_name: `Target ${corner}` },
    };
  }
  return { ...HASS, states: { ...HASS.states, ...states } };
}

const TYRES = {
  type: 'tyres',
  tyres: CORNERS.map((corner) => `sensor.tyre_${corner}`),
  targets: CORNERS.map((corner) => `sensor.target_${corner}`),
  low_share: 0.85,
  warn_share: 0.92,
};

async function tyreChips(silent: boolean, pressures: Record<string, string>): Promise<Element[]> {
  const out = await paint(
    {
      type: 'custom:mnml-tile-card',
      name: 'M3',
      icon: 'mdi:car',
      popup: '#car',
      chips: [{ ...TYRES, ...(silent ? { silent: true } : {}) }],
    },
    tyreHass(pressures),
  );
  return [...out.querySelectorAll('.chips .control')];
}

test('a silent tyres icon is drawn only while a tyre is dropping, low, or its sensor is unavailable', async () => {
  assert.equal((await tyreChips(true, {})).length, 0, 'all tyres at target: nothing');
  const dropping = await tyreChips(true, { front_left: '2.1' });
  assert.equal(dropping.length, 1);
  assert.match(dropping[0]?.getAttribute('aria-label') ?? '', /dropping/);
  const low = await tyreChips(true, { rear_right: '1.8' });
  assert.equal(low.length, 1);
  assert.match(low[0]?.getAttribute('aria-label') ?? '', /low/);
  const gone = await tyreChips(true, { front_right: 'unavailable' });
  assert.equal(gone.length, 1);
  assert.match(gone[0]?.getAttribute('aria-label') ?? '', /unavailable/i);
});

test('a tyres icon that is not silent is drawn while all is well, as before', async () => {
  assert.equal((await tyreChips(false, {})).length, 1);
});

function alarmChips(rules: unknown[], state: string): Promise<Element[]> {
  return paint(
    {
      type: 'custom:mnml-tile-card',
      name: 'M3',
      icon: 'mdi:car',
      popup: '#car',
      chips: [
        {
          type: 'status',
          name: 'Alarm',
          icon: 'mdi:shield-car',
          silent: true,
          rules,
        },
      ],
    },
    {
      ...HASS,
      states: {
        ...HASS.states,
        'sensor.alarm': {
          entity_id: 'sensor.alarm',
          state,
          attributes: { friendly_name: 'Alarm' },
        },
      },
    },
  ).then((out) => [...out.querySelectorAll('.chips .control')]);
}

const UNARMED = { entities: ['sensor.alarm'], color: 'red', is: ['unarmed'] };

test('a status rule that names unavailable colours an unavailable entity, which is orange otherwise', async () => {
  const named = await alarmChips(
    [UNARMED, { entities: ['sensor.alarm'], color: 'red', is: ['unavailable'] }],
    'unavailable',
  );
  assert.equal(named.length, 1);
  assert.match(named[0]?.getAttribute('style') ?? '', /red/);
  const plain = await alarmChips([UNARMED], 'unavailable');
  assert.equal(plain.length, 1, 'an unavailable entity is still drawn');
  assert.match(plain[0]?.getAttribute('style') ?? '', /orange/);
});

test('a status rule with only a not does not take an unavailable entity from the orange', async () => {
  const chips = await alarmChips(
    [{ entities: ['sensor.alarm'], color: 'red', not: ['unarmed'] }],
    'unavailable',
  );
  assert.equal(chips.length, 1);
  assert.match(chips[0]?.getAttribute('style') ?? '', /orange/);
});

test('a silent status control with a rule for unarmed shows while unarmed and hides while armed', async () => {
  assert.equal((await alarmChips([UNARMED], 'unarmed')).length, 1);
  assert.equal((await alarmChips([UNARMED], 'doorsOnly')).length, 0);
  assert.equal((await alarmChips([UNARMED], 'doorsTiltCabin')).length, 0);
});

const DAY = 86_400_000;

function expiryChips(state: string, withinDays = 14): Promise<Element[]> {
  return paint(
    {
      type: 'custom:mnml-tile-card',
      name: 'Tablet',
      icon: 'mdi:tablet',
      popup: '#tablet',
      chips: [
        {
          type: 'status',
          name: 'Key expires soon',
          icon: 'mdi:key-alert-outline',
          silent: true,
          rules: [{ entities: ['sensor.key'], color: 'red', within_days: withinDays }],
        },
      ],
    },
    {
      ...HASS,
      states: {
        ...HASS.states,
        'sensor.key': {
          entity_id: 'sensor.key',
          state,
          attributes: { friendly_name: 'Key', device_class: 'timestamp' },
        },
      },
    },
  ).then((out) => [...out.querySelectorAll('.chips .control')]);
}

test('a status rule with within_days holds while a timestamp is that near, or already past, and not before', async () => {
  const soon = await expiryChips(new Date(Date.now() + 5 * DAY).toISOString());
  assert.equal(soon.length, 1, 'five days off, inside 14');
  assert.match(soon[0]?.getAttribute('style') ?? '', /red/);
  assert.equal((await expiryChips(new Date(Date.now() - DAY).toISOString())).length, 1, 'expired');
  assert.equal(
    (await expiryChips(new Date(Date.now() + 60 * DAY).toISOString())).length,
    0,
    'far off',
  );
  assert.equal(
    (await expiryChips(new Date(Date.now() + 20 * DAY).toISOString(), 30)).length,
    1,
    'the limit is the rule',
  );
});

test('a silent status rule with within_days is quiet for a timestamp that is not a date', async () => {
  assert.equal((await expiryChips('unknown')).length, 0);
  assert.equal((await expiryChips('not a date')).length, 0);
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

const LIGHT = {
  entity_id: 'light.a',
  state: 'on',
  attributes: { friendly_name: 'Lights', brightness: 80, supported_color_modes: ['brightness'] },
};

const RELAX = { entity_id: 'scene.relax', state: '2026-10-12T07:00:00+00:00', attributes: {} };

const LIGHTS_HASS = {
  ...HASS,
  states: { ...HASS.states, 'light.a': LIGHT, 'scene.relax': RELAX },
  formatEntityAttributeValue: (_stateObj: unknown, _name: string, value: unknown): string =>
    `${String(value)}%`,
};

const LIGHT_ITEM = {
  entity: 'light.a',
  popup: '#jane-lights',
  state: [{ when: { is: ['off'] } }, { attribute: 'brightness' }],
  controls: [
    { type: 'scenes', scenes: ['scene.relax'], name: 'Scenes', icon: 'mdi:palette-swatch' },
    {
      type: 'slider',
      entity: 'light.a',
      slider: 'brightness',
      name: 'Brightness',
      icon: 'mdi:brightness-6',
    },
    { type: 'toggle', entity: 'light.a', icon: 'mdi:power', primary: true },
  ],
};

const WITH_LIGHTS = {
  type: 'custom:mnml-tile-card',
  entity: 'person.jane',
  popup: '#jane',
  item: LIGHT_ITEM,
};

test('the item row of a tile is its item minified: a small icon, the name and the state on one line, and every control of the item at a smaller size', async () => {
  const out = await paint(WITH_LIGHTS, LIGHTS_HASS);
  const row = out.querySelector('.tile > .row');
  assert.ok(row, 'the lights row');
  assert.equal(text(row.querySelector('.line')), 'Lights • 80%', 'one line');
  assert.equal(row.querySelector('.text'), null, 'not the two lines of an item');
  assert.ok(row.querySelector('[aria-haspopup]'), 'the scenes button');
  const brightness = row.querySelector('[aria-label="Brightness"]');
  assert.ok(brightness, 'the brightness slider button');
  const controls = [...row.querySelectorAll<HTMLElement>('.control')];
  assert.equal(controls.length, 3, 'scenes, brightness and power');
  assert.equal(controls.at(-1)?.getAttribute('aria-pressed'), 'true', 'power last');
  for (const control of controls) {
    assert.deepEqual(
      [getComputedStyle(control).height, getComputedStyle(control).borderRadius],
      ['28px', '50%'],
      'a 28 px round',
    );
  }
  const pill = row.querySelector('.pill');
  assert.ok(pill);
  const look = getComputedStyle(pill);
  assert.deepEqual([look.width, look.height], ['28px', '28px'], 'a small icon');
  assert.equal(look.backgroundColor, 'rgba(0, 0, 0, 0)', 'with no tile under it');
  assert.equal(getComputedStyle(row).minHeight, '36px', 'one slim line');
});

test("a slider button on a tile's item row opens its slider over that row alone, so the tile's header stays", async () => {
  const out = await paint(WITH_LIGHTS, LIGHTS_HASS);
  const row = out.querySelector<HTMLElement>('.tile > .row');
  assert.ok(row);
  row.querySelector<HTMLElement>('[aria-label="Brightness"]')?.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const overlay = out.querySelector('.overlay');
  assert.ok(overlay, 'a slider opened');
  assert.equal(overlay.parentElement, row, 'inside the row');
  assert.equal(getComputedStyle(row).position, 'relative');
});

test('the item row of a tile reads its state on the same line while the light is off', async () => {
  const out = await paint(WITH_LIGHTS, {
    ...LIGHTS_HASS,
    states: {
      ...LIGHTS_HASS.states,
      'light.a': { ...LIGHT, state: 'off', attributes: { friendly_name: 'Lights' } },
    },
  });
  assert.equal(text(out.querySelector('.tile > .row .line')), 'Lights • off');
});

test("tapping the item row of a tile opens the item's pop-up, not the tile's", async () => {
  history.replaceState(null, '', location.pathname);
  const out = await paint(WITH_LIGHTS, LIGHTS_HASS);
  const row = out.querySelector<HTMLElement>('.tile > .row');
  assert.ok(row);
  row.click();
  assert.equal(location.hash, '#jane-lights');
  history.replaceState(null, '', location.pathname);
});

test("the same item in a pop-up's entity card keeps every control", async () => {
  const made = document.createElement('mnml-entity-card');
  assert.ok(made instanceof MnmlEntityCard);
  made.setConfig({ type: 'custom:mnml-entity-card', ...LIGHT_ITEM } as never);
  made.hass = LIGHTS_HASS as never;
  const out = await mounted(made);
  assert.deepEqual(
    [...out.querySelectorAll('.row .control')].map((control) => control.getAttribute('aria-label')),
    ['Scenes', 'Brightness', 'Lights'],
  );
  assert.equal(text(out.querySelector('.row .text .name')), 'Lights', 'and its two lines');
});

test('a nav chip opens its pop-up from the chip itself, not from the whole tile', async () => {
  const out = await paint({
    type: 'custom:mnml-tile-card',
    entity: 'person.jane',
    popup: '#jane',
    chips: [{ type: 'nav', entity: 'person.jane', popup: '#jane-phone' }],
  });
  const chip = out.querySelector<HTMLElement>('.chips button.control');
  assert.ok(chip);
  chip.click();
  assert.equal(location.hash, '#jane-phone');
  assert.equal(originOf('#jane-phone'), chip);
  history.replaceState(null, '', location.pathname);
});

test('a part the template marked carries its path on the card, its chips, its state and its item, and a card without marks carries none', async () => {
  const marked = {
    type: 'custom:mnml-tile-card',
    entity: 'person.jane',
    popup: '#jane',
    state: [{ entity: 'person.jane', _part: 'card/state/#where' }],
    chips: [
      { type: 'indicator', entity: 'person.jane', color: 'orange', _part: 'card/chips/#home' },
    ],
    item: { entity: 'person.jane', _part: 'card/item' },
    _part: 'card',
  };
  const made = card();
  made.setConfig(marked as never);
  made.hass = HASS as never;
  const out = await mounted(made);
  assert.equal(made.getAttribute('data-part'), 'card');
  assert.deepEqual(
    [...out.querySelectorAll('[data-part]')].map((node) => node.getAttribute('data-part')),
    ['card/state/#where', 'card/chips/#home', 'card/item'],
  );
  const plain = await paint({ type: 'custom:mnml-tile-card', entity: 'person.jane', popup: '#j' });
  assert.equal(plain.querySelector('[data-part]'), null);
});
