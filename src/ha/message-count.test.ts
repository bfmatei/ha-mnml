import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Host } from '../cards/base.ts';
import { fakeHass, fakeHost } from '../test/hass.ts';
import { until } from '../test/until.ts';
import { notified, wire } from '../test/wire.ts';
import type { Wire } from '../test/wire.ts';

import type { HomeAssistant } from './hass.ts';
import { messageCount } from './message-count.ts';

const REPAIR = {
  domain: 'hassio',
  issue_id: 'disk_full',
  severity: 'error',
  created: '2026-10-01T10:00:00+00:00',
  ignored: false,
};

interface Listening {
  host: Host;
  refreshed: () => number;
  leave: () => void;
}

function listening(): Listening {
  const teardowns: (() => void)[] = [];
  let refreshed = 0;
  return {
    host: fakeHost({
      register: (teardown) => {
        teardowns.push(teardown);
        return () => undefined;
      },
      refresh: () => {
        refreshed += 1;
      },
    }),
    refreshed: () => refreshed,
    leave: () => {
      for (const teardown of teardowns.splice(0)) {
        teardown();
      }
    },
  };
}

function hassOn(line: Wire, admin: boolean): HomeAssistant {
  return { ...fakeHass(), connection: line.connection, user: { id: 'u1', is_admin: admin } };
}

test('one subscription counts for every card, which hears each change, and the last card to go ends it', () => {
  const line = wire();
  const hass = hassOn(line, false);
  const one = listening();
  const two = listening();
  assert.equal(messageCount(one.host, hass), undefined, 'nothing until Home Assistant answers');
  assert.equal(messageCount(two.host, hass), undefined);
  assert.deepEqual(line.sent, [{ type: 'persistent_notification/subscribe' }]);
  line.push(notified(2));
  assert.equal(one.refreshed(), 1);
  assert.equal(two.refreshed(), 1);
  assert.deepEqual(messageCount(one.host, hass), { all: 2, notifications: 2 });
  one.leave();
  assert.equal(line.unsubscribed, 0, 'a card still counts');
  two.leave();
  return until(() => line.unsubscribed === 1, 'the end of the subscription');
});

test("an administrator's count adds the open repairs, which nobody else is asked for", async () => {
  const line = wire({ 'repairs/list_issues': { issues: [REPAIR, { ...REPAIR, ignored: true }] } });
  const admin = listening();
  const hass = hassOn(line, true);
  messageCount(admin.host, hass);
  line.push(notified(1));
  assert.equal(messageCount(admin.host, hass), undefined, 'not until the repairs answer too');
  await until(() => messageCount(admin.host, hass) !== undefined, 'the repairs');
  assert.deepEqual(messageCount(admin.host, hass), { all: 2, notifications: 1 });
  admin.leave();
  const other = wire({ 'repairs/list_issues': { issues: [REPAIR] } });
  const user = listening();
  messageCount(user.host, hassOn(other, false));
  other.push(notified(0));
  assert.deepEqual(messageCount(user.host, hassOn(other, false)), { all: 0, notifications: 0 });
  assert.deepEqual(other.sent, [{ type: 'persistent_notification/subscribe' }]);
  user.leave();
});

test('a card no longer on the page neither joins nor starts a subscription', () => {
  const line = wire();
  const gone = listening();
  const host = { ...gone.host, isConnected: false };
  assert.equal(messageCount(host, hassOn(line, false)), undefined);
  assert.deepEqual(line.sent, []);
});

test('a new connection starts a new subscription and ends the old one', async () => {
  const first = wire();
  const second = wire();
  const card = listening();
  messageCount(card.host, hassOn(first, false));
  first.push(notified(3));
  messageCount(card.host, hassOn(second, false));
  assert.equal(messageCount(card.host, hassOn(second, false)), undefined);
  second.push(notified(1));
  assert.deepEqual(messageCount(card.host, hassOn(second, false)), { all: 1, notifications: 1 });
  await until(() => first.unsubscribed === 1, 'the end of the first subscription');
  card.leave();
});
