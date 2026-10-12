import assert from 'node:assert/strict';

import { render } from 'lit';
import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';
import { homes } from '../templates/corpus.ts';
import { drawn } from '../test/render.ts';

import { drawSlots } from './slots-tab.ts';
import type { SlotsActions } from './slots-tab.ts';

const actions = (edit: (next: Template) => void, shipped?: Template): SlotsActions => ({
  hass: undefined,
  open: new Map(),
  areas: [],
  shipped,
  update: edit,
  redraw: () => {},
});

function change(root: HTMLElement, label: string, value: string): void {
  const input = root.querySelector(`input[aria-label="${label}"]`);
  assert.ok(input instanceof HTMLInputElement, label);
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

test('two fields of a slot changed one after the other both stay, without a redraw between them', () => {
  let template: Template = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = drawn(
    drawSlots(
      () => template,
      actions((next) => {
        template = next;
      }),
    ),
  );
  change(box, 'Label', 'Title');
  change(box, 'Help', 'The heading');
  assert.deepEqual(template.slots?.['title'], {
    kind: 'text',
    label: 'Title',
    help: 'The heading',
  });
});

test('a slot that differs from the shipped template is marked changed, and one as shipped is not', () => {
  const shipped: Template = {
    slots: { title: { kind: 'text' }, icon: { kind: 'icon' } },
    card: { type: 'x' },
  };
  const template: Template = {
    slots: {
      title: { kind: 'text', label: 'Title' },
      icon: { kind: 'icon' },
      extra: { kind: 'flag' },
    },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(
      () => template,
      actions(() => {}, shipped),
    ),
  );
  const marked = [...box.querySelectorAll('.slot')]
    .filter((slot) => slot.querySelector('.badge.changed') !== null)
    .map((slot) => slot.querySelector('.slot-name')?.textContent);
  assert.deepEqual(marked, ['title', 'extra']);
});

test("a template of the home's own marks no slot changed", () => {
  const template: Template = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = drawn(
    drawSlots(
      () => template,
      actions(() => {}),
    ),
  );
  assert.equal(box.querySelector('.badge.changed'), null);
});

test('a new slot is added under the name typed, and a name taken is refused', () => {
  let template: Template = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = drawn(
    drawSlots(
      () => template,
      actions((next) => {
        template = next;
      }),
    ),
  );
  const input = box.querySelector('input[aria-label="The new slot"]');
  const add = box.querySelector('button[aria-label="Add the slot"]');
  assert.ok(input instanceof HTMLInputElement && add instanceof HTMLButtonElement);
  input.value = 'title';
  input.dispatchEvent(new Event('input'));
  add.click();
  assert.deepEqual(Object.keys(template.slots ?? {}), ['title']);
  assert.equal(input.validationMessage, 'A slot of that name is there already');
  input.value = 'subtitle';
  input.dispatchEvent(new Event('input'));
  add.click();
  assert.deepEqual(template.slots?.['subtitle'], { kind: 'text' });
});

test('a slot name typed is still the one added after the tab draws again', () => {
  let template: Template = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = document.createElement('div');
  const draw = (): void => {
    render(
      drawSlots(
        () => template,
        actions((next) => {
          template = next;
        }),
      ),
      box,
    );
  };
  draw();
  const input = box.querySelector('input[aria-label="The new slot"]');
  const kind = box.querySelector('.add-slot select');
  assert.ok(input instanceof HTMLInputElement && kind instanceof HTMLSelectElement);
  input.value = 'lamp';
  input.dispatchEvent(new Event('input'));
  kind.value = 'entity';
  kind.dispatchEvent(new Event('change'));
  draw();
  const add = box.querySelector('button[aria-label="Add the slot"]');
  assert.ok(add instanceof HTMLButtonElement);
  add.click();
  assert.deepEqual(template.slots?.['lamp'], { kind: 'entity' });
});

test('a choice shows the value the template holds after a redraw, even one the user changed', () => {
  const template: Template = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = document.createElement('div');
  const draw = (): void => {
    render(
      drawSlots(
        () => template,
        actions(() => {}),
      ),
      box,
    );
  };
  draw();
  const kind = box.querySelector('select[aria-label="Kind"]');
  assert.ok(kind instanceof HTMLSelectElement);
  kind.value = 'entity';
  kind.dispatchEvent(new Event('change'));
  draw();
  assert.equal(kind.value, 'text');
});

function messyHass(): SlotsActions['hass'] {
  const registries = homes()['messy'];
  assert.ok(registries);
  return {
    areas: registries.areas,
    devices: registries.devices,
    entities: registries.entities,
    states: Object.fromEntries(
      Object.entries(registries.states).map(([id, state]) => [
        id,
        { entity_id: id, state: 'on', ...state },
      ]),
    ),
  } as unknown as SlotsActions['hass'];
}

test('trying a rule in an area explains the matches, the pick and what almost matched', () => {
  const template: Template = {
    slots: {
      window: { kind: 'entity', discover: { domain: 'binary_sensor', device_class: 'window' } },
      lock: { kind: 'entity', discover: { domain: 'lock' } },
    },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(() => template, {
      ...actions(() => {}),
      hass: messyHass(),
      areas: [{ value: 'den', label: 'Den' }],
    }),
  );
  const traces = [...box.querySelectorAll('.trace')].map((trace) => trace.textContent ?? '');
  assert.equal(traces.length, 2, 'each slot with a rule explains itself');
  const [window, lock] = traces;
  assert.match(
    window ?? '',
    /binary_sensor, device class window: 2 matches, took binary_sensor\.den_window_a/,
  );
  assert.match(window ?? '', /tied with binary_sensor\.den_window_b/);
  assert.match(window ?? '', /binary_sensor\.den_vent has no device class/);
  assert.match(lock ?? '', /no lock in Den/);
});

test('a rule with the newer filters is drawn as a sentence, and the rest can be added as words', () => {
  const template: Template = {
    slots: {
      power: {
        kind: 'entity',
        discover: {
          domain: 'sensor',
          unit: 'W',
          label: 'main',
          exclude: { entity_category: 'diagnostic' },
        },
      },
    },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(() => template, {
      ...actions(() => {}),
      hass: messyHass(),
      areas: [{ value: 'den', label: 'Den' }],
    }),
  );
  assert.equal(box.querySelector('.rule-yaml'), null, 'the form can draw it');
  const text = box.querySelector('.finding')?.textContent ?? '';
  assert.match(text, /with unit/);
  assert.match(text, /labelled/);
  for (const word of ['in the category', 'with state class', 'named like', 'made by', 'of model']) {
    assert.ok(box.querySelector(`button[aria-label="Add: ${word}"]`), `${word} can be added`);
  }
});
