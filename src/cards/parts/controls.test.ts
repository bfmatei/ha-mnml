import assert from 'node:assert/strict';

import { test } from 'vitest';

import { drawn } from '../../test/render.ts';

import { renderControls } from './controls.ts';

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
  return Reflect.get(chip(controls, state), 'title');
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
  assert.equal(Reflect.get(toggle, 'title'), 'Update: unavailable');
  assert.equal(Reflect.get(service, 'title'), 'Install: unavailable');
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

test('a toggle tells assistive technology whether it is pressed', () => {
  const toggle: Controls = [{ type: 'toggle', entity: 'update.a', when: { not: ['off'] } }];
  assert.equal(chip(toggle, 'idle').getAttribute('aria-pressed'), 'true');
  assert.equal(chip(toggle, 'off').getAttribute('aria-pressed'), 'false');
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
