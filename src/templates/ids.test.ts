import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';

import { expand } from './expand.ts';
import { RELEASED, RETIRED, partPaths } from './ids.ts';
import { SHIPPED } from './shipped.ts';

function lists(
  value: Value | undefined,
  at: string,
  found: [string, Value[]][] = [],
): [string, Value[]][] {
  if (Array.isArray(value)) {
    found.push([at, value]);
    for (const [index, item] of value.entries()) {
      lists(item, `${at}[${index}]`, found);
    }
  } else if (isMapping(value)) {
    for (const [key, inner] of Object.entries(value)) {
      lists(inner, `${at}.${key}`, found);
    }
  }
  return found;
}

test('every part of a list in a shipped card or pop-up has an id, unique in its list', () => {
  for (const [name, template] of Object.entries(SHIPPED)) {
    const trees: [string, Value | undefined][] = [
      [`${name}.card`, template.card],
      [`${name}.popups`, template.popups],
    ];
    for (const [root, tree] of trees) {
      for (const [at, items] of lists(tree, root)) {
        const ids = items.filter(isMapping).map((item) => item['id']);
        for (const id of ids) {
          assert.equal(typeof id, 'string', `${at}: a part without an id`);
        }
        assert.equal(new Set(ids).size, ids.length, `${at}: an id used twice`);
      }
    }
  }
});

test("an id is the template's own, and no card sees it", () => {
  const expanded = expand(
    {
      chips: {
        card: {
          type: 'custom:mnml-heading-card',
          title: 'Hall',
          icon: 'mdi:door',
          controls: [{ id: 'lock', type: 'toggle', entity: 'lock.hall' }],
        },
      },
    },
    { template: 'chips', slots: {} },
    {},
  );
  assert.deepEqual(expanded.card, {
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
    controls: [{ type: 'toggle', entity: 'lock.hall' }],
  });
});

test('a part id kept in a release stays, or is retired, and a retired one is never used again', () => {
  const now = new Set(
    Object.entries(SHIPPED).flatMap(([name, template]) => partPaths(name, template)),
  );
  const vanished = RELEASED.filter((path) => !now.has(path) && !RETIRED.includes(path));
  assert.deepEqual(vanished, [], 'gone without being retired: add them to retired in ids.json');
  const reused = RETIRED.filter((path) => now.has(path));
  assert.deepEqual(reused, [], 'retired, and used again');
  const unknown = [...now].filter((path) => !RELEASED.includes(path));
  assert.deepEqual(unknown, [], 'new parts: npm run fix:ids adds them to ids.json');
});

test('an id stays on a mapping that is not a part of a list, such as the data of an action', () => {
  const expanded = expand(
    {
      clear: {
        card: {
          type: 'custom:mnml-heading-card',
          title: 'Hall',
          icon: 'mdi:door',
          tap_action: { action: 'perform-action', data: { id: 'kitchen' } },
        },
      },
    },
    { template: 'clear', slots: {} },
    {},
  );
  assert.deepEqual((expanded.card as { tap_action: unknown }).tap_action, {
    action: 'perform-action',
    data: { id: 'kitchen' },
  });
});

test('no shipped part id starts with my-, which belongs to the parts a home adds', () => {
  const taken = Object.entries(SHIPPED).flatMap(([name, template]) =>
    partPaths(name, template).filter((path) => /\/#my-/.test(path)),
  );
  assert.deepEqual(taken, []);
});
