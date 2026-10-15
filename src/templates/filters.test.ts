import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Filter, Rule } from '../contract/templates.ts';
import type { EntityEntry, Registries } from '../ha/registries.ts';

import { homes } from './corpus.ts';
import { TEXT_FILTERS, describe, filterWords, matches, whyNot } from './filters.ts';
import { SHIPPED } from './shipped.ts';

const R: Registries = {
  areas: { den: { area_id: 'den', name: 'Den' } },
  devices: {
    plug: {
      id: 'plug',
      area_id: 'den',
      name: 'Plug',
      manufacturer: 'Shelly',
      model: 'Plus Plug S',
      labels: ['kitchen'],
    },
    cloud: { id: 'cloud', area_id: 'den', name: 'Forecast', entry_type: 'service' },
  },
  entities: {
    'sensor.plug_power': {
      entity_id: 'sensor.plug_power',
      device_id: 'plug',
      platform: 'shelly',
      translation_key: 'power',
    },
    'sensor.plug_rssi': {
      entity_id: 'sensor.plug_rssi',
      device_id: 'plug',
      platform: 'shelly',
      translation_key: 'rssi',
      entity_category: 'diagnostic',
    },
    'sensor.plug_daily': {
      entity_id: 'sensor.plug_daily',
      device_id: 'plug',
      platform: 'utility_meter',
      hidden: true,
    },
    'sensor.forecast': { entity_id: 'sensor.forecast', device_id: 'cloud', platform: 'met' },
    'light.lamp': { entity_id: 'light.lamp', area_id: 'den', platform: 'hue' },
  },
  states: {
    'sensor.plug_power': {
      attributes: {
        device_class: 'power',
        unit_of_measurement: 'W',
        state_class: 'measurement',
        friendly_name: 'Plug power',
        modes: ['eco', 'boost'],
      },
    },
    'sensor.plug_rssi': {
      attributes: {
        device_class: 'signal_strength',
        unit_of_measurement: 'dBm',
        state_class: 'measurement',
        friendly_name: 'Plug signal',
        modes: ['boost'],
      },
    },
    'sensor.forecast': { attributes: { friendly_name: 'Forecast' } },
  },
};

interface Sample {
  filter: Filter;
  holds: string;
  misses: string;
  why: readonly string[];
}

const SAMPLES: Record<keyof Filter, Sample> = {
  domain: {
    filter: { domain: 'sensor' },
    holds: 'sensor.plug_power',
    misses: 'light.lamp',
    why: ['is in the domain light, not sensor'],
  },
  device_class: {
    filter: { device_class: 'power' },
    holds: 'sensor.plug_power',
    misses: 'sensor.plug_rssi',
    why: ['has device class signal_strength, not power'],
  },
  platform: {
    filter: { platform: 'shelly' },
    holds: 'sensor.plug_power',
    misses: 'light.lamp',
    why: ['is from the integration hue, not shelly'],
  },
  translation_key: {
    filter: { translation_key: 'power' },
    holds: 'sensor.plug_power',
    misses: 'sensor.plug_rssi',
    why: ['has translation key rssi, not power'],
  },
  entity_category: {
    filter: { entity_category: 'none' },
    holds: 'sensor.plug_power',
    misses: 'sensor.plug_rssi',
    why: ['is in the category diagnostic, not primary'],
  },
  unit: {
    filter: { unit: 'W' },
    holds: 'sensor.plug_power',
    misses: 'sensor.plug_rssi',
    why: ['has unit dBm, not W'],
  },
  state_class: {
    filter: { state_class: 'measurement' },
    holds: 'sensor.plug_power',
    misses: 'sensor.forecast',
    why: ['has no state class'],
  },
  attribute: {
    filter: { attribute: { modes: 'eco' } },
    holds: 'sensor.plug_power',
    misses: 'sensor.plug_rssi',
    why: ['has modes boost, without eco'],
  },
  name: {
    filter: { name: 'power plug' },
    holds: 'sensor.plug_power',
    misses: 'sensor.plug_rssi',
    why: ['is named "Plug signal"'],
  },
  manufacturer: {
    filter: { manufacturer: 'shelly' },
    holds: 'sensor.plug_power',
    misses: 'sensor.forecast',
    why: ['is made by nobody known, not shelly'],
  },
  model: {
    filter: { model: 'plug' },
    holds: 'sensor.plug_power',
    misses: 'sensor.forecast',
    why: ['is of model unknown, not plug'],
  },
  entry_type: {
    filter: { entry_type: 'service' },
    holds: 'sensor.forecast',
    misses: 'sensor.plug_power',
    why: ['is on a device of type none, not service'],
  },
  integration: {
    filter: { integration: 'utility_meter' },
    holds: 'sensor.plug_power',
    misses: 'sensor.forecast',
    why: ['is not on a device of the integration utility_meter'],
  },
  label: {
    filter: { label: 'kitchen' },
    holds: 'sensor.plug_power',
    misses: 'sensor.forecast',
    why: ['lacks the label kitchen'],
  },
  exclude: {
    filter: { exclude: { entity_category: 'diagnostic' } },
    holds: 'sensor.plug_power',
    misses: 'sensor.plug_rssi',
    why: ['is excluded: it is in the category diagnostic'],
  },
};

function entry(id: string, registries: Registries = R): EntityEntry {
  const found = registries.entities[id];
  assert.ok(found, id);
  return found;
}

test('every filter key has a reason, given exactly when the key does not hold', () => {
  for (const [key, sample] of Object.entries(SAMPLES)) {
    assert.deepEqual(Object.keys(sample.filter), [key]);
    assert.equal(matches(entry(sample.holds), sample.filter, R), true, `${key} holds`);
    assert.deepEqual(whyNot(entry(sample.holds), sample.filter, R), [], `${key} has no reason`);
    assert.equal(matches(entry(sample.misses), sample.filter, R), false, `${key} misses`);
    assert.deepEqual(whyNot(entry(sample.misses), sample.filter, R), sample.why, key);
  }
});

test('the reasons are those of every key that does not hold, in the order the rule is spoken', () => {
  const filter: Filter = { domain: 'sensor', platform: 'met', device_class: 'power', unit: 'W' };
  assert.deepEqual(whyNot(entry('sensor.plug_rssi'), filter, R), [
    'has device class signal_strength, not power',
    'is from the integration shelly, not met',
    'has unit dBm, not W',
  ]);
  assert.equal(
    describe(filter),
    'sensor with device class power, from the integration met, with unit W',
  );
  assert.deepEqual(
    whyNot(entry('sensor.plug_rssi'), { attribute: { modes: 'eco', colour: 'red' } }, R),
    ['has modes boost, without eco', 'has no attribute colour'],
  );
});

function filtersIn(rule: Rule | undefined): Filter[] {
  if (rule === undefined || typeof rule === 'string') {
    return [];
  }
  if (Array.isArray(rule)) {
    return rule.flatMap(filtersIn);
  }
  if ('per' in rule) {
    return [
      ...(rule.where === undefined ? [] : [rule.where]),
      ...Object.values(rule.fields).flatMap(filtersIn),
    ];
  }
  if ('fields' in rule) {
    return [
      ...(rule.device === undefined ? [] : [rule.device].flat()),
      ...Object.values(rule.fields).flatMap(filtersIn),
    ];
  }
  return [rule];
}

test('matching and the reasons agree on every entity of the corpus, for every filter a shipped template uses', () => {
  const filters = [
    ...new Map(
      Object.values(SHIPPED)
        .flatMap((template) => Object.values(template.slots ?? {}))
        .flatMap((spec) => filtersIn(spec.discover))
        .map((filter) => [JSON.stringify(filter), filter] as const),
    ).values(),
  ];
  assert.ok(filters.length > 100, 'the shipped templates use plenty of filters');
  let checked = 0;
  for (const [home, registries] of Object.entries(homes())) {
    if (home === 'demo') {
      continue;
    }
    for (const each of Object.values(registries.entities)) {
      for (const filter of filters) {
        assert.equal(
          whyNot(each, filter, registries).length === 0,
          matches(each, filter, registries),
          `${home} ${each.entity_id} ${describe(filter)}`,
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 10_000);
});

test("the rule's sentence and the panel's words come from one vocabulary", () => {
  assert.equal(
    describe({ domain: 'binary_sensor', device_class: 'window' }),
    `binary_sensor ${filterWords('device_class')} window`,
  );
  assert.equal(
    describe({ domain: 'sensor', translation_key: 'status', entity_category: 'none' }),
    `sensor ${filterWords('translation_key')} status, ${filterWords('entity_category')} primary`,
  );
  assert.equal(
    describe({ domain: 'climate', exclude: { attribute: { hvac_modes: 'cool' } } }),
    'climate but not with attribute hvac_modes cool',
  );
  assert.equal(describe({ label: 'main' }), 'any entity labelled main');
  assert.deepEqual(
    TEXT_FILTERS.map((key) => filterWords(key)),
    [
      'with device class',
      'from the integration',
      'with translation key',
      'in the category',
      'with unit',
      'with state class',
      'named like',
      'made by',
      'of model',
      'on a device of type',
      'on a device of the integration',
      'labelled',
    ],
  );
});
