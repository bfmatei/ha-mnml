import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

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

interface Call {
  domain: string;
  service: string;
  data: unknown;
  target: unknown;
}

function hassWith(attributes: Record<string, unknown>, state: string, calls: Call[]): unknown {
  return {
    states: { 'sensor.notifications': { entity_id: 'sensor.notifications', state, attributes } },
    entities: {
      'binary_sensor.dns_status': { entity_id: 'binary_sensor.dns_status', device_id: 'd1' },
    },
    devices: { d1: { id: 'd1', name: 'dns', name_by_user: 'DNS' } },
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    callService: (domain: string, service: string, data: unknown, target: unknown) => {
      calls.push({ domain, service, data, target });
      return Promise.resolve();
    },
  };
}

function card(): MnmlMessagesCard {
  const made = document.createElement('mnml-messages-card');
  assert.ok(made instanceof MnmlMessagesCard);
  return made;
}

async function mount(
  state: string,
  attributes: Record<string, unknown>,
  calls: Call[] = [],
  config: unknown = CONFIG,
): Promise<{ card: MnmlMessagesCard; root: ShadowRoot }> {
  const made = card();
  made.setConfig(config as never);
  made.hass = hassWith(attributes, state, calls) as never;
  return { card: made, root: await mounted(made) };
}

async function paint(
  state: string,
  attributes: Record<string, unknown>,
  calls: Call[] = [],
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
  made.hass = hassWith({ messages: [...MESSAGES] }, '2', []) as never;
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
  const calls: Call[] = [];
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
    made.setConfig({
      ...CONFIG,
      sources: [{ source: 'pve', entity: 'sensor.pve', name: 'Server' }],
    } as never);
  }, /unknown key: sources\[0\]\.name/);
});

test('a message cleared takes its own card away, so the focus stays with the message it was on', async () => {
  const { card: made, root } = await mount('2', { messages: MESSAGES });
  const kept = messages(root)[1];
  assert.ok(kept);
  made.hass = hassWith({ messages: [MESSAGES[1]] }, '1', []) as never;
  await made.updateComplete;
  assert.equal(messages(root)[0], kept);
});
