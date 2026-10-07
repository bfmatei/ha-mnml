import assert from 'node:assert/strict';

import { test } from 'vitest';

import { discover } from '../templates/discover.ts';
import { readTemplates } from '../templates/shipped.ts';

import { carFrom, personFrom, roomFrom, systemFrom } from './customized.ts';
import { HOME } from './fixture.ts';
import { personOf } from './person.ts';

const TEMPLATES = readTemplates();
const CARD = 'custom:mnml-template-card';

test('a room keeps what its editor overrides, and its area, or the one picked', () => {
  assert.deepEqual(
    roomFrom({ area: 'kitchen' }, { type: CARD, template: 'room', area: 'kitchen' }),
    {
      area: 'kitchen',
    },
  );
  assert.deepEqual(
    roomFrom(
      { area: 'kitchen' },
      { type: CARD, template: 'room', area: 'living', slots: { name: 'Lounge' } },
    ),
    { area: 'living', slots: { name: 'Lounge' } },
  );
  assert.deepEqual(
    roomFrom({ area: 'kitchen' }, { type: CARD, template: 'room', slots: { name: 'Cook' } }),
    { area: 'kitchen', slots: { name: 'Cook' } },
  );
});

test('a person keeps only what differs from what MNML finds of them, so their devices follow the home', () => {
  const found = personOf(HOME, 'person.jane');
  assert.deepEqual(
    personFrom({ entity: 'person.jane' }, { type: CARD, template: 'person', slots: found }, HOME),
    { entity: 'person.jane' },
  );
  assert.deepEqual(
    personFrom(
      { entity: 'person.jane' },
      { type: CARD, template: 'person', slots: { ...found, batteries: [] } },
      HOME,
    ),
    { entity: 'person.jane', slots: { batteries: [] } },
  );
});

test('a system card found in the whole home keeps only its overrides', () => {
  const template = TEMPLATES['home-assistant'];
  assert.ok(template);
  const found = discover(template, undefined, HOME);
  assert.deepEqual(
    systemFrom(
      { template: 'home-assistant' },
      { type: CARD, template: 'home-assistant' },
      HOME,
      TEMPLATES,
    ),
    { template: 'home-assistant' },
  );
  assert.deepEqual(
    systemFrom(
      { template: 'home-assistant' },
      { type: CARD, template: 'home-assistant', slots: { ...found, cpu: 'sensor.cpu' } },
      HOME,
      TEMPLATES,
    ),
    { template: 'home-assistant', slots: { cpu: 'sensor.cpu' } },
  );
});

test('a car is its key and the rest of its slots, and one without a key that names it is no car', () => {
  assert.deepEqual(
    carFrom({ type: CARD, template: 'car', slots: { key: 'sedan', metadata: 'sensor.sedan' } }),
    { key: 'sedan', slots: { metadata: 'sensor.sedan' } },
  );
  assert.equal(
    carFrom({ type: CARD, template: 'car', slots: { metadata: 'sensor.sedan' } }),
    undefined,
  );
  assert.equal(carFrom({ type: CARD, template: 'car', slots: { key: 'My car' } }), undefined);
});
