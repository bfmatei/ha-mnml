import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import { MnmlWeatherCard } from './weather.ts';

define('mnml-weather-card', MnmlWeatherCard);

const CONFIG = { type: 'custom:mnml-weather-card', entity: 'weather.home' };

type Listener = (message: { forecast: unknown[] | null }) => void;

interface Asked {
  message: Record<string, unknown>;
  push: Listener;
  stopped: boolean;
}

function hassWith(asked: Asked[], features = 3, attributes: Record<string, unknown> = {}): unknown {
  return {
    states: {
      'weather.home': {
        entity_id: 'weather.home',
        state: 'partlycloudy',
        attributes: {
          temperature: 21,
          humidity: 54,
          supported_features: features,
          ...attributes,
        },
      },
    },
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (): string => 'Partly cloudy',
    formatEntityAttributeValue: (_stateObj: unknown, name: string, value: unknown): string =>
      name === 'humidity' ? `${String(value)} %` : `${String(value)} °C`,
    connection: {
      subscribeMessage: (push: Listener, message: Record<string, unknown>) => {
        const entry: Asked = { message, push, stopped: false };
        asked.push(entry);
        return Promise.resolve(() => {
          entry.stopped = true;
          return Promise.resolve();
        });
      },
    },
  };
}

const day = (offset: number, high: number, low: number) => ({
  datetime: new Date(Date.now() + offset * 86400000).toISOString(),
  condition: 'rainy',
  temperature: high,
  templow: low,
  precipitation_probability: 60,
});

async function paint(asked: Asked[], hass: unknown = hassWith(asked)) {
  const made = document.createElement('mnml-weather-card');
  assert.ok(made instanceof MnmlWeatherCard);
  made.setConfig(CONFIG as never);
  made.hass = hass as never;
  const root = await mounted(made);
  return { made, root };
}

test('the conditions now are drawn from the entity, and only those it has', async () => {
  const { root } = await paint([]);
  assert.equal(text(root.querySelector('.temperature')), '21 °C');
  assert.equal(text(root.querySelector('.condition')), 'Partly cloudy');
  assert.deepEqual(
    [...root.querySelectorAll('.fact')].map((node) => text(node.querySelector('.label'))),
    ['Humidity'],
  );
});

test('the daily forecast is followed, and its days are drawn with their range', async () => {
  const asked: Asked[] = [];
  const { made, root } = await paint(asked);
  assert.deepEqual(asked[0]?.message, {
    type: 'weather/subscribe_forecast',
    forecast_type: 'daily',
    entity_id: 'weather.home',
  });
  asked[0]?.push({ forecast: [day(0, 24, 14), day(1, 22, 12)] });
  await made.updateComplete;
  const steps = [...root.querySelectorAll('.step')];
  assert.equal(steps.length, 2);
  assert.equal(text(steps[0]?.querySelector('.when')), 'Today');
  assert.equal(text(steps[0]?.querySelector('.high')), '24 °C');
  assert.equal(text(steps[0]?.querySelector('.low')), '14 °C');
  assert.equal(text(steps[0]?.querySelector('.rain')), '60%');
});

test('a weather entity with only an hourly forecast follows that, and one with none follows nothing', async () => {
  const hourly: Asked[] = [];
  await paint(hourly, hassWith(hourly, 2));
  assert.equal(hourly[0]?.message['forecast_type'], 'hourly');
  const none: Asked[] = [];
  const { root } = await paint(none, hassWith(none, 0));
  assert.equal(none.length, 0);
  assert.equal(root.querySelectorAll('.step').length, 0);
});

test('the subscription is let go when the card leaves the page, and taken again when it returns', async () => {
  const asked: Asked[] = [];
  const { made } = await paint(asked);
  made.remove();
  await Promise.resolve();
  assert.equal(asked[0]?.stopped, true);
  document.body.append(made);
  await made.updateComplete;
  assert.equal(asked.length, 2);
});

test('a forecast kind that changes lets the old subscription go before it takes the new one', async () => {
  const asked: Asked[] = [];
  const { made, root } = await paint(asked, hassWith(asked, 1));
  made.hass = hassWith(asked, 2) as never;
  await made.updateComplete;
  await Promise.resolve();
  assert.deepEqual(
    asked.map((entry) => [entry.message['forecast_type'], entry.stopped]),
    [
      ['daily', true],
      ['hourly', false],
    ],
  );
  asked[1]?.push({ forecast: [day(0, 20, 10)] });
  asked[0]?.push({ forecast: [day(0, 30, 20), day(1, 30, 20)] });
  await made.updateComplete;
  assert.equal(root.querySelectorAll('.step').length, 1, 'a late daily message changes nothing');
});

test('the full card follows a twice-daily forecast when the entity has no daily one', async () => {
  const asked: Asked[] = [];
  const { made, root } = await paint(asked, hassWith(asked, 6));
  assert.equal(asked[0]?.message['forecast_type'], 'twice_daily');
  asked[0]?.push({ forecast: [day(0, 24, 14), day(0.5, 15, 10)] });
  await made.updateComplete;
  assert.equal(root.querySelectorAll('.step').length, 2);
});
