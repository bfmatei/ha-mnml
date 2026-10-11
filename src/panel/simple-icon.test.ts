import assert from 'node:assert/strict';

import { html, render } from 'lit';
import type { TemplateResult } from 'lit';
import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';
import { define, drawn } from '../test/render.ts';

import { drawLook, simpleOf } from './simple.ts';
import type { SimpleActions, SimpleRow } from './simple.ts';

function drawLooks(rows: readonly SimpleRow[], actions: SimpleActions): TemplateResult {
  return html`${rows.flatMap((row) =>
    row.looks.map((look) => drawLook(look, row.label, actions, undefined)),
  )}`;
}

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
    drawLooks(simpleOf(TILE, TILE), {
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

test('an icon picker cleared shows its value again when drawn again', () => {
  const box = document.createElement('div');
  const draw = (): void => {
    render(
      drawLooks(simpleOf(TILE, TILE), { toggle: () => undefined, look: () => undefined }),
      box,
    );
  };
  draw();
  const picker = box.querySelector('ha-icon-picker[data-path="card/icon"]');
  assert.ok(picker instanceof FakePicker);
  picker.value = '';
  draw();
  assert.equal(picker.value, 'mdi:flower');
});
