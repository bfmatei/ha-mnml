import assert from 'node:assert/strict';

import { test } from 'vitest';

import './register.ts';
import { STUBS } from './stubs.ts';

const hass = (ids: string[]): unknown => ({
  states: Object.fromEntries(ids.map((id) => [id, { entity_id: id, state: 'on', attributes: {} }])),
});

test("each card's stub picks a fitting entity of the home", () => {
  const home = hass([
    'sensor.power',
    'light.desk',
    'media_player.tv',
    'select.mode',
    'button.bell',
    'calendar.tv',
    'script.clear',
  ]);
  assert.equal(STUBS['mnml-slider-card']?.(home as never)['entity'], 'light.desk');
  assert.equal(STUBS['mnml-slider-card']?.(home as never)['slider'], 'brightness');
  assert.equal(STUBS['mnml-media-card']?.(home as never)['entity'], 'media_player.tv');
  assert.equal(STUBS['mnml-button-card']?.(home as never)['entity'], 'button.bell');
  assert.deepEqual(STUBS['mnml-select-card']?.(home as never), { entity: 'select.mode' });
});

test('every card takes its stub, in a home with fitting entities and in an empty one', () => {
  for (const home of [
    hass(['sensor.power', 'light.desk', 'media_player.tv', 'climate.hall']),
    hass([]),
  ]) {
    for (const [tag, stub] of Object.entries(STUBS)) {
      const Card = customElements.get(tag) as unknown as new () => {
        setConfig(config: unknown): void;
      };
      assert.ok(Card, tag);
      new Card().setConfig({ type: `custom:${tag}`, ...stub(home as never) });
    }
  }
});
