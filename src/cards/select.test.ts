import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define } from '../test/render.ts';

import { MnmlSelectCard } from './select.ts';

define('mnml-select-card', MnmlSelectCard);

function card(): MnmlSelectCard {
  const made = document.createElement('mnml-select-card');
  assert.ok(made instanceof MnmlSelectCard);
  return made;
}

test('a mode attribute the select card does not know is an error card that lists them', () => {
  const made = card();
  const select = { type: 'custom:mnml-select-card', entity: 'climate.a' };
  assert.throws(() => {
    made.setConfig({ ...select, attribute: 'hvac_mode' } as never);
  }, /attribute must be one of hvac_modes, preset_modes/);
  assert.doesNotThrow(() => {
    made.setConfig({ ...select, attribute: 'preset_modes' } as never);
  });
});

test("a select over an entity takes none of the scenes form's keys", () => {
  const made = card();
  assert.throws(() => {
    made.setConfig({
      type: 'custom:mnml-select-card',
      entity: 'select.a',
      active_scene: 'select.b',
    } as never);
  }, /unknown key: active_scene/);
});
