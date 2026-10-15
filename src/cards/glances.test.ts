import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DEMO } from '../../demo/home.ts';
import { drawn } from '../home/view.ts';
import { fakeHass } from '../test/hass.ts';
import type { FakeState, ServiceCall } from '../test/hass.ts';
import { configure, created, define, mounted, text } from '../test/render.ts';
import { until } from '../test/until.ts';
import { notified, wire } from '../test/wire.ts';

import { MnmlGlancesCard } from './glances.ts';
import { tipOf } from './parts/tooltip.ts';

define('mnml-glances-card', MnmlGlancesCard);

const CONFIG = {
  type: 'custom:mnml-glances-card',
  items: [
    { entity: 'weather.home', state: [{}, { attribute: 'temperature' }] },
    { entity: 'input_boolean.away', name: 'Vacation', color: 'amber', toggle: true, quiet: true },
    {
      entity: 'sensor.failed',
      name: 'Failed checks',
      color: 'red',
      when: { not: ['0'] },
      show: { not: ['0'] },
    },
    {
      entities: ['sensor.a_battery', 'sensor.b_battery', 'sensor.c_battery'],
      name: 'Low batteries',
      below: 20,
      critical: 5,
    },
  ],
};

function reading(
  id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): [string, FakeState] {
  return [id, { state, attributes }];
}

function services(calls: readonly ServiceCall[]): string[] {
  return calls.map(({ domain, service }) => `${domain}.${service}`);
}

function hassWith(failed: string, batteries: string[], calls?: ServiceCall[]) {
  const [a = '80', b = '80', c = '80'] = batteries;
  return fakeHass({
    states: Object.fromEntries([
      reading('weather.home', 'sunny', { temperature: 21 }),
      reading('input_boolean.away', 'off'),
      reading('sensor.failed', failed),
      reading('sensor.a_battery', a),
      reading('sensor.b_battery', b),
      reading('sensor.c_battery', c),
    ]),
    calls,
  });
}

async function paint(failed: string, batteries: string[], calls?: ServiceCall[]) {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  configure(made, CONFIG);
  made.hass = hassWith(failed, batteries, calls);
  return mounted(made);
}

test('the glances are pills on the page: the card paints no surface or edge of its own', async () => {
  const root = await paint('2', ['3']);
  const card = root.querySelector('.glances.card');
  assert.ok(card);
  const style = getComputedStyle(card);
  assert.equal(style.background, 'rgba(0, 0, 0, 0)', 'no surface');
  assert.equal(style.boxShadow, 'none', 'no shadow');
  assert.equal(style.overflow, 'visible', 'so the pills are not clipped');
});

test('what does not need you is not drawn: no failed checks, no low battery', async () => {
  const root = await paint('0', []);
  assert.deepEqual(
    [...root.querySelectorAll('.glance')].map((glance) => tipOf(glance)),
    ['weather.home', 'Vacation: off'],
  );
});

test('the calm statuses and what needs you are two groups, the second drawn only when there is one', async () => {
  const calm = await paint('0', []);
  assert.equal(calm.querySelectorAll('.group.calm .glance').length, 2);
  assert.equal(calm.querySelector('.group.problems'), null);
  const busy = await paint('2', ['14', '80', '80']);
  assert.equal(busy.querySelectorAll('.group.calm .glance').length, 2);
  assert.equal(busy.querySelectorAll('.group.problems .glance').length, 2);
});

test('a quiet glance draws no value and a dim icon while off, and its value once on', async () => {
  const off = await paint('0', []);
  const away = off.querySelectorAll('.glance')[1];
  assert.ok(away?.classList.contains('quiet'));
  assert.equal(away?.querySelector('.state'), null);
});

test('a count lists what it counts in its tooltip, and only a critical one fades in', async () => {
  const root = await paint('0', ['14', '80', '3']);
  const glance = root.querySelector('.group.problems .glance');
  assert.ok(glance?.classList.contains('critical'));
  assert.match(tipOf(glance) ?? '', /^Low batteries\n.*14.*\n.*3/);
  const calm = await paint('0', ['14', '80', '80']);
  assert.ok(!calm.querySelector('.group.problems .glance')?.classList.contains('critical'));
});

test('a glance draws no name beside its icon, its name being its tooltip', async () => {
  const root = await paint('2', ['14', '80', '3']);
  assert.equal(root.querySelector('.glance .name'), null);
});

test('a sensor that is not 0 is a glance, and a battery below the limit is counted', async () => {
  const root = await paint('2', ['14', '80', '3']);
  const glances = [...root.querySelectorAll('.glance')];
  assert.equal(glances.length, 4);
  assert.equal(text(glances[2]?.querySelector('.state')), '2');
  assert.equal(text(glances[3]?.querySelector('.state')), '2');
  assert.ok(glances[3]?.getAttribute('style')?.includes('red'));
});

test('a count turns orange while none is critical, and an unavailable battery is not counted', async () => {
  const root = await paint('0', ['14', 'unavailable', '80']);
  const glance = root.querySelectorAll('.glance')[2];
  assert.equal(text(glance?.querySelector('.state')), '1');
  assert.ok(!glance?.getAttribute('style')?.includes('red'));
});

test('only a toggle glance is a button, and it toggles its entity', async () => {
  const calls: ServiceCall[] = [];
  const root = await paint('0', [], calls);
  const glances = [...root.querySelectorAll<HTMLElement>('.glance')];
  assert.deepEqual(
    glances.map((glance) => glance.getAttribute('role')),
    [null, 'button'],
  );
  glances[1]?.click();
  assert.deepEqual(services(calls), ['homeassistant.toggle']);
});

test('a timer glance with show is: active is drawn only while the timer runs, and prints the time it has left', async () => {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  configure(made, {
    type: 'custom:mnml-glances-card',
    items: [{ entity: 'timer.tea', show: { is: ['active'] }, state: [{ remaining: true }] }],
  });
  const finishes = new Date(Date.now() + 65_500).toISOString();
  const hass = (state: string) =>
    fakeHass({
      states: {
        'timer.tea': { state, attributes: { remaining: '0:03:00', finishes_at: finishes } },
      },
    });
  made.hass = hass('idle');
  const root = await mounted(made);
  assert.equal(root.querySelector('.glance'), null, 'nothing while it is idle');
  made.hass = hass('active');
  await made.updateComplete;
  assert.equal(text(root.querySelector('.glance .state')), '1:06');
  made.remove();
});

test("a toggle glance fires Home Assistant's light haptic as it toggles", async () => {
  const felt: unknown[] = [];
  const listener = (event: Event): void => {
    felt.push(event instanceof CustomEvent ? event.detail : undefined);
  };
  window.addEventListener('haptic', listener);
  const root = await paint('0', []);
  root.querySelectorAll<HTMLElement>('.glance')[1]?.click();
  window.removeEventListener('haptic', listener);
  assert.deepEqual(felt, ['light']);
});

test('a card with nothing to show draws nothing, and one with no items is an error card', async () => {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  assert.throws(() => {
    configure(made, { type: 'custom:mnml-glances-card' });
  });
  assert.throws(() => {
    configure(made, {
      type: 'custom:mnml-glances-card',
      items: [{ entities: ['sensor.a'] }],
    });
  });
});

function alarmHass(alarm: string, home: boolean, calls?: ServiceCall[]) {
  return fakeHass({
    states: Object.fromEntries([
      reading('alarm_control_panel.home', alarm),
      reading('person.jane', home ? 'home' : 'not_home'),
    ]),
    calls,
  });
}

async function alarm(state: string, home: boolean, calls?: ServiceCall[]) {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  configure(made, {
    type: 'custom:mnml-glances-card',
    items: [
      {
        entity: 'alarm_control_panel.home',
        name: 'Alarm',
        bare: true,
        toggle: true,
        when: { not: ['disarmed'] },
        alert: { is: ['triggered'] },
        people: ['person.jane'],
      },
    ],
  });
  made.hass = alarmHass(state, home, calls);
  return (await mounted(made)).querySelector('.glance');
}

test('an alarm is red when it is on with somebody home or off with everybody away, and normal otherwise', async () => {
  assert.ok((await alarm('armed_away', true))?.classList.contains('colored'));
  assert.ok((await alarm('disarmed', false))?.classList.contains('colored'));
  assert.ok(!(await alarm('disarmed', true))?.classList.contains('colored'));
  assert.ok(!(await alarm('armed_away', false))?.classList.contains('colored'));
});

test('a triggered alarm is red whoever is home, and a bare glance draws its icon alone', async () => {
  const triggered = await alarm('triggered', false);
  assert.ok(triggered?.classList.contains('colored'));
  assert.equal(triggered?.querySelector('.state'), null);
  assert.match(tipOf(triggered) ?? '', /^Alarm: triggered$/);
  assert.match(tipOf(await alarm('armed_away', true)) ?? '', /with somebody home/);
});

test('tapping the alarm arms it while it is disarmed and disarms it otherwise', async () => {
  const calls: ServiceCall[] = [];
  (await alarm('disarmed', true, calls))?.dispatchEvent(new MouseEvent('click'));
  (await alarm('armed_away', true, calls))?.dispatchEvent(new MouseEvent('click'));
  assert.deepEqual(services(calls), [
    'alarm_control_panel.alarm_arm_away',
    'alarm_control_panel.alarm_disarm',
  ]);
});

test('a toggle glance whose confirm rule holds arms on the first tap, says what it will do, and toggles on the second', async () => {
  const calls: ServiceCall[] = [];
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  configure(made, {
    type: 'custom:mnml-glances-card',
    items: [
      {
        entity: 'input_boolean.away',
        name: 'Vacation',
        icon: 'mdi:palm-tree',
        toggle: true,
        confirm: {},
        quiet: true,
      },
    ],
  });
  made.hass = hassWith('0', [], calls);
  const root = await mounted(made);
  const glance = (): HTMLElement => {
    const found = root.querySelector<HTMLElement>('.glance');
    assert.ok(found);
    return found;
  };
  glance().click();
  await made.updateComplete;
  assert.deepEqual(calls, [], 'the first tap does not toggle');
  assert.equal(text(glance()), 'Turn on? Tap again');
  assert.equal(glance().getAttribute('aria-label'), 'Turn on Vacation? Tap again');
  assert.ok(glance().classList.contains('armed'));
  glance().click();
  await made.updateComplete;
  assert.deepEqual(services(calls), ['homeassistant.toggle']);
  assert.equal(text(glance()), '', 'and it is quiet again');
});

test('a glance that does not toggle takes no confirm', () => {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  assert.throws(() => {
    configure(made, {
      type: 'custom:mnml-glances-card',
      items: [{ entity: 'weather.home', popup: '#weather', confirm: {} }],
    });
  }, /^Error: items\[0\]\.confirm needs toggle: true$/);
});

test('a summed item adds its sensors together, drawn while the total is above 0 and red while the first is at the limit', async () => {
  const config = {
    type: 'custom:mnml-glances-card',
    items: [
      {
        entities: ['sensor.failed', 'sensor.warned'],
        name: 'Checks',
        color: 'orange',
        sum: true,
        critical: 1,
      },
    ],
  };
  const paint = async (failed: string, warned: string) => {
    const made = document.createElement('mnml-glances-card');
    assert.ok(made instanceof MnmlGlancesCard);
    configure(made, config);
    made.hass = fakeHass({
      states: Object.fromEntries([
        reading('sensor.failed', failed),
        reading('sensor.warned', warned),
      ]),
    });
    return mounted(made);
  };
  const quiet = await paint('0', '0');
  assert.equal(quiet.querySelectorAll('.glance').length, 0);
  const warnings = await paint('0', '2');
  assert.equal(text(warnings.querySelector('.glance .state')), '2');
  assert.equal(warnings.querySelector('.glance.critical'), null);
  const both = await paint('1', '2');
  assert.equal(text(both.querySelector('.glance .state')), '3');
  assert.ok(both.querySelector('.glance.critical'));
});

test('a glance that acts is a button named with what its tooltip says, its value included', async () => {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  configure(made, {
    type: 'custom:mnml-glances-card',
    items: [
      { entity: 'weather.home', popup: '#weather' },
      { entity: 'input_boolean.away', name: 'Vacation', toggle: true },
      {
        entities: ['sensor.a_battery', 'sensor.b_battery'],
        name: 'Low batteries',
        below: 20,
        popup: '#batteries',
      },
      { entity: 'sensor.c_battery' },
    ],
  });
  made.hass = hassWith('0', ['14', '3', '80']);
  const root = await mounted(made);
  assert.deepEqual(
    [...root.querySelectorAll('.glance')].map((glance) => [
      glance.getAttribute('role'),
      glance.getAttribute('aria-label'),
    ]),
    [
      ['button', 'weather.home: sunny'],
      ['button', 'Vacation: off'],
      [null, null],
      ['button', 'Low batteries. sensor.a_battery: 14. sensor.b_battery: 3'],
    ],
  );
});

test("a count's is and not match a state as a rule does, lower-cased and without hyphens, and skip an unavailable one", async () => {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  configure(made, {
    type: 'custom:mnml-glances-card',
    items: [
      {
        entities: ['sensor.sedan_doors', 'sensor.suv_doors', 'sensor.van_doors'],
        name: 'Unlocked',
        color: 'red',
        is: ['unlocked', 'selectivelocked'],
      },
      {
        entities: ['sensor.router_state', 'sensor.switch_state', 'sensor.ap_state'],
        name: 'Network devices down',
        color: 'red',
        not: ['connected', 'upgrading'],
      },
    ],
  });
  made.hass = fakeHass({
    states: Object.fromEntries([
      reading('sensor.sedan_doors', 'UNLOCKED'),
      reading('sensor.suv_doors', 'SELECTIVE-LOCKED'),
      reading('sensor.van_doors', 'SECURED'),
      reading('sensor.router_state', 'Connected'),
      reading('sensor.switch_state', 'heartbeat_missed'),
      reading('sensor.ap_state', 'unavailable'),
    ]),
  });
  const root = await mounted(made);
  assert.deepEqual(
    [...root.querySelectorAll('.glance')].map((glance) => text(glance.querySelector('.state'))),
    ['2', '1'],
  );
});

async function paintWith(config: unknown, states: [string, FakeState][]): Promise<ShadowRoot> {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  configure(made, config);
  made.hass = fakeHass({
    states: Object.fromEntries(states),
    formatEntityState: (stateObj, state = stateObj.state) => {
      const unit = stateObj.attributes['unit_of_measurement'];
      return typeof unit === 'string' ? `${state} ${unit}` : state;
    },
  });
  return mounted(made);
}

test("a glance's rules and state line may read an attribute, so notifications are drawn, coloured and counted by their alerts", async () => {
  const config = {
    type: 'custom:mnml-glances-card',
    items: [
      {
        entity: 'sensor.notifications',
        name: 'Notifications',
        color: 'amber',
        when: { attribute: 'alerts', not: ['0'] },
        show: { attribute: 'alerts', not: ['0'] },
        state: [{ attribute: 'alerts' }],
      },
    ],
  };
  const quiet = await paintWith(config, [reading('sensor.notifications', '2', { alerts: 0 })]);
  assert.equal(quiet.querySelector('.glance'), null, 'two notices, no alert');
  const loud = await paintWith(config, [reading('sensor.notifications', '3', { alerts: 2 })]);
  const glance = loud.querySelector('.group.problems .glance');
  assert.ok(glance?.classList.contains('colored'));
  assert.ok(glance?.getAttribute('style')?.includes('amber'));
  assert.equal(text(glance?.querySelector('.state')), '2');
});

test("a count's show decides whether it is drawn, reading the first counted entity unless it names another", async () => {
  const config = {
    type: 'custom:mnml-glances-card',
    items: [
      {
        entities: ['climate.bedroom'],
        name: 'Heating while away',
        icon: 'mdi:thermometer-alert',
        not: ['off'],
        show: { entity: 'input_boolean.away', is: ['on'] },
      },
      { entities: ['climate.bedroom'], name: 'Heating', not: ['off'], show: { is: ['heat'] } },
    ],
  };
  const names = async (heating: string, away: string): Promise<(string | undefined)[]> => {
    const root = await paintWith(config, [
      reading('climate.bedroom', heating),
      reading('input_boolean.away', away),
    ]);
    return [...root.querySelectorAll('.glance')].map((glance) => tipOf(glance)?.split('\n')[0]);
  };
  assert.deepEqual(await names('heat', 'off'), ['Heating']);
  assert.deepEqual(await names('heat', 'on'), ['Heating while away', 'Heating']);
  assert.deepEqual(await names('auto', 'on'), ['Heating while away']);
  assert.deepEqual(await names('off', 'on'), []);
});

test("a total is a calm glance: the sum of its entities in the first one's unit, uncoloured, each listed in its tooltip", async () => {
  const config = {
    type: 'custom:mnml-glances-card',
    items: [
      {
        entities: [
          'sensor.plug_power',
          'sensor.fridge_power',
          'sensor.boiler_power',
          'sensor.car_power',
        ],
        name: 'Energy',
        icon: 'mdi:lightning-bolt',
        total: true,
        popup: '#energy',
      },
    ],
  };
  const watts = { unit_of_measurement: 'W' };
  const root = await paintWith(config, [
    reading('sensor.plug_power', '12.5', watts),
    reading('sensor.fridge_power', '80', watts),
    reading('sensor.boiler_power', 'unavailable', watts),
    reading('sensor.car_power', '7', { unit_of_measurement: 'kW' }),
  ]);
  const glance = root.querySelector('.group.calm .glance');
  assert.ok(glance);
  assert.equal(root.querySelector('.group.problems'), null);
  assert.ok(!glance.classList.contains('colored'));
  assert.equal(text(glance.querySelector('.state')), '92.5 W');
  assert.equal(tipOf(glance), 'Energy\nsensor.plug_power: 12.5 W\nsensor.fridge_power: 80 W');
  assert.equal(glance.getAttribute('role'), 'button');
  const none = await paintWith(config, [reading('sensor.plug_power', 'unavailable', watts)]);
  assert.equal(none.querySelector('.glance'), null, 'not drawn while none reads a number');
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  assert.throws(() => {
    configure(made, {
      type: 'custom:mnml-glances-card',
      items: [{ entities: ['sensor.plug_power'], name: 'Energy', total: true, below: 20 }],
    });
  }, /^Error: items\[0\]\.below does not go with total$/);
});

function glancesOf(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    return value.map(glancesOf).find((found) => found !== undefined);
  }
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const node = Object.fromEntries(Object.entries(value));
  return node['type'] === 'custom:mnml-glances-card' ? node : glancesOf(Object.values(node));
}

const NEEDS_YOU: ReadonlySet<unknown> = new Set([
  'Stopped guests',
  'Network devices down',
  'Tailscale offline',
  'Media health',
]);

async function demoGlances(states: Record<string, string>): Promise<Element[]> {
  const glances = glancesOf(drawn(DEMO));
  const items = glances?.['items'];
  assert.ok(Array.isArray(items));
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  configure(made, {
    type: 'custom:mnml-glances-card',
    items: items.filter(
      (item: unknown) =>
        typeof item === 'object' && item !== null && NEEDS_YOU.has(Reflect.get(item, 'name')),
    ),
  });
  made.hass = fakeHass({
    states: Object.fromEntries(Object.entries(states).map(([id, state]) => reading(id, state))),
  });
  const root = await mounted(made);
  return [...root.querySelectorAll('.group.problems .glance')];
}

test("Home Assistant's messages are a glance that needs you, counted while there are any and opening their pop-up", async () => {
  const line = wire();
  const made = created('mnml-glances-card', MnmlGlancesCard);
  configure(made, {
    type: 'custom:mnml-glances-card',
    items: [
      {
        messages: true,
        name: 'Messages',
        icon: 'mdi:home-assistant',
        color: 'amber',
        popup: '#system-messages',
      },
    ],
  });
  made.hass = { ...fakeHass(), connection: line.connection };
  const root = await mounted(made);
  line.push(notified(0));
  await made.updateComplete;
  assert.equal(made.style.display, 'none', 'none, so nothing is drawn');
  line.push(notified(2));
  await made.updateComplete;
  const [well, ...rest] = root.querySelectorAll('.group.problems .glance');
  assert.ok(well);
  assert.equal(rest.length, 0);
  assert.equal(text(well.querySelector('.state')), '2');
  assert.equal(tipOf(well), 'Messages');
  assert.equal(well.getAttribute('aria-label'), 'Messages: 2');
  assert.equal(well.getAttribute('role'), 'button');
  made.remove();
  await until(() => line.unsubscribed === 1, 'the end of the subscription');
});

test("the demo home's Glances show a stopped guest, a device down or offline and the media server's health, each opening its pop-up", async () => {
  const { proxmox, network, tailscale, media } = DEMO.system;
  assert.ok(proxmox && network && tailscale && media?.movies?.health);
  const [router, exit] = tailscale.devices.filter((device) => device.essential === true);
  const personal = tailscale.devices.find((device) => device.essential !== true);
  const [guest] = proxmox.guests;
  const [switched] = network.devices;
  assert.ok(router && exit && personal && guest && switched);
  const calm: Record<string, string> = {
    ...Object.fromEntries(proxmox.guests.map((one) => [one.status, 'on'])),
    ...Object.fromEntries(network.devices.map((device) => [device, 'connected'])),
    ...Object.fromEntries(tailscale.devices.map((device) => [device.connected, 'on'])),
    [media.movies.health]: 'off',
  };
  assert.deepEqual(await demoGlances({ ...calm, [personal.connected]: 'off' }), []);
  const wells = await demoGlances({
    ...calm,
    [guest.status]: 'off',
    [switched]: 'heartbeat_missed',
    [exit.connected]: 'off',
    [media.movies.health]: 'on',
  });
  assert.deepEqual(
    wells.map((well) => [tipOf(well)?.split('\n')[0], text(well.querySelector('.state'))]),
    [
      ['Stopped guests', '1'],
      ['Network devices down', '1'],
      ['Tailscale offline', '1'],
      ['Media health', '1'],
    ],
  );
  assert.ok(wells.every((well) => well.getAttribute('role') === 'button'));
});
