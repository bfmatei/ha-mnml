import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DEMO } from '../../demo/home.ts';
import { drawn } from '../home/view.ts';
import { define, mounted, text } from '../test/render.ts';

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

interface Call {
  service: string;
}

function reading(
  id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): [string, unknown] {
  return [id, { entity_id: id, state, attributes }];
}

function hassWith(failed: string, batteries: string[], calls: Call[] = []): unknown {
  const [a = '80', b = '80', c = '80'] = batteries;
  return {
    states: Object.fromEntries([
      reading('weather.home', 'sunny', { temperature: 21 }),
      reading('input_boolean.away', 'off'),
      reading('sensor.failed', failed),
      reading('sensor.a_battery', a),
      reading('sensor.b_battery', b),
      reading('sensor.c_battery', c),
    ]),
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    formatEntityAttributeValue: (_stateObj: unknown, _name: string, value: unknown): string =>
      String(value),
    callService: (domain: string, service: string): Promise<unknown> => {
      calls.push({ service: `${domain}.${service}` });
      return Promise.resolve();
    },
  };
}

async function paint(failed: string, batteries: string[], calls: Call[] = []) {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  made.setConfig(CONFIG as never);
  made.hass = hassWith(failed, batteries, calls) as never;
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
  const calls: Call[] = [];
  const root = await paint('0', [], calls);
  const glances = [...root.querySelectorAll<HTMLElement>('.glance')];
  assert.deepEqual(
    glances.map((glance) => glance.getAttribute('role')),
    [null, 'button'],
  );
  glances[1]?.click();
  assert.deepEqual(calls, [{ service: 'homeassistant.toggle' }]);
});

test('a card with nothing to show draws nothing, and one with no items is an error card', async () => {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  assert.throws(() => {
    made.setConfig({ type: 'custom:mnml-glances-card' } as never);
  });
  assert.throws(() => {
    made.setConfig({
      type: 'custom:mnml-glances-card',
      items: [{ entities: ['sensor.a'] }],
    } as never);
  });
});

function alarmHass(alarm: string, home: boolean, calls: Call[] = []): unknown {
  return {
    states: Object.fromEntries([
      reading('alarm_control_panel.home', alarm),
      reading('person.jane', home ? 'home' : 'not_home'),
    ]),
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    callService: (domain: string, service: string): Promise<unknown> => {
      calls.push({ service: `${domain}.${service}` });
      return Promise.resolve();
    },
  };
}

async function alarm(state: string, home: boolean, calls: Call[] = []) {
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  made.setConfig({
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
  } as never);
  made.hass = alarmHass(state, home, calls) as never;
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
  const calls: Call[] = [];
  (await alarm('disarmed', true, calls))?.dispatchEvent(new MouseEvent('click'));
  (await alarm('armed_away', true, calls))?.dispatchEvent(new MouseEvent('click'));
  assert.deepEqual(calls, [
    { service: 'alarm_control_panel.alarm_arm_away' },
    { service: 'alarm_control_panel.alarm_disarm' },
  ]);
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
    made.setConfig(config as never);
    made.hass = {
      states: Object.fromEntries([
        reading('sensor.failed', failed),
        reading('sensor.warned', warned),
      ]),
      entities: {},
      devices: {},
      locale: { language: 'en' },
      formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    } as never;
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
  made.setConfig({
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
  } as never);
  made.hass = hassWith('0', ['14', '3', '80']) as never;
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
  made.setConfig({
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
  } as never);
  made.hass = {
    ...(hassWith('0', []) as object),
    states: Object.fromEntries([
      reading('sensor.sedan_doors', 'UNLOCKED'),
      reading('sensor.suv_doors', 'SELECTIVE-LOCKED'),
      reading('sensor.van_doors', 'SECURED'),
      reading('sensor.router_state', 'Connected'),
      reading('sensor.switch_state', 'heartbeat_missed'),
      reading('sensor.ap_state', 'unavailable'),
    ]),
  } as never;
  const root = await mounted(made);
  assert.deepEqual(
    [...root.querySelectorAll('.glance')].map((glance) => text(glance.querySelector('.state'))),
    ['2', '1'],
  );
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
  'Unlocked',
  'Car security',
]);

async function demoGlances(states: Record<string, string>): Promise<Element[]> {
  const glances = glancesOf(drawn(DEMO));
  const items = glances?.['items'];
  assert.ok(Array.isArray(items));
  const made = document.createElement('mnml-glances-card');
  assert.ok(made instanceof MnmlGlancesCard);
  made.setConfig({
    type: 'custom:mnml-glances-card',
    items: items.filter(
      (item: unknown) =>
        typeof item === 'object' && item !== null && NEEDS_YOU.has(Reflect.get(item, 'name')),
    ),
  } as never);
  made.hass = {
    ...(hassWith('0', []) as object),
    states: Object.fromEntries(Object.entries(states).map(([id, state]) => reading(id, state))),
  } as never;
  const root = await mounted(made);
  return [...root.querySelectorAll('.group.problems .glance')];
}

test("the demo home's Glances show a stopped guest, a device down or offline, the media server's health, a lock and each car left open, each opening its pop-up", async () => {
  const { proxmox, network, tailscale, media } = DEMO.system;
  const room = DEMO.rooms.find((one) => one.lock !== undefined);
  const [sedan, suv] = DEMO.cars;
  assert.ok(proxmox && network && tailscale && media?.movies?.health && room?.lock);
  assert.ok(sedan && suv);
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
    [room.lock]: 'locked',
    [sedan.lock]: 'SECURED',
    [sedan.alarm]: 'doorsOnly',
    [suv.lock]: 'LOCKED',
    [suv.alarm]: 'doorsTiltCabin',
  };
  assert.deepEqual(await demoGlances({ ...calm, [personal.connected]: 'off' }), []);
  const wells = await demoGlances({
    ...calm,
    [guest.status]: 'off',
    [switched]: 'heartbeat_missed',
    [exit.connected]: 'off',
    [media.movies.health]: 'on',
    [room.lock]: 'unlocked',
    [sedan.alarm]: 'unarmed',
    [suv.lock]: 'SELECTIVE-LOCKED',
  });
  assert.deepEqual(
    wells.map((well) => [tipOf(well)?.split('\n')[0], text(well.querySelector('.state'))]),
    [
      ['Stopped guests', '1'],
      ['Network devices down', '1'],
      ['Tailscale offline', '1'],
      ['Media health', '1'],
      ['Unlocked', '1'],
      ['Car security', '1'],
      ['Car security', '1'],
    ],
  );
  assert.ok(wells.every((well) => well.getAttribute('role') === 'button'));
});
