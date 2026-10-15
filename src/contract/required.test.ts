import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';
import { parse } from 'yaml';

import { problemsOf, requireStructure } from './required.ts';
import { CARD_STRUCTURES } from './structure.ts';
import type { Structure } from './structure.ts';

const card = (type: keyof typeof CARD_STRUCTURES): Structure => CARD_STRUCTURES[type];

const HEADING = card('custom:mnml-heading-card');
const LIST = card('custom:mnml-list-card');
const TILE = card('custom:mnml-tile-card');

test('a missing required key is named by its path, at the top, in a part, in a list and in a tagged kind', () => {
  assert.deepEqual(problemsOf(HEADING, { type: 'custom:mnml-heading-card', title: 'Rooms' }), [
    'icon is required',
  ]);
  assert.deepEqual(problemsOf(LIST, { rows: [{ name: 'Lamp' }] }), ['rows[0].entity is required']);
  assert.deepEqual(
    problemsOf(TILE, { name: 'Living', icon: 'mdi:sofa', popup: '#living', item: {} }),
    ['item.entity is required'],
  );
  assert.deepEqual(
    problemsOf(HEADING, {
      title: 'Rooms',
      icon: 'mdi:home',
      controls: [
        { type: 'slider', entity: 'light.a', slider: 'brightness' },
        { type: 'nav', entity: 'light.a' },
        { type: 'indicator', entity: 'light.a' },
        { type: 'status', name: 'Leaks', icon: 'mdi:water', rules: [{ entities: [] }] },
      ],
    }),
    [
      'controls[0].name is required',
      'controls[0].icon is required',
      'controls[1].popup is required',
      'controls[2].color is required',
      'controls[3].rules[0].color is required',
    ],
  );
});

test('an empty or null required value is missing', () => {
  assert.deepEqual(problemsOf(HEADING, { title: '', icon: null }), [
    'title is required',
    'icon is required',
  ]);
});

test('a tagged part names its kinds when its type is missing or unknown, and checks nothing else of it', () => {
  const kinds =
    'toggle, slider, select, service, nav, indicator, status, tyres, scenes, messages, dismiss';
  assert.deepEqual(
    problemsOf(HEADING, {
      title: 'Rooms',
      icon: 'mdi:home',
      controls: [{ entity: 'light.a' }, { type: 'toggel' }],
    }),
    [`controls[0].type must be one of ${kinds}`, `controls[1].type must be one of ${kinds}`],
  );
});

test('a marked card asks for the keys of the kind its marker picks', () => {
  assert.deepEqual(problemsOf(TILE, { name: 'Living' }), ['icon is required', 'popup is required']);
  assert.deepEqual(problemsOf(TILE, { popup: '#living' }), ['entity is required']);
  assert.deepEqual(problemsOf(TILE, { entity: 'light.a', popup: '#living' }), []);
  const select = card('custom:mnml-select-card');
  assert.deepEqual(problemsOf(select, { scenes: ['scene.a'] }), [
    'name is required',
    'icon is required',
  ]);
  assert.deepEqual(problemsOf(select, {}), ['entity is required']);
});

test('a value of the wrong kind is named by its path and what it must be', () => {
  const heading = { title: 'Rooms', icon: 'mdi:home' };
  const control = (extra: Record<string, unknown>): unknown => ({
    ...heading,
    controls: [{ type: 'toggle', entity: 'light.a', ...extra }],
  });
  assert.deepEqual(problemsOf(HEADING, { ...heading, title: 5 }), ['title must be a text']);
  assert.deepEqual(problemsOf(HEADING, { ...heading, icon: ['mdi:home'] }), [
    'icon must be an icon',
  ]);
  assert.deepEqual(problemsOf(HEADING, control({ primary: 'yes' })), [
    'controls[0].primary must be true',
  ]);
  assert.deepEqual(problemsOf(HEADING, control({ color: 'green' })), [
    'controls[0].color must be one of red, orange, amber, blue',
  ]);
  assert.deepEqual(problemsOf(HEADING, control({ entity: 'Living lights' })), [
    'controls[0].entity must be an entity',
  ]);
  assert.deepEqual(problemsOf(HEADING, control({ when: 'on' })), [
    'controls[0].when must be a mapping',
  ]);
  assert.deepEqual(problemsOf(HEADING, control({ when: { is: 'on' } })), [
    'controls[0].when.is must be a list of texts',
  ]);
  assert.deepEqual(problemsOf(HEADING, control({ when: { not: [true] } })), [
    'controls[0].when.not must be a list of texts',
  ]);
  assert.deepEqual(problemsOf(HEADING, control({ show: { entity: 'on' } })), [
    'controls[0].show.entity must be an entity',
  ]);
  assert.deepEqual(problemsOf(HEADING, { ...heading, controls: { type: 'toggle' } }), [
    'controls must be a list',
  ]);
  assert.deepEqual(problemsOf(HEADING, { ...heading, controls: ['toggle'] }), [
    'controls[0] must be a mapping',
  ]);
  assert.deepEqual(
    problemsOf(HEADING, {
      ...heading,
      controls: [
        { type: 'service', entity: 'button.a', service: 'press', name: 'Go', icon: 'mdi:play' },
        { type: 'nav', entity: 'light.a', popup: 'kitchen' },
        { type: 'scenes', scenes: 'scene.a', name: 'Scenes', icon: 'mdi:palette' },
        { type: 'scenes', scenes: ['light.a'], name: 'Scenes', icon: 'mdi:palette' },
      ],
    }),
    [
      'controls[0].service must be a service, such as light.turn_on',
      "controls[1].popup must be a pop-up hash, such as '#kitchen'",
      'controls[2].scenes must be a list',
      'controls[3].scenes[0] must be an entity of scene',
    ],
  );
});

test('an entity of the wrong domain, a corner list of the wrong length and a wrong number are named', () => {
  const messages = card('custom:mnml-messages-card');
  assert.deepEqual(problemsOf(messages, { entity: 'light.a', clear: 'script.clear' }), [
    'entity must be an entity of sensor',
  ]);
  const plan = {
    doors: ['binary_sensor.a', 'binary_sensor.b', 'binary_sensor.c', 'binary_sensor.d'],
    hood: 'binary_sensor.hood',
    tailgate: 'binary_sensor.tailgate',
    windows: ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d'],
    tyres: ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d'],
    tyre_targets: ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d'],
    tyre_low_share: 0.8,
    tyre_warn_share: 0.9,
  };
  const carPlan = card('custom:mnml-car-plan-card');
  assert.deepEqual(problemsOf(carPlan, plan), []);
  assert.deepEqual(
    problemsOf(carPlan, {
      ...plan,
      doors: ['binary_sensor.a'],
      windows: ['sensor.a', 'sensor.b', 'sensor.c', 'binary_sensor.d'],
      tyre_low_share: '0.8',
    }),
    [
      'doors must list 4 entities',
      'windows[3] must be an entity of sensor',
      'tyre_low_share must be a number',
    ],
  );
});

test('words, a summary, a part, a flag that writes a word and a choice are checked', () => {
  assert.deepEqual(
    problemsOf(card('custom:mnml-report-card'), {
      entity: 'sensor.report',
      colors: { warnings: 'green' },
    }),
    ['colors must map to one of red, orange, amber, blue'],
  );
  assert.deepEqual(
    problemsOf(LIST, {
      summary: 'average',
      rows: [{ entity: 'sensor.a', words: { on: 1 }, label: true }],
    }),
    [
      'summary must be lowest, highest or { sum: <column> }',
      'rows[0].label must be device',
      'rows[0].words must map states to words',
    ],
  );
  assert.deepEqual(problemsOf(LIST, { summary: { sum: 1 }, rows: [] }), []);
  assert.deepEqual(
    problemsOf(card('custom:mnml-clients-card'), {
      entity: 'sensor.clients',
      fields: 'name',
      networks: [{ name: 'LAN', icon: 'mdi:lan', subnet: '10.0.0.0/24' }],
    }),
    ['fields must be a mapping'],
  );
  assert.deepEqual(
    problemsOf(card('custom:mnml-slider-card'), { entity: 'light.a', slider: 'dim' }),
    [
      'slider must be one of brightness, color_temp, hue, temperature, value, volume, position, percentage, humidity',
    ],
  );
});

test("the pop-ups card's pop-ups and the template card's slots are checked by their kinds", () => {
  const popups = card('custom:mnml-popups-card');
  assert.deepEqual(problemsOf(popups, { width: '560px', popups: [{ hash: '#a', cards: [] }] }), []);
  assert.deepEqual(
    problemsOf(popups, {
      width: '560px',
      open: { phone: 'drawer' },
      popups: [{ hash: '#a', cards: [{ title: 'x' }] }, { cards: [] }],
    }),
    [
      'open.phone must be one of sheet, dialog, unfold',
      'popups[0].cards must be a list of cards, each with a type',
      'popups[1].hash is required',
    ],
  );
  assert.deepEqual(
    problemsOf(card('custom:mnml-template-card'), { template: 'room', slots: ['a'] }),
    ['slots must be a mapping'],
  );
});

test('requireStructure throws every problem at once, and nothing for a configuration that fits', () => {
  assert.throws(() => {
    requireStructure(HEADING, { controls: [{ type: 'toggle' }] });
  }, /^Error: title is required; icon is required; controls\[0\]\.entity is required$/);
  assert.doesNotThrow(() => {
    requireStructure(HEADING, {
      type: 'custom:mnml-heading-card',
      title: 'Rooms',
      icon: 'mdi:home',
    });
  });
});

function customCards(
  value: unknown,
  found: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      customCards(item, found);
    }
  } else if (typeof value === 'object' && value !== null) {
    const record = Object.fromEntries(Object.entries(value));
    if (typeof record['type'] === 'string' && Object.hasOwn(CARD_STRUCTURES, record['type'])) {
      found.push(record);
    }
    for (const item of Object.values(record)) {
      customCards(item, found);
    }
  }
  return found;
}

test('every example card fits its structure', () => {
  const examples = [
    'examples/cards.yaml',
    'examples/templates.yaml',
    'examples/home-templates.yaml',
  ];
  const found = examples.flatMap((file) => customCards(parse(readFileSync(file, 'utf8'))));
  assert.ok(found.length > 20);
  for (const config of found) {
    const type = String(config['type']);
    const structure = Object.entries(CARD_STRUCTURES).find(([name]) => name === type)?.[1];
    assert.ok(structure, type);
    assert.deepEqual(problemsOf(structure, config), [], type);
  }
});
