import assert from 'node:assert/strict';

import { afterEach, test, vi } from 'vitest';

import { fakeConnection, fakeHass } from '../test/hass.ts';
import type { FakeState } from '../test/hass.ts';
import { until } from '../test/until.ts';

import { Judge, conditionProblem } from './conditions.ts';
import type { HassConnection, HomeAssistant } from './hass.ts';

interface Subscribed {
  message: Record<string, unknown>;
  send: (event: unknown) => void;
  closed: boolean;
}

function connection(subscribed: Subscribed[] = []): HassConnection {
  return fakeConnection({
    subscribeMessage: (send, message) => {
      const entry: Subscribed = { message, send, closed: false };
      subscribed.push(entry);
      return Promise.resolve(() => {
        entry.closed = true;
        return Promise.resolve();
      });
    },
  });
}

function hassOf(
  states: Record<string, FakeState>,
  extra: { connection?: HassConnection } = {},
): HomeAssistant {
  return fakeHass({
    states,
    connection: connection(),
    user: { id: 'u-1', is_admin: false },
    ...extra,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a state condition reads an attribute, a missing one as unknown, and counts states named by entity id', () => {
  const judge = new Judge(() => {});
  const hass = hassOf({
    'climate.hall': { state: 'heat', attributes: { hvac_action: 'heating' } },
    'input_select.wanted': { state: 'heat' },
  });
  const shown = (condition: Record<string, unknown>): boolean =>
    judge.shown([condition], hass, undefined);
  assert.equal(
    shown({
      condition: 'state',
      entity: 'climate.hall',
      attribute: 'hvac_action',
      state: 'heating',
    }),
    true,
  );
  assert.equal(
    shown({ condition: 'state', entity: 'climate.hall', attribute: 'fan', state: 'unknown' }),
    true,
  );
  assert.equal(
    shown({ condition: 'state', entity: 'climate.hall', state: ['input_select.wanted'] }),
    true,
  );
  assert.equal(shown({ condition: 'state', entity: 'climate.hall', state_not: 'heat' }), false);
  assert.equal(shown({ entity: 'climate.hall', state: 'heat' }), true, 'the legacy form');
});

test("a state or numeric_state condition without an entity judges the card's own, and hides a card whose entity is gone", () => {
  const judge = new Judge(() => {});
  const hass = hassOf({ 'sensor.level': { state: '42' } });
  assert.equal(judge.shown([{ condition: 'state', state: '42' }], hass, 'sensor.level'), true);
  assert.equal(
    judge.shown([{ condition: 'numeric_state', above: 50 }], hass, 'sensor.level'),
    false,
  );
  assert.equal(judge.shown([{ condition: 'state', state: '42' }], hass, undefined), false);
  assert.equal(
    judge.shown([{ condition: 'state', entity: 'sensor.gone', state_not: 'on' }], hass, undefined),
    false,
  );
});

test('a numeric_state condition compares above and below, reads a bound from an entity, and is false for a state that is not a number', () => {
  const judge = new Judge(() => {});
  const hass = hassOf({
    'sensor.level': { state: '42', attributes: { peak: 80 } },
    'number.limit': { state: '40' },
    'sensor.word': { state: 'high' },
  });
  const shown = (condition: Record<string, unknown>): boolean =>
    judge.shown([{ condition: 'numeric_state', ...condition }], hass, undefined);
  assert.equal(shown({ entity: 'sensor.level', above: 40, below: 50 }), true);
  assert.equal(shown({ entity: 'sensor.level', below: 42 }), false);
  assert.equal(shown({ entity: 'sensor.level', above: 'number.limit' }), true);
  assert.equal(shown({ entity: 'sensor.level', attribute: 'peak', above: 70 }), true);
  assert.equal(shown({ entity: 'sensor.word', above: 0 }), false);
});

test('a screen condition follows its media query, and a change to it calls back', () => {
  const lists = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
  vi.stubGlobal('matchMedia', (query: string) => {
    const list = lists.get(query) ?? { matches: false, listeners: new Set<() => void>() };
    lists.set(query, list);
    return {
      get matches() {
        return list.matches;
      },
      addEventListener: (_type: string, listener: () => void) => list.listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => list.listeners.delete(listener),
    };
  });
  let changes = 0;
  const judge = new Judge(() => {
    changes += 1;
  });
  const hass = hassOf({});
  const visibility = [{ condition: 'screen', media_query: '(min-width: 1024px)' }];
  assert.equal(judge.shown(visibility, hass, undefined), false);
  const list = lists.get('(min-width: 1024px)');
  assert.ok(list);
  list.matches = true;
  for (const listener of list.listeners) {
    listener();
  }
  assert.equal(changes, 1);
  assert.equal(judge.shown(visibility, hass, undefined), true);
  judge.close();
  assert.equal(list.listeners.size, 0, 'closing lets go of the query');
});

test("a user condition shows the card to the users it names, by Home Assistant's user id", () => {
  const judge = new Judge(() => {});
  const hass = hassOf({});
  assert.equal(judge.shown([{ condition: 'user', users: ['u-1', 'u-2'] }], hass, undefined), true);
  assert.equal(judge.shown([{ condition: 'user', users: ['u-2'] }], hass, undefined), false);
});

const on = (entity: string) => ({ condition: 'state', entity, state: 'on' });

test('and, or and not combine their conditions as Home Assistant does, skipping disabled ones', () => {
  const judge = new Judge(() => {});
  const hass = hassOf({ 'light.a': { state: 'on' }, 'light.b': { state: 'off' } });
  const shown = (condition: Record<string, unknown>): boolean =>
    judge.shown([condition], hass, undefined);
  assert.equal(shown({ condition: 'and', conditions: [on('light.a'), on('light.b')] }), false);
  assert.equal(shown({ condition: 'or', conditions: [on('light.a'), on('light.b')] }), true);
  assert.equal(
    shown({ condition: 'not', conditions: [on('light.a'), on('light.b')] }),
    true,
    'not is the opposite of all its conditions together',
  );
  assert.equal(shown({ condition: 'or', conditions: on('light.a') }), true, 'a single condition');
  assert.equal(shown({ condition: 'not' }), true, 'without conditions, as Home Assistant has it');
  assert.equal(
    shown({ condition: 'and', conditions: [on('light.a'), { ...on('light.b'), enabled: false }] }),
    true,
  );
  assert.equal(
    judge.shown([on('light.a'), { ...on('light.b'), enabled: false }], hass, undefined),
    true,
  );
  assert.equal(shown({ ...on('light.a'), enabled: '{{ true }}' }), false, 'a templated enabled');
});

test('a condition only the server can judge is subscribed with subscribe_condition, hides the card until it answers, and follows the answer', async () => {
  const subscribed: Subscribed[] = [];
  let changes = 0;
  const judge = new Judge(() => {
    changes += 1;
  });
  const hass = hassOf({}, { connection: connection(subscribed) });
  const sun = { condition: 'sun', after: 'sunset' };
  const visibility = [sun, { condition: 'template', value_template: '{{ true }}' }];
  assert.equal(judge.shown(visibility, hass, undefined), false);
  assert.equal(judge.shown(visibility, hass, undefined), false);
  assert.deepEqual(
    subscribed.map((entry) => entry.message),
    [
      { type: 'subscribe_condition', condition: sun },
      { type: 'subscribe_condition', condition: visibility[1] },
    ],
    'one subscription each, however often the card is judged',
  );
  subscribed[0]?.send({ result: true });
  assert.equal(judge.shown(visibility, hass, undefined), false, 'one still to answer');
  subscribed[1]?.send({ result: true });
  assert.equal(judge.shown(visibility, hass, undefined), true);
  assert.equal(changes, 2);
  subscribed[1]?.send({ error: { code: 'template_error', message: 'bad' } });
  assert.equal(judge.shown(visibility, hass, undefined), false, 'an error hides the card');
  judge.close();
  await until(() => subscribed.every((entry) => entry.closed), 'the subscriptions closed');
  assert.deepEqual(
    subscribed.map((entry) => entry.closed),
    [true, true],
  );
  subscribed[0]?.send({ result: false });
  assert.equal(changes, 3, 'nothing is heard from a closed subscription');
});

test('a core state condition with entity_id goes to the server, and a new connection subscribes again', async () => {
  const first: Subscribed[] = [];
  const second: Subscribed[] = [];
  const judge = new Judge(() => {});
  const core = { condition: 'state', entity_id: ['light.a', 'light.b'], state: 'on', match: 'any' };
  judge.shown([core], hassOf({}, { connection: connection(first) }), undefined);
  judge.shown([core], hassOf({}, { connection: connection(second) }), undefined);
  await until(() => first[0]?.closed === true, 'the first subscription closed');
  assert.equal(first.length, 1);
  assert.equal(first[0]?.closed, true);
  assert.equal(second.length, 1);
});

test('time, location and view_columns, which Home Assistant judges in its own frontend, show the card and subscribe nothing', () => {
  const subscribed: Subscribed[] = [];
  const judge = new Judge(() => {});
  const hass = hassOf({}, { connection: connection(subscribed) });
  const visibility = [
    { condition: 'time', after: '08:00', before: '20:00' },
    { condition: 'location', locations: ['home'] },
    { condition: 'view_columns', min: 2 },
  ];
  assert.equal(judge.shown(visibility, hass, undefined), true);
  assert.equal(subscribed.length, 0);
});

test("a condition is a problem only when it is not a mapping or lacks the key Home Assistant's frontend cannot judge it without", () => {
  assert.equal(conditionProblem({ condition: 'sun', after: 'sunset' }, 'v[0]'), undefined);
  assert.equal(conditionProblem({ condition: 'numeric_state', entity: '' }, 'v[0]'), undefined);
  assert.equal(conditionProblem({ condition: 'or' }, 'v[0]'), undefined);
  assert.equal(conditionProblem({ condition: 'light.is_on', target: {} }, 'v[0]'), undefined);
  assert.equal(conditionProblem({ entity: 'light.a', state: 'on' }, 'v[0]'), undefined);
  assert.equal(conditionProblem('on', 'v[0]'), 'v[0]: a condition must be a mapping');
  assert.equal(
    conditionProblem({ condition: 'state', entity: 'light.a' }, 'v[0]'),
    'v[0]: a state condition needs state or state_not',
  );
  assert.equal(
    conditionProblem({ condition: 'screen' }, 'v[0]'),
    'v[0]: a screen condition needs media_query',
  );
  assert.equal(
    conditionProblem({ condition: 'user' }, 'v[0]'),
    'v[0]: a user condition needs users',
  );
  assert.equal(
    conditionProblem({ condition: 'not', conditions: [{ condition: 'screen' }] }, 'v[0]'),
    'v[0].conditions[0]: a screen condition needs media_query',
  );
});
