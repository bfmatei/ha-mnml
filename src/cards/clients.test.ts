import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import { MnmlClientsCard } from './clients.ts';

define('mnml-clients-card', MnmlClientsCard);

const CONFIG = {
  type: 'custom:mnml-clients-card',
  entity: 'sensor.clients',
  names: 'sensor.names',
  networks: [
    { name: 'IoT', icon: 'mdi:home-automation', subnet: '10.3.0.0/16' },
    { name: 'Servers', icon: 'mdi:server', subnet: '10.5.0.0/16' },
    { name: 'Lab', icon: 'mdi:flask', subnet: '10.5.20.0/24' },
    { name: 'Guest', icon: 'mdi:account-question-outline', subnet: '10.2.0.0/16' },
  ],
};

const CLIENTS = [
  { type: 'WIRED', name: 'Home Assistant', ipAddress: '10.5.10.2' },
  { type: 'WIRELESS', name: 'Vacuum', ipAddress: '10.3.5.1' },
  { type: 'WIRED', name: 'DNS', ipAddress: '10.5.10.1' },
  { type: 'WIRED', name: 'Hue Bridge', ipAddress: '10.3.10.1' },
  { type: 'WIRELESS', name: 'Lab box', ipAddress: '10.5.20.7' },
  { type: 'WIRELESS', name: 'Visitor', ipAddress: '192.168.1.9' },
  { type: 'VPN', name: 'Roaming', ipAddress: '' },
  { type: 'WIRELESS', name: '', ipAddress: '10.3.1.1' },
];

const NAMES = [
  { ip: '10.5.10.2', name: 'ha.home.arpa', source: 'rDNS' },
  { ip: '10.3.10.1', name: 'hue.home.arpa', source: 'rDNS' },
  { ip: '10.3.1.1', name: '3dprinter.home.arpa', source: 'rDNS' },
];

type States = Record<string, { state: string; attributes: Record<string, unknown> }>;

function hassOf(states: States): unknown {
  return {
    states: Object.fromEntries(
      Object.entries(states).map(([id, entry]) => [id, { entity_id: id, ...entry }]),
    ),
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
  };
}

function configured(config: unknown): MnmlClientsCard {
  const card = document.createElement('mnml-clients-card');
  assert.ok(card instanceof MnmlClientsCard);
  card.setConfig(config as never);
  return card;
}

async function paint(states: States, config: unknown = CONFIG): Promise<ShadowRoot> {
  const card = configured(config);
  card.hass = hassOf(states) as never;
  return mounted(card);
}

const LIVE: States = {
  'sensor.clients': { state: '8', attributes: { data: CLIENTS } },
  'sensor.names': { state: '3', attributes: { auto_clients: NAMES } },
};

function sections(out: ParentNode): Element[] {
  return [...(out.querySelector('.clients')?.children ?? [])];
}

function title(node: Element | undefined | null): string | undefined {
  const label = node?.querySelector('.heading')?.children[1];
  return label === undefined ? undefined : text(label);
}

function rowsOf(node: Element | undefined): Element[] {
  return [...(node?.querySelector('.card .list')?.children ?? [])];
}

function fqdn(row: Element | undefined): string | undefined {
  const node = row?.querySelector('.fqdn');
  return node === null || node === undefined ? undefined : text(node);
}

function rows(node: Element | undefined): string[] {
  return rowsOf(node).map((row) =>
    [text(row.querySelector('.name')), fqdn(row) ?? '', text(row.querySelector('.ip'))].join(' | '),
  );
}

function hidden(node: Element | undefined): boolean {
  return node?.querySelector('.card') === null;
}

test('clients group by the networks in model order, the first matching subnet winning', async () => {
  const out = sections(await paint(LIVE));
  assert.deepEqual(out.map(title), ['IoT', 'Servers', 'Other']);
  assert.deepEqual(rows(out[1]), [
    'DNS |  | 10.5.10.1',
    'Home Assistant | ha.home.arpa | 10.5.10.2',
    'Lab box |  | 10.5.20.7',
  ]);
});

test('each section heading counts its clients', async () => {
  const out = sections(await paint(LIVE));
  assert.equal(text(out[0]?.querySelector('.heading .state')), '3');
});

test('rows sort by IP numerically, and a client with no name takes its FQDN', async () => {
  assert.deepEqual(rows(sections(await paint(LIVE))[0]), [
    '3dprinter.home.arpa |  | 10.3.1.1',
    'Vacuum |  | 10.3.5.1',
    'Hue Bridge | hue.home.arpa | 10.3.10.1',
  ]);
});

test('a client outside every subnet, or without an IPv4 address, goes to Other, last', async () => {
  assert.deepEqual(rows(sections(await paint(LIVE))[2]), [
    'Visitor |  | 192.168.1.9',
    'Roaming |  | —',
  ]);
});

test('the row icon is the connection type', async () => {
  const icons = rowsOf(sections(await paint(LIVE))[2]).map((row) =>
    Reflect.get(row.children[0] ?? {}, 'icon'),
  );
  assert.deepEqual(icons, ['mdi:wifi', 'mdi:help-network-outline']);
});

test('a network with no client draws nothing', async () => {
  assert.ok(
    !sections(await paint(LIVE))
      .map(title)
      .includes('Guest'),
  );
});

test('without the names sensor every row still shows, without an FQDN', async () => {
  const only: States = {};
  const clients = LIVE['sensor.clients'];
  if (clients !== undefined) {
    only['sensor.clients'] = clients;
  }
  const out = sections(await paint(only));
  assert.equal(rows(out[1])[1], 'Home Assistant |  | 10.5.10.2');
  assert.equal(rows(out[0])[0], '10.3.1.1 |  | 10.3.1.1');
});

test('an unavailable clients sensor shows the unavailable value, and no list', async () => {
  const out = await paint({ 'sensor.clients': { state: 'unavailable', attributes: {} } });
  assert.ok(out.querySelector('.empty.colored'));
  assert.equal(out.querySelector('.clients'), null);
});

test('an unavailable clients sensor keeps a Clients heading over its value', async () => {
  const out = await paint({ 'sensor.clients': { state: 'unavailable', attributes: {} } });
  assert.equal(title(out.querySelector('.section')), 'Clients');
});

test('a clients sensor with no value yet, or no list, draws nothing rather than "No clients"', async () => {
  const painted = await Promise.all(
    [
      { state: 'unknown', attributes: {} },
      { state: '29', attributes: {} },
      { state: '29', attributes: { data: 'not a list' } },
    ].map(async (entry) => ({
      entry: JSON.stringify(entry),
      out: await paint({ 'sensor.clients': entry }),
    })),
  );
  for (const { entry, out } of painted) {
    assert.equal(out.querySelector('.empty'), null, entry);
    assert.equal(out.querySelector('.clients'), null, entry);
  }
});

test('no clients read as an empty list', async () => {
  const out = await paint({ 'sensor.clients': { state: '0', attributes: { data: [] } } });
  assert.equal(text(out.querySelector('.empty')), 'No clients');
});

test('the names sensor is optional: without it, rows have no FQDN', async () => {
  const { names: _names, ...config } = CONFIG;
  const out = sections(await paint(LIVE, config));
  assert.equal(rows(out[1])[1], 'Home Assistant |  | 10.5.10.2');
});

test('reverse-DNS names, and dotted names from etc/hosts, count as FQDNs', async () => {
  const names = [
    ...NAMES,
    { ip: '10.5.10.1', name: 'dns.home.arpa', source: 'etc/hosts' },
    { ip: '10.3.5.1', name: '', source: 'WHOIS' },
    { ip: '10.5.20.7', name: 'labbox.lan', source: 'DHCP' },
    { ip: '192.168.1.9', name: 'ip6-allnodes', source: 'etc/hosts' },
  ];
  const out = sections(
    await paint({ ...LIVE, 'sensor.names': { state: '7', attributes: { auto_clients: names } } }),
  );
  const servers = rowsOf(out[1]);
  assert.equal(fqdn(servers[0]), 'dns.home.arpa', 'a dotted etc/hosts name');
  assert.equal(fqdn(servers[1]), 'ha.home.arpa');
  assert.equal(fqdn(servers[2]), undefined, 'a DHCP hostname is not an FQDN');
  assert.equal(fqdn(rowsOf(out[0])[1]), undefined, 'an empty name adds no line');
  assert.equal(fqdn(rowsOf(out[2])[0]), undefined, 'an undotted hosts name');
});

test('a malformed subnet fails the configuration instead of emptying its network', () => {
  for (const subnet of ['10.1.0.0/61', '256.0.0.0/8', '10.1.0/16']) {
    const config = { ...CONFIG, networks: [{ name: 'Bad', icon: 'mdi:lan', subnet }] };
    assert.throws(() => configured(config), /subnet/, subnet);
  }
});

test('a client with a missing or null name or IP, or an IPv6 address, still gets a row', async () => {
  const data = [
    { type: 'WIRED', ipAddress: '10.5.10.9' },
    { type: 'WIRELESS', name: null, ipAddress: null },
    { type: 'WIRELESS', name: 'Laptop', ipAddress: 'fd05::12' },
  ];
  const out = sections(await paint({ 'sensor.clients': { state: '3', attributes: { data } } }));
  assert.deepEqual(out.map(title), ['Servers', 'Other']);
  assert.deepEqual(rows(out[0]), ['10.5.10.9 |  | 10.5.10.9']);
  assert.deepEqual(rows(out[1]), ['— |  | —', 'Laptop |  | fd05::12']);
});

test('an unavailable names sensor leaves every row without an FQDN', async () => {
  const out = sections(
    await paint({ ...LIVE, 'sensor.names': { state: 'unavailable', attributes: {} } }),
  );
  assert.equal(rows(out[1])[1], 'Home Assistant |  | 10.5.10.2');
});

test('a screen reader hears the count as clients, and the connection type', async () => {
  const out = sections(await paint(LIVE));
  const count = out[0]?.querySelector('.heading .state');
  assert.equal(count?.getAttribute('role'), 'img');
  assert.equal(count?.getAttribute('aria-label'), '3 clients');
  const labels = rowsOf(out[2]).map((row) => row.children[0]?.getAttribute('aria-label'));
  assert.deepEqual(labels, ['Wi-Fi', 'Other connection']);
  assert.equal(rowsOf(out[1])[0]?.children[0]?.getAttribute('aria-label'), 'Ethernet');
});

test('folded, every network shows its heading only, and Other, which needs you, stays open', async () => {
  const out = sections(await paint(LIVE, { ...CONFIG, fold: true }));
  const titles = out.map((node) => {
    const label = node.querySelector('.heading.fold')?.children[1];
    return label === undefined ? undefined : text(label);
  });
  assert.deepEqual(titles, ['IoT', 'Servers', 'Other']);
  assert.deepEqual(out.map(hidden), [true, true, false]);
  assert.equal(text(out[0]?.querySelector('.heading.fold .state')), '3', 'the count stays');
});

test('a tap on a folded network opens it, and the choice holds through the next update', async () => {
  const card = configured({ ...CONFIG, fold: true });
  card.hass = hassOf(LIVE) as never;
  const out = await mounted(card);
  sections(out)[0]?.querySelector<HTMLElement>('.heading.fold')?.click();
  await card.updateComplete;
  assert.ok(!hidden(sections(out)[0]), 'open after the tap');
  card.hass = hassOf({
    ...LIVE,
    'sensor.clients': { state: '9', attributes: { data: CLIENTS } },
  }) as never;
  await card.updateComplete;
  assert.ok(!hidden(sections(out)[0]), 'still open');
  assert.ok(hidden(sections(out)[1]), 'the others stay folded');
});

test('fields maps another source: ip instead of ipAddress, kind instead of type', async () => {
  const config = { ...CONFIG, attribute: 'clients', fields: { ip_address: 'ip', type: 'kind' } };
  const states: States = {
    'sensor.clients': {
      state: '1',
      attributes: { clients: [{ name: 'Laptop', ip: '10.5.10.5', kind: 'WIRELESS' }] },
    },
  };
  const out = sections(await paint(states, config));
  assert.deepEqual(out.map(title), ['Servers']);
  assert.deepEqual(rows(out[0]), ['Laptop |  | 10.5.10.5']);
});

test('a record missing its mapped address shows a dash, not a crash', async () => {
  const config = { ...CONFIG, fields: { ip_address: 'ip' } };
  const states: States = {
    'sensor.clients': { state: '1', attributes: { data: [{ name: 'Mystery', type: 'WIRED' }] } },
  };
  const out = sections(await paint(states, config));
  assert.deepEqual(out.map(title), ['Other']);
  assert.deepEqual(rows(out[0]), ['Mystery |  | —']);
});
