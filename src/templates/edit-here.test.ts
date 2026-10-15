import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DEMO } from '../../demo/home.ts';
import { isMapping } from '../contract/templates.ts';
import type { Template, Templates, Value } from '../contract/templates.ts';
import { build } from '../home/view.ts';

import { expandDashboard } from './dashboard.ts';
import { editHere } from './edit-here.ts';
import { toValue } from './expand.ts';
import { SHIPPED } from './shipped.ts';

const T: Templates = {
  chip: {
    slots: {
      entity: { kind: 'entity', required: true },
      popup: { kind: 'text', required: true },
      color: { kind: 'text', default: 'blue' },
      when: { kind: 'object' },
    },
    card: {
      type: 'nav',
      entity: '[[entity]]',
      popup: '[[popup]]',
      color: '[[color]]',
      when: '[[when]]',
    },
  },
  optional: {
    slots: { amount: { kind: 'entity' }, name: { kind: 'text' } },
    card: {
      type: 'custom:mnml-entity-card',
      entity: 'light.a',
      controls: [
        { id: 'slider', if: 'amount', type: 'slider', entity: '[[amount]]' },
        { id: 'plain', unless: 'amount', type: 'toggle', entity: 'light.a' },
        { id: 'named', type: 'service', name: 'Run [[name]]' },
      ],
    },
  },
  each: {
    slots: { lights: { kind: 'entities' } },
    card: [{ id: 'each-lights', each: 'lights', as: 'light', type: 'toggle', entity: '[[light]]' }],
  },
  pair: {
    card: [
      { id: 'one', type: 'a' },
      { id: 'two', type: 'b' },
    ],
  },
  updates: {
    slots: {
      devices: { kind: 'objects', fields: { update: { kind: 'entity' }, key: { kind: 'flag' } } },
    },
    card: {
      id: 'update',
      if: 'devices.*.update',
      type: 'status',
      entities: ['[[devices.?key.update]]'],
    },
  },
  places: {
    slots: { power: { kind: 'entity' }, today: { kind: 'entity' }, total: { kind: 'entity' } },
    card: {
      type: 'row',
      'values!': ['[[power]]', '[[today]]', '[[total]]'],
      entities: ['[[power]]', '[[today]]', '[[total]]'],
    },
  },
};

const use = (item: Record<string, Value>) => editHere(item, T);

test('a use is replaced by what its template draws, its slots written in, and its defaults', () => {
  const done = use({
    id: 'ac',
    template: 'chip',
    slots: { entity: '[[ac.entity]]', popup: '#[[key]]-ac' },
  });
  assert.deepEqual(done?.items, [
    {
      id: 'ac',
      type: 'nav',
      entity: '[[ac.entity]]',
      popup: '#[[key]]-ac',
      color: 'blue',
    },
  ]);
});

test('a slot set to null is none, as expand reads it, not its default', () => {
  const done = use({
    id: 'ac',
    template: 'chip',
    slots: { entity: 'climate.a', popup: '#a', color: null },
  });
  assert.deepEqual(done?.items, [{ id: 'ac', type: 'nav', entity: 'climate.a', popup: '#a' }]);
});

test('a key ending in ! keeps the place of a slot the use leaves unset, as null', () => {
  const done = use({
    id: 'meter',
    template: 'places',
    slots: { power: '[[meter.power]]', total: '[[meter.total]]' },
  });
  assert.deepEqual(done?.items, [
    {
      id: 'meter',
      type: 'row',
      'values!': ['[[meter.power]]', null, '[[meter.total]]'],
      entities: ['[[meter.power]]', '[[meter.total]]'],
    },
  ]);
});

test('what a use adds beside its slots stays, and its conditions stay with it', () => {
  const done = use({
    id: 'ac',
    if: 'ac',
    template: 'chip',
    slots: { entity: '[[ac.entity]]', popup: '#a', color: 'red', when: { not: ['off'] } },
    grid_options: { columns: 6 },
  });
  assert.deepEqual(done?.items, [
    {
      id: 'ac',
      if: 'ac',
      type: 'nav',
      entity: '[[ac.entity]]',
      popup: '#a',
      color: 'red',
      when: { not: ['off'] },
      grid_options: { columns: 6 },
    },
  ]);
});

test('a condition on a slot the use fills with one of its own becomes a condition on that one, or none', () => {
  assert.deepEqual(
    use({ id: 'x', template: 'optional', slots: { amount: '[[dimmer]]', name: '[[who]]' } })?.items,
    [
      {
        id: 'x',
        type: 'custom:mnml-entity-card',
        entity: 'light.a',
        controls: [
          { id: 'slider', if: 'dimmer', type: 'slider', entity: '[[dimmer]]' },
          { id: 'plain', unless: 'dimmer', type: 'toggle', entity: 'light.a' },
          { id: 'named', type: 'service', name: 'Run [[who]]' },
        ],
      },
    ],
  );
  const fixed = use({ id: 'x', template: 'optional', slots: { amount: 'number.a', name: 'it' } });
  assert.deepEqual(fixed?.items, [
    {
      id: 'x',
      type: 'custom:mnml-entity-card',
      entity: 'light.a',
      controls: [
        { id: 'slider', type: 'slider', entity: 'number.a' },
        { id: 'named', type: 'service', name: 'Run it' },
      ],
    },
  ]);
});

test('a list of its own is repeated over the list of the use, and a list drawn is several items', () => {
  assert.deepEqual(
    use({ id: 'all', template: 'each', slots: { lights: '[[room.lights]]' } })?.items,
    [
      {
        id: 'all-each-lights',
        each: 'room.lights',
        as: 'light',
        type: 'toggle',
        entity: '[[light]]',
      },
    ],
  );
  assert.deepEqual(use({ id: 'two', template: 'pair' })?.items, [
    { id: 'two-one', type: 'a' },
    { id: 'two-two', type: 'b' },
  ]);
});

test('a projection over a slot the use fills with one of its own becomes a projection over that one', () => {
  assert.deepEqual(use({ id: 'x', template: 'updates', slots: { devices: '[[tailnet]]' } }), {
    items: [
      {
        id: 'x',
        if: 'tailnet.*.update',
        type: 'status',
        entities: ['[[tailnet.?key.update]]'],
      },
    ],
    list: false,
    popups: [],
  });
});

test('what cannot be edited here is refused', () => {
  assert.equal(use({ id: 'x', template: 'nothing' }), undefined);
  assert.equal(use({ id: 'x', template: 'each', slots: { lights: ['light.a'] } }), undefined);
  assert.equal(
    use({ id: 'x', template: 'updates', slots: { devices: [{ update: 'update.a' }] } }),
    undefined,
    'a projection over a list written out',
  );
  assert.equal(
    use({ id: 'x', template: 'optional', slots: { name: '[[missing]]' } }) !== undefined,
    true,
  );
});

function rewrite(
  value: Value,
  templates: Templates,
  popups: Value[],
  taken: ReadonlySet<string>,
): Value {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const inside =
        isMapping(item) && typeof item['as'] === 'string' ? new Set([...taken, item['as']]) : taken;
      if (isMapping(item) && typeof item['template'] === 'string') {
        const done = editHere(item, templates, inside);
        if (done !== undefined) {
          popups.push(...done.popups);
          return done.items.map((each) => rewrite(each, templates, popups, inside));
        }
      }
      return [rewrite(item, templates, popups, inside)];
    });
  }
  if (isMapping(value)) {
    const inside = typeof value['as'] === 'string' ? new Set([...taken, value['as']]) : taken;
    if (typeof value['template'] === 'string' && value['id'] === undefined) {
      const done = editHere(value, templates, inside);
      const only = done?.items[0];
      if (done?.list === true) {
        popups.push(...done.popups);
        return rewrite(done.items, templates, popups, inside);
      }
      if (done !== undefined && done.items.length === 1 && isMapping(only)) {
        popups.push(...done.popups);
        return rewrite(only, templates, popups, inside);
      }
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, rewrite(inner, templates, popups, inside)]),
    );
  }
  return value;
}

function editedHere(templates: Templates): Templates {
  return Object.fromEntries(
    Object.entries(templates).map(([name, template]): [string, Template] => {
      const popups: Value[] = [];
      const taken = new Set(Object.keys(template.slots ?? {}));
      const card = rewrite(template.card, templates, popups, taken);
      const own = rewrite(template.popups ?? [], templates, popups, taken);
      const all = [...(Array.isArray(own) ? own : []), ...popups];
      return [name, { ...template, card, ...(all.length > 0 ? { popups: all } : {}) }];
    }),
  );
}

const uses = (templates: Templates): number =>
  Object.values(templates).reduce(
    (count, template) => count + JSON.stringify(template).split('"template"').length - 1,
    0,
  );

test('every shipped template, with its fragments edited here, draws the demo home as it was', () => {
  const dashboard = toValue(build(DEMO));
  const before = expandDashboard(SHIPPED, dashboard);
  const after = expandDashboard(editedHere(SHIPPED), dashboard);
  assert.deepEqual(after, before);
  assert.ok(uses(editedHere(SHIPPED)) < uses(SHIPPED) / 2, 'most uses were edited here');
});
