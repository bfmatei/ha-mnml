import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { HomeAssistant } from '../ha/hass.ts';
import { fakeConnection, fakeHass } from '../test/hass.ts';
import { configure, define, mounted, text, updated } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlAgendaCard } from './agenda.ts';
import { MnmlCard } from './base.ts';
import { MnmlCarPlanCard } from './car-plan.ts';
import { MnmlClientsCard } from './clients.ts';
import { MnmlEntityCard } from './entity.ts';
import { MnmlGlancesCard } from './glances.ts';
import { MnmlHeaderCard } from './header.ts';
import { MnmlListCard } from './list.ts';
import { MnmlMediaCard } from './media.ts';
import { MnmlMessagesCard } from './messages.ts';
import { tipOf } from './parts/tooltip.ts';
import { MnmlReportCard } from './report.ts';
import { MnmlSelectCard } from './select.ts';
import { MnmlWeatherCard } from './weather.ts';

function marked(word: unknown): unknown {
  if (typeof word === 'string') {
    return `[[${word}]]`;
  }
  if (typeof word === 'function') {
    return (...values: unknown[]): string =>
      `[[${String(Reflect.apply(word, undefined, values))}]]`;
  }
  if (Array.isArray(word)) {
    return word.map(marked);
  }
  return typeof word === 'object' && word !== null
    ? Object.fromEntries(Object.entries(word).map(([key, value]) => [key, marked(value)]))
    : word;
}

function markedWords<T extends object>(words: T): T {
  const out = { ...words };
  for (const [key, word] of Object.entries(out)) {
    Reflect.set(out, key, marked(word));
  }
  return out;
}

vi.mock(import('../words/words.ts'), async (original) => {
  const real = await original();
  const { EN } = await import('../words/en.ts');
  const pseudo = markedWords(EN);
  return {
    wordsFor: (language: string): typeof EN =>
      language === 'ja' ? pseudo : real.wordsFor(language),
  };
});

define('mnml-agenda-card', MnmlAgendaCard);
define('mnml-car-plan-card', MnmlCarPlanCard);
define('mnml-clients-card', MnmlClientsCard);
define('mnml-entity-card', MnmlEntityCard);
define('mnml-glances-card', MnmlGlancesCard);
define('mnml-header-card', MnmlHeaderCard);
define('mnml-list-card', MnmlListCard);
define('mnml-media-card', MnmlMediaCard);
define('mnml-messages-card', MnmlMessagesCard);
define('mnml-report-card', MnmlReportCard);
define('mnml-select-card', MnmlSelectCard);
define('mnml-weather-card', MnmlWeatherCard);

type Readings = Record<string, readonly [string, Record<string, unknown>?]>;

const AS_HA_SAYS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ro: { off: 'Închis', closed: 'Închis', OPEN: 'Deschis', home: 'Acasă', sunny: 'Însorit' },
  de: {
    off: 'Geschlossen',
    closed: 'Geschlossen',
    OPEN: 'Offen',
    home: 'Zuhause',
    sunny: 'Sonnig',
  },
};

const ATTRIBUTES_AS_HA_SAYS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ro: { humidity: 'Umiditate' },
  de: { humidity: 'Luftfeuchtigkeit' },
};

function hassOf(language: string, readings: Readings): HomeAssistant {
  const [base = ''] = language.split('-');
  const states = AS_HA_SAYS[base] ?? {};
  const attributes = ATTRIBUTES_AS_HA_SAYS[base] ?? {};
  return fakeHass({
    states: Object.fromEntries(
      Object.entries(readings).map(([id, [state, more = {}]]) => [id, { state, attributes: more }]),
    ),
    language,
    formatEntityState: (stateObj) => states[stateObj.state] ?? stateObj.state,
    formatEntityAttributeName: (_stateObj, attribute) => attributes[attribute] ?? attribute,
    formatEntityAttributeValue: (_stateObj, _attribute, value) => String(value),
    connection: fakeConnection({
      subscribeMessage: () => Promise.resolve(() => Promise.resolve()),
    }),
  });
}

async function painted(tag: string, config: object, hass: HomeAssistant): Promise<ShadowRoot> {
  const made = document.createElement(tag);
  assert.ok(made instanceof MnmlCard, `${tag} is a card`);
  configure(made, config);
  made.hass = hass;
  return mounted(made);
}

const CORNERS = ['front_left', 'front_right', 'rear_left', 'rear_right'];

const CAR = {
  type: 'custom:mnml-car-plan-card',
  doors: CORNERS.map((corner) => `binary_sensor.door_${corner}`),
  hood: 'binary_sensor.hood',
  tailgate: 'binary_sensor.tailgate',
  windows: CORNERS.map((corner) => `sensor.window_${corner}`),
  tyres: CORNERS.map((corner) => `sensor.tyre_${corner}`),
  tyre_targets: CORNERS.map((corner) => `sensor.target_${corner}`),
  tyre_low_share: 0.9,
  tyre_warn_share: 0.95,
};

function car(windows: string): Readings {
  const readings: [string, readonly [string]][] = [
    ['binary_sensor.hood', ['off']],
    ['binary_sensor.tailgate', ['off']],
    ...CORNERS.flatMap((corner): [string, readonly [string]][] => [
      [`binary_sensor.door_${corner}`, ['off']],
      [`sensor.window_${corner}`, [corner === 'front_left' ? windows : 'closed']],
      [`sensor.tyre_${corner}`, [corner === 'rear_right' ? '1.9' : '2.4']],
      [`sensor.target_${corner}`, ['2.4']],
    ]),
  ];
  return Object.fromEntries(readings);
}

async function drawing(language: string, windows: string): Promise<{ said: string; aria: string }> {
  const root = await painted('mnml-car-plan-card', CAR, hassOf(language, car(windows)));
  return {
    said: text(root.querySelector('.caption')),
    aria: root.querySelector('svg')?.getAttribute('aria-label') ?? '',
  };
}

test("a card drawn in Romanian says its own words in Romanian, and HA's states as HA gives them", async () => {
  const open = await drawing('ro', 'OPEN');
  assert.equal(open.said, 'Geamul din față stânga deschis • O anvelopă cu presiune scăzută');
  assert.ok(open.aria.includes('Capota: Închis'), open.aria);
  assert.ok(open.aria.includes('Geamul din față stânga: Deschis'), open.aria);
  const header = await painted(
    'mnml-header-card',
    { type: 'custom:mnml-header-card', entity: 'person.jane', state: [{}], back: true },
    hassOf('ro-RO', { 'person.jane': ['home', { friendly_name: 'Jane' }] }),
  );
  assert.deepEqual(
    [...header.querySelectorAll('.round')].map((button) => button.getAttribute('aria-label')),
    ['Înapoi', 'Închide'],
  );
  assert.equal(text(header.querySelector('.state')), 'Acasă');
  const clients = await painted(
    'mnml-clients-card',
    { type: 'custom:mnml-clients-card', entity: 'sensor.clients', networks: [] },
    hassOf('ro', { 'sensor.clients': ['0', { data: [] }] }),
  );
  assert.equal(text(clients), 'Niciun client');
  const weather = await painted(
    'mnml-weather-card',
    { type: 'custom:mnml-weather-card', entity: 'weather.home' },
    hassOf('ro', { 'weather.home': ['sunny', { temperature: 21, humidity: 60 }] }),
  );
  assert.equal(text(weather.querySelector('.heading')), 'Vremea');
  assert.equal(text(weather.querySelector('.condition')), 'Însorit');
  assert.equal(text(weather.querySelector('.fact .label')), 'Umiditate');
});

test('a language without a table of its own draws English words beside its own HA states', async () => {
  const open = await drawing('de', 'OPEN');
  assert.equal(open.said, 'Front left window open • One tyre low');
  assert.ok(open.aria.includes('Hood: Geschlossen'), open.aria);
  assert.equal((await drawing('de', 'closed')).said, 'One tyre low');
  const weather = await painted(
    'mnml-weather-card',
    { type: 'custom:mnml-weather-card', entity: 'weather.home' },
    hassOf('de', { 'weather.home': ['sunny', { temperature: 21, humidity: 60 }] }),
  );
  assert.equal(text(weather.querySelector('.heading')), 'Weather');
  assert.equal(text(weather.querySelector('.fact .label')), 'Luftfeuchtigkeit');
});

const mark = (words: string): string => `[[${words}]]`;

function at(days: number, hour: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour).toISOString();
}

const READINGS: Readings = {
  ...car('OPEN'),
  'person.jane': ['home'],
  'lock.front': ['locked'],
  'input_boolean.away': ['on'],
  'sensor.a': ['12', { unit_of_measurement: '%' }],
  'sensor.b': ['80', { unit_of_measurement: '%' }],
  'button.reset_a': ['unknown'],
  'sensor.clients': [
    '2',
    {
      data: [
        { type: 'WIRELESS', name: mark('Vacuum'), ipAddress: '10.3.5.1' },
        { type: 'VPN', name: mark('Roaming'), ipAddress: '' },
      ],
    },
  ],
  'sensor.checks': ['1', { details: `${mark('failed')}:\n  ${mark('entry')}` }],
  'weather.home': ['sunny', { temperature: 21, humidity: 60, supported_features: 1 }],
  'calendar.sonarr': ['off'],
  'sensor.notifications': [
    '1',
    { messages: [{ id: 'a', title: mark('Backup'), message: mark('failed'), time: at(0, 8) }] },
  ],
  'media_player.living': [
    'playing',
    { supported_features: 1 | 4 | 16 | 32 | 16384, media_title: mark('Song') },
  ],
  'select.mode': ['One', { options: ['One', 'Two'] }],
  'light.living': ['on'],
  'light.a': ['on'],
};

const EVENTS = [
  { summary: `${mark('Show')} - S01E04 - ${mark('Pilot')}`, start: { dateTime: at(1, 20) } },
  { summary: `${mark('Show')} - S01E05 - ${mark('Second')}`, start: { dateTime: at(1, 21) } },
];

const FORECAST = [0, 1].map((days) => ({
  datetime: at(days, 12),
  condition: 'sunny',
  temperature: 20,
  templow: 10,
  precipitation_probability: 10,
}));

function pseudoHass(): HomeAssistant {
  return fakeHass({
    states: Object.fromEntries(
      Object.entries(READINGS).map(([id, [state, more = {}]]) => [
        id,
        {
          state,
          attributes: { friendly_name: mark(id), ...more },
          last_changed: at(0, 8),
          last_updated: at(0, 8),
        },
      ]),
    ),
    language: 'ja',
    formatEntityState: (stateObj, state) => mark(state ?? stateObj.state),
    formatEntityAttributeName: (_stateObj, attribute) => mark(attribute),
    formatEntityAttributeValue: (_stateObj, _attribute, value) => mark(String(value)),
    callApi: () => Promise.resolve(EVENTS),
    connection: fakeConnection({
      subscribeMessage: (push) => {
        queueMicrotask(() => {
          push({ forecast: FORECAST });
        });
        return Promise.resolve(() => Promise.resolve());
      },
    }),
  });
}

interface Case {
  tag: string;
  config: object;
  says: string;
  press?: string;
}

const CASES: Case[] = [
  { tag: 'mnml-car-plan-card', config: CAR, says: mark('Front left window open') },
  {
    tag: 'mnml-clients-card',
    config: {
      type: 'custom:mnml-clients-card',
      entity: 'sensor.clients',
      networks: [{ name: mark('IoT'), icon: 'mdi:home-automation', subnet: '10.3.0.0/16' }],
    },
    says: mark('Other connection'),
  },
  {
    tag: 'mnml-header-card',
    config: {
      type: 'custom:mnml-header-card',
      entity: 'person.jane',
      state: [{}],
      back: true,
      controls: [
        { type: 'toggle', entity: 'lock.front', confirm: {} },
        {
          type: 'tyres',
          tyres: CAR.tyres,
          targets: CAR.tyre_targets,
          low_share: 0.9,
          warn_share: 0.95,
        },
      ],
    },
    says: mark('Tyre pressure low'),
    press: '.lane .control',
  },
  {
    tag: 'mnml-glances-card',
    config: {
      type: 'custom:mnml-glances-card',
      items: [{ entity: 'input_boolean.away', toggle: true, confirm: {}, people: ['person.jane'] }],
    },
    says: mark(`${mark('input_boolean.away')}: ${mark('on')} with somebody home`),
    press: '.calm .glance',
  },
  {
    tag: 'mnml-list-card',
    config: {
      type: 'custom:mnml-list-card',
      title: mark('Batteries'),
      summary: 'lowest',
      rows: [{ entity: 'sensor.a', reset: 'button.reset_a' }, { entity: 'sensor.b' }],
    },
    says: mark(`Lowest ${mark('12')}`),
  },
  {
    tag: 'mnml-report-card',
    config: { type: 'custom:mnml-report-card', entity: 'sensor.checks' },
    says: mark('1 entry'),
  },
  {
    tag: 'mnml-weather-card',
    config: { type: 'custom:mnml-weather-card', entity: 'weather.home' },
    says: mark('Today'),
  },
  {
    tag: 'mnml-agenda-card',
    config: {
      type: 'custom:mnml-agenda-card',
      title: mark('Upcoming'),
      sources: [{ entity: 'calendar.sonarr', kind: 'episodes' }],
    },
    says: mark('2 episodes'),
  },
  {
    tag: 'mnml-messages-card',
    config: {
      type: 'custom:mnml-messages-card',
      entity: 'sensor.notifications',
      clear: 'script.a',
    },
    says: mark(`Clear ${mark('Backup')}`),
  },
  {
    tag: 'mnml-media-card',
    config: { type: 'custom:mnml-media-card', entity: 'media_player.living' },
    says: mark('Pause'),
  },
  {
    tag: 'mnml-select-card',
    config: { type: 'custom:mnml-select-card', entity: 'select.mode' },
    says: mark(`${mark('select.mode')}: choose`),
  },
  {
    tag: 'mnml-entity-card',
    config: {
      type: 'custom:mnml-entity-card',
      entity: 'light.living',
      items: [{ entity: 'light.a' }],
    },
    says: mark(`Show the lights of ${mark('light.living')}`),
  },
];

function spoken(root: Node): string[] {
  const out: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.textContent ?? '');
      return;
    }
    if (node instanceof Element) {
      if (node.localName === 'style') {
        return;
      }
      for (const name of ['aria-label', 'title']) {
        const value = node.getAttribute(name);
        if (value !== null) {
          out.push(value);
        }
      }
      const tipped = tipOf(node);
      if (tipped !== undefined) {
        out.push(tipped);
      }
      if (node.shadowRoot !== null) {
        walk(node.shadowRoot);
      }
    }
    for (const child of node.childNodes) {
      walk(child);
    }
  };
  walk(root);
  return out.map((said) => said.trim()).filter((said) => said !== '');
}

function unmarked(said: string): string {
  let rest = said;
  for (let before = ''; before !== rest;) {
    before = rest;
    rest = rest.replaceAll(/\[\[[^[\]]*\]\]/g, ' ');
  }
  return rest.replaceAll(/\bS\d{2}E\d{2}(-(S\d{2})?E\d{2})?\b/g, ' ');
}

for (const { tag, config, says, press } of CASES) {
  test(`every word ${tag} draws itself comes from its word table`, async () => {
    const made = document.createElement(tag);
    assert.ok(made instanceof MnmlCard, `${tag} is a card`);
    configure(made, config);
    made.hass = pseudoHass();
    const root = await mounted(made);
    await updated(root);
    const before = spoken(root);
    if (press !== undefined) {
      root.querySelector<HTMLElement>(press)?.click();
      await until(
        () => spoken(root).some((each) => each.includes('Tap again')),
        `${tag} asks again`,
      );
    }
    const said = [...before, ...spoken(root)];
    assert.ok(
      said.some((each) => each.includes(says)),
      `${tag} says ${says}, in ${said.join(' | ')}`,
    );
    if (press !== undefined) {
      assert.ok(
        said.some((each) => each.includes('Tap again')),
        `${tag} asks again`,
      );
    }
    assert.deepEqual(
      said.filter((each) => /[A-Za-z]/.test(unmarked(each))),
      [],
      `${tag} draws only the words of its table and of Home Assistant`,
    );
    made.remove();
  });
}
