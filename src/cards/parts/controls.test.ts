import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { StateRule } from '../../contract/cards.ts';
import type { EntityId } from '../../contract/entities.ts';
import { drawn } from '../../test/render.ts';

import { renderControls } from './controls.ts';
import { tipOf } from './tooltip.ts';

type Controls = Parameters<typeof renderControls>[0];

function hassWith(state: string): unknown {
  return {
    states: { 'update.a': { entity_id: 'update.a', state, attributes: {} } },
    entities: { 'update.a': { entity_id: 'update.a', name: 'Update', device_id: 'd1' } },
    devices: { d1: { id: 'd1', name: 'Matter Server', name_by_user: null } },
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
  };
}

type Context = Parameters<typeof renderControls>[1];

function lane(controls: Controls, context: unknown): Element | null {
  return drawn(renderControls(controls, context as Context)).querySelector('.lane');
}

function chip(controls: Controls, state: string): Element {
  const drawnLane = lane(controls, { hass: hassWith(state), host: {} });
  assert.ok(drawnLane, 'the lane renders');
  const first = drawnLane.children[0];
  assert.ok(first, 'the chip renders');
  return first;
}

function tooltip(controls: Controls, state: string): unknown {
  return tipOf(chip(controls, state));
}

function pressButton(state: string): Element | undefined {
  const hass = {
    states: { 'button.a': { entity_id: 'button.a', state, attributes: {} } },
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
  };
  const drawnLane = lane(
    [
      {
        type: 'service',
        entity: 'button.a',
        service: 'button.press',
        name: 'Pause',
        icon: 'mdi:pause',
      },
    ],
    { hass, host: {} },
  );
  return drawnLane?.children[0];
}

test('a service control on a button is drawn before the button was ever pressed', () => {
  const fresh = pressButton('unknown');
  assert.ok(fresh, 'a never-pressed button is offered');
  assert.equal(fresh.localName, 'button');
  const offline = pressButton('unavailable');
  assert.ok(offline?.classList.contains('inert'), 'an unavailable one is an inert display');
});

test('a coloured control follows its when rule, and lights on "on" without one', () => {
  const plain: Controls = [{ type: 'toggle', entity: 'update.a', color: 'amber' }];
  const running: Controls = [
    { type: 'toggle', entity: 'update.a', color: 'amber', when: { not: ['off'] } },
  ];
  const lit = (controls: Controls, state: string): boolean =>
    chip(controls, state).classList.contains('colored');
  assert.equal(lit(plain, 'on'), true);
  assert.equal(lit(plain, 'idle'), false);
  assert.equal(lit(running, 'idle'), true);
  assert.equal(lit(running, 'off'), false);
});

test('an unavailable entity keeps its action controls as inert orange displays', () => {
  const both = lane(
    [
      { type: 'toggle', entity: 'update.a', color: 'amber', primary: true },
      {
        type: 'service',
        entity: 'update.a',
        service: 'button.press',
        name: 'Install',
        icon: 'mdi:download',
      },
    ],
    { hass: hassWith('unavailable'), host: {} },
  );
  assert.ok(both);
  assert.equal(both.children.length, 2, 'both are drawn');
  const [toggle, service] = both.children;
  assert.ok(toggle && service);
  assert.equal(toggle.localName, 'div', 'a display, not a button');
  assert.ok(toggle.classList.contains('inert'));
  assert.ok(toggle.classList.contains('primary'), 'keeps its place in the lane');
  assert.ok(toggle.classList.contains('colored'));
  assert.equal(tipOf(toggle), 'Update: unavailable');
  assert.equal(tipOf(service), 'Install: unavailable');
  assert.ok(service.querySelector('ha-icon'), "a service keeps the control's own icon");
});

test('a chip goes orange for an unavailable entity, and a nav chip still navigates', () => {
  const nav: Controls = [
    { type: 'nav', entity: 'update.a', popup: '#x', color: 'blue', when: { not: ['off'] } },
  ];
  const node = chip(nav, 'unavailable');
  assert.equal(node.localName, 'button');
  assert.ok(node.classList.contains('colored'));
  assert.ok(!chip(nav, 'off').classList.contains('colored'));
});

test('a status chip lists its unavailable entities after its own rules', () => {
  const chip: Controls = [
    {
      type: 'status',
      name: 'Firmware',
      icon: 'mdi:chip',
      rules: [{ entities: ['update.a'], label: 'device', is: ['on'], color: 'amber' }],
    },
  ];
  assert.equal(tooltip(chip, 'unavailable'), 'Firmware\nMatter Server: unavailable');
  assert.equal(tooltip(chip, 'on'), 'Firmware\nMatter Server: on', 'a matching rule wins');
  assert.equal(tooltip(chip, 'off'), 'Firmware', 'and nothing to say leaves the name alone');
});

test('a silent status chip is drawn only while a rule holds or an entity is unavailable', () => {
  const battery: Controls = [
    {
      type: 'status',
      name: 'Batteries',
      icon: 'mdi:battery-alert',
      silent: true,
      rules: [
        { entities: ['update.a'], below: 5, color: 'red' },
        { entities: ['update.a'], below: 20, color: 'orange' },
      ],
    },
  ];
  const drawnWith = (state: string): Element | undefined =>
    lane(battery, { hass: hassWith(state), host: {} })?.children[0];
  assert.equal(drawnWith('80'), undefined, 'fine: nothing is drawn');
  assert.ok(drawnWith('14')?.classList.contains('colored'));
  assert.equal(tipOf(drawnWith('14')), 'Batteries\nUpdate: 14');
  assert.ok(drawnWith('unavailable')?.classList.contains('colored'), 'an offline one is a problem');
});

function pressedOf(entity: EntityId, state: string, when?: StateRule): string | null {
  const hass = {
    states: { [entity]: { entity_id: entity, state, attributes: {} } },
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
  };
  const toggle: Controls = [{ type: 'toggle', entity, color: 'orange', ...(when ? { when } : {}) }];
  const node = lane(toggle, { hass, host: {} })?.children[0];
  assert.ok(node, `${entity} ${state}`);
  assert.equal(node.localName, 'button', `${entity} ${state}`);
  return node.getAttribute('aria-pressed');
}

test("a toggle tells assistive technology it is pressed while its entity is on, whatever its colour's rule", () => {
  const off: StateRule = { is: ['off'] };
  assert.equal(pressedOf('switch.protection', 'on', off), 'true');
  assert.equal(pressedOf('switch.protection', 'off', off), 'false');
  assert.equal(pressedOf('switch.protection', 'on'), 'true');
  assert.equal(pressedOf('update.a', 'idle', { not: ['off'] }), 'true');
  assert.equal(pressedOf('climate.hall', 'heat'), 'true');
  assert.equal(pressedOf('climate.hall', 'off'), 'false');
});

test('a toggle of a lock, an alarm or a cover is pressed while it is not at rest, as in Home Assistant', () => {
  const unlocked: StateRule = { is: ['unlocked', 'open', 'jammed'] };
  assert.equal(pressedOf('lock.door', 'unlocked', unlocked), 'true');
  assert.equal(pressedOf('lock.door', 'locked', unlocked), 'false');
  assert.equal(pressedOf('alarm_control_panel.home', 'armed_away'), 'true');
  assert.equal(pressedOf('alarm_control_panel.home', 'disarmed'), 'false');
  assert.equal(pressedOf('cover.blind', 'open'), 'true');
  assert.equal(pressedOf('cover.blind', 'closed'), 'false');
});

test('a status chip names its entities by their own name by default', () => {
  const chip: Controls = [
    {
      type: 'status',
      name: 'Updates',
      icon: 'mdi:package-up',
      rules: [{ entities: ['update.a'], is: ['on'], color: 'amber' }],
    },
  ];
  assert.equal(tooltip(chip, 'on'), 'Updates\nUpdate: on');
});

test('a status rule with label: device names its entities after their device', () => {
  const chip: Controls = [
    {
      type: 'status',
      name: 'Updates',
      icon: 'mdi:package-up',
      rules: [{ entities: ['update.a'], label: 'device', is: ['on'], color: 'amber' }],
    },
  ];
  assert.equal(tooltip(chip, 'on'), 'Updates\nMatter Server: on');
});

test("a status rule with words renders a raw state through them, as a list row's words do", () => {
  const chip: Controls = [
    {
      type: 'status',
      name: 'Alarm',
      icon: 'mdi:shield-car',
      rules: [
        {
          entities: ['update.a'],
          words: { doorsonly: 'Doors only' },
          not: ['unarmed'],
          color: 'amber',
        },
      ],
    },
  ];
  assert.equal(tooltip(chip, 'doorsOnly'), 'Alarm\nUpdate: Doors only');
});

test('a key that comes within its days while nothing else changes turns red on time, on a page left open', async () => {
  vi.useFakeTimers({ now: Date.parse('2026-10-01T00:00:00Z') });
  try {
    const hass = {
      states: {
        'sensor.key': {
          entity_id: 'sensor.key',
          state: '2026-10-15T05:30:00Z',
          attributes: {},
        },
      },
      entities: {},
      devices: {},
      locale: { language: 'en' },
      formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    };
    const expiring: Controls = [
      {
        type: 'status',
        name: 'Key',
        icon: 'mdi:key',
        silent: true,
        rules: [{ entities: ['sensor.key'], within_days: 14, color: 'red' }],
      },
    ];
    const teardowns = new Set<() => void>();
    const seen: { lane: Element | null } = { lane: null };
    const paint = (): void => {
      seen.lane = lane(expiring, { hass, host });
    };
    const shown = (): Element | null => seen.lane;
    const host = {
      hass,
      isConnected: true,
      hold: () => () => {},
      register: (teardown: () => void) => {
        teardowns.add(teardown);
        return () => {
          teardowns.delete(teardown);
        };
      },
      notify: () => {},
      refresh: paint,
    };
    paint();
    assert.equal(shown(), null, 'not drawn while the key is further off');
    assert.equal(teardowns.size, 1, 'one wake-up, registered with the card');
    paint();
    assert.equal(teardowns.size, 1, 'however often the card draws');
    await vi.advanceTimersByTimeAsync(5 * 3_600_000);
    assert.equal(shown(), null, 'still further off five hours on');
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    assert.ok(shown()?.querySelector('.control.colored'), 'red once it is within 14 days');
    assert.equal(teardowns.size, 0, 'and nothing is left to wake');
  } finally {
    vi.useRealTimers();
  }
});

interface Call {
  domain: string;
  service: string;
  data: unknown;
  target: unknown;
}

test("a toggle and a service control call their service on their entity, through the host's hass", () => {
  const drawnWith: Call[] = [];
  const now: Call[] = [];
  const states = {
    'light.a': { entity_id: 'light.a', state: 'on', attributes: {} },
    'lock.door': { entity_id: 'lock.door', state: 'locked', attributes: {} },
    'button.restart': { entity_id: 'button.restart', state: 'unknown', attributes: {} },
  };
  const hass = (calls: Call[]): unknown => ({
    states,
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    callService: (domain: string, service: string, data: unknown, target: unknown) => {
      calls.push({ domain, service, data, target });
      return Promise.resolve();
    },
  });
  const pressedLane = lane(
    [
      { type: 'toggle', entity: 'light.a' },
      { type: 'toggle', entity: 'lock.door' },
      {
        type: 'service',
        entity: 'button.restart',
        service: 'button.press',
        name: 'Restart',
        icon: 'mdi:restart',
      },
    ],
    { hass: hass(drawnWith), host: { hass: hass(now), notify: () => {} } },
  );
  assert.ok(pressedLane);
  for (const button of pressedLane.children) {
    assert.ok(button instanceof HTMLButtonElement);
    button.click();
  }
  assert.deepEqual(drawnWith, [], 'not the hass the lane was drawn with');
  assert.deepEqual(now, [
    {
      domain: 'homeassistant',
      service: 'toggle',
      data: undefined,
      target: { entity_id: 'light.a' },
    },
    { domain: 'lock', service: 'unlock', data: undefined, target: { entity_id: 'lock.door' } },
    {
      domain: 'button',
      service: 'press',
      data: undefined,
      target: { entity_id: 'button.restart' },
    },
  ]);
});
