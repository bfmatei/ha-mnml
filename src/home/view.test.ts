import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DEMO } from '../../demo/home.ts';

import type { Home } from './types.ts';
import { build, drawn } from './view.ts';

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(
  value: unknown,
  visit: (node: Json, parentKey: string) => void,
  parentKey = 'root',
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit, parentKey);
    }
    return;
  }
  if (!isJson(value)) {
    return;
  }
  visit(value, parentKey);
  for (const [key, child] of Object.entries(value)) {
    walk(child, visit, key);
  }
}

const dashboard = drawn(DEMO);

test('every table row fills exactly the columns its card declares', () => {
  let checked = 0;
  walk(dashboard, (node) => {
    const headers = node['headers'];
    if (node['type'] !== 'custom:mnml-list-card' || !Array.isArray(headers)) {
      return;
    }
    const rows: unknown = node['rows'];
    assert.ok(Array.isArray(rows));
    for (const row of rows) {
      assert.ok(isJson(row));
      const values = row['values'];
      if (values === undefined) {
        continue;
      }
      assert.ok(Array.isArray(values));
      const columns: number = headers.length - 1;
      const shared: boolean = rows.some(
        (other: unknown) => isJson(other) && other['of'] !== undefined,
      );
      assert.ok(
        values.length === columns || (shared && values.length === columns - 1),
        `row ${String(row['entity'])}`,
      );
      checked += 1;
    }
  });
  assert.ok(checked > 0, 'there are table rows to check');
});

const SURFACE: Record<string, string> = {
  'custom:mnml-popups-card': 'open, popups, type, width',
  'custom:mnml-agenda-card': 'icon, sources, title, type',
  'custom:mnml-button-card': 'entity, service, type',
  'custom:mnml-car-plan-card':
    'doors, hood, icon, sunroof, tailgate, title, type, tyre_low_share, tyre_targets, tyre_warn_share, tyres, windows',
  'custom:mnml-clients-card': 'entity, fold, names, networks, type',
  'custom:mnml-entity-card':
    'color, controls, entity, icon, items, label, name, popup, state, strip_word, type, visibility, when',
  'custom:mnml-header-card': 'back, color, controls, entity, icon, label, name, state, type, when',
  'custom:mnml-glances-card': 'grid_options, items, type',
  'custom:mnml-heading-card': 'grid_options, icon, state, title, type, visibility',
  'custom:mnml-list-card': 'fold, headers, icon, lowest_first, rows, summary, title, type',
  'custom:mnml-media-card': 'entity, popup, type',
  'custom:mnml-messages-card': 'clear, entity, sources, type',
  'custom:mnml-report-card': 'colors, entity, icon, title, type',
  'custom:mnml-weather-card': 'entity, title, type',
  'custom:mnml-select-card':
    'active_scene, attribute, entity, icon, name, scenes, type, visibility',
  'custom:mnml-slider-card': 'color, entity, icon, name, slider, turn_on, type, visibility',
  'custom:mnml-tile-card':
    'chips, entity, grid_options, icon, item, label, name, popup, state, type',
  grid_options: 'columns',
  indicator: 'color, entity, show, type',
  item: 'color, controls, entity, popup, state',
  items:
    'alert, bare, below, color, controls, critical, entities, entity, icon, is, name, people, popup, quiet, show, state, strip_word, sum, toggle, when',
  nav: 'color, entity, popup, show, type, when',
  networks: 'icon, name, subnet',
  popups: 'cards, hash',
  rows: 'bar, color, critical, critical_high, entity, flag, high, label, low, low_only, name, of, relative, reset, show, strip, values, when, words, zero_when_empty',
  rules: 'below, color, entities, is, label, not, within_days, words',
  scenes: 'active_scene, icon, name, scenes, type',
  select: 'attribute, color, entity, primary, show, type, when',
  service: 'entity, icon, name, primary, service, show, type',
  show: 'entity, is, not',
  slider: 'color, entity, icon, name, show, slider, type',
  sources: 'entity, kind, name, source',
  state: 'attribute, entity, icon, minutes, name, relative, serial, text, when',
  status: 'icon, name, rules, silent, type',
  toggle: 'color, entity, icon, primary, show, type, when',
  tyres: 'low_share, silent, targets, type, tyres, warn_share',
  visibility: 'condition, entity, state_not',
  when: 'entity, is, not',
};

test('the contract surface the generator writes has not drifted', () => {
  const found = new Map<string, Set<string>>();
  walk(dashboard, (node, parentKey) => {
    const bucket = typeof node['type'] === 'string' ? node['type'] : parentKey;
    let keys = found.get(bucket);
    if (keys === undefined) {
      keys = new Set();
      found.set(bucket, keys);
    }
    for (const [key, value] of Object.entries(node)) {
      if (value !== undefined) {
        keys.add(key);
      }
    }
  });
  for (const [bucket, expected] of Object.entries(SURFACE)) {
    const keys = found.get(bucket);
    assert.ok(keys, `${bucket} is still written`);
    assert.equal([...keys].sort().join(', '), expected, bucket);
  }
});

test('build() is a pure function of the home', () => {
  assert.equal(JSON.stringify(build(DEMO)), JSON.stringify(build(DEMO)));
});

test('the dashboard names no minimal- card any more', () => {
  assert.ok(!JSON.stringify(build(DEMO)).includes('minimal-'));
});

function titles(home: typeof DEMO): unknown[] {
  return (build(home).views[0]?.sections ?? []).map((section) => {
    const [first] = section.cards;
    return first !== undefined && 'slots' in first ? first.slots?.['title'] : undefined;
  });
}

test('the untitled outlook comes first, the titled sections in the order the home gives, the pop-up shell last', () => {
  assert.deepEqual(titles(DEMO), [
    undefined,
    DEMO.sections.rooms,
    DEMO.sections.people,
    DEMO.sections.garage,
    DEMO.sections.infrastructure,
    undefined,
  ]);
  assert.deepEqual(titles({ ...DEMO, order: ['rooms', 'garage', 'infrastructure', 'people'] }), [
    undefined,
    DEMO.sections.rooms,
    DEMO.sections.garage,
    DEMO.sections.infrastructure,
    DEMO.sections.people,
    undefined,
  ]);
});

function popupCards(home: Home, hash: string): Json[] {
  let cards: Json[] = [];
  walk(drawn(home), (node) => {
    if (node['hash'] === hash && Array.isArray(node['cards'])) {
      cards = node['cards'].filter(isJson);
    }
  });
  return cards;
}

function controlsOf(card: Json | undefined): Json[] {
  assert.ok(card);
  const controls: unknown = card['controls'];
  assert.ok(Array.isArray(controls));
  return controls.filter(isJson);
}

function withoutActions(): Home {
  const home = structuredClone(DEMO);
  const checks = home.system.proxmox?.checks;
  assert.ok(checks);
  delete checks.actions;
  return home;
}

const RUNNING = 'binary_sensor.infrastructure_server_checks_running';

test('the server pop-up has one Checks card: the last run, what failed and warns, run or stop, and the checks pop-up', () => {
  const cards = popupCards(DEMO, '#proxmox');
  const checks = cards.filter((card) => card['name'] === 'Checks');
  assert.equal(checks.length, 1);
  const [card] = checks;
  assert.ok(card);
  assert.equal(card['type'], 'custom:mnml-entity-card');
  assert.equal(card['entity'], 'sensor.infrastructure_server_checks_last_run');
  assert.equal(card['popup'], '#checks');
  assert.deepEqual(card['state'], [{ relative: true }]);
  const controls = controlsOf(card);
  assert.deepEqual(
    controls.map((control) => `${String(control['type'])}:${String(control['name'])}`),
    ['status:Failed', 'status:Warnings', 'service:Run checks', 'service:Stop checks'],
  );
  const [run, stop] = controls.slice(2);
  assert.deepEqual(run?.['show'], { entity: RUNNING, not: ['on'] });
  assert.deepEqual(stop?.['show'], { entity: RUNNING, is: ['on'] });
  assert.equal(run?.['entity'], 'button.infrastructure_server_checks_run');
  assert.equal(stop?.['entity'], 'button.infrastructure_server_checks_stop');
  assert.ok(
    cards.every(
      (other) => other['type'] !== 'custom:mnml-list-card' || other['title'] !== 'Daily checks',
    ),
  );
  assert.ok(cards.every((other) => other['type'] !== 'custom:mnml-report-card'));
  assert.ok(cards.every((other) => other['type'] !== 'custom:mnml-button-card'));
});

test('without actions the Checks card keeps the icons and draws no run or stop', () => {
  const card = popupCards(withoutActions(), '#proxmox').find((other) => other['name'] === 'Checks');
  assert.deepEqual(
    controlsOf(card).map((control) => control['type']),
    ['status', 'status'],
  );
});

test('the checks pop-up keeps the list and the details, and has run and stop in its header', () => {
  const cards = popupCards(DEMO, '#checks');
  const header = cards.find((card) => card['type'] === 'custom:mnml-header-card');
  assert.deepEqual(
    controlsOf(header).map((control) => control['name']),
    ['Run checks', 'Stop checks'],
  );
  assert.equal(header?.['back'], true);
  assert.ok(cards.some((card) => card['type'] === 'custom:mnml-list-card'));
  assert.ok(cards.some((card) => card['type'] === 'custom:mnml-report-card'));
  assert.ok(cards.every((card) => card['type'] !== 'custom:mnml-button-card'));
  const bare = popupCards(withoutActions(), '#checks').find(
    (card) => card['type'] === 'custom:mnml-header-card',
  );
  assert.deepEqual(bare?.['controls'] ?? [], []);
});

function under(home: Home, key: string): Json[] {
  const found: Json[] = [];
  walk(drawn(home), (node, parentKey) => {
    if (parentKey === key && typeof node['type'] === 'string') {
      found.push(node);
    }
  });
  return found;
}

test('a status icon on a tile is drawn only while something is wrong', () => {
  const chips = under(DEMO, 'chips');
  const status = chips.filter((chip) => chip['type'] === 'status');
  assert.ok(status.length >= 14, 'the tiles have status icons');
  assert.deepEqual(
    status.filter((chip) => chip['silent'] !== true).map((chip) => String(chip['name'])),
    [],
  );
  const tyres = chips.filter((chip) => chip['type'] === 'tyres');
  assert.ok(tyres.length > 0);
  assert.deepEqual(
    tyres.filter((chip) => chip['silent'] !== true),
    [],
  );
});

const isOpening = (node: Json): boolean =>
  node['type'] === 'indicator' && /_(window|door)$/.test(String(node['entity']));

test("a room tile's window and door icons show only while the sensor is not off, and the pop-up header keeps them", () => {
  const tile = under(DEMO, 'chips').filter(isOpening);
  assert.ok(tile.length > 0, 'a room tile has them');
  assert.deepEqual(
    tile.filter((chip) => JSON.stringify(chip['show']) !== JSON.stringify({ not: ['off'] })),
    [],
  );
  const header = under(DEMO, 'controls').filter(isOpening);
  assert.ok(header.length > 0, 'a room pop-up header has them');
  assert.deepEqual(
    header.filter((control) => control['show'] !== undefined),
    [],
    'the pop-up is the details of the room: it keeps showing them',
  );
});

test("the server tile's notifications icon is hidden while there are none", () => {
  const nav = under(DEMO, 'chips').filter(
    (chip) => chip['type'] === 'nav' && chip['popup'] === '#proxmox-notifications',
  );
  assert.equal(nav.length, 1);
  assert.deepEqual(nav[0]?.['show'], { not: ['0'] });
});

test("the car's alarm icon is red while the alarm sounds, the car is unarmed or the state is unavailable, and has no rule for an armed state", () => {
  const alarms = under(DEMO, 'chips').filter(
    (chip) => chip['type'] === 'status' && chip['name'] === 'Alarm',
  );
  assert.equal(alarms.length, 2, 'both cars have one');
  for (const alarm of alarms) {
    const rules = alarm['rules'];
    assert.ok(Array.isArray(rules));
    const found = rules.filter(isJson);
    assert.deepEqual(
      found.map((rule) => rule['color']),
      found.map(() => 'red'),
      'every rule is red',
    );
    assert.ok(
      found.every((rule) => rule['not'] === undefined),
      'no rule lights on an armed state',
    );
    const named = new Set(found.flatMap((rule) => (Array.isArray(rule['is']) ? rule['is'] : [])));
    assert.deepEqual(
      [...named].toSorted((a, b) => String(a).localeCompare(String(b))),
      ['on', 'unarmed', 'unavailable'],
    );
  }
});

function tiles(home: Home): Json[] {
  return under(home, 'cards').filter((card) => card['type'] === 'custom:mnml-tile-card');
}

test('Tailscale is its own tile in the infrastructure section, right after Network, with its pop-up', () => {
  const names = tiles(DEMO).map((tile) => tile['name']);
  const at = names.indexOf('Tailscale');
  assert.ok(at > 0, 'there is a Tailscale tile');
  assert.equal(names[at - 1], 'Network');
  const tile = tiles(DEMO)[at];
  assert.equal(tile?.['popup'], '#tailscale');
  assert.equal(tile?.['icon'], 'mdi:vpn');
});

test('the Tailscale tile flags an offline device, a relayed connection and an update, each only while it holds', () => {
  const tile = tiles(DEMO).find((card) => card['name'] === 'Tailscale');
  assert.ok(tile);
  const chips = tile['chips'];
  assert.ok(Array.isArray(chips));
  const found = chips.filter(isJson);
  assert.deepEqual(
    found.map((chip) => `${String(chip['name'])}:${String(chip['silent'])}`),
    ['Offline:true', 'Relayed:true', 'Update:true'],
  );
  const colours = found.map((chip) => {
    const rules = chip['rules'];
    assert.ok(Array.isArray(rules));
    return rules.filter(isJson).map((rule) => rule['color']);
  });
  assert.deepEqual(colours, [['red'], ['orange'], ['amber']]);
  const relayed = found[1]?.['rules'];
  assert.ok(Array.isArray(relayed) && isJson(relayed[0]));
  assert.deepEqual(relayed[0]['words'], { off: 'Relayed' }, 'its tooltip says Relayed, not Off');
});

test('Network has no VPN any more: no chip on its tile, no list in its pop-up', () => {
  const network = tiles(DEMO).find((card) => card['name'] === 'Network');
  assert.ok(network);
  const chips = network['chips'];
  assert.ok(Array.isArray(chips));
  assert.ok(chips.filter(isJson).every((chip) => chip['name'] !== 'VPN'));
  const popup = popupCards(DEMO, '#network');
  assert.ok(popup.length > 0);
  assert.ok(popup.every((card) => card['title'] !== 'VPN'));
});

function tailscale(): { tile: Json; popup: Json[] } {
  const tile = tiles(DEMO).find((card) => card['name'] === 'Tailscale');
  assert.ok(tile);
  return { tile, popup: popupCards(DEMO, '#tailscale') };
}

function rulesOf(control: Json | undefined): Json[] {
  const rules = control?.['rules'];
  assert.ok(Array.isArray(rules));
  return rules.filter(isJson);
}

const ESSENTIAL = [
  'binary_sensor.infrastructure_tailscale_router_connected_to_control',
  'binary_sensor.infrastructure_tailscale_exit_node_connected_to_control',
];

test('only the essential devices, the router and the exit node, can make the Tailscale tile red', () => {
  const chips = tailscale().tile['chips'];
  assert.ok(Array.isArray(chips) && isJson(chips[0]));
  const rules = chips[0]['rules'];
  assert.ok(Array.isArray(rules) && isJson(rules[0]));
  assert.deepEqual(rules[0]['entities'], ESSENTIAL);
});

test('the Tailscale pop-up is a card per device: the essential two under Infrastructure, the other four under Devices', () => {
  const [, ...rest] = tailscale().popup;
  const order = rest.map((card) =>
    card['type'] === 'custom:mnml-heading-card'
      ? `# ${String(card['title'])}`
      : String(card['entity']),
  );
  assert.deepEqual(order, [
    '# Infrastructure',
    ...ESSENTIAL,
    '# Devices',
    'binary_sensor.infrastructure_tailscale_joe_phone_connected_to_control',
    'binary_sensor.infrastructure_tailscale_joe_laptop_connected_to_control',
    'binary_sensor.infrastructure_tailscale_joe_tablet_connected_to_control',
    'binary_sensor.infrastructure_tailscale_jane_phone_connected_to_control',
  ]);
});

function cardsOf(): Json[] {
  return tailscale().popup.filter((card) => card['type'] === 'custom:mnml-entity-card');
}

test('a device card shows its IP address as its status, and an essential one is red while off', () => {
  const cards = cardsOf();
  assert.equal(cards.length, 6);
  for (const card of cards) {
    assert.equal(card['label'], 'device', 'the title is the name of the device');
    assert.equal(
      card['strip_word'],
      'Tailscale',
      'without the Tailscale every device name starts with',
    );
    const state = card['state'];
    assert.ok(Array.isArray(state) && state.length === 1 && isJson(state[0]));
    assert.match(String(state[0]['entity']), /^sensor\.infrastructure_tailscale_.+_ip_address$/);
  }
  const red = cards.filter((card) => card['color'] === 'red').map((card) => card['entity']);
  assert.deepEqual(red, ESSENTIAL);
});

test('a device has one connection icon: Connected while it is, and its last seen time while it is not', () => {
  const [router] = cardsOf();
  const [, , , connected, seen] = controlsOf(router);
  assert.equal(connected?.['type'], 'status');
  assert.equal(connected?.['name'], 'Connected');
  assert.equal(connected?.['silent'], true);
  assert.deepEqual(
    rulesOf(connected).map((rule) => [rule['color'], rule['is']]),
    [['blue', ['on']]],
  );
  assert.equal(seen?.['type'], 'indicator');
  assert.equal(seen?.['entity'], 'sensor.infrastructure_tailscale_router_last_seen');
  assert.deepEqual(seen?.['show'], {
    entity: 'binary_sensor.infrastructure_tailscale_router_connected_to_control',
    not: ['on'],
  });
});

test('a device card has icons for a pending update, a key that expires soon, and for the router and exit node how they connect', () => {
  const [router, , phone] = cardsOf();
  const kinds = (card: Json | undefined): string[] =>
    controlsOf(card).map((control) => String(control['name'] ?? control['type']));
  assert.deepEqual(kinds(router), [
    'Update',
    'Key expires soon',
    'Connection',
    'Connected',
    'indicator',
  ]);
  assert.deepEqual(kinds(phone), ['Update', 'Key expires soon', 'Connected', 'indicator']);
  const [update, key, connection] = controlsOf(router);
  assert.deepEqual(
    rulesOf(update).map((rule) => [rule['color'], rule['is']]),
    [['red', ['on']]],
  );
  assert.deepEqual(
    rulesOf(key).map((rule) => [rule['color'], rule['within_days']]),
    [['red', 14]],
  );
  assert.equal(key?.['silent'], true);
  assert.deepEqual(
    rulesOf(connection).map((rule) => [rule['color'], rule['words']]),
    [
      ['orange', { off: 'Relayed' }],
      ['blue', { on: 'Direct' }],
    ],
  );
});
