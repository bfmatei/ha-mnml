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
    DEMO.sections.system,
    undefined,
  ]);
  assert.deepEqual(titles({ ...DEMO, order: ['rooms', 'garage', 'system', 'people'] }), [
    undefined,
    DEMO.sections.rooms,
    DEMO.sections.garage,
    DEMO.sections.system,
    DEMO.sections.people,
    undefined,
  ]);
});

function announced(home: Home): unknown[] {
  const hashes: unknown[] = [];
  walk(drawn(home), (node) => {
    if (node['type'] === 'custom:mnml-popups-card' && Array.isArray(node['popups'])) {
      hashes.push(...node['popups'].filter(isJson).map((popup) => popup['hash']));
    }
  });
  return hashes;
}

test('no pop-up hash is announced twice in the demo home, and each room brings its heating, AC, vacuum and printer pop-ups', () => {
  const hashes = announced(DEMO);
  assert.deepEqual(
    hashes.filter((hash, at) => hashes.indexOf(hash) !== at),
    [],
  );
  const wanted = DEMO.rooms.flatMap((room) => [
    ...(room.heating === undefined ? [] : [`#${room.key}-heating`]),
    ...(room.ac === undefined ? [] : [`#${room.key}-ac`]),
    ...(room.vacuum === undefined ? [] : [`#${room.key}-vacuum`]),
    ...(room.printer3d === undefined ? [] : [`#${room.key}-3d-printer`]),
  ]);
  assert.ok(wanted.includes('#living-vacuum') && wanted.includes('#office-3d-printer'));
  assert.deepEqual(
    wanted.filter((hash) => !hashes.includes(hash)),
    [],
  );
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

test("the checks pop-up keeps the list and the details, and its header has the Checks card's controls, what failed and warns, run and stop, with the last run left to the list", () => {
  const cards = popupCards(DEMO, '#checks');
  const header = cards.find((card) => card['type'] === 'custom:mnml-header-card');
  assert.equal(header?.['entity'], 'sensor.infrastructure_server_checks_last_run');
  assert.equal(header?.['state'], undefined);
  assert.deepEqual(
    controlsOf(header).map((control) => control['name']),
    ['Failed', 'Warnings', 'Run checks', 'Stop checks'],
  );
  assert.equal(header?.['back'], true);
  assert.ok(cards.some((card) => card['type'] === 'custom:mnml-list-card'));
  assert.ok(cards.some((card) => card['type'] === 'custom:mnml-report-card'));
  assert.ok(cards.every((card) => card['type'] !== 'custom:mnml-button-card'));
  const bare = popupCards(withoutActions(), '#checks').find(
    (card) => card['type'] === 'custom:mnml-header-card',
  );
  assert.deepEqual(
    controlsOf(bare).map((control) => control['type']),
    ['status', 'status'],
  );
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

test("the notifications' icon on the server tile and their glance are drawn and amber while there are alerts, warnings or errors, whatever the notices", () => {
  const alerts = { attribute: 'alerts', not: ['0'] };
  const nav = under(DEMO, 'chips').filter(
    (chip) => chip['type'] === 'nav' && chip['popup'] === '#proxmox-notifications',
  );
  assert.equal(nav.length, 1);
  assert.deepEqual([nav[0]?.['when'], nav[0]?.['show']], [alerts, alerts]);
  const glance = glanceItems(DEMO).find((item) => item['name'] === 'Notifications');
  assert.deepEqual(
    [glance?.['color'], glance?.['when'], glance?.['show'], glance?.['state']],
    ['amber', alerts, alerts, [{ attribute: 'alerts' }]],
  );
  const notifications = DEMO.system.proxmox?.notifications?.messages;
  const row = popupCards(DEMO, '#proxmox').find((card) => card['entity'] === notifications);
  const [header] = popupCards(DEMO, '#proxmox-notifications');
  assert.deepEqual([row?.['when'], header?.['when']], [alerts, alerts], 'and so are its pop-ups');
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

test('Tailscale is its own tile in the system section, right after Network, with its pop-up', () => {
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

test("the Tailscale tile's Update counts only the essential devices, and the pop-up still shows every device's update", () => {
  const chips = tailscale().tile['chips'];
  assert.ok(Array.isArray(chips));
  const update = chips.filter(isJson).find((chip) => chip['name'] === 'Update');
  const tailnet = DEMO.system.tailscale;
  assert.ok(tailnet);
  assert.deepEqual(
    rulesOf(update).flatMap((rule) => rule['entities']),
    tailnet.devices.flatMap((device) =>
      device.essential === true && device.update !== undefined ? [device.update] : [],
    ),
  );
  const shown = new Set<unknown>();
  walk(tailscale().popup, (node) => {
    if (node['type'] === 'status' && node['name'] === 'Update') {
      for (const rule of rulesOf(node)) {
        for (const entity of Array.isArray(rule['entities']) ? rule['entities'] : []) {
          shown.add(entity);
        }
      }
    }
  });
  assert.deepEqual(
    [...shown],
    tailnet.devices.flatMap((device) => (device.update === undefined ? [] : [device.update])),
  );
});

test("AdGuard's protection chip is neutral while on, orange while off and asks before turning off, as its pop-up's header and power button", () => {
  const toggle = {
    type: 'toggle',
    entity: DEMO.system.adguard?.protection,
    confirm: { is: ['on'] },
    color: 'orange',
    when: { is: ['off'] },
  };
  const tile = tiles(DEMO).find((card) => card['entity'] === DEMO.system.adguard?.protection);
  const chips = tile?.['chips'];
  assert.ok(Array.isArray(chips));
  assert.deepEqual(
    chips.filter(isJson).find((chip) => chip['type'] === 'toggle'),
    toggle,
  );
  const [header] = popupCards(DEMO, '#adguard');
  assert.equal(header?.['color'], 'orange');
  assert.deepEqual(header?.['when'], { is: ['off'] });
  assert.deepEqual(controlsOf(header), [{ ...toggle, icon: 'mdi:power', primary: true }]);
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

test('a device card has icons for a pending update in amber, a key that expires soon, and for the router and exit node how they connect', () => {
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
    [['amber', ['on']]],
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

const ALONE: Home = { ...DEMO, people: [], cars: [] };

test('a section with no tiles is left out, its heading too', () => {
  assert.deepEqual(titles(ALONE), [
    undefined,
    DEMO.sections.rooms,
    DEMO.sections.system,
    undefined,
  ]);
});

test('a section heading is given its title and icon, and nothing else', () => {
  const [view] = build(DEMO).views;
  const heading = view?.sections[1]?.cards[0];
  assert.ok(heading !== undefined && 'slots' in heading);
  assert.deepEqual(heading.slots, { title: DEMO.sections.rooms, icon: 'mdi:floor-plan' });
});

function glanceItems(home: Home): Json[] {
  const found: Json[] = [];
  walk(drawn(home), (node) => {
    if (node['type'] === 'custom:mnml-glances-card' && Array.isArray(node['items'])) {
      found.push(...node['items'].filter(isJson));
    }
  });
  return found;
}

test('the Glances count every network device, essential Tailscale device, guest and media health problem, each opening its pop-up, and leave locks and cars to their tiles', () => {
  const items = glanceItems(DEMO);
  const counts = items
    .filter((item) => Array.isArray(item['entities']))
    .map(({ entities, is, not, popup }) => ({ entities, is, not, popup }));
  const { proxmox, network, tailscale, media } = DEMO.system;
  assert.ok(proxmox && network && tailscale && media?.movies?.health);
  assert.ok(DEMO.rooms.some((room) => room.lock !== undefined) && DEMO.cars.length > 0);
  const names = new Set(items.map((item) => item['name']));
  for (const name of ['Unlocked', 'Car security']) {
    assert.equal(names.has(name), false, name);
  }
  for (const expected of [
    {
      entities: network.devices,
      is: undefined,
      not: ['connected', 'upgrading', 'provisioning'],
      popup: '#network',
    },
    {
      entities: tailscale.devices.flatMap((device) =>
        device.essential === true ? [device.connected] : [],
      ),
      is: ['off'],
      not: undefined,
      popup: '#tailscale',
    },
    {
      entities: proxmox.guests.map((guest) => guest.status),
      is: ['off'],
      not: undefined,
      popup: '#proxmox',
    },
    { entities: [media.movies.health], is: ['on'], not: undefined, popup: '#media' },
  ]) {
    assert.ok(
      counts.some((count) => JSON.stringify(count) === JSON.stringify(expected)),
      JSON.stringify(expected),
    );
  }
});

test('a home without systems has none of their counts', () => {
  const {
    proxmox: _proxmox,
    network: _network,
    tailscale: _tailscale,
    media: _media,
    ...system
  } = DEMO.system;
  const bare: Home = { ...DEMO, system };
  const named = new Set(glanceItems(bare).map((item) => item['name']));
  for (const name of [
    'Network devices down',
    'Tailscale offline',
    'Stopped guests',
    'Media health',
  ]) {
    assert.equal(named.has(name), false, name);
  }
});

function plainSpeakers(): Home {
  const home = structuredClone(DEMO);
  for (const room of home.rooms) {
    room.media = room.media?.map((member) =>
      typeof member === 'string' ? member : { key: member.key, entity: member.entity },
    );
  }
  return home;
}

test('a speaker with only its key and its player draws its pop-up with the volume and nothing else', () => {
  const cards = popupCards(plainSpeakers(), '#living-sonos');
  assert.deepEqual(
    cards.map((card) => card['type']),
    ['custom:mnml-header-card', 'custom:mnml-heading-card', 'custom:mnml-slider-card'],
  );
  assert.ok(!JSON.stringify(cards).includes('[['));
});

function listOf(value: unknown): Json[] {
  assert.ok(Array.isArray(value));
  return value.filter(isJson);
}

function roomOf(test: (room: Home['rooms'][number]) => boolean): Home['rooms'][number] {
  const room = DEMO.rooms.find(test);
  assert.ok(room);
  return room;
}

test("a room's lights pop-up has the room's name alone as its header's line, its scenes before the power button, and no scenes in a card under it", () => {
  const room = roomOf(
    (one) => (one.lights?.scenes?.length ?? 0) > 0 && one.lights?.activeScene !== undefined,
  );
  const [header, ...rest] = popupCards(DEMO, `#${room.key}-lights`);
  assert.deepEqual(header?.['state'], [{ text: room.name }]);
  const [scenes, power] = controlsOf(header);
  assert.deepEqual(scenes, {
    type: 'scenes',
    scenes: room.lights?.scenes,
    active_scene: room.lights?.activeScene,
    name: 'Scenes',
    icon: 'mdi:palette-swatch',
  });
  assert.equal(power?.['type'], 'toggle');
  assert.ok(rest.length > 0);
  assert.ok(rest.every((card) => card['scenes'] === undefined));
});

test("a room's pop-up shows a leak sensor as a red row, and its header a red Leak icon, only while it is wet", () => {
  const room = roomOf((one) => one.leaks !== undefined);
  const leaks = room.leaks ?? [];
  const cards = popupCards(DEMO, `#${room.key}`);
  const leak = controlsOf(cards[0]).find((control) => control['name'] === 'Leak');
  assert.equal(leak?.['silent'], true);
  assert.deepEqual(
    rulesOf(leak).map((rule) => [rule['color'], rule['is'], rule['entities']]),
    [['red', ['on'], leaks]],
  );
  assert.deepEqual(
    cards
      .filter((card) => leaks.some((id) => id === card['entity']))
      .map((card) => [card['color'], card['state'], card['visibility']]),
    leaks.map((id) => [
      'red',
      [{}, { since: true }],
      [{ condition: 'state', entity: id, state: 'on' }],
    ]),
  );
});

test("the Glances count each room's leaks while wet, each opening its room", () => {
  const counts = glanceItems(DEMO)
    .filter((item) => item['name'] === 'Leaks')
    .map(({ entities, is, popup }) => JSON.stringify({ entities, is, popup }));
  const rooms = DEMO.rooms.filter((room) => room.leaks !== undefined);
  assert.ok(rooms.length > 0);
  assert.deepEqual(
    new Set(counts),
    new Set(
      rooms.map((room) =>
        JSON.stringify({ entities: room.leaks, is: ['on'], popup: `#${room.key}` }),
      ),
    ),
  );
});

test('the batteries pop-up lists the low ones under a heading per room, then one per person named by Home Assistant, each lowest first', () => {
  const lists = popupCards(DEMO, '#batteries').filter(
    (card) => card['type'] === 'custom:mnml-list-card',
  );
  const rooms = DEMO.rooms.flatMap((room) => {
    const batteries = [
      ...(room.batteries ?? []),
      ...(room.heating?.thermostats ?? []).map((thermostat) => thermostat.battery),
    ].toSorted();
    return batteries.length === 0
      ? []
      : [
          {
            title: room.name,
            entity: undefined,
            icon: room.icon ?? 'mdi:battery-low',
            batteries,
          },
        ];
  });
  const people = DEMO.people.map((person) => ({
    title: undefined,
    entity: person.entity,
    icon: 'mdi:account',
    batteries: person.devices.map((device) => device.battery),
  }));
  assert.ok(people.length > 1);
  assert.deepEqual(
    lists.map((list) => ({
      title: list['title'],
      entity: list['entity'],
      icon: list['icon'],
      batteries: listOf(list['rows']).map((row) => row['entity']),
    })),
    [...rooms, ...people],
  );
  assert.ok(lists.every((list) => list['lowest_first'] === true));
  assert.ok(lists.every((list) => listOf(list['rows']).every((row) => row['low_only'] === true)));
});

const DEMO_METERS = [
  ...DEMO.rooms.flatMap((room) => [
    ...(room.outlets ?? []).map((outlet) => outlet.energy),
    room.ac?.energy,
    room.printer3d?.outlet?.energy,
  ]),
  DEMO.system.proxmox?.outlet.energy,
].flatMap((meter) => (meter === undefined ? [] : [meter]));

const METERS = DEMO_METERS.map((meter) => meter.power);

function meterTables(home: Home): Json[] {
  return popupCards(home, '#energy').filter((card) => card['title'] === 'Meters');
}

test("the energy pop-up lists every meter of the home, its outlets', ACs', 3D printer's and server's, highest power first, in one Meters table of now, today, in total and the share of the home's usage, with their power now summed in its heading", () => {
  const tables = meterTables(DEMO);
  assert.equal(tables.length, 1);
  const [meters] = tables;
  assert.ok(meters);
  assert.equal(meters['highest_first'], true);
  assert.deepEqual(meters['summary'], { sum: 0 });
  assert.deepEqual(meters['headers'], ['Item', 'Now', 'Today', 'Total', 'Share']);
  assert.ok(DEMO_METERS.length >= 5);
  assert.deepEqual(
    listOf(meters['rows']).map((row) => [row['entity'], row['values'], row['of']]),
    DEMO_METERS.map((meter) => [
      meter.power,
      [meter.power, meter.today, meter.total, meter.power],
      DEMO.energy?.usage,
    ]),
  );
  assert.equal(
    popupCards(DEMO, '#energy').find((card) => card['title'] === 'Devices'),
    undefined,
  );
});

test("a room's timer is drawn in its pop-up with the room's other devices, and as a calm glance while it runs, opening the room, never as an issue", () => {
  const room = roomOf((one) => one.timers !== undefined);
  const [timer] = room.timers ?? [];
  assert.ok(timer);
  const cards = popupCards(DEMO, `#${room.key}`);
  const other = cards.findIndex((card) => card['title'] === 'Other');
  const drawnTimer = cards.findIndex((card) => card['entity'] === timer);
  assert.ok(other !== -1 && drawnTimer > other);
  assert.deepEqual(cards[drawnTimer]?.['state'], [{ remaining: true }]);
  assert.deepEqual(
    controlsOf(cards[drawnTimer]).map((control) => control['service'] ?? control['type']),
    ['timer.start', 'timer.pause', 'timer.cancel', 'timer.finish', 'select'],
  );
  assert.deepEqual(
    glanceItems(DEMO).filter((item) => item['entity'] === timer),
    [
      {
        entity: timer,
        color: 'amber',
        when: { is: ['active'] },
        show: { is: ['active'] },
        calm: true,
        state: [{ remaining: true }],
        popup: `#${room.key}`,
      },
    ],
  );
});

test("Home Assistant's messages follow the server's notifications: a chip, a glance and a row open their own pop-up, its header counting them with a Clear all", () => {
  const hash = '#system-messages';
  const tile = tiles(DEMO).find((one) => one['name'] === 'Home Assistant');
  const chip = listOf(tile?.['chips']).find((one) => one['type'] === 'messages');
  assert.deepEqual([chip?.['popup'], chip?.['name'], chip?.['color']], [hash, 'Messages', 'amber']);
  const glance = glanceItems(DEMO).find((item) => item['messages'] === true);
  assert.deepEqual([glance?.['popup'], glance?.['name']], [hash, 'Messages']);
  const [header, row] = popupCards(DEMO, '#system');
  assert.equal(header?.['type'], 'custom:mnml-header-card');
  assert.deepEqual(
    [row?.['type'], row?.['popup'], row?.['name']],
    ['custom:mnml-messages-card', hash, 'Messages'],
  );
  const cards = popupCards(DEMO, hash);
  assert.deepEqual(
    cards.map((card) => [card['type'], card['notifications'], card['repairs']]),
    [
      ['custom:mnml-header-card', undefined, undefined],
      ['custom:mnml-messages-card', true, undefined],
      ['custom:mnml-messages-card', undefined, true],
    ],
  );
  const [top] = cards;
  assert.deepEqual(
    [top?.['messages'], top?.['color'], top?.['back'], top?.['state']],
    [true, 'amber', true, [{ text: 'Home Assistant' }]],
  );
  assert.deepEqual(controlsOf(top), [
    { type: 'dismiss', name: 'Clear all', icon: 'mdi:notification-clear-all' },
  ]);
});

test('without a usage sensor, the Meters table has no Share column', () => {
  const { energy: _energy, ...home } = DEMO;
  const [meters, more] = meterTables(home);
  assert.ok(meters);
  assert.equal(more, undefined);
  assert.deepEqual(meters['headers'], ['Item', 'Now', 'Today', 'Total']);
  assert.deepEqual(
    listOf(meters['rows']).map((row) => [row['values'], row['of']]),
    DEMO_METERS.map((meter) => [[meter.power, meter.today, meter.total], undefined]),
  );
});

function energyGlances(home: Home): Json[] {
  return glanceItems(home).filter((item) => item['name'] === 'Energy');
}

test('a home without energy sensors still has the energy pop-up, its meters alone, and an Energy glance, their power summed', () => {
  const { energy: _energy, ...home } = DEMO;
  const cards = popupCards(home, '#energy');
  assert.deepEqual(
    cards.map((card) => card['title'] ?? card['name']),
    ['Energy', 'Meters'],
  );
  assert.equal(cards[0]?.['state'], undefined);
  assert.deepEqual(energyGlances(home), [
    {
      entities: METERS,
      name: 'Energy',
      icon: 'mdi:lightning-bolt',
      total: true,
      popup: '#energy',
    },
  ]);
  assert.deepEqual(
    energyGlances(DEMO).map((item) => item['entity']),
    [DEMO.energy?.usage],
    'with them, the glance is the home usage',
  );
});

test("a heating's pop-up shows its schedule and a slider per preset temperature; the room's pop-up lists the heating's schedule, then the room's own", () => {
  const room = roomOf((one) => one.heating?.schedule !== undefined && one.schedules !== undefined);
  const schedule = room.heating?.schedule;
  const presets = room.heating?.presetTemperatures ?? [];
  assert.ok(schedule !== undefined && presets.length > 0);
  const heating = popupCards(DEMO, `#${room.key}-heating`);
  const card = heating.find((one) => one['entity'] === schedule);
  assert.equal(card?.['color'], 'amber');
  assert.deepEqual(card?.['state'], [{}, { attribute: 'next_event', relative: true }]);
  assert.deepEqual(
    heating.filter((one) => presets.some((id) => id === one['entity'])).map((one) => one['type']),
    presets.map(() => 'custom:mnml-slider-card'),
  );
  const cards = popupCards(DEMO, `#${room.key}`);
  const at = cards.findIndex((one) => one['title'] === 'Schedules');
  const own = room.schedules ?? [];
  assert.ok(at > 0);
  assert.deepEqual(
    cards.slice(at + 1, at + 2 + own.length).map((one) => one['entity']),
    [schedule, ...own],
  );
});

test('a tap that costs asks first: the lock while locked, the garage door while closed, the alarm while armed, vacation while off, cancelling a print, clearing the notifications', () => {
  const chips = under(DEMO, 'chips');
  const lock = chips.find(
    (chip) => chip['type'] === 'toggle' && String(chip['entity']).startsWith('lock.'),
  );
  assert.deepEqual(lock?.['confirm'], { is: ['locked'] });
  const garage = chips.find(
    (chip) => chip['type'] === 'toggle' && String(chip['entity']).startsWith('cover.'),
  );
  assert.deepEqual(garage?.['confirm'], { is: ['closed'] });
  const glances = glanceItems(DEMO);
  assert.deepEqual(glances.find((item) => item['name'] === 'Alarm')?.['confirm'], {
    not: ['disarmed'],
  });
  assert.deepEqual(glances.find((item) => item['name'] === 'Vacation')?.['confirm'], {
    is: ['off'],
  });
  const controls = under(DEMO, 'controls');
  const cancel = controls.find(
    (control) =>
      control['entity'] === roomOf((one) => one.printer3d !== undefined).printer3d?.actions.cancel,
  );
  assert.deepEqual(cancel?.['confirm'], {});
  const clear = controls.find((control) => control['name'] === 'Clear all');
  assert.deepEqual(clear?.['confirm'], {});
});

test("a heating is amber while it runs, on its tile's chip, its item and its pop-up's header, whose line is the room's name alone; its target slider is uncoloured while it is off", () => {
  const room = roomOf((one) => one.heating !== undefined);
  const entity = room.heating?.entity;
  const running = ['amber', { not: ['off'] }];
  const nav = under(DEMO, 'chips').find(
    (chip) => chip['type'] === 'nav' && chip['entity'] === entity,
  );
  assert.deepEqual([nav?.['color'], nav?.['when']], running);
  const item = popupCards(DEMO, `#${room.key}`).find((card) => card['entity'] === entity);
  assert.deepEqual([item?.['color'], item?.['when']], running);
  const cards = popupCards(DEMO, `#${room.key}-heating`);
  const [header] = cards;
  assert.deepEqual([header?.['color'], header?.['when']], running);
  assert.equal(header?.['entity'], entity);
  assert.equal(header?.['icon'], undefined, "the header has the entity's icon, as the item");
  assert.deepEqual(header?.['state'], [{ text: room.name }]);
  assert.deepEqual(
    cards
      .filter((card) => card['type'] === 'custom:mnml-slider-card' && card['entity'] === entity)
      .map((card) => card['color']),
    ['amber', undefined],
  );
});

function controlled(node: Json): string | undefined {
  const { type, scenes } = node;
  if (Array.isArray(scenes)) {
    return `scenes ${scenes.join(' ')}`;
  }
  if (type === 'slider' || type === 'custom:mnml-slider-card') {
    return `${String(node['entity'])} ${String(node['slider'])}`;
  }
  if (type === 'select' || type === 'custom:mnml-select-card') {
    const attribute = typeof node['attribute'] === 'string' ? node['attribute'] : 'option';
    return `${String(node['entity'])} ${attribute}`;
  }
  return undefined;
}

test('no pop-up has a slider, a menu or scenes both in its header and in a card under it', () => {
  let popups = 0;
  walk(dashboard, (node) => {
    const cards = Array.isArray(node['cards']) ? node['cards'].filter(isJson) : [];
    const [header, ...body] = cards;
    if (typeof node['hash'] !== 'string' || header?.['type'] !== 'custom:mnml-header-card') {
      return;
    }
    popups += 1;
    const below = new Set<string>();
    walk(body, (one) => {
      const what = controlled(one);
      if (what !== undefined) {
        below.add(what);
      }
    });
    const above = Array.isArray(header['controls']) ? header['controls'].filter(isJson) : [];
    assert.deepEqual(
      above.map(controlled).filter((what) => what !== undefined && below.has(what)),
      [],
      node['hash'],
    );
  });
  assert.ok(popups > 10);
});

function shownBy(item: Json, owner: unknown): string | undefined {
  if (item['text'] !== undefined || item['name'] === true) {
    return undefined;
  }
  const entity = item['entity'] ?? owner;
  const attribute = typeof item['attribute'] === 'string' ? item['attribute'] : 'state';
  return typeof entity === 'string' ? `${entity} ${attribute}` : undefined;
}

test('no pop-up header shows a value that a row or a card under it shows', () => {
  let popups = 0;
  const twice: string[] = [];
  walk(dashboard, (node) => {
    const cards = Array.isArray(node['cards']) ? node['cards'].filter(isJson) : [];
    const [header, ...body] = cards;
    if (typeof node['hash'] !== 'string' || header?.['type'] !== 'custom:mnml-header-card') {
      return;
    }
    popups += 1;
    const below = new Set<string>();
    walk(body, (one, parentKey) => {
      const items = [
        ...(parentKey === 'rows' ? [shownBy(one, undefined)] : []),
        ...(Array.isArray(one['state'])
          ? one['state'].filter(isJson).map((item) => shownBy(item, one['entity']))
          : []),
      ];
      for (const what of items) {
        if (what !== undefined) {
          below.add(what);
        }
      }
    });
    const line = Array.isArray(header['state']) ? header['state'].filter(isJson) : [];
    for (const what of line.map((item) => shownBy(item, header['entity']))) {
      if (what !== undefined && below.has(what)) {
        twice.push(`${node['hash']} ${what}`);
      }
    }
  });
  assert.ok(popups > 10);
  assert.deepEqual(twice, []);
});

test("a heating's pop-up header has its preset menu and power, an AC's its mode menu, and the target is the slider under them", () => {
  const room = roomOf((one) => one.heating?.preset === true && one.ac !== undefined);
  for (const [hash, entity, controls] of [
    [`#${room.key}-heating`, room.heating?.entity, ['select preset_modes', 'toggle']],
    [`#${room.key}-ac`, room.ac?.entity, ['select hvac_modes']],
  ] as const) {
    const [header, ...body] = popupCards(DEMO, hash);
    assert.deepEqual(
      controlsOf(header).map((one) =>
        [one['type'], one['attribute']].filter((part) => typeof part === 'string').join(' '),
      ),
      controls,
      hash,
    );
    assert.ok(
      body.some((card) => card['type'] === 'custom:mnml-slider-card' && card['entity'] === entity),
      hash,
    );
  }
});

function comes(chip: Json): boolean {
  return chip['show'] !== undefined || chip['type'] === 'status';
}

test("a room's chips that come and go are before the ones always there, on its tile and in its pop-up's header, so one appearing moves none of them", () => {
  for (const room of DEMO.rooms) {
    const tile = tiles(DEMO).find((card) => card['popup'] === `#${room.key}`);
    const [header] = popupCards(DEMO, `#${room.key}`);
    for (const chips of [tile?.['chips'], header?.['controls']]) {
      const order = (Array.isArray(chips) ? chips.filter(isJson) : []).map(comes);
      assert.deepEqual(
        order,
        order.toSorted((a, b) => Number(b) - Number(a)),
        room.key,
      );
    }
  }
});

test("the vacuum's pop-up header carries its item's state line and controls; the 3D printer's has its job buttons, its outlet's power only under it", () => {
  const living = roomOf((one) => one.vacuum !== undefined);
  const item = popupCards(DEMO, `#${living.key}`).find(
    (card) => card['entity'] === living.vacuum?.entity,
  );
  const [header] = popupCards(DEMO, `#${living.key}-vacuum`);
  const line = listOf(item?.['state']);
  assert.ok(line.length > 0);
  assert.deepEqual(listOf(header?.['state']).slice(-line.length), line);
  assert.deepEqual(controlsOf(header), controlsOf(item));
  const office = roomOf((one) => one.printer3d?.outlet !== undefined);
  const outlet = office.printer3d?.outlet?.entity;
  const [printer, ...body] = popupCards(DEMO, `#${office.key}-3d-printer`);
  const controls = controlsOf(printer);
  assert.ok(controls.length > 0);
  assert.ok(controls.every((control) => control['entity'] !== outlet));
  assert.ok(body.some((card) => card['entity'] === outlet));
});

test("what is normal reads neutral: the server's outlet is orange only while off, a car's alarm row red only while disarmed", () => {
  const outlet = DEMO.system.proxmox?.outlet.entity;
  const host = popupCards(DEMO, '#proxmox').find((card) => card['title'] === 'Host');
  const row = listOf(host?.['rows']).find((one) => one['entity'] === outlet);
  assert.deepEqual([row?.['color'], row?.['when']], ['orange', { is: ['off'] }]);
  for (const car of DEMO.cars) {
    const security = popupCards(DEMO, `#car-${car.key}`).find(
      (card) => card['title'] === 'Security',
    );
    const alarm = listOf(security?.['rows']).find((one) => one['entity'] === car.alarm);
    assert.deepEqual([alarm?.['color'], alarm?.['when']], ['red', { is: ['unarmed'] }], car.key);
  }
});

test("a person's pop-up header has the tile's driving, focus and battery icons", () => {
  const [person] = DEMO.people;
  assert.ok(person);
  const tile = tiles(DEMO).find((card) => card['entity'] === person.entity);
  const [header] = popupCards(DEMO, `#person-${person.key}`);
  assert.deepEqual(
    listOf(tile?.['chips']).map((chip) => chip['name']),
    ['Driving', 'Do not disturb', 'Batteries'],
  );
  assert.deepEqual(controlsOf(header), listOf(tile?.['chips']));
});
