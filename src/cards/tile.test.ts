import assert from 'node:assert/strict';

import { CSSResult } from 'lit';
import { test } from 'vitest';

import type { HomeAssistant } from '../ha/hass.ts';
import { originOf } from '../ha/navigation.ts';
import { fakeConnection, fakeHass } from '../test/hass.ts';
import { configure, created, define, mounted, text } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlEntityCard } from './entity.ts';
import { tipOf } from './parts/tooltip.ts';
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

const HASS = fakeHass({ states: { 'person.jane': JANE, 'sensor.last_run': LAST_RUN } });

const card = (): MnmlTileCard => created('mnml-tile-card', MnmlTileCard);

async function paint(config: unknown, hass: HomeAssistant = HASS): Promise<ShadowRoot> {
  const made = card();
  configure(made, config);
  made.hass = hass;
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
  const icon = pill?.querySelector('ha-state-icon');
  assert.ok(icon);
  assert.equal(
    Reflect.get(icon, 'stateObj'),
    HASS.states['person.jane'],
    "the icon follows the entity's state",
  );
  assert.equal(pill?.querySelector('ha-icon'), null);
});

test('a named tile keeps the icon it is given', async () => {
  const out = await paint({
    type: 'custom:mnml-tile-card',
    name: 'System',
    icon: 'mdi:server',
    popup: '#system',
  });
  const icon = out.querySelector('.pill ha-icon');
  assert.ok(icon);
  assert.equal(Reflect.get(icon, 'icon'), 'mdi:server');
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
  const time = out.querySelector('.state ha-relative-time');
  assert.ok(time);
  assert.equal(Reflect.get(time, 'datetime'), '2026-10-12T07:00:00+00:00');
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

test('a relative attribute prints the attribute as a relative time, and nothing while it is empty', async () => {
  const schedule = {
    entity_id: 'schedule.coffee',
    state: 'on',
    attributes: { friendly_name: 'Coffee', next_event: '2026-10-14T22:00:00+00:00' },
    last_changed: '2026-10-14T06:00:00+00:00',
  };
  const idle = { ...schedule, entity_id: 'schedule.idle', attributes: { next_event: null } };
  const hass = fakeHass({
    ...HASS,
    states: { ...HASS.states, 'schedule.coffee': schedule, 'schedule.idle': idle },
  });
  const out = await paint(
    {
      type: 'custom:mnml-tile-card',
      entity: 'schedule.coffee',
      popup: '#kitchen',
      state: [{ attribute: 'next_event', relative: true }],
    },
    hass,
  );
  const time = out.querySelector('.state ha-relative-time');
  assert.ok(time);
  assert.equal(Reflect.get(time, 'datetime'), '2026-10-14T22:00:00+00:00');
  const empty = await paint(
    {
      type: 'custom:mnml-tile-card',
      entity: 'schedule.idle',
      popup: '#kitchen',
      state: [{ attribute: 'next_event', relative: true }],
    },
    hass,
  );
  assert.equal(empty.querySelector('.state ha-relative-time'), null);
});

test('a since item prints how long ago its entity last changed, as a relative time', async () => {
  const leak = {
    entity_id: 'binary_sensor.leak',
    state: 'on',
    attributes: { friendly_name: 'Leak' },
    last_changed: '2026-10-14T09:12:00+00:00',
  };
  const out = await paint(
    {
      type: 'custom:mnml-tile-card',
      entity: 'binary_sensor.leak',
      popup: '#bathroom',
      state: [{}, { since: true }],
    },
    fakeHass({ ...HASS, states: { ...HASS.states, 'binary_sensor.leak': leak } }),
  );
  const time = out.querySelector('.state ha-relative-time');
  assert.ok(time);
  assert.equal(Reflect.get(time, 'datetime'), '2026-10-14T09:12:00+00:00');
  assert.match(text(out.querySelector('.state')), /^on/);
});

const CORNERS = ['front_left', 'front_right', 'rear_left', 'rear_right'] as const;

function tyreHass(pressures: Record<string, string>): HomeAssistant {
  const states: Record<string, { state: string; attributes: Record<string, unknown> }> = {};
  for (const corner of CORNERS) {
    states[`sensor.tyre_${corner}`] = {
      state: pressures[corner] ?? '2.4',
      attributes: { friendly_name: `Tyre ${corner}` },
    };
    states[`sensor.target_${corner}`] = {
      state: '2.4',
      attributes: { friendly_name: `Target ${corner}` },
    };
  }
  return fakeHass({ ...HASS, states: { ...HASS.states, ...states } });
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
    fakeHass({
      ...HASS,
      states: { ...HASS.states, 'sensor.alarm': { state, attributes: { friendly_name: 'Alarm' } } },
    }),
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
    fakeHass({
      ...HASS,
      states: {
        ...HASS.states,
        'sensor.key': { state, attributes: { friendly_name: 'Key', device_class: 'timestamp' } },
      },
    }),
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
    configure(made, { ...tile, chips: [{ type: 'toggel', entity: 'light.a' }] });
  }, /chips\[0\]\.type must be one of toggle, /);
  assert.throws(() => {
    configure(made, {
      ...tile,
      item: {
        entity: 'light.a',
        controls: [{ type: 'nav', entity: 'light.a', popup: '#a' }, { type: 'slide' }],
      },
    });
  }, /item\.controls\[1\]\.type must be one of toggle, /);
});

test('a tile without its pop-up, or with a name and no icon, is an error card that names what it lacks', () => {
  const made = card();
  assert.throws(() => {
    configure(made, { type: 'custom:mnml-tile-card', entity: 'person.jane' });
  }, /^Error: popup is required$/);
  assert.throws(() => {
    configure(made, { type: 'custom:mnml-tile-card', name: 'Hall', popup: '#hall' });
  }, /^Error: icon is required$/);
  assert.throws(() => {
    configure(made, {
      type: 'custom:mnml-tile-card',
      entity: 'person.jane',
      popup: '#jane',
      item: { entity: 'light.a', controls: [{ type: 'toggle' }] },
    });
  }, /^Error: item\.controls\[0\]\.entity is required$/);
});

test('a tile is a large or a small square, with the trend of a sensor; any other shape or trend is an error card', () => {
  const made = card();
  const tile = { type: 'custom:mnml-tile-card', entity: 'person.jane', popup: '#jane' };
  configure(made, {
    ...tile,
    square: 'large',
    trend: {
      entity: 'sensor.hall_temperature',
      color: 'amber',
      when: { entity: 'climate.hall', attribute: 'hvac_action', is: ['heating'] },
    },
  });
  configure(made, { ...tile, square: 'small' });
  assert.throws(() => {
    configure(made, { ...tile, square: 'round' });
  }, /^Error: square must be one of large, small$/);
  assert.throws(() => {
    configure(made, { ...tile, trend: { color: 'amber' } });
  }, /^Error: trend\.entity is required$/);
  assert.throws(() => {
    configure(made, { ...tile, trend: { entity: 'light.a' } });
  }, /trend\.entity/);
});

test('a tile with a name of its own takes no label', () => {
  const made = card();
  assert.throws(() => {
    configure(made, {
      type: 'custom:mnml-tile-card',
      name: 'Hall',
      icon: 'mdi:door',
      label: 'device',
      popup: '#hall',
    });
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

const LIGHTS_HASS = fakeHass({
  ...HASS,
  states: { ...HASS.states, 'light.a': LIGHT, 'scene.relax': RELAX },
  formatEntityAttributeValue: (_stateObj, _name, value) => `${String(value)}%`,
});

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

test("the item row of a tile is its item minified: a small icon, the state on one line with the name its icon's label, and every control of the item at a smaller size", async () => {
  const out = await paint(WITH_LIGHTS, LIGHTS_HASS);
  const row = out.querySelector('.tile > .row');
  assert.ok(row, 'the lights row');
  assert.equal(text(row.querySelector('.line')), '80%', 'one line');
  assert.equal(row.querySelector('.pill')?.getAttribute('aria-label'), 'Lights');
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

function coarseRules(): CSSStyleRule[] {
  const style = document.createElement('style');
  style.textContent = MnmlTileCard.styles
    .flat()
    .map((sheet) => (sheet instanceof CSSResult ? sheet.cssText : ''))
    .join('\n');
  document.head.append(style);
  const rules = [...(style.sheet?.cssRules ?? [])].flatMap((rule) =>
    rule instanceof CSSMediaRule && rule.conditionText === '(pointer: coarse)'
      ? [...rule.cssRules].filter((inner) => inner instanceof CSSStyleRule)
      : [],
  );
  style.remove();
  return rules;
}

function px(rules: CSSStyleRule[], selector: string, property: string): number {
  const found = rules.find((rule) => rule.selectorText === selector);
  assert.ok(found, selector);
  return Number.parseFloat(found.style.getPropertyValue(property));
}

test("on a touch screen each control of a tile's Lights row keeps its 28 px look and has a 44 px target of its own", async () => {
  const out = await paint(WITH_LIGHTS, LIGHTS_HASS);
  const control = out.querySelector<HTMLElement>('.tile > .row .control');
  assert.ok(control);
  const size = Number.parseFloat(getComputedStyle(control).height);
  assert.equal(size, 28);
  const coarse = coarseRules();
  const reach = -px(coarse, '.tile > .row .control:not(.inert)::after', 'inset');
  const gap = px(coarse, '.tile > .row > .lane', 'gap');
  assert.ok(size + 2 * reach >= 44, 'a target of at least 44 by 44 px');
  assert.ok(gap >= 2 * reach, 'that does not overlap its neighbour');
});

test("a press between two controls of a tile's Lights row opens nothing", async () => {
  history.replaceState(null, '', location.pathname);
  const out = await paint(WITH_LIGHTS, LIGHTS_HASS);
  const lane = out.querySelector<HTMLElement>('.tile > .row > .lane');
  assert.ok(lane);
  lane.click();
  assert.equal(location.hash, '', 'neither the row nor the tile opens its pop-up');
  history.replaceState(null, '', location.pathname);
});

test("a slider button on a tile's item row opens its slider over that row alone, so the tile's header stays", async () => {
  const out = await paint(WITH_LIGHTS, LIGHTS_HASS);
  const row = out.querySelector<HTMLElement>('.tile > .row');
  assert.ok(row);
  row.querySelector<HTMLElement>('[aria-label="Brightness"]')?.click();
  await until(() => out.querySelector('.overlay') !== null, 'a slider');
  const overlay = out.querySelector('.overlay');
  assert.ok(overlay, 'a slider opened');
  assert.equal(overlay.parentElement, row, 'inside the row');
  assert.equal(getComputedStyle(row).position, 'relative');
});

test('the item row of a tile reads its state on the same line while the light is off', async () => {
  const out = await paint(
    WITH_LIGHTS,
    fakeHass({
      ...LIGHTS_HASS,
      states: {
        ...LIGHTS_HASS.states,
        'light.a': { ...LIGHT, state: 'off', attributes: { friendly_name: 'Lights' } },
      },
    }),
  );
  assert.equal(text(out.querySelector('.tile > .row .line')), 'off');
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
  configure(made, { type: 'custom:mnml-entity-card', ...LIGHT_ITEM });
  made.hass = LIGHTS_HASS;
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
  configure(made, marked);
  made.hass = HASS;
  const out = await mounted(made);
  assert.equal(made.getAttribute('data-part'), 'card');
  assert.deepEqual(
    [...out.querySelectorAll('[data-part]')].map((node) => node.getAttribute('data-part')),
    ['card/state/#where', 'card/chips/#home', 'card/item'],
  );
  const plain = await paint({ type: 'custom:mnml-tile-card', entity: 'person.jane', popup: '#j' });
  assert.equal(plain.querySelector('[data-part]'), null);
});

const ROOM_HASS = fakeHass({
  ...LIGHTS_HASS,
  states: {
    ...LIGHTS_HASS.states,
    'sensor.hall_temperature': { state: '21.5', attributes: { friendly_name: 'Temperature' } },
    'sensor.hall_humidity': { state: '48', attributes: { friendly_name: 'Humidity' } },
    'binary_sensor.window': { state: 'on', attributes: { friendly_name: 'Window' } },
    'binary_sensor.door': { state: 'on', attributes: { friendly_name: 'Door' } },
    'binary_sensor.leak': { state: 'on', attributes: { friendly_name: 'Leak' } },
    'binary_sensor.motion': { state: 'on', attributes: { friendly_name: 'Motion' } },
    'lock.front': { state: 'unlocked', attributes: { friendly_name: 'Front door' } },
    'climate.hall_ac': {
      state: 'cool',
      attributes: { friendly_name: 'AC', hvac_modes: ['off', 'cool'] },
    },
    'climate.hall_heating': {
      state: 'heat',
      attributes: { friendly_name: 'Heating', hvac_action: 'heating' },
    },
  },
});

const ROOM_CHIPS = [
  { type: 'indicator', entity: 'binary_sensor.window', color: 'orange' },
  { type: 'indicator', entity: 'binary_sensor.door', color: 'orange' },
  {
    type: 'status',
    name: 'Leak',
    icon: 'mdi:water-alert',
    silent: true,
    rules: [{ entities: ['binary_sensor.leak'], is: ['on'], color: 'red' }],
  },
  {
    type: 'status',
    name: 'Motion',
    icon: 'mdi:motion-sensor',
    rules: [{ entities: ['binary_sensor.motion'], is: ['off'], color: 'orange' }],
  },
  { type: 'toggle', entity: 'lock.front', color: 'red', when: { is: ['unlocked'] } },
  {
    type: 'nav',
    entity: 'climate.hall_ac',
    popup: '#hall-ac',
    color: 'blue',
    when: { not: ['off'] },
  },
  {
    type: 'nav',
    entity: 'climate.hall_heating',
    popup: '#hall-heating',
    color: 'amber',
    when: { not: ['off'] },
  },
];

const ROOM = {
  type: 'custom:mnml-tile-card',
  name: 'Hall',
  icon: 'mdi:door',
  popup: '#hall',
  square: 'large',
  state: [
    { entity: 'sensor.hall_temperature' },
    { entity: 'sensor.hall_humidity' },
    { entity: 'binary_sensor.window' },
  ],
  chips: ROOM_CHIPS,
  item: LIGHT_ITEM,
};

function labels(root: ParentNode, selector: string): (string | null)[] {
  return [...root.querySelectorAll(selector)].map((each) => each.getAttribute('aria-label'));
}

test('a large square is its pill, its worst issues in the corner, its name over its first two readings, each on its line, and a column of buttons that ends with its lights', async () => {
  const out = await paint(ROOM, ROOM_HASS);
  assert.ok(out.querySelector('.tile.square.large > .pill'));
  assert.deepEqual(labels(out, '.strip > [role="img"]'), [
    'Leak. Leak: on',
    'Window: on',
    'Door: on',
  ]);
  assert.equal(text(out.querySelector('.text > .name')), 'Hall');
  assert.deepEqual(
    [...out.querySelectorAll('.text > .hero')].map(text),
    ['21.5', '48'],
    'the first two readings alone',
  );
  assert.deepEqual(labels(out, '.column > button'), ['Front door', 'AC', 'Lights']);
  assert.equal(out.querySelector('.row'), null, 'no Lights row');
  assert.equal(out.querySelector<HTMLElement>('.glow')?.style.getPropertyValue('--m-glow'), '23%');
  const motion = (await paint({ ...ROOM, square: undefined }, ROOM_HASS)).querySelector(
    '.chips > [role="img"][aria-label="Motion"]',
  );
  assert.ok(motion, 'the chip left out shows on a strip');
  assert.equal(motion.classList.contains('colored'), false, 'with no colour');
});

test('a strip holds three issues at most, the third counting the rest, whose tooltip names them', async () => {
  const out = await paint(
    {
      ...ROOM,
      chips: [
        ...ROOM_CHIPS,
        { type: 'indicator', entity: 'binary_sensor.motion', color: 'orange' },
      ],
    },
    ROOM_HASS,
  );
  assert.deepEqual(labels(out, '.strip > [role="img"]'), [
    'Leak. Leak: on',
    'Window: on',
    '2 more',
  ]);
  const more = out.querySelector('.strip > .more');
  assert.equal(text(more), '+2');
  assert.equal(tipOf(more), '2 more\nDoor: on\nMotion: on');
});

test('a large square leaves a service chip to its pop-up: neither a button of its column nor a cell of its strip', async () => {
  const config = {
    ...ROOM,
    chips: [
      {
        type: 'service',
        entity: 'button.restart',
        service: 'button.press',
        name: 'Restart',
        icon: 'mdi:restart',
      },
      ...ROOM_CHIPS,
    ],
  };
  const hass = fakeHass({
    ...ROOM_HASS,
    states: {
      ...ROOM_HASS.states,
      'button.restart': { state: '2026-10-12T07:00:00+00:00', attributes: {} },
    },
  });
  const strip = await paint({ ...config, square: undefined }, hass);
  assert.ok(strip.querySelector('.chips > button[aria-label="Restart"]'), 'a strip draws it');
  const out = await paint(config, hass);
  assert.deepEqual(labels(out, '.column > button'), ['Front door', 'AC', 'Lights']);
  assert.equal(out.querySelector('[aria-label="Restart"]'), null);
});

function streamed(): { hass: HomeAssistant; push: (message: unknown) => void } {
  let pushed: ((message: unknown) => void) | undefined;
  const hass = fakeHass({
    ...ROOM_HASS,
    connection: fakeConnection({
      subscribeMessage: (callback) => {
        pushed = callback;
        return Promise.resolve(() => Promise.resolve());
      },
    }),
  });
  return {
    hass,
    push: (message) => {
      pushed?.(message);
    },
  };
}

type Readings = readonly (readonly [string, number])[];

const HALL_DAY: Readings = [
  ['20', 90_000],
  ['22', 3600],
];

function hallDay(readings: Readings): unknown {
  const now = Date.now() / 1000;
  return {
    start_time: now - 86_400,
    end_time: now,
    states: {
      'sensor.hall_temperature': readings.map(([state, ago]) => ({ s: state, lu: now - ago })),
    },
  };
}

test('a large square draws its trend from the history stream once it comes, in its colour while its rule holds', async () => {
  const { hass, push } = streamed();
  const out = await paint(
    {
      ...ROOM,
      trend: {
        entity: 'sensor.hall_temperature',
        color: 'amber',
        when: { entity: 'climate.hall_heating', attribute: 'hvac_action', is: ['heating'] },
      },
    },
    hass,
  );
  assert.equal(out.querySelector('.trend'), null, 'nothing before the history comes');
  push(hallDay(HALL_DAY));
  await until(() => out.querySelector('.trend path') !== null, 'the line');
  const line = out.querySelector('.trend');
  assert.ok(line?.classList.contains('colored'));
  assert.match(line?.getAttribute('style') ?? '', /amber/);
  assert.match(out.querySelector('.trend path')?.getAttribute('d') ?? '', /^M0 100L/);
});

async function trended(trend: unknown, readings: Readings): Promise<ShadowRoot> {
  const { hass, push } = streamed();
  const made = card();
  configure(made, { ...ROOM, trend });
  made.hass = hass;
  const out = await mounted(made);
  push(hallDay(readings));
  await made.updateComplete;
  return out;
}

test('a day of history with no value in it draws no trend', async () => {
  const out = await trended({ entity: 'sensor.hall_temperature', color: 'amber' }, [
    ['unavailable', 90_000],
    ['unknown', 3600],
  ]);
  assert.equal(out.querySelector('.trend'), null);
});

test('a trend with a colour and no rule stays neutral, since its sensor is never on', async () => {
  const out = await trended({ entity: 'sensor.hall_temperature', color: 'amber' }, HALL_DAY);
  const line = out.querySelector('.trend');
  assert.ok(line, 'the line');
  assert.equal(line.classList.contains('colored'), false);
});

test('a large square follows the history of its trend while it is on the page, and a strip never does', async () => {
  const followed: unknown[] = [];
  let closed = 0;
  const hass = fakeHass({
    ...ROOM_HASS,
    connection: fakeConnection({
      subscribeMessage: (_callback, message) => {
        followed.push(message['entity_ids']);
        return Promise.resolve(() => {
          closed += 1;
          return Promise.resolve();
        });
      },
    }),
  });
  const streams = async (): Promise<number> => {
    await until(() => true);
    return followed.length - closed;
  };
  const hall = {
    type: 'custom:mnml-tile-card',
    name: 'Hall',
    icon: 'mdi:door',
    popup: '#hall',
    trend: { entity: 'sensor.hall_temperature' },
  };
  await paint(hall, hass);
  assert.equal(await streams(), 0, 'a strip');
  const made = card();
  configure(made, { ...hall, square: 'large' });
  made.hass = hass;
  await mounted(made);
  assert.equal(await streams(), 1, 'from the first draw');
  const warmer = (state: string): HomeAssistant =>
    fakeHass({
      ...hass,
      states: { ...hass.states, 'sensor.hall_temperature': { state } },
    });
  made.hass = warmer('22');
  await made.updateComplete;
  assert.equal(await streams(), 1, 'one stream while the states change');
  made.remove();
  assert.equal(await streams(), 0, 'closed when the card leaves the page');
  made.hass = warmer('23');
  await made.updateComplete;
  assert.equal(await streams(), 0, 'and not opened again while it is away');
  document.body.append(made);
  await made.updateComplete;
  assert.equal(await streams(), 1, 'opened again when it comes back');
  configure(made, { ...hall, square: 'large', trend: { entity: 'sensor.last_run' } });
  await made.updateComplete;
  assert.equal(await streams(), 1, 'one stream after the trend changes');
  assert.deepEqual(followed.at(-1), ['sensor.last_run']);
  made.remove();
});

test('a large square glows only while its light is on', async () => {
  const out = await paint(
    ROOM,
    fakeHass({
      ...ROOM_HASS,
      states: {
        ...ROOM_HASS.states,
        'light.a': { ...LIGHT, state: 'off', attributes: { friendly_name: 'Lights' } },
      },
    }),
  );
  assert.equal(out.querySelector('.glow'), null);
});

test('a tap on the lights of a large square opens its options, its toggle first, in place of its column, and an option turns the square into its control', async () => {
  const out = await paint(ROOM, ROOM_HASS);
  const lights = out.querySelector<HTMLElement>('.column > .lights');
  assert.ok(lights);
  lights.click();
  const options = out.querySelector('.square > .options');
  assert.ok(options);
  assert.deepEqual(labels(options, '.control'), ['Lights', 'Scenes', 'Brightness']);
  options.querySelector<HTMLElement>('[aria-label="Brightness"]')?.click();
  assert.equal(out.querySelector('.square > .options'), null);
  assert.ok(out.querySelector('.square > .overlay mnml-slider'));
});

test("a large square's open options follow its light, gaining its sliders when it turns on", async () => {
  const off = fakeHass({
    ...ROOM_HASS,
    states: {
      ...ROOM_HASS.states,
      'light.a': { ...LIGHT, state: 'off', attributes: { friendly_name: 'Lights' } },
    },
  });
  const out = await paint(
    {
      ...ROOM,
      item: {
        ...LIGHT_ITEM,
        controls: [
          { type: 'scenes', scenes: ['scene.relax'], name: 'Scenes', icon: 'mdi:palette-swatch' },
          {
            type: 'slider',
            entity: 'light.a',
            slider: 'brightness',
            name: 'Brightness',
            icon: 'mdi:brightness-6',
            show: { is: ['on'] },
          },
        ],
      },
    },
    off,
  );
  out.querySelector<HTMLElement>('.column > .lights')?.click();
  assert.deepEqual(labels(out, '.square > .options > .control'), ['Lights', 'Scenes']);
  const made = out.host;
  assert.ok(made instanceof MnmlTileCard);
  made.hass = ROOM_HASS;
  await made.updateComplete;
  assert.deepEqual(labels(out, '.square > .options > .control'), [
    'Lights',
    'Scenes',
    'Brightness',
  ]);
  assert.equal(
    out.querySelector('.square > .options > .control')?.getAttribute('aria-pressed'),
    'true',
  );
});

test("a pop-up chip with controls in a large square's column opens its menu in place of its pop-up", async () => {
  const out = await paint(
    {
      ...ROOM,
      chips: [
        ...ROOM_CHIPS.slice(0, 5),
        {
          type: 'nav',
          entity: 'climate.hall_ac',
          popup: '#hall-ac',
          controls: [{ type: 'select', entity: 'climate.hall_ac', attribute: 'hvac_modes' }],
        },
      ],
    },
    ROOM_HASS,
  );
  const ac = out.querySelector<HTMLElement>('.column > [aria-label="AC"]');
  assert.ok(ac);
  assert.equal(ac.getAttribute('aria-haspopup'), 'true');
  ac.click();
  assert.equal(location.hash, '');
  assert.deepEqual(labels(out, '.square > .options > .control'), ['cool', 'Details']);
});

test('a small square is its icon in a well and its name, with a coloured chip of any kind as a cell, and no buttons nor readings', async () => {
  const out = await paint(
    {
      type: 'custom:mnml-tile-card',
      name: 'AdGuard',
      icon: 'mdi:shield-check',
      popup: '#adguard',
      square: 'small',
      state: [{ entity: 'switch.protection' }],
      chips: [
        { type: 'toggle', entity: 'switch.protection', color: 'orange', when: { is: ['off'] } },
        { type: 'nav', entity: 'switch.protection', popup: '#adguard-protection' },
      ],
    },
    fakeHass({
      states: {
        'switch.protection': { state: 'off', attributes: { friendly_name: 'Protection' } },
      },
    }),
  );
  assert.ok(out.querySelector('.tile.square.small > .well ha-icon'));
  assert.equal(text(out.querySelector('.square > .name')), 'AdGuard');
  assert.equal(out.querySelector('.state'), null, 'no readings');
  assert.equal(out.querySelector('button'), null, 'no buttons');
  assert.deepEqual(labels(out, '.strip > [role="img"]'), ['Protection']);
});

test('a small square holds two cells at most, the second counting the rest, and leaves out a coloured chip that is neither an issue, a toggle nor a nav', async () => {
  const config = {
    type: 'custom:mnml-tile-card',
    name: 'Hall',
    icon: 'mdi:door',
    popup: '#hall',
    square: 'small',
    chips: [
      { type: 'indicator', entity: 'binary_sensor.window', color: 'orange' },
      { type: 'select', entity: 'select.mode', color: 'red', when: { is: ['eco'] } },
      {
        type: 'nav',
        entity: 'climate.hall_ac',
        popup: '#hall-ac',
        color: 'blue',
        when: { not: ['off'] },
      },
      { type: 'toggle', entity: 'lock.front', color: 'red', when: { is: ['unlocked'] } },
    ],
  };
  const hass = fakeHass({
    ...ROOM_HASS,
    states: {
      ...ROOM_HASS.states,
      'select.mode': {
        state: 'eco',
        attributes: { friendly_name: 'Mode', options: ['eco', 'comfort'] },
      },
    },
  });
  const mode = (await paint({ ...config, square: undefined }, hass)).querySelector(
    '.chips > button[aria-label="Mode"]',
  );
  assert.ok(mode?.classList.contains('colored'), 'a strip draws the select, coloured');
  const out = await paint(config, hass);
  assert.deepEqual(labels(out, '.strip > [role="img"]'), ['Front door', '2 more']);
  const more = out.querySelector('.strip > .more');
  assert.equal(text(more), '+2');
  assert.equal(tipOf(more), '2 more\nWindow: on\nAC');
});
