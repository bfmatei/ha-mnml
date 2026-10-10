import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DEMO } from '../../demo/home.ts';

import { hashProblems, problems } from './problems.ts';
import type { Home } from './types.ts';
import { drawn } from './view.ts';

test('the demo home has no problems', () => {
  assert.deepEqual(problems(DEMO), []);
});

test('a room keyed like a fixed pop-up is a duplicate hash', () => {
  const [first, ...rest] = DEMO.rooms;
  assert.ok(first);
  const home = { ...DEMO, rooms: [{ ...first, key: 'system' }, ...rest] };
  assert.ok(problems(home).some((problem) => problem.includes('#system')));
});

test('an order that skips or repeats a section is named', () => {
  assert.deepEqual(
    problems({ ...DEMO, order: ['rooms', 'garage', 'infrastructure', 'people'] }),
    [],
  );
  for (const order of [
    ['rooms', 'garage', 'infrastructure'],
    ['rooms', 'rooms', 'garage', 'infrastructure'],
  ] as const) {
    assert.ok(
      problems({ ...DEMO, order }).some((problem) => problem.startsWith('order must list')),
    );
  }
});

test('a key that is not a URL fragment is named', () => {
  const [first, ...rest] = DEMO.rooms;
  assert.ok(first);
  const home = { ...DEMO, rooms: [{ ...first, key: 'Living Room' }, ...rest] };
  assert.ok(problems(home).some((problem) => problem.includes('Living Room')));
});

test('two devices of one person with one key are a duplicate hash', () => {
  const [first, ...rest] = DEMO.people;
  assert.ok(first);
  const [device, ...others] = first.devices;
  assert.ok(device);
  const home: Home = {
    ...DEMO,
    people: [{ ...first, devices: [device, device, ...others] }, ...rest],
  };
  assert.ok(problems(home).some((problem) => problem.includes('#person-joe-phone')));
});

test('a pop-up a card points at and nothing defines is named', () => {
  const dashboard = {
    views: [
      {
        cards: [
          { type: 'custom:mnml-tile-card', popup: '#nowhere' },
          { hash: '#somewhere', cards: [] },
        ],
      },
    ],
  };
  assert.deepEqual(hashProblems(dashboard), ['#nowhere is opened but no pop-up defines it']);
});

test('a network with an invalid subnet is named', () => {
  const network = DEMO.system.network;
  assert.ok(network?.clients);
  const home: Home = {
    ...DEMO,
    system: {
      ...DEMO.system,
      network: {
        ...network,
        clients: {
          ...network.clients,
          networks: [{ name: 'Odd', icon: 'mdi:help' as const, subnet: '10.0.0.0/33' as const }],
        },
      },
    },
  };
  assert.ok(problems(home).some((problem) => problem.includes('Odd')));
});

test('a home without an outside sensor, a vacation helper, or a room icon and climate sensors draws whole', () => {
  const [first, ...rest] = DEMO.rooms;
  assert.ok(first);
  const { icon: _icon, temperature: _temperature, humidity: _humidity, ...bare } = first;
  const { outside: _outside, vacation: _vacation, ...plain } = DEMO;
  const home: Home = { ...plain, rooms: [bare, ...rest] };
  assert.deepEqual(problems(home), []);
  const headings: Record<string, unknown>[] = [];
  const tiles: Record<string, unknown>[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
    } else if (typeof value === 'object' && value !== null) {
      const node = Object.fromEntries(Object.entries(value));
      if (node['type'] === 'custom:mnml-heading-card') {
        headings.push(node);
      }
      if (node['type'] === 'custom:mnml-tile-card' && node['name'] === first.name) {
        tiles.push(node);
      }
      for (const item of Object.values(node)) {
        walk(item);
      }
    }
  };
  walk(drawn(home));
  assert.equal(headings[0]?.['state'], undefined, 'the Rooms heading has no outside reading');
  assert.equal(headings[1]?.['controls'], undefined, 'the People heading has no vacation toggle');
  assert.equal(tiles[0]?.['icon'], 'mdi:texture-box', "the room takes the template's icon");
});

test('a key that only a pop-up the home lacks would take is a producible duplicate', () => {
  const [first, second, ...rest] = DEMO.rooms;
  assert.ok(first && second);
  const home: Home = { ...DEMO, rooms: [first, { ...second, key: `${first.key}-ac` }, ...rest] };
  assert.deepEqual(hashProblems(drawn(home)), [], 'nothing drawn twice');
  assert.ok(problems(home).includes(`#${first.key}-ac can be produced twice`));
});

test('a home the templates cannot draw is a problem, not an error', () => {
  const [first, ...rest] = DEMO.rooms;
  assert.ok(first);
  const home: Home = { ...DEMO, rooms: [{ ...first, key: '' }, ...rest] };
  const found = problems(home);
  assert.ok(found.some((problem) => problem.includes('the slot key is required')));
  assert.ok(found.some((problem) => problem.includes('is no URL fragment')));
});
