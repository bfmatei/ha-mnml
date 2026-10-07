import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isPlan } from '../contract/builder.ts';
import type { Template } from '../contract/templates.ts';
import { discover } from '../templates/discover.ts';
import type { Registries } from '../templates/discover.ts';
import { readTemplates } from '../templates/shipped.ts';

import { HOME } from './fixture.ts';
import { defaultPlan } from './plan.ts';

const TEMPLATES = readTemplates();

test('the default plan has the rooms with something to show, in the order Home Assistant lists them', () => {
  assert.deepEqual(defaultPlan(HOME, TEMPLATES).rooms, [{ area: 'kitchen' }, { area: 'living' }]);
});

test('the default plan has every person, and pop-ups that unfold on tablet and desktop', () => {
  const plan = defaultPlan(HOME, TEMPLATES);
  assert.deepEqual(plan.people, [{ entity: 'person.jane' }, { entity: 'person.bob' }]);
  assert.deepEqual(plan.open, { tablet: 'unfold', desktop: 'unfold' });
  assert.equal(plan.title, 'Home');
  assert.equal(plan.icon, 'mdi:home-variant');
  assert.deepEqual(plan.cars, []);
  assert.equal(isPlan(plan), true);
});

test('the default plan has each system template whose required slots discovery fills', () => {
  assert.deepEqual(defaultPlan(HOME, TEMPLATES).system, []);
  const adguard: Template = {
    slots: {
      protection: {
        kind: 'entity',
        required: true,
        discover: { domain: 'light', platform: 'hue', scope: 'all' },
      },
    },
    card: { type: 'custom:mnml-tile-card', entity: '[[protection]]' },
  };
  assert.deepEqual(defaultPlan(HOME, { ...TEMPLATES, adguard }).system, [{ template: 'adguard' }]);
});

function withEntities(
  registries: Registries,
  entities: readonly (readonly [string, string, string | undefined])[],
): Registries {
  return {
    ...registries,
    entities: {
      ...registries.entities,
      ...Object.fromEntries(
        entities.map(([entity_id, platform, translation_key]) => [
          entity_id,
          { entity_id, platform, translation_key },
        ]),
      ),
    },
  };
}

const MONITOR = [
  ['sensor.system_monitor_processor_use', 'systemmonitor', 'processor_use'],
  ['sensor.system_monitor_memory_usage', 'systemmonitor', 'memory_use_percent'],
  ['sensor.system_monitor_disk_free', 'systemmonitor', 'disk_free'],
  ['sensor.system_monitor_disk_use', 'systemmonitor', 'disk_use'],
] as const;
const SUPERVISOR = [
  ['sensor.home_assistant_host_disk_free', 'hassio', 'disk_free'],
  ['sensor.home_assistant_host_disk_used', 'hassio', 'disk_used'],
  ['update.home_assistant_core_update', 'hassio', undefined],
] as const;
const ADGUARD = [
  ['switch.adguard_home_protection', 'adguard', 'protection'],
  ['switch.adguard_home_filtering', 'adguard', 'filtering'],
  ['sensor.adguard_home_dns_queries', 'adguard', 'dns_queries'],
  ['sensor.adguard_home_dns_queries_blocked', 'adguard', 'dns_queries_blocked'],
  ['sensor.adguard_home_dns_queries_blocked_ratio', 'adguard', 'dns_queries_blocked_ratio'],
  ['sensor.adguard_home_average_processing_speed', 'adguard', 'average_processing_speed'],
  ['sensor.adguard_home_rules_count', 'adguard', 'rules_count'],
  ['update.adguard_home', 'adguard', undefined],
] as const;

test('a home with System Monitor and AdGuard Home gets their system cards, found in the whole home', () => {
  const home = withEntities(HOME, [...MONITOR, ...SUPERVISOR, ...ADGUARD]);
  assert.deepEqual(defaultPlan(home, TEMPLATES).system, [
    { template: 'home-assistant' },
    { template: 'adguard' },
  ]);
  const system = TEMPLATES['home-assistant'];
  const adguard = TEMPLATES['adguard'];
  assert.ok(system && adguard);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(discover(system, undefined, home)).filter(
        ([slot]) => !slot.endsWith('firmware'),
      ),
    ),
    {
      cpu: 'sensor.system_monitor_processor_use',
      memory: 'sensor.system_monitor_memory_usage',
      disk_free: 'sensor.home_assistant_host_disk_free',
      disk_used: 'sensor.home_assistant_host_disk_used',
      updates: ['update.home_assistant_core_update'],
    },
  );
  assert.deepEqual(discover(adguard, undefined, home), {
    protection: 'switch.adguard_home_protection',
    queries: 'sensor.adguard_home_dns_queries',
    blocked: 'sensor.adguard_home_dns_queries_blocked',
    ratio: 'sensor.adguard_home_dns_queries_blocked_ratio',
    speed: 'sensor.adguard_home_average_processing_speed',
    rules: 'sensor.adguard_home_rules_count',
    update: 'update.adguard_home',
  });
});

test("without the Supervisor, Home Assistant's disk comes from System Monitor", () => {
  const system = TEMPLATES['home-assistant'];
  assert.ok(system);
  const found = discover(system, undefined, withEntities(HOME, MONITOR));
  assert.equal(found['disk_free'], 'sensor.system_monitor_disk_free');
  assert.equal(found['disk_used'], 'sensor.system_monitor_disk_use');
});
