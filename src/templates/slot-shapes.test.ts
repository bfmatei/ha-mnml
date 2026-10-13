import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isTemplate } from '../contract/templates.ts';
import type { Shapes, WrittenTemplate } from '../contract/templates.ts';

import { TemplateError, expand } from './expand.ts';
import { withShapes } from './slot-shapes.ts';

const SHAPES: Shapes = {
  meter: {
    kind: 'object',
    label: 'Meter',
    fields: {
      power: { kind: 'entity' },
      today: { kind: 'entity', label: 'Today' },
      total: { kind: 'entity' },
    },
  },
  outlet: {
    kind: 'object',
    fields: { entity: { kind: 'entity', required: true }, energy: { shape: 'meter' } },
  },
  metered: { shape: 'outlet', fields: { energy: { required: true } } },
  watched: { shape: 'meter', fields: { watts: { required: true } } },
  counted: { shape: 'meter', fields: { power: { kind: 'entities' } } },
  low: { kind: 'number', default: 20, help: 'Orange under this.' },
  loop: { shape: 'round' },
  round: { kind: 'object', fields: { inner: { shape: 'loop' } } },
};

function shaped(slots: WrittenTemplate['slots']): WrittenTemplate {
  return { slots, card: { type: 'x' } };
}

test('a slot that names a shape takes its kind and fields, and its own words, requirement, default and rule win', () => {
  const template = withShapes(
    'room',
    shaped({
      energy: { shape: 'meter', label: 'Energy', group: 'Power', required: true },
      low: { shape: 'low', default: 30 },
      found: { shape: 'meter', discover: { fields: { power: { domain: 'sensor' } } } },
    }),
    SHAPES,
  );
  assert.deepEqual(template.slots, {
    energy: {
      kind: 'object',
      required: true,
      label: 'Energy',
      group: 'Power',
      fields: {
        power: { kind: 'entity' },
        today: { kind: 'entity', label: 'Today' },
        total: { kind: 'entity' },
      },
    },
    low: { kind: 'number', default: 30, help: 'Orange under this.' },
    found: {
      kind: 'object',
      discover: { fields: { power: { domain: 'sensor' } } },
      label: 'Meter',
      fields: {
        power: { kind: 'entity' },
        today: { kind: 'entity', label: 'Today' },
        total: { kind: 'entity' },
      },
    },
  });
});

test('objects makes a list of an object shape, a field may name a shape, and fields change single fields of it', () => {
  const template = withShapes(
    'room',
    shaped({
      outlets: { shape: 'outlet', kind: 'objects' },
      server: { shape: 'metered', fields: { energy: { fields: { power: { required: true } } } } },
      ac: {
        kind: 'object',
        fields: { entity: { kind: 'entity' }, energy: { shape: 'meter', label: 'Its energy' } },
      },
    }),
    SHAPES,
  );
  const meter = {
    power: { kind: 'entity' },
    today: { kind: 'entity', label: 'Today' },
    total: { kind: 'entity' },
  };
  assert.deepEqual(template.slots, {
    outlets: {
      kind: 'objects',
      fields: {
        entity: { kind: 'entity', required: true },
        energy: { kind: 'object', label: 'Meter', fields: meter },
      },
    },
    server: {
      kind: 'object',
      fields: {
        entity: { kind: 'entity', required: true },
        energy: {
          kind: 'object',
          required: true,
          label: 'Meter',
          fields: { ...meter, power: { kind: 'entity', required: true } },
        },
      },
    },
    ac: {
      kind: 'object',
      fields: {
        entity: { kind: 'entity' },
        energy: { kind: 'object', label: 'Its energy', fields: meter },
      },
    },
  });
});

test('a template that names no shape comes back as it is', () => {
  const template = shaped({ entity: { kind: 'entity', required: true } });
  assert.equal(withShapes('plain', template, SHAPES), template);
});

function problem(slots: WrittenTemplate['slots']): string {
  try {
    withShapes('room', shaped(slots), SHAPES);
  } catch (error) {
    assert.ok(error instanceof TemplateError);
    return error.message;
  }
  return 'no error';
}

test('an unknown shape, a cycle, a field the shape lacks or a kind it cannot take is an error naming the template and the slot', () => {
  assert.equal(
    problem({ energy: { shape: 'metre' } }),
    'room: the slot energy uses the shape metre, which is not known',
  );
  assert.equal(
    problem({ ac: { kind: 'object', fields: { energy: { shape: 'metre' } } } }),
    'room: the slot ac.energy uses the shape metre, which is not known',
  );
  assert.equal(
    problem({ ring: { shape: 'loop' } }),
    'room: the slot ring uses the shape loop, which uses itself through round',
  );
  assert.equal(
    problem({ energy: { shape: 'meter', fields: { watts: { required: true } } } }),
    'room: the slot energy uses the shape meter, which has no field named watts',
  );
  assert.equal(
    problem({ energy: { shape: 'meter', kind: 'entities' } }),
    'room: the slot energy uses the shape meter, of kind object, as entities: only an object shape is taken as objects, or an objects one as object',
  );
  assert.equal(
    problem({ low: { shape: 'low', kind: 'objects' } }),
    'room: the slot low uses the shape low, of kind number, as objects: only an object shape is taken as objects, or an objects one as object',
  );
});

test("a field that changes kind, or names a shape of another kind, is an error naming the field's kind", () => {
  assert.equal(
    problem({ energy: { shape: 'meter', fields: { power: { kind: 'entities' } } } }),
    'room: the slot energy uses the shape meter, whose field power is of kind entity, as entities: only an object field is taken as objects, or an objects one as object',
  );
  assert.equal(
    problem({ energy: { shape: 'meter', fields: { power: { shape: 'meter' } } } }),
    'room: the slot energy uses the shape meter, whose field power is of kind entity, as the shape meter, of kind object: only an object field is taken as objects, or an objects one as object',
  );
  const template = withShapes(
    'room',
    shaped({
      outlet: { shape: 'outlet', fields: { energy: { shape: 'meter', label: 'Its energy' } } },
    }),
    SHAPES,
  );
  assert.equal(template.slots?.['outlet']?.fields?.['energy']?.label, 'Its energy');
});

test('a field the layered shape changes is blamed on the layered shape, through the shape it takes', () => {
  assert.equal(
    problem({ energy: { shape: 'watched' } }),
    'room: the slot energy uses the shape watched, which takes the shape meter, which has no field named watts',
  );
  assert.equal(
    problem({ energy: { shape: 'counted' } }),
    'room: the slot energy uses the shape counted, which takes the shape meter, whose field power is of kind entity, as entities: only an object field is taken as objects, or an objects one as object',
  );
});

test("a slot spec or a field that is not a mapping is left to the engine's slot checks, which name it", () => {
  const odd = JSON.parse(
    '{"title": {"slots": {"title": null}, "card": {"type": "x"}}, "field": {"slots": {"o": {"kind": "object", "fields": {"f": null}}}, "card": {"type": "x"}}, "change": {"slots": {"energy": {"shape": "meter", "fields": {"power": null}}, "name": null}, "card": {"type": "x"}}, "list": {"slots": [{"shape": "meter"}], "card": {"type": "x"}}, "fields": {"slots": {"o": {"kind": "object", "fields": "f"}}, "card": {"type": "x"}}}',
  ) as Record<string, WrittenTemplate>;
  const drawn = (name: string): string => {
    const written = odd[name];
    assert.ok(written !== undefined);
    try {
      expand({ [name]: withShapes(name, written, SHAPES) }, { template: name });
    } catch (error) {
      assert.ok(error instanceof TemplateError);
      return error.message;
    }
    return 'no error';
  };
  const none =
    'which is none of text, texts, number, icon, flag, entity, entities, object, objects';
  assert.equal(drawn('title'), `title: the slot title has the kind none, ${none}`);
  assert.equal(drawn('field'), `field: the slot o.f has the kind none, ${none}`);
  assert.equal(drawn('change'), `change: the slot energy.power has the kind none, ${none}`);
  assert.equal(drawn('list'), 'list: slots must be a mapping');
  assert.equal(drawn('fields'), 'fields: the fields of o must be a mapping');
  assert.equal(
    problem({ energy: { shape: 'meter', fields: JSON.parse('"power"') } }),
    'room: the fields of energy must be a mapping',
  );
});

test('a template with its shapes resolved draws as the template written out does', () => {
  const written = withShapes(
    'tile',
    {
      slots: { outlets: { shape: 'outlet', kind: 'objects' } },
      card: { type: 'x', powers: '[[outlets.*.energy.power]]' },
    },
    SHAPES,
  );
  const drawn = expand(
    { tile: written },
    {
      template: 'tile',
      slots: { outlets: [{ entity: 'switch.a', energy: { power: 'sensor.a_power' } }] },
    },
  );
  assert.deepEqual(drawn.card, { type: 'x', powers: ['sensor.a_power'] });
});

test('a shape that was never resolved is an error naming the slot when the template is expanded', () => {
  const written: unknown = { slots: { energy: { shape: 'metre' } }, card: { type: 'x' } };
  assert.ok(isTemplate(written));
  assert.throws(
    () => expand({ tile: written }, { template: 'tile' }),
    /^Error: tile: the slot energy uses the shape metre, which could not be resolved$/,
  );
});
