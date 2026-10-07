import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';
import { define, drawn } from '../test/render.ts';

import { drawSimple, simpleOf } from './simple.ts';

class FakePicker extends HTMLElement {
  value = '';
}

define('ha-icon-picker', FakePicker);

const TILE: Template = {
  card: { type: 'custom:mnml-tile-card', name: 'Garden', icon: 'mdi:flower', chips: [] },
};

test("an icon is chosen with Home Assistant's icon picker where the page has it", () => {
  const chosen: string[] = [];
  const box = drawn(
    drawSimple(simpleOf(TILE, TILE), {
      toggle: () => undefined,
      look: (_look, value) => {
        chosen.push(value);
      },
    }),
  );
  const picker = box.querySelector('ha-icon-picker[data-path="card/icon"]');
  assert.ok(picker instanceof FakePicker);
  assert.equal(picker.value, 'mdi:flower');
  picker.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'mdi:sprout' } }));
  assert.deepEqual(chosen, ['mdi:sprout']);
});
