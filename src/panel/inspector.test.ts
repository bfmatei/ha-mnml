import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template, Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import { define, drawn, mounted } from '../test/render.ts';

import {
  conditionOf,
  drawInspector,
  fittingSlots,
  MnmlBinder,
  slotPaths,
  withCondition,
} from './inspector.ts';
import type { InspectorActions } from './inspector.ts';
import { partOf } from './outline.ts';
import { valueAt, withValue } from './tree.ts';

define('mnml-binder', MnmlBinder);

test("a template's slots are offered with the fields of its object slots", () => {
  assert.deepEqual(
    slotPaths({
      name: { kind: 'text' },
      nozzle: {
        kind: 'object',
        fields: { temperature: { kind: 'entity' }, target: { kind: 'entity' } },
      },
      lights: { kind: 'objects', fields: { group: { kind: 'entity' } } },
    }),
    ['name', 'nozzle', 'nozzle.temperature', 'nozzle.target', 'lights'],
  );
});

test('a part is shown always, if slots are set, or unless they are; the condition is written after its id', () => {
  assert.deepEqual(conditionOf({ id: 'lock', type: 'toggle' }), { show: 'always', slots: [] });
  assert.deepEqual(conditionOf({ if: ['lock', 'door'] }), { show: 'if', slots: ['lock', 'door'] });
  assert.deepEqual(conditionOf({ unless: 'lock' }), { show: 'unless', slots: ['lock'] });
  assert.deepEqual(Object.keys(withCondition({ id: 'lock', type: 'toggle' }, 'if', ['lock'])), [
    'id',
    'if',
    'type',
  ]);
  assert.deepEqual(
    withCondition({ id: 'lock', if: 'lock', type: 'toggle' }, 'unless', ['a', 'b']),
    {
      id: 'lock',
      unless: ['a', 'b'],
      type: 'toggle',
    },
  );
  assert.deepEqual(withCondition({ id: 'lock', if: 'lock', type: 'toggle' }, 'always', []), {
    id: 'lock',
    type: 'toggle',
  });
});

function actionsFor(get: () => Template, set: (next: Template) => void): InspectorActions {
  return {
    hass: undefined,
    open: new Map(),
    template: get(),
    templates: {},
    value: (path) => {
      const found = valueAt(get(), path);
      return typeof found === 'object' && found !== null && !Array.isArray(found) ? found : {};
    },
    update: (path, next) => {
      set(withValue(get(), path, next));
    },
    redraw: () => {},
  };
}

function cardOf(template: Template): Record<string, Value> {
  const card = valueAt(template, ['card']);
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  return card;
}

test('two bound fields of a part changed one after the other both stay, without a redraw between them', () => {
  let template: Template = {
    slots: { title: { kind: 'text' }, icon: { kind: 'icon' } },
    card: { type: 'custom:mnml-heading-card', title: '[[title]]', icon: '[[icon]]' },
  };
  const box = drawn(
    drawInspector(
      partOf(cardOf(template), ['card'], undefined, 0),
      actionsFor(
        () => template,
        (next) => {
          template = next;
        },
      ),
    ),
  );
  const form = (key: string): Element => {
    const found = [...box.querySelectorAll('ha-form')].find((node) => {
      const data = field(node, 'data');
      return typeof data === 'object' && data !== null && Object.hasOwn(data, key);
    });
    assert.ok(found, key);
    return found;
  };
  form('title').dispatchEvent(
    new CustomEvent('value-changed', { detail: { value: { title: 'Hall [[title]]' } } }),
  );
  form('icon').dispatchEvent(
    new CustomEvent('value-changed', { detail: { value: { icon: 'mdi:door [[icon]]' } } }),
  );
  assert.deepEqual(template.card, {
    type: 'custom:mnml-heading-card',
    title: 'Hall [[title]]',
    icon: 'mdi:door [[icon]]',
  });
});

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
  const form = root.querySelector('ha-form');
  assert.ok(form);
  const options = (): unknown =>
    field(field(field(field(form, 'schema'), '1'), 'selector'), 'select');
  assert.deepEqual(field(options(), 'options'), ['lamp']);
  form.dispatchEvent(
    new CustomEvent('value-changed', { detail: { value: { field: 'name', slot: 'lamp' } } }),
  );
  await binder.updateComplete;
  assert.deepEqual(field(options(), 'options'), ['title', 'lamp']);
  const bind = root.querySelector('button[aria-label="Bind the field to the slot"]');
  assert.ok(bind instanceof HTMLButtonElement);
  bind.click();
  assert.deepEqual(bound, ['name=lamp']);
});
