import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';

import { sliderSpec } from './slider-spec.ts';

interface Call {
  service: string;
  data: unknown;
}

function recorder(): { hass: HomeAssistant; calls: Call[] } {
  const calls: Call[] = [];
  const hass = {
    states: {},
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: HassEntity): string => stateObj.state,
    formatEntityAttributeValue: (_stateObj: HassEntity, _name: string, value: unknown): string =>
      String(value),
    callService: (domain: string, service: string, data: unknown): Promise<unknown> => {
      calls.push({ service: `${domain}.${service}`, data });
      return Promise.resolve();
    },
  } as unknown as HomeAssistant;
  return { hass, calls };
}

function entity(state: string, attributes: Record<string, unknown>): HassEntity {
  return { entity_id: 'light.a', state, attributes, last_changed: '', last_updated: '' };
}

test('brightness runs 0 to 100 from the 0 to 255 attribute, and 0 turns the light off', async () => {
  const { hass, calls } = recorder();
  const spec = sliderSpec(hass, 'light.a', entity('on', { brightness: 128 }), 'brightness');
  assert.ok(spec);
  assert.equal(spec.value, 50);
  assert.equal(sliderSpec(hass, 'light.a', entity('off', {}), 'brightness')?.value, 0);
  await spec.commit(0);
  await spec.commit(40);
  assert.deepEqual(calls, [
    { service: 'light.turn_off', data: undefined },
    { service: 'light.turn_on', data: { brightness_pct: 40 } },
  ]);
});

test('colour temperature reads the lamp range and dims while it has no reading', () => {
  const { hass } = recorder();
  const lamp = entity('on', { min_color_temp_kelvin: 2200, max_color_temp_kelvin: 4000 });
  const spec = sliderSpec(hass, 'light.a', lamp, 'color_temp');
  assert.ok(spec);
  assert.deepEqual([spec.min, spec.max, spec.value, spec.dimmed], [2200, 4000, 2200, true]);
});

test('a target temperature turns the climate on first only when asked to', async () => {
  const { hass, calls } = recorder();
  const off = entity('off', { min_temp: 16, max_temp: 30, target_temp_step: 1, temperature: 21 });
  const plain = sliderSpec(hass, 'climate.a', off, 'temperature');
  const waking = sliderSpec(hass, 'climate.a', off, 'temperature', { turn_on: true });
  assert.ok(plain && waking);
  assert.deepEqual([plain.min, plain.max, plain.step, plain.value], [16, 30, 1, 21]);
  await plain.commit(22);
  await waking.commit(23);
  assert.deepEqual(
    calls.map((call) => call.service),
    ['climate.set_temperature', 'climate.turn_on', 'climate.set_temperature'],
  );
});

test('a cover slider reads its position, or its state when it has none, and sets it', async () => {
  const { hass, calls } = recorder();
  const blinds = sliderSpec(hass, 'cover.a', entity('open', { current_position: 35 }), 'position');
  const garage = sliderSpec(hass, 'cover.b', entity('open', {}), 'position');
  assert.ok(blinds && garage);
  assert.deepEqual([blinds.value, garage.value], [35, 100]);
  assert.equal(sliderSpec(hass, 'cover.b', entity('closed', {}), 'position')?.value, 0);
  await blinds.commit(80);
  assert.deepEqual(calls, [{ service: 'cover.set_cover_position', data: { position: 80 } }]);
});

test('a fan slider is at 0 while the fan is off, and sets its percentage', async () => {
  const { hass, calls } = recorder();
  const on = sliderSpec(
    hass,
    'fan.a',
    entity('on', { percentage: 40, percentage_step: 20 }),
    'percentage',
  );
  assert.ok(on);
  assert.deepEqual([on.value, on.step], [40, 20]);
  assert.equal(
    sliderSpec(hass, 'fan.a', entity('off', { percentage: 40 }), 'percentage')?.value,
    0,
  );
  await on.commit(60);
  assert.deepEqual(calls, [{ service: 'fan.set_percentage', data: { percentage: 60 } }]);
});

test('a humidifier slider runs over its humidity range and sets the target', async () => {
  const { hass, calls } = recorder();
  const spec = sliderSpec(
    hass,
    'humidifier.a',
    entity('on', { min_humidity: 30, max_humidity: 70, humidity: 50 }),
    'humidity',
  );
  assert.ok(spec);
  assert.deepEqual([spec.min, spec.max, spec.value], [30, 70, 50]);
  await spec.commit(55);
  assert.deepEqual(calls, [{ service: 'humidifier.set_humidity', data: { humidity: 55 } }]);
});
