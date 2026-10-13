import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';

import { expand } from './expand.ts';
import { rolesOf } from './roles.ts';
import { SHIPPED } from './shipped.ts';

type Mapping = Record<string, Value>;

function all(node: Value, found: Mapping[] = []): Mapping[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      all(item, found);
    }
  } else if (isMapping(node)) {
    found.push(node);
    for (const inner of Object.values(node)) {
      all(inner, found);
    }
  }
  return found;
}

function popup(template: string, slots: Mapping, hash: string): Mapping[] {
  const found = expand(SHIPPED, { template, slots }).popups.find(
    (each) => isMapping(each) && each['hash'] === hash,
  );
  assert.ok(found, hash);
  return all(found);
}

const row = (cards: Mapping[], entity: string): Mapping | undefined =>
  cards.find((each) => each['entity'] === entity && each['type'] === undefined);

test("a room's battery thresholds reach the batteries of its pop-up and of its heating pop-up", () => {
  const slots = {
    key: 'den',
    name: 'Den',
    batteries: ['sensor.door_battery'],
    heating: {
      entity: 'climate.den',
      thermostats: [{ valve: 'sensor.valve', battery: 'sensor.valve_battery' }],
    },
    low: 30,
    critical: 10,
  };
  const battery = row(popup('room', slots, '#den'), 'sensor.door_battery');
  assert.deepEqual([battery?.['low'], battery?.['critical']], [30, 10]);
  const valve = row(popup('room', slots, '#den-heating'), 'sensor.valve_battery');
  assert.deepEqual([valve?.['low'], valve?.['critical']], [30, 10]);
});

const PHONE = {
  key: 'phone',
  tracker: 'device_tracker.phone',
  battery: 'sensor.phone_battery',
  battery_state: 'sensor.phone_battery_state',
  connection: 'sensor.phone_connection',
  network: 'sensor.phone_network',
  storage: 'sensor.phone_storage',
  focus: 'binary_sensor.phone_focus',
  activity: 'sensor.phone_activity',
  permission: 'sensor.phone_permission',
};

test("a person's battery thresholds reach each device's pop-up", () => {
  const slots = { key: 'alex', entity: 'person.alex', devices: [PHONE], low: 30, critical: 10 };
  const battery = row(popup('person', slots, '#person-alex-phone'), 'sensor.phone_battery');
  assert.deepEqual([battery?.['low'], battery?.['critical']], [30, 10]);
});

const CAR = {
  key: 'suv',
  metadata: 'sensor.suv',
  lock: 'sensor.suv_lock',
  alarm: 'sensor.suv_alarm',
  doors: ['binary_sensor.d1', 'binary_sensor.d2', 'binary_sensor.d3', 'binary_sensor.d4'],
  hood: 'binary_sensor.hood',
  tailgate: 'binary_sensor.tailgate',
  windows: ['sensor.w1', 'sensor.w2', 'sensor.w3', 'sensor.w4'],
  tyres: ['sensor.t1', 'sensor.t2', 'sensor.t3', 'sensor.t4'],
  tyre_targets: ['sensor.g1', 'sensor.g2', 'sensor.g3', 'sensor.g4'],
};

function plan(slots: Mapping): Mapping | undefined {
  return popup('car', slots, '#car-suv').find(
    (each) => each['type'] === 'custom:mnml-car-plan-card',
  );
}

test("a car's open states reach its plan, which draws them at least half open", () => {
  assert.deepEqual(plan(CAR)?.['half_states'], ['open', 'intermediate']);
  assert.equal(plan(CAR)?.['open_states'], undefined, 'on and open stay fully open');
  assert.deepEqual(plan({ ...CAR, open_states: ['opened'] })?.['half_states'], ['opened']);
});

test("a media server's words for nothing reach its pop-up", () => {
  const slots = {
    streams: 'sensor.streams',
    requests: { pending: 'sensor.pending', processing: 'sensor.processing' },
    movies: { queue: 'sensor.movies_queue', count: 'sensor.movies' },
    none: ['0', 'idle'],
  };
  const cards = popup('media-server', slots, '#media');
  assert.deepEqual(row(cards, 'sensor.pending')?.['when'], { not: ['0', 'idle'] });
  assert.deepEqual(row(cards, 'sensor.movies_queue')?.['when'], { not: ['0', 'idle'] });
});

test('a slot set to null reaches a nested template as none, not as its default', () => {
  const cards = popup('car', { ...CAR, lock_words: null }, '#car-suv');
  assert.equal(row(cards, 'sensor.suv_lock')?.['words'], undefined);
});

const T: Templates = {
  outer: {
    slots: { entity: { kind: 'entity', required: true }, color: { kind: 'text' } },
    card: { template: 'power', slots: { entity: '[[entity]]', color: '[[color]]' } },
  },
  power: SHIPPED['power'] ?? { card: null },
};

test('a nested template gets null for a slot set to null, and its default for one left unset', () => {
  assert.deepEqual(
    expand(T, { template: 'outer', slots: { entity: 'light.a', color: null } }).card,
    { type: 'toggle', entity: 'light.a', icon: 'mdi:power', primary: true },
  );
  assert.deepEqual(expand(T, { template: 'outer', slots: { entity: 'light.a' } }).card, {
    type: 'toggle',
    entity: 'light.a',
    icon: 'mdi:power',
    color: 'amber',
    primary: true,
  });
});

const roles = rolesOf(SHIPPED);

function holdsAlways(rule: Mapping): boolean {
  const not = rule['not'];
  return (
    rule['is'] === undefined &&
    rule['below'] === undefined &&
    rule['within_days'] === undefined &&
    (not === undefined || (Array.isArray(not) && not.length === 0))
  );
}

test('a word list left empty never lights a chip of its tile, whatever the state', () => {
  const always: string[] = [];
  for (const [name, template] of Object.entries(SHIPPED)) {
    if (roles[name] !== 'tile') {
      continue;
    }
    const words = Object.entries(template.slots ?? {}).filter(([, spec]) => spec.kind === 'texts');
    for (const [slot] of words) {
      for (const empty of [null, []]) {
        const { card } = expand(SHIPPED, {
          template: name,
          slots: { ...template.example, [slot]: empty },
        });
        for (const node of all(card)) {
          const rules = node['type'] === 'status' ? node['rules'] : undefined;
          for (const rule of Array.isArray(rules) ? rules.filter(isMapping) : []) {
            if (holdsAlways(rule)) {
              always.push(
                `${name} with ${slot}: ${JSON.stringify(empty)}: ${JSON.stringify(node['name'])}`,
              );
            }
          }
        }
      }
    }
  }
  assert.deepEqual([...new Set(always)], []);
});

const NETWORK = { devices: ['sensor.ap'] };

test("an empty word list leaves a pop-up's row uncoloured where the row needs nothing else", () => {
  for (const empty of [null, []]) {
    const devices = row(
      popup('unifi-network', { ...NETWORK, device_up: empty }, '#network'),
      'sensor.ap',
    );
    assert.deepEqual(devices, { entity: 'sensor.ap', label: 'device' });
    const requests = row(
      popup(
        'media-server',
        {
          streams: 'sensor.streams',
          requests: { pending: 'sensor.pending', processing: 'sensor.processing' },
          none: empty,
        },
        '#media',
      ),
      'sensor.pending',
    );
    assert.deepEqual(requests, { entity: 'sensor.pending' });
    const lock = row(popup('car', { ...CAR, unlocked: empty }, '#car-suv'), 'sensor.suv_lock');
    assert.deepEqual(lock?.['when'], { is: [] }, 'is: [] holds for no state');
  }
});

test('a device that need not stay connected has no colour rule, and an essential one keeps it', () => {
  const device = { connected: 'binary_sensor.phone' };
  const personal = expand(SHIPPED, { template: 'tailscale-device', slots: { device } }).card;
  assert.ok(isMapping(personal));
  assert.deepEqual([personal['color'], personal['when']], [undefined, undefined]);
  const essential = expand(SHIPPED, {
    template: 'tailscale-device',
    slots: { device, alert: 'red' },
  }).card;
  assert.ok(isMapping(essential));
  assert.deepEqual([essential['color'], essential['when']], ['red', { is: ['off'] }]);
});

test('the Checks glance leaves its colour to the count default', () => {
  const { card } = expand(SHIPPED, {
    template: 'glances',
    slots: {
      checks: {
        failed: 'sensor.failed',
        last_run: 'sensor.last_run',
        overdue: 'binary_sensor.overdue',
      },
    },
  });
  const checks = all(card).find((node) => node['name'] === 'Checks');
  assert.ok(checks);
  assert.equal(checks['color'], undefined);
});
