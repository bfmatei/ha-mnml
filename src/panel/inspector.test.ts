import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Value, WrittenTemplate } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import { drawn } from '../test/render.ts';

import { readableOf } from './data.ts';
import { conditionOf, drawInspector, slotPaths, withCondition } from './inspector.ts';
import type { InspectorActions } from './inspector.ts';
import { partOf } from './outline.ts';
import { valueAt, withValue } from './tree.ts';

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

function actionsFor(
  get: () => WrittenTemplate,
  set: (next: WrittenTemplate) => void,
): InspectorActions {
  return {
    hass: undefined,
    open: new Map(),
    template: readableOf('test', get()),
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

function cardOf(template: WrittenTemplate): Record<string, Value> {
  const card = valueAt(template, ['card']);
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  return card;
}

test('two bound fields of a part changed one after the other both stay, without a redraw between them', () => {
  let template: WrittenTemplate = {
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

function dataOf(node: Element): Record<string, Value> {
  const data = field(node, 'data');
  return isMapping(data) ? data : {};
}

test('a shared piece shows a slot it is not given as empty, and an edit writes that slot alone, leaving the others as they were', () => {
  let template: WrittenTemplate = { card: { template: 'banner', slots: { title: 'Hi', size: 3 } } };
  const actions: InspectorActions = {
    ...actionsFor(
      () => template,
      (next) => {
        template = next;
      },
    ),
    templates: {
      banner: {
        slots: { title: { kind: 'text' }, subtitle: { kind: 'text' }, size: { kind: 'number' } },
        card: { type: 'custom:mnml-heading-card', title: '[[title]]' },
      },
    },
  };
  const box = drawn(drawInspector(partOf(cardOf(template), ['card'], undefined, 0), actions));
  const form = (key: string): Element => {
    const found = [...box.querySelectorAll('ha-form')].find((node) =>
      Object.hasOwn(dataOf(node), key),
    );
    assert.ok(found, key);
    return found;
  };
  const edit = (key: string, value: string): void => {
    form(key).dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: { ...dataOf(form(key)), [key]: value } },
      }),
    );
  };
  assert.equal(dataOf(form('subtitle'))['subtitle'], '');
  assert.equal(dataOf(form('size'))['size'], '3');
  edit('title', 'Hello');
  assert.deepEqual(template.card, { template: 'banner', slots: { title: 'Hello', size: 3 } });
  edit('subtitle', 'Hall');
  edit('title', '');
  assert.deepEqual(template.card, { template: 'banner', slots: { size: 3, subtitle: 'Hall' } });
});
