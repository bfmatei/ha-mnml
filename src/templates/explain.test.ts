import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Rule } from '../contract/templates.ts';

import { homes } from './corpus.ts';
import { discover } from './discover.ts';
import type { Registries } from './discover.ts';
import { explain } from './explain.ts';
import { SHIPPED } from './shipped.ts';

const room = SHIPPED['room'];

function traceOf(home: string, area: string, slot: string): ReturnType<typeof explain>[string] {
  const registries: Registries | undefined = homes()[home];
  assert.ok(registries && room);
  const trace = explain(room, area, registries)[slot];
  assert.ok(trace, `${slot} has a rule`);
  return trace;
}

test('every slot explains what discover() found: the same value, in every corpus home, area and template', () => {
  let slots = 0;
  for (const [home, registries] of Object.entries(homes())) {
    for (const template of Object.values(SHIPPED)) {
      for (const area of ['', ...Object.keys(registries.areas)]) {
        const given = area === '' ? undefined : area;
        const found = discover(template, given, registries);
        const traces = explain(template, given, registries);
        for (const [slot, trace] of Object.entries(traces)) {
          assert.deepEqual(trace.value, found[slot], `${home} ${area || '*'} ${slot}`);
          slots++;
        }
      }
    }
  }
  assert.ok(slots > 100, 'the corpus exercises plenty of slots');
});

test('a slot with two matches lists both, says which it took, and leaves the hidden one out', () => {
  const { steps, value } = traceOf('messy', 'den', 'window');
  assert.equal(value, 'binary_sensor.den_window_a');
  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.rule, 'binary_sensor, device class window');
  assert.deepEqual(steps[0]?.candidates, [
    'binary_sensor.den_window_a',
    'binary_sensor.den_window_b',
  ]);
  assert.deepEqual(steps[0]?.picked, ['binary_sensor.den_window_a']);
});

test('what almost matched is listed with the reason it did not', () => {
  const { steps } = traceOf('messy', 'den', 'window');
  const vent = steps[0]?.near.find((near) => near.entity_id === 'binary_sensor.den_vent');
  assert.ok(vent, 'the vent has no device class, so it is a near miss');
  assert.deepEqual(vent.why, ['has no device class']);
});

test('an empty slot says why: nothing of that kind here, or the thing is somewhere else', () => {
  const lock = traceOf('messy', 'den', 'lock');
  assert.equal(lock.value, undefined);
  assert.equal(lock.reason, 'no lock in Den');
  const battery = traceOf('messy', 'den', 'batteries');
  assert.equal(battery.value, undefined);
  assert.match(battery.reason ?? '', /sensor\.multi_battery/, 'it names where the battery is');
});

test('a slot filled from the first of several rules records the rules it tried', () => {
  const { steps, value } = traceOf('messy', 'den', 'temperature');
  assert.equal(value, 'sensor.multi_temperature');
  assert.deepEqual(
    steps.map((step) => step.rule),
    ['the area temperature sensor', 'sensor, device class temperature'],
  );
  assert.deepEqual(
    steps[1]?.candidates,
    ['sensor.multi_temperature', 'sensor.multi_probe_temperature'],
    'best first: the diagnostic probe comes last',
  );
  assert.deepEqual(steps[1]?.picked, ['sensor.multi_temperature']);
});

test('an object slot explains each field it fills', () => {
  const { steps } = traceOf('tidy', 'living', 'lights');
  const fields = steps.map((step) => step.field);
  assert.deepEqual(fields, ['group', 'members', 'members.entity', 'members.entity', 'scenes']);
});

const G: Registries = {
  areas: { den: { area_id: 'den', name: 'Den', icon: null } },
  devices: { lamp: { id: 'lamp', area_id: 'den', name: 'Lamp', manufacturer: 'Signify' } },
  entities: {
    'sensor.den_power': { entity_id: 'sensor.den_power', area_id: 'den' },
    'sensor.den_energy': { entity_id: 'sensor.den_energy', area_id: 'den' },
    'sensor.den_rssi': {
      entity_id: 'sensor.den_rssi',
      area_id: 'den',
      entity_category: 'diagnostic',
    },
    'light.lamp': { entity_id: 'light.lamp', device_id: 'lamp', labels: ['guest'] },
  },
  states: {
    'sensor.den_power': { attributes: { unit_of_measurement: 'W' } },
    'sensor.den_energy': { attributes: { unit_of_measurement: 'kWh' } },
    'sensor.den_rssi': { attributes: { unit_of_measurement: 'dBm' } },
  },
};

function tracesFor(rule: Rule, slot = 'x'): ReturnType<typeof explain>[string] {
  const trace = explain(
    { card: {}, slots: { [slot]: { kind: 'entity', discover: rule } } },
    'den',
    G,
  )[slot];
  assert.ok(trace);
  return trace;
}

test('the new filters read well in the rule and in the near misses', () => {
  const unit = tracesFor({ domain: 'sensor', unit: 'W' });
  assert.equal(unit.steps[0]?.rule, 'sensor, unit W');
  assert.deepEqual(
    unit.steps[0]?.near.map((near) => [near.entity_id, near.why]),
    [
      ['sensor.den_energy', ['has unit kWh, not W']],
      ['sensor.den_rssi', ['has unit dBm, not W']],
    ],
  );
  const category = tracesFor({ domain: 'sensor', unit: 'dBm', entity_category: 'none' });
  assert.equal(category.steps[0]?.rule, 'sensor, primary, unit dBm');
  assert.deepEqual(
    category.steps[0]?.near.find((near) => near.entity_id === 'sensor.den_rssi')?.why,
    ['is diagnostic, not primary'],
  );
  assert.equal(tracesFor({ label: 'main' }).steps[0]?.rule, 'labelled main');
  assert.equal(
    tracesFor({ domain: 'light', manufacturer: 'ikea' }).steps[0]?.near[0]?.why[0],
    'is made by Signify, not ikea',
  );
  assert.equal(
    tracesFor({ domain: 'sensor', exclude: { entity_category: 'diagnostic' } }).steps[0]?.rule,
    'sensor, but not diagnostic',
  );
});

test('a slot filled by its mnml_ label says so, and says the rules did not run', () => {
  const registries: Registries = {
    ...G,
    entities: {
      ...G.entities,
      'sensor.den_energy': {
        entity_id: 'sensor.den_energy',
        area_id: 'den',
        labels: ['mnml_power'],
      },
    },
  };
  const trace = explain(
    { card: {}, slots: { power: { kind: 'entity', discover: { domain: 'sensor', unit: 'W' } } } },
    'den',
    registries,
  )['power'];
  assert.equal(trace?.value, 'sensor.den_energy');
  assert.deepEqual(
    trace?.steps.map((step) => step.rule),
    ['labelled mnml_power'],
  );
});

test('two matches that rank alike are a tie, and the trace lists them; a clear winner is not', () => {
  const tied = traceOf('messy', 'den', 'window');
  assert.deepEqual(tied.steps[0]?.tied, [
    'binary_sensor.den_window_a',
    'binary_sensor.den_window_b',
  ]);
  const clear = traceOf('messy', 'den', 'temperature');
  assert.equal(clear.steps[1]?.tied, undefined, 'the diagnostic probe loses outright');
  assert.equal(
    traceOf('tidy', 'living', 'window').steps[0]?.tied,
    undefined,
    'one match is no tie',
  );
});

test('a labelled slot is never a tie, and an entities slot is never one either', () => {
  assert.equal(traceOf('labelled', 'den', 'window').steps[0]?.tied, undefined);
  assert.equal(traceOf('tidy', 'living', 'batteries').steps[0]?.tied, undefined);
});
