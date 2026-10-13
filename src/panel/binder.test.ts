import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { fittingSlots, MnmlBinder } from './binder.ts';

define('mnml-binder', MnmlBinder);

test('a field is offered only the slots of a kind that fits it', () => {
  const slots = {
    name: { kind: 'text' },
    count: { kind: 'number' },
    lamp: { kind: 'entity' },
    lamps: { kind: 'entities' },
    shown: { kind: 'flag' },
    look: { kind: 'icon' },
  } as const;
  assert.deepEqual(fittingSlots(slots, 'entity'), ['lamp']);
  assert.deepEqual(fittingSlots(slots, 'entities'), ['lamp', 'lamps']);
  assert.deepEqual(fittingSlots(slots, 'flag'), ['shown']);
  assert.deepEqual(fittingSlots(slots, 'icon'), ['name', 'look']);
  assert.deepEqual(fittingSlots(slots, 'text'), ['name', 'count', 'lamp', 'look']);
  assert.deepEqual(fittingSlots(slots, 'rule'), [
    'name',
    'count',
    'lamp',
    'lamps',
    'shown',
    'look',
  ]);
});

test('the binder offers the slots that fit the field chosen, and binds the one chosen', async () => {
  const bound: string[] = [];
  const binder = document.createElement('mnml-binder');
  assert.ok(binder instanceof MnmlBinder);
  binder.fields = [
    { value: 'entity', label: 'Entity', kind: 'entity' },
    { value: 'name', label: 'Name', kind: 'text' },
  ];
  binder.slots = { title: { kind: 'text' }, lamp: { kind: 'entity' } };
  binder.bind = (key, slot) => {
    bound.push(`${key}=${slot}`);
  };
  const root = await mounted(binder);
  const picks = (): HTMLSelectElement[] => [...root.querySelectorAll('select')];
  const slots = (): string[] => [...(picks()[1]?.options ?? [])].map((option) => option.value);
  assert.deepEqual(slots(), ['lamp']);
  const chosen = picks()[0];
  assert.ok(chosen);
  chosen.value = 'name';
  chosen.dispatchEvent(new Event('change'));
  await binder.updateComplete;
  assert.deepEqual(slots(), ['title', 'lamp']);
  const slot = picks()[1];
  assert.ok(slot);
  slot.value = 'lamp';
  slot.dispatchEvent(new Event('change'));
  await binder.updateComplete;
  const bind = root.querySelector('button[aria-label="Link the setting to the slot"]');
  assert.ok(bind instanceof HTMLButtonElement);
  bind.click();
  assert.deepEqual(bound, ['name=lamp']);
});
