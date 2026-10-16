import assert from 'node:assert/strict';

import { render } from 'lit';
import { test, vi } from 'vitest';

import type { StateRule } from '../../contract/cards.ts';
import type { EntityId } from '../../contract/entities.ts';
import { fakeHass, fakeHost } from '../../test/hass.ts';
import type { ServiceCall } from '../../test/hass.ts';
import { drawn, text } from '../../test/render.ts';
import { until } from '../../test/until.ts';
import { notified, wire } from '../../test/wire.ts';
import type { Wire } from '../../test/wire.ts';
import type { Host } from '../base.ts';

import { chipsOf, renderControls } from './controls.ts';
import { tipOf } from './tooltip.ts';

type Controls = Parameters<typeof renderControls>[0];

function hassWith(state: string) {
  return fakeHass({
    states: { 'update.a': { state } },
    entities: { 'update.a': { entity_id: 'update.a', name: 'Update', device_id: 'd1' } },
    devices: { d1: { id: 'd1', name: 'Matter Server', name_by_user: null } },
  });
}

type Context = Parameters<typeof renderControls>[1];

function lane(controls: Controls, context: Context): Element | null {
  return drawn(renderControls(controls, context)).querySelector('.lane');
}

function chip(controls: Controls, state: string): Element {
  const drawnLane = lane(controls, { hass: hassWith(state), host: fakeHost() });
  assert.ok(drawnLane, 'the lane renders');
  const first = drawnLane.children[0];
  assert.ok(first, 'the chip renders');
  return first;
}

function tooltip(controls: Controls, state: string): unknown {
  return tipOf(chip(controls, state));
}

function pressButton(state: string): Element | undefined {
  const hass = fakeHass({ states: { 'button.a': { state } } });
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
    { hass, host: fakeHost() },
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
    { hass: hassWith('unavailable'), host: fakeHost() },
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
    lane(battery, { hass: hassWith(state), host: fakeHost() })?.children[0];
  assert.equal(drawnWith('80'), undefined, 'fine: nothing is drawn');
  assert.ok(drawnWith('14')?.classList.contains('colored'));
  assert.equal(tipOf(drawnWith('14')), 'Batteries\nUpdate: 14');
  assert.ok(drawnWith('unavailable')?.classList.contains('colored'), 'an offline one is a problem');
});

function pressedOf(entity: EntityId, state: string, when?: StateRule): string | null {
  const hass = fakeHass({ states: { [entity]: { state } } });
  const toggle: Controls = [{ type: 'toggle', entity, color: 'orange', ...(when ? { when } : {}) }];
  const node = lane(toggle, { hass, host: fakeHost() })?.children[0];
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
    const hass = fakeHass({ states: { 'sensor.key': { state: '2026-10-15T05:30:00Z' } } });
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
    const host = fakeHost({
      hass,
      register: (teardown) => {
        teardowns.add(teardown);
        return () => {
          teardowns.delete(teardown);
        };
      },
      refresh: paint,
    });
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

test("a toggle and a service control call their service on their entity, through the host's hass", () => {
  const drawnWith: ServiceCall[] = [];
  const now: ServiceCall[] = [];
  const states = {
    'light.a': { state: 'on' },
    'lock.door': { state: 'locked' },
    'button.restart': {},
  };
  const hass = (calls: ServiceCall[]) => fakeHass({ states, calls });
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
    { hass: hass(drawnWith), host: fakeHost({ hass: hass(now) }) },
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

function feel(): { felt: unknown[]; stop: () => void } {
  const felt: unknown[] = [];
  const listener = (event: Event): void => {
    felt.push(event instanceof CustomEvent ? event.detail : undefined);
  };
  window.addEventListener('haptic', listener);
  return {
    felt,
    stop: () => {
      window.removeEventListener('haptic', listener);
    },
  };
}

test("a toggle fires Home Assistant's light haptic as it acts, and a call that fails fires its failure haptic", async () => {
  const { felt, stop } = feel();
  try {
    const notified: string[] = [];
    const hass = fakeHass({
      states: { 'light.a': { state: 'on' } },
      callService: () => Promise.reject(new Error('The light is offline')),
    });
    const button = lane([{ type: 'toggle', entity: 'light.a' }], {
      hass,
      host: fakeHost({
        hass,
        notify: (message) => {
          notified.push(message);
        },
      }),
    })?.children[0];
    assert.ok(button instanceof HTMLButtonElement);
    button.click();
    assert.deepEqual(felt, ['light']);
    await until(() => felt.length === 2, 'the failure');
    assert.deepEqual(felt, ['light', 'failure']);
    assert.deepEqual(notified, ['The light is offline']);
  } finally {
    stop();
  }
});

interface Armed {
  calls: ServiceCall[];
  refreshes: number;
  press: () => HTMLButtonElement;
  host: Context['host'];
}

function armable(controls: Controls, states: Record<string, string>): Armed {
  const calls: ServiceCall[] = [];
  const teardowns = new Set<() => void>();
  const hass = fakeHass({
    states: Object.fromEntries(Object.entries(states).map(([id, state]) => [id, { state }])),
    entities: { 'lock.door': { entity_id: 'lock.door', name: 'Front door' } },
    calls,
  });
  const armed: Armed = {
    calls,
    refreshes: 0,
    host: {
      hass,
      isConnected: true,
      hold: () => () => {},
      register: (teardown) => {
        teardowns.add(teardown);
        return () => {
          teardowns.delete(teardown);
        };
      },
      notify: () => {},
      refresh: () => {
        armed.refreshes += 1;
      },
    },
    press: () => {
      const button = lane(controls, { hass, host: armed.host })?.children[0];
      assert.ok(button instanceof HTMLButtonElement);
      return button;
    },
  };
  return armed;
}

test('a toggle whose confirm rule holds arms on the first press, says what it will do, and acts on the second', () => {
  const controls: Controls = [{ type: 'toggle', entity: 'lock.door', confirm: { is: ['locked'] } }];
  const door = armable(controls, { 'lock.door': 'locked' });
  door.press().click();
  assert.deepEqual(door.calls, [], 'the first press does nothing to the lock');
  assert.equal(door.refreshes, 1, 'it draws the card again, armed');
  const armed = door.press();
  assert.equal(text(armed), 'Unlock? Tap again');
  assert.equal(armed.getAttribute('aria-label'), 'Unlock Front door? Tap again');
  assert.ok(armed.classList.contains('armed'));
  armed.click();
  assert.deepEqual(door.calls, [
    { domain: 'lock', service: 'unlock', data: undefined, target: { entity_id: 'lock.door' } },
  ]);
  const after = door.press();
  assert.equal(text(after), '', 'and it is no longer armed');
  assert.equal(after.getAttribute('aria-label'), 'Front door');
});

test('an armed control lets go after 3 s, and the next press arms it again', async () => {
  vi.useFakeTimers();
  try {
    const controls: Controls = [
      { type: 'toggle', entity: 'lock.door', confirm: { is: ['locked'] } },
    ];
    const door = armable(controls, { 'lock.door': 'locked' });
    door.press().click();
    await vi.advanceTimersByTimeAsync(2900);
    assert.equal(text(door.press()), 'Unlock? Tap again');
    await vi.advanceTimersByTimeAsync(200);
    assert.equal(door.refreshes, 2, 'drawn again when it lets go');
    const calm = door.press();
    assert.equal(text(calm), '');
    calm.click();
    assert.deepEqual(door.calls, [], 'a press after it let go arms it again');
    assert.equal(text(door.press()), 'Unlock? Tap again');
  } finally {
    vi.useRealTimers();
  }
});

test('a toggle whose confirm rule does not hold acts on one press, as one without confirm', () => {
  const controls: Controls = [{ type: 'toggle', entity: 'lock.door', confirm: { is: ['locked'] } }];
  const door = armable(controls, { 'lock.door': 'unlocked' });
  door.press().click();
  assert.deepEqual(door.calls, [
    { domain: 'lock', service: 'lock', data: undefined, target: { entity_id: 'lock.door' } },
  ]);
  assert.equal(door.refreshes, 0);
});

test('a service control with an empty confirm rule asks every time, by its own name', () => {
  const controls: Controls = [
    {
      type: 'service',
      entity: 'script.clear',
      service: 'script.turn_on',
      name: 'Clear all',
      icon: 'mdi:notification-clear-all',
      confirm: {},
    },
  ];
  const clear = armable(controls, { 'script.clear': 'off' });
  clear.press().click();
  assert.deepEqual(clear.calls, []);
  const armed = clear.press();
  assert.equal(text(armed), 'Clear all? Tap again');
  assert.equal(armed.getAttribute('aria-label'), 'Clear all? Tap again');
  armed.click();
  assert.equal(clear.calls.length, 1);
  clear.press().click();
  assert.equal(clear.calls.length, 1, 'and asks again the next time');
});

interface Messaging {
  line: Wire;
  calls: ServiceCall[];
  host: Host;
  draw: (controls: Controls) => Element | undefined;
  leave: () => void;
}

function messaging(): Messaging {
  const line = wire();
  const calls: ServiceCall[] = [];
  const teardowns: (() => void)[] = [];
  const hass = { ...fakeHass({ calls }), connection: line.connection };
  const host = fakeHost({
    hass,
    register: (teardown) => {
      teardowns.push(teardown);
      return () => undefined;
    },
  });
  return {
    line,
    calls,
    host,
    draw: (controls) => lane(controls, { hass, host })?.children[0],
    leave: () => {
      for (const teardown of teardowns.splice(0)) {
        teardown();
      }
    },
  };
}

test('the messages chip is drawn while Home Assistant has any, counts them in its tooltip, and opens their pop-up', () => {
  const home = messaging();
  const controls: Controls = [
    {
      type: 'messages',
      popup: '#system-messages',
      name: 'Messages',
      icon: 'mdi:bell-badge-outline',
      color: 'amber',
    },
  ];
  assert.equal(home.draw(controls), undefined, 'nothing until Home Assistant answers');
  home.line.push(notified(0));
  assert.equal(home.draw(controls), undefined, 'nor while there are none');
  home.line.push(notified(3));
  const button = home.draw(controls);
  assert.ok(button instanceof HTMLButtonElement);
  assert.equal(tipOf(button), 'Messages: 3');
  assert.ok(button.classList.contains('colored'));
  home.leave();
});

test('the dismiss control is drawn while there are notifications, asks first, then dismisses them all', () => {
  const home = messaging();
  const controls: Controls = [
    { type: 'dismiss', name: 'Clear all', icon: 'mdi:notification-clear-all' },
  ];
  assert.equal(home.draw(controls), undefined);
  home.line.push(notified(0));
  assert.equal(home.draw(controls), undefined, 'nothing to dismiss');
  home.line.push(notified(2));
  const first = home.draw(controls);
  assert.ok(first instanceof HTMLButtonElement);
  first.click();
  assert.deepEqual(home.calls, []);
  const armed = home.draw(controls);
  assert.ok(armed instanceof HTMLButtonElement);
  assert.equal(text(armed), 'Clear all? Tap again');
  armed.click();
  assert.deepEqual(home.calls, [
    { domain: 'persistent_notification', service: 'dismiss_all', data: {}, target: undefined },
  ]);
  home.leave();
});

function said(entity: EntityId, state: string): string {
  const controls: Controls = [{ type: 'toggle', entity, confirm: {} }];
  const one = armable(controls, { [entity]: state });
  one.press().click();
  return text(one.press());
}

test('a toggle says the action its press takes: on or off, open or close, arm or disarm', () => {
  assert.equal(said('light.a', 'on'), 'Turn off? Tap again');
  assert.equal(said('switch.a', 'off'), 'Turn on? Tap again');
  assert.equal(said('cover.a', 'closed'), 'Open? Tap again');
  assert.equal(said('cover.a', 'open'), 'Close? Tap again');
  assert.equal(said('alarm_control_panel.a', 'armed_away'), 'Disarm? Tap again');
  assert.equal(said('alarm_control_panel.a', 'disarmed'), 'Arm? Tap again');
  assert.equal(said('lock.door', 'unlocked'), 'Lock? Tap again');
});

test('each chip says its kind, its title and its colour, and gives an inert cell beside the control it draws', () => {
  const hass = fakeHass({
    states: {
      'lock.front': { state: 'unlocked', attributes: { friendly_name: 'Front door' } },
      'binary_sensor.window': { state: 'on', attributes: { friendly_name: 'Window' } },
    },
  });
  const chips = chipsOf(
    [
      { type: 'toggle', entity: 'lock.front', color: 'red', when: { is: ['unlocked'] } },
      { type: 'indicator', entity: 'binary_sensor.window', color: 'orange' },
      { type: 'nav', entity: 'binary_sensor.window', popup: '#window' },
    ],
    { hass, host: fakeHost() },
  );
  assert.deepEqual(
    chips.map(({ control, title, color }) => [control.type, title, color]),
    [
      ['toggle', 'Front door', 'red'],
      ['indicator', 'Window: on', 'orange'],
      ['nav', 'Window', undefined],
    ],
  );
  const root = document.createElement('div');
  render(
    chips.map((chip) => chip.cell),
    root,
  );
  assert.equal(root.querySelector('button'), null, 'no cell is a button');
  assert.deepEqual(
    [...root.querySelectorAll('[role="img"]')].map((cell) => cell.getAttribute('aria-label')),
    ['Front door', 'Window: on', 'Window'],
  );
  const [lock] = chips;
  assert.ok(lock);
  assert.equal(drawn(lock.drawn).querySelector('button')?.getAttribute('aria-pressed'), 'true');
});
