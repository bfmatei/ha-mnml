import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { HomeAssistant } from '../ha/hass.ts';
import { fakeHass } from '../test/hass.ts';
import type { ServiceCall } from '../test/hass.ts';
import { configure, created, define, mounted, text } from '../test/render.ts';
import { until } from '../test/until.ts';
import { notified, wire } from '../test/wire.ts';
import type { Wire } from '../test/wire.ts';

import { MnmlMessagesCard } from './messages.ts';

define('mnml-messages-card', MnmlMessagesCard);

const CONFIG = {
  type: 'custom:mnml-messages-card',
  entity: 'sensor.notifications',
  clear: 'script.clear_notifications',
};

const MESSAGES = [
  { id: 'b', title: 'Backup failed', message: 'vzdump 101: error', time: '2026-10-01T12:00:00Z' },
  { id: 'a', title: 'Updates', message: '', time: '2026-10-01T10:00:00Z' },
];

function hassWith(
  attributes: Record<string, unknown>,
  state: string,
  calls: ServiceCall[],
): HomeAssistant {
  return fakeHass({
    states: { 'sensor.notifications': { state, attributes } },
    entities: {
      'binary_sensor.dns_status': { entity_id: 'binary_sensor.dns_status', device_id: 'd1' },
    },
    devices: { d1: { id: 'd1', name: 'dns', name_by_user: 'DNS' } },
    calls,
  });
}

const card = (): MnmlMessagesCard => created('mnml-messages-card', MnmlMessagesCard);

async function mount(
  state: string,
  attributes: Record<string, unknown>,
  calls: ServiceCall[] = [],
  config: unknown = CONFIG,
): Promise<{ card: MnmlMessagesCard; root: ShadowRoot }> {
  const made = card();
  configure(made, config);
  made.hass = hassWith(attributes, state, calls);
  return { card: made, root: await mounted(made) };
}

async function paint(
  state: string,
  attributes: Record<string, unknown>,
  calls: ServiceCall[] = [],
): Promise<ShadowRoot> {
  return (await mount(state, attributes, calls)).root;
}

function messages(out: ParentNode): Element[] {
  return [...(out.querySelector('.messages')?.children ?? [])];
}

test('each message is a card of its own: its title, and its time as the state line', async () => {
  const [first, second] = messages(await paint('2', { messages: MESSAGES }));
  assert.deepEqual([...(first?.classList ?? [])], ['card']);
  assert.equal(text(first?.querySelector('.name')), 'Backup failed');
  assert.ok(first?.querySelector('.state ha-relative-time'), 'the time is relative');
  assert.equal(text(second?.querySelector('.name')), 'Updates');
});

test('a message starts collapsed, and a tap on its row shows and hides the text', async () => {
  const { card: made, root } = await mount('2', { messages: MESSAGES });
  const [first] = messages(root);
  const row = first?.querySelector<HTMLElement>('.row.link');
  const body = first?.querySelector('.body');
  const pill = first?.querySelector('.pill');
  assert.ok(row && body && pill);
  assert.ok(body.classList.contains('hidden'));
  assert.equal(text(body), 'vzdump 101: error');
  assert.equal(pill.getAttribute('aria-expanded'), 'false');
  row.click();
  await made.updateComplete;
  assert.ok(!body.classList.contains('hidden'), 'the text shows');
  assert.deepEqual(
    [...(first?.classList ?? [])],
    ['card', 'open'],
    'the title may wrap while open',
  );
  assert.equal(pill.getAttribute('aria-label'), 'Hide Backup failed');
  row.click();
  await made.updateComplete;
  assert.ok(body.classList.contains('hidden'), 'the text hides again');
});

test('an open message stays open when the list re-renders', async () => {
  const { card: made, root } = await mount('2', { messages: MESSAGES });
  messages(root)[0]?.querySelector<HTMLElement>('.row.link')?.click();
  await made.updateComplete;
  made.hass = hassWith({ messages: [...MESSAGES] }, '2', []);
  await made.updateComplete;
  const body = messages(root)[0]?.querySelector('.body');
  assert.ok(body && !body.classList.contains('hidden'), 'still open');
});

test('a message without text has no body and nothing to expand', async () => {
  const second = messages(await paint('2', { messages: MESSAGES }))[1];
  assert.equal(second?.querySelector('.body'), null);
  const row = second?.querySelector('.row');
  assert.ok(row && !row.classList.contains('link'), 'the row does not link');
  assert.equal(second?.querySelector('.pill')?.getAttribute('role'), null);
});

test('the envelope takes the severity: error red, warning orange, notice and info blue, any other grey', async () => {
  const sent = ['error', 'warning', 'notice', 'info', 'unknown'].map((severity) => ({
    id: severity,
    title: severity,
    message: '',
    severity,
    time: '2026-10-01T12:00:00Z',
  }));
  const out = await paint('6', {
    messages: [...sent, { id: 'none', title: 'Mail', message: '', time: '2026-10-01T12:00:00Z' }],
  });
  assert.deepEqual(
    messages(out).map((entry) => {
      const pill = entry.querySelector<HTMLElement>('.pill.colored');
      return pill === null ? undefined : pill.style.getPropertyValue('--m-color');
    }),
    [
      'var(--red-color)',
      'var(--orange-color)',
      'var(--blue-color)',
      'var(--blue-color)',
      undefined,
      undefined,
    ],
  );
  assert.ok(
    messages(out)[4]?.querySelector('.pill'),
    'an unknown severity leaves the envelope uncoloured',
  );
});

test('a message whose severity is not a string is dropped', async () => {
  const out = await paint('1', {
    messages: [{ id: 'x', title: 'Odd', message: '', severity: 3, time: '2026-10-01T10:00:00Z' }],
  });
  assert.equal(text(out.querySelector('.empty')), 'No notifications');
});

test("a message's clear button runs the clear script with that message's id", async () => {
  const calls: ServiceCall[] = [];
  const clear = messages(
    await paint('2', { messages: MESSAGES }, calls),
  )[1]?.querySelector<HTMLElement>('.control');
  assert.equal(clear?.getAttribute('aria-label'), 'Clear Updates');
  clear?.click();
  assert.deepEqual(calls, [
    {
      domain: 'script',
      service: 'turn_on',
      data: { variables: { id: 'a' } },
      target: { entity_id: 'script.clear_notifications' },
    },
  ]);
});

test('no messages, or none well-formed, read as an empty list', async () => {
  assert.equal(text((await paint('0', {})).querySelector('.empty')), 'No notifications');
  assert.equal(
    text((await paint('1', { messages: [{ id: 'x', title: 'No time' }] })).querySelector('.empty')),
    'No notifications',
  );
});

test('a message names its source before its time: PVE and PBS by name, a guest by its device', async () => {
  const config = {
    ...CONFIG,
    sources: [
      { source: 'pve', name: 'Proxmox VE' },
      { source: 'pbs', name: 'PBS' },
      { source: 'dns.home.arpa', entity: 'binary_sensor.dns_status' },
    ],
  };
  const sent = [
    { ...MESSAGES[0], id: 'c', source: 'pbs' },
    { ...MESSAGES[0], id: 'd', source: 'dns.home.arpa' },
    { ...MESSAGES[0], id: 'e', source: 'downloads.home.arpa' },
    { ...MESSAGES[0], id: 'f', source: '' },
    { ...MESSAGES[0], id: 'g' },
  ];
  const { root } = await mount('5', { messages: sent }, [], config);
  const lines = messages(root).map((entry) => {
    const state = entry.querySelector('.state');
    return state?.children.length === 2 ? text(state.children[0]) : undefined;
  });
  assert.deepEqual(lines, ['PBS', 'DNS', 'downloads.home.arpa', undefined, undefined]);
  const first = messages(root)[0]?.querySelector('.state');
  assert.equal(text(first), 'PBS •', 'a separator between the source and the time');
  assert.equal(first?.children[1]?.localName, 'ha-relative-time', 'the time follows the source');
});

test('a source is named by an entity or by a name, not both', () => {
  const made = card();
  assert.throws(() => {
    configure(made, {
      ...CONFIG,
      sources: [{ source: 'pve', entity: 'sensor.pve', name: 'Server' }],
    });
  }, /unknown key: sources\[0\]\.name/);
});

test('a message cleared takes its own card away, so the focus stays with the message it was on', async () => {
  const { card: made, root } = await mount('2', { messages: MESSAGES });
  const kept = messages(root)[1];
  assert.ok(kept);
  made.hass = hassWith({ messages: [MESSAGES[1]] }, '1', []);
  await made.updateComplete;
  assert.equal(messages(root)[0], kept);
});

test('a clear goes through the hass of the moment, not the one the message was drawn with', async () => {
  const drawn: ServiceCall[] = [];
  const now: ServiceCall[] = [];
  const first = hassWith({ messages: MESSAGES }, '2', drawn);
  const made = card();
  configure(made, CONFIG);
  made.hass = first;
  const root = await mounted(made);
  made.hass = {
    ...first,
    callService: (domain, service, data, target) => {
      now.push({ domain, service, data, target });
      return Promise.resolve();
    },
  };
  messages(root)[1]?.querySelector<HTMLElement>('.control')?.click();
  assert.deepEqual(drawn, []);
  assert.deepEqual(
    now.map((call) => call.data),
    [{ variables: { id: 'a' } }],
  );
});

function names(out: ParentNode): string[] {
  return messages(out).map((entry) => text(entry.querySelector('.name')));
}

const NOTIFIED = {
  n1: {
    notification_id: 'n1',
    title: 'Update',
    message: 'Version 2026.10.1 is out',
    created_at: '2026-10-01T10:00:00+00:00',
  },
  n2: {
    notification_id: 'n2',
    title: null,
    message: 'Login attempt failed',
    created_at: '2026-10-01T12:00:00+00:00',
  },
};

test("the notifications variant lists Home Assistant's persistent notifications, newest first, and dismisses the one cleared", async () => {
  const line = wire();
  const calls: ServiceCall[] = [];
  const made = card();
  made.setConfig({ type: 'custom:mnml-messages-card', notifications: true });
  made.hass = { ...hassWith({}, '0', calls), connection: line.connection };
  const root = await mounted(made);
  assert.deepEqual(line.sent, [{ type: 'persistent_notification/subscribe' }]);
  assert.equal(made.style.display, 'none', 'nothing until Home Assistant answers');
  line.push({ type: 'current', notifications: NOTIFIED });
  await made.updateComplete;
  assert.deepEqual(names(root), ['Login attempt failed', 'Update']);
  assert.equal(
    messages(root)[0]?.querySelector('.body'),
    null,
    'a message without a title is the title',
  );
  assert.equal(text(messages(root)[1]?.querySelector('.body')), 'Version 2026.10.1 is out');
  line.push({
    type: 'added',
    notifications: {
      n3: {
        ...NOTIFIED.n1,
        notification_id: 'n3',
        title: 'Backup',
        created_at: '2026-10-01T13:00:00+00:00',
      },
    },
  });
  line.push({ type: 'removed', notifications: { n2: NOTIFIED.n2 } });
  await made.updateComplete;
  assert.deepEqual(names(root), ['Backup', 'Update']);
  messages(root)[1]?.querySelector<HTMLElement>('.control')?.click();
  assert.deepEqual(calls, [
    {
      domain: 'persistent_notification',
      service: 'dismiss',
      data: { notification_id: 'n1' },
      target: undefined,
    },
  ]);
  line.push({ type: 'current', notifications: {} });
  await made.updateComplete;
  assert.equal(text(root.querySelector('.empty')), 'No notifications');
  made.remove();
  await until(() => line.unsubscribed === 1, 'the subscription ended');
});

const ISSUES = [
  {
    domain: 'zha',
    issue_id: 'old_firmware',
    translation_key: 'firmware',
    translation_placeholders: { version: '7' },
    severity: 'warning',
    created: '2026-10-01T09:00:00+00:00',
    ignored: false,
  },
  {
    domain: 'hassio',
    issue_id: 'disk_full',
    severity: 'error',
    created: '2026-10-01T10:00:00+00:00',
    ignored: false,
  },
  {
    domain: 'cloud',
    issue_id: 'ignored_one',
    severity: 'critical',
    created: '2026-10-01T11:00:00+00:00',
    ignored: true,
  },
  {
    domain: 'backup',
    issue_id: 'no_backup',
    severity: 'critical',
    created: '2026-10-01T08:00:00+00:00',
    ignored: false,
  },
];

const WORDS: Record<string, string> = {
  'component.zha.issues.firmware.title': 'Firmware {version} is old',
  'component.zha.issues.firmware.description': 'Update the coordinator.',
  'component.hassio.issues.disk_full.title': 'The disk is full',
  'component.zha.title': 'Zigbee Home Automation',
  'component.hassio.title': 'Supervisor',
};

function repairsHass(admin: boolean, line: Wire, loaded: unknown[]): HomeAssistant {
  return {
    ...hassWith({}, '0', []),
    user: { id: 'u1', is_admin: admin },
    connection: line.connection,
    localize: (key: string, values?: Record<string, unknown>): string =>
      (WORDS[key] ?? '').replaceAll(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name])),
    loadBackendTranslation: (category: string, domains: string[]) => {
      loaded.push([category, domains]);
      return Promise.resolve();
    },
  };
}

test("the repairs variant lists an admin's open repairs, most severe first, by Home Assistant's titles, with nothing to clear", async () => {
  const line = wire({ 'repairs/list_issues': { issues: ISSUES } });
  const loaded: unknown[] = [];
  const made = card();
  made.setConfig({ type: 'custom:mnml-messages-card', repairs: true });
  made.hass = repairsHass(true, line, loaded);
  const root = await mounted(made);
  await until(() => names(root).length === 3, 'the repairs');
  assert.deepEqual(loaded, [['issues', ['zha', 'hassio', 'backup']]]);
  assert.deepEqual(names(root), ['No backup', 'The disk is full', 'Firmware 7 is old']);
  assert.deepEqual(
    messages(root).map((entry) =>
      entry.querySelector<HTMLElement>('.pill.colored')?.style.getPropertyValue('--m-color'),
    ),
    ['var(--red-color)', 'var(--red-color)', 'var(--orange-color)'],
  );
  assert.equal(root.querySelector('.control'), null, 'a repair is fixed in Home Assistant');
  assert.equal(text(messages(root)[2]?.querySelector('.body')), 'Update the coordinator.');
  assert.equal(text(messages(root)[2]?.querySelector('.state span')), 'Zigbee Home Automation');
  assert.equal(text(messages(root)[0]?.querySelector('.state span')), 'backup');
  const asked = (): number =>
    line.sent.filter((message) => (message as { type: string }).type === 'repairs/list_issues')
      .length;
  line.event();
  await until(() => asked() === 2, 'asked again when the issue registry changes');
  made.remove();
  await until(() => line.unsubscribed === 1, 'the subscription ended');
});

test('the repairs variant draws nothing for a user who is not an admin, and asks nothing', async () => {
  const line = wire({ 'repairs/list_issues': { issues: ISSUES } });
  const made = card();
  made.setConfig({ type: 'custom:mnml-messages-card', repairs: true });
  made.hass = repairsHass(false, line, []);
  await mounted(made);
  assert.deepEqual(line.sent, []);
  assert.equal(made.style.display, 'none');
  made.remove();
});

test('a messages card reads a sensor with its clear script, notifications or repairs, never two of them', () => {
  const made = card();
  const type = 'custom:mnml-messages-card';
  assert.throws(() => {
    configure(made, { type, notifications: true, entity: 'sensor.notifications' });
  }, /entity/);
  assert.throws(() => {
    configure(made, { type, repairs: true, clear: 'script.clear' });
  }, /clear/);
  assert.throws(() => {
    configure(made, { type, notifications: true, repairs: true });
  }, /repairs/);
  assert.throws(() => {
    configure(made, { type, entity: 'sensor.notifications' });
  }, /clear/);
});

test("the summary row counts Home Assistant's messages, None when there are none, coloured only while there are any, and opens their pop-up", async () => {
  const line = wire({ 'repairs/list_issues': { issues: ISSUES } });
  const made = card();
  configure(made, {
    type: 'custom:mnml-messages-card',
    popup: '#system-messages',
    name: 'Messages',
    icon: 'mdi:bell-outline',
    color: 'amber',
  });
  made.hass = repairsHass(true, line, []);
  const root = await mounted(made);
  assert.equal(made.style.display, 'none', 'nothing until Home Assistant answers');
  line.push(notified(0));
  await until(() => text(root.querySelector('.state')) === '3', 'the open repairs counted');
  assert.equal(text(root.querySelector('.name')), 'Messages');
  const pill = root.querySelector('.pill');
  assert.ok(pill);
  assert.ok(pill.classList.contains('colored'));
  assert.equal(pill.getAttribute('role'), 'button');
  assert.equal(pill.getAttribute('aria-label'), 'Messages: 3');
  assert.ok(root.querySelector('.row.link'));
  made.remove();
  const other = wire();
  const quiet = card();
  configure(quiet, {
    type: 'custom:mnml-messages-card',
    popup: '#system-messages',
    name: 'Messages',
    icon: 'mdi:bell-outline',
    color: 'amber',
  });
  quiet.hass = repairsHass(false, other, []);
  const calm = await mounted(quiet);
  other.push(notified(0));
  await quiet.updateComplete;
  assert.equal(text(calm.querySelector('.state')), 'None');
  assert.equal(calm.querySelector('.pill.colored'), null);
  quiet.remove();
});
