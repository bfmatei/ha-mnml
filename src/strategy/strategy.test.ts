import assert from 'node:assert/strict';

import { test } from 'vitest';

import { dashboardOf } from '../builder/dashboard.ts';
import { HOME } from '../builder/fixture.ts';
import { defaultPlan } from '../builder/plan.ts';
import { isMapping } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { readTemplates } from '../templates/shipped.ts';
import { fakeHass, fakeStore } from '../test/hass.ts';

import { MnmlStrategy } from './strategy.ts';

const TEMPLATES = readTemplates();

function home(
  answers: Readonly<Record<string, unknown>> = {},
  refuse?: unknown,
): { hass: HomeAssistant; asked: string[] } {
  const store = fakeStore();
  store.kept = {};
  store.refuse = refuse;
  const asked: string[] = [];
  store.answer = (message) => {
    const type = String(message['type']);
    asked.push(type);
    return Object.hasOwn(answers, type)
      ? Promise.resolve(answers[type])
      : Promise.reject({ code: 'not_found', message: 'No prefs' });
  };
  return { hass: fakeHass({ ...HOME, connection: store.hass.connection }), asked };
}

test('Home Assistant is offered a dashboard named Home, regenerated when a registry changes', () => {
  assert.deepEqual(MnmlStrategy.registryDependencies, ['areas', 'devices', 'entities']);
  assert.deepEqual(MnmlStrategy.getCreateSuggestions(), {
    title: 'Home',
    icon: 'mdi:home-variant',
  });
  assert.equal(MnmlStrategy.getConfigElement().localName, 'mnml-strategy-editor');
});

test('a strategy that chooses nothing makes the quick start dashboard, its templates loaded first', async () => {
  const { hass, asked } = home();
  assert.deepEqual(
    await MnmlStrategy.generate({ type: 'custom:mnml' }, hass),
    dashboardOf(defaultPlan(HOME, TEMPLATES), HOME, TEMPLATES),
  );
  assert.deepEqual(asked, ['energy/get_prefs']);
});

test("the energy settings reach the strategy's discovery", async () => {
  const { hass } = home({
    'energy/get_prefs': {
      energy_sources: [{ type: 'grid', stat_rate: 'sensor.jane_phone_battery_level' }],
      device_consumption: [],
    },
  });
  const dashboard = await MnmlStrategy.generate(
    { type: 'custom:mnml', system: [{ template: 'energy-popup', slots: {} }] },
    hass,
  );
  const card = dashboard.views
    .flatMap((view) => view.sections.flatMap((section) => section.cards))
    .find((each) => isMapping(each) && each['template'] === 'energy-popup');
  assert.ok(isMapping(card) && isMapping(card['slots']));
  assert.equal(card['slots']['grid'], 'sensor.jane_phone_battery_level');
});

test('a strategy whose templates cannot be read, or that names a wrong choice, fails with why', async () => {
  await assert.rejects(
    MnmlStrategy.generate(
      { type: 'custom:mnml' },
      home({}, { code: 'boom', message: 'Boom' }).hass,
    ),
    /the templates MNML keeps could not be read: Boom/,
  );
  await assert.rejects(
    MnmlStrategy.generate({ type: 'custom:mnml', rooms: 'kitchen' }, home().hass),
    /MNML strategy: rooms is not a dashboard choice/,
  );
});
