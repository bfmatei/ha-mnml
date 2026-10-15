import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fakeConnection, fakeHass, fakeHost, fakeState, fakeStore } from './hass.ts';
import type { ServiceCall } from './hass.ts';

const localize = (): string => 'Hoch';

test('a fake state takes its id from its key, and is unchanged since the epoch, with no attributes', () => {
  const hass = fakeHass({ states: { 'light.a': { state: 'on' } } });
  assert.deepEqual(hass.states['light.a'], {
    entity_id: 'light.a',
    state: 'on',
    attributes: {},
    last_changed: '1970-01-01T00:00:00+00:00',
    last_updated: '1970-01-01T00:00:00+00:00',
  });
});

test('a fake Home Assistant speaks English and formats a state, an attribute and its name as given', () => {
  const hass = fakeHass({
    states: { 'sun.sun': { state: 'above_horizon', attributes: { a: 2 } } },
  });
  const sun = hass.states['sun.sun'];
  assert.ok(sun);
  assert.equal(hass.locale.language, 'en');
  assert.equal(fakeHass({ language: 'ro' }).locale.language, 'ro');
  assert.equal(hass.formatEntityState(sun), 'above_horizon');
  assert.equal(hass.formatEntityState(sun, 'below_horizon'), 'below_horizon');
  assert.equal(hass.formatEntityAttributeName(sun, 'next_rising'), 'next_rising');
  assert.equal(hass.formatEntityAttributeValue(sun, 'a'), '2');
  assert.equal(hass.formatEntityAttributeValue(sun, 'a', 3), '3');
  assert.equal(hass.localize('ui.card.weather.high'), '', 'an unknown key reads as nothing');
});

test('a fake Home Assistant records the services it is asked for, and knows no command', async () => {
  const calls: ServiceCall[] = [];
  const hass = fakeHass({ calls });
  await hass.callService('light', 'turn_on', { brightness: 3 }, { entity_id: 'light.a' });
  assert.deepEqual(calls, [
    {
      domain: 'light',
      service: 'turn_on',
      data: { brightness: 3 },
      target: { entity_id: 'light.a' },
    },
  ]);
  await assert.rejects(hass.connection.sendMessagePromise({ type: 'mnml/x' }), {
    code: 'unknown_command',
  });
});

test('a fake made from another, with calls of its own, records them there alone', async () => {
  const first: ServiceCall[] = [];
  const second: ServiceCall[] = [];
  const hass = fakeHass({ ...fakeHass({ calls: first }), calls: second });
  await hass.callService('button', 'press', undefined, { entity_id: 'button.a' });
  assert.deepEqual(first, []);
  assert.equal(second.length, 1);
});

test('what a test gives replaces the fake, and a store keeps its connection in a whole Home Assistant', () => {
  assert.equal(fakeHass({ localize }).localize('ui.card.weather.high'), 'Hoch');
  const store = fakeStore();
  assert.equal(store.hass.locale.language, 'en');
  assert.equal(typeof store.hass.connection.subscribeMessage, 'function');
});

test('a fake state on its own is unknown until given a state, and keeps the id it was made with', () => {
  assert.equal(fakeState('lock.door').state, 'unknown');
  assert.deepEqual(fakeState('lock.door', { state: 'jammed', attributes: { a: 1 } }), {
    entity_id: 'lock.door',
    state: 'jammed',
    attributes: { a: 1 },
    last_changed: '1970-01-01T00:00:00+00:00',
    last_updated: '1970-01-01T00:00:00+00:00',
  });
});

test('a fake connection knows no command or subscription, listens to nothing, and answers as given', async () => {
  const quiet = fakeConnection();
  await assert.rejects(quiet.sendMessagePromise({ type: 'mnml/x' }), { code: 'unknown_command' });
  await assert.rejects(
    quiet.subscribeMessage(() => undefined, { type: 'mnml/x' }),
    { code: 'unknown_command' },
  );
  const stop = await quiet.subscribeEvents(() => undefined, 'state_changed');
  await stop();
  const told = fakeConnection({
    sendMessagePromise: (message) => Promise.resolve(message['type']),
  });
  assert.equal(await told.sendMessagePromise({ type: 'mnml/x' }), 'mnml/x');
});

test('a fake host is in the page with no Home Assistant, and takes what a test gives', () => {
  const host = fakeHost();
  assert.equal(host.isConnected, true);
  assert.equal(host.hass, undefined);
  const hass = fakeHass();
  assert.equal(fakeHost({ hass }).hass, hass);
});

test('a store records every command and answers each as its test says, refusing by default', async () => {
  const store = fakeStore();
  await assert.rejects(store.hass.connection.sendMessagePromise({ type: 'mnml/x' }), {
    code: 'unknown_command',
  });
  store.answer = (message) => Promise.resolve(message['type'] === 'mnml/y' ? 'yes' : 'no');
  assert.equal(await store.hass.connection.sendMessagePromise({ type: 'mnml/y' }), 'yes');
  assert.deepEqual(store.calls, [{ type: 'mnml/x' }, { type: 'mnml/y' }]);
});
