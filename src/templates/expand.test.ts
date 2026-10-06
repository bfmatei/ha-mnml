import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Templates } from '../contract/templates.ts';

import { TemplateError, expand, toValue } from './expand.ts';

const T: Templates = {
  power: {
    slots: {
      entity: { kind: 'entity', required: true },
      color: { kind: 'text', default: 'amber' },
    },
    card: {
      type: 'toggle',
      entity: '[[entity]]',
      icon: 'mdi:power',
      color: '[[color]]',
      primary: true,
    },
  },
  tile: {
    slots: {
      key: { kind: 'text', required: true },
      name: { kind: 'text' },
      count: { kind: 'number' },
      words: { kind: 'texts' },
      windows: { kind: 'entities' },
      lights: { kind: 'object', fields: { group: { kind: 'entity' } } },
      ac: { kind: 'entity' },
      heating: { kind: 'entity' },
      outlet: { kind: 'entity' },
      latency: { kind: 'entities' },
      guests: { kind: 'objects', fields: { status: { kind: 'entity' }, host: { kind: 'text' } } },
    },
    card: {
      type: 'custom:mnml-tile-card',
      name: '[[name]]',
      popup: '#[[key]]',
      count: '[[count]]',
      first: '[[latency.0]]',
      group: '[[lights.group]]',
      'chips?': [
        {
          each: 'windows',
          as: 'window',
          type: 'indicator',
          entity: '[[window]]',
          popup: '#[[key]]-[[window]]',
        },
        { if: ['ac', 'heating'], text: 'climate' },
        { unless: 'outlet', text: 'no outlet' },
        { template: 'power', slots: { entity: '[[ac]]' }, if: 'ac', show: { is: ['on'] } },
      ],
      rows: [{ each: 'guests', as: 'guest', if: 'guest.host', entity: '[[guest.status]]' }],
      state: [{}],
    },
    popups: [{ hash: '#[[key]]', cards: [{ type: 'custom:mnml-header-card', name: '[[name]]' }] }],
  },
};

test('a whole slot keeps its type, a slot inside a string is text, and an unfilled one drops its key', () => {
  const { card } = expand(T, {
    template: 'tile',
    slots: { key: 'hall', count: 3, latency: ['sensor.a', 'sensor.b'] },
  });
  assert.deepEqual(card, {
    type: 'custom:mnml-tile-card',
    popup: '#hall',
    count: 3,
    first: 'sensor.a',
    chips: [{ text: 'no outlet' }],
    rows: [],
    state: [{}],
  });
});

test('each repeats an item per element and sees the outer slots; if and unless keep or drop it', () => {
  const { card } = expand(T, {
    template: 'tile',
    slots: {
      key: 'hall',
      windows: ['binary_sensor.w1', 'binary_sensor.w2'],
      heating: 'climate.h',
      outlet: 'switch.o',
      guests: [{ status: 'binary_sensor.g1', host: 'a.lan' }, { status: 'binary_sensor.g2' }],
    },
  });
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  assert.deepEqual(card['chips'], [
    { type: 'indicator', entity: 'binary_sensor.w1', popup: '#hall-binary_sensor.w1' },
    { type: 'indicator', entity: 'binary_sensor.w2', popup: '#hall-binary_sensor.w2' },
    { text: 'climate' },
  ]);
  assert.deepEqual(card['rows'], [{ entity: 'binary_sensor.g1' }]);
});

test('a nested template takes its slots, its defaults, and the keys added beside it', () => {
  const { card } = expand(T, {
    template: 'tile',
    slots: { key: 'hall', ac: 'climate.ac', outlet: 'switch.o' },
  });
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  assert.deepEqual(card['chips'], [
    { text: 'climate' },
    {
      type: 'toggle',
      entity: 'climate.ac',
      icon: 'mdi:power',
      color: 'amber',
      primary: true,
      show: { is: ['on'] },
    },
  ]);
});

test('a key ending in ? is dropped when it comes out empty', () => {
  const { card } = expand(T, { template: 'tile', slots: { key: 'hall', outlet: 'switch.o' } });
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  assert.equal('chips' in card, false);
});

test('pop-ups are rendered with the slots and returned beside the card', () => {
  const { popups } = expand(T, { template: 'tile', slots: { key: 'hall', name: 'Hall' } });
  assert.deepEqual(popups, [
    { hash: '#hall', cards: [{ type: 'custom:mnml-header-card', name: 'Hall' }] },
  ]);
});

test('in a list, an item that renders to a list is spliced', () => {
  const t: Templates = {
    pair: { slots: { a: { kind: 'entity' } }, card: [{ entity: '[[a]]' }, { entity: '[[a]]' }] },
    host: {
      slots: { a: { kind: 'entity' }, more: { kind: 'entities' } },
      card: { rows: ['[[more]]', { template: 'pair', slots: { a: '[[a]]' } }] },
    },
  };
  assert.deepEqual(
    expand(t, { template: 'host', slots: { a: 'sensor.a', more: ['sensor.b', 'sensor.c'] } }).card,
    {
      rows: ['sensor.b', 'sensor.c', { entity: 'sensor.a' }, { entity: 'sensor.a' }],
    },
  );
});

test('a replaced fragment is used where it is nested', () => {
  const replaced: Templates = {
    ...T,
    power: {
      slots: { entity: { kind: 'entity' } },
      card: { type: 'toggle', entity: '[[entity]]' },
    },
  };
  const { card } = expand(replaced, {
    template: 'tile',
    slots: { key: 'hall', ac: 'climate.ac', outlet: 'switch.o' },
  });
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  assert.deepEqual(card['chips'], [
    { text: 'climate' },
    { type: 'toggle', entity: 'climate.ac', show: { is: ['on'] } },
  ]);
});

test('discovered values fill what the instance leaves out, and an instance value wins', () => {
  const { card } = expand(
    T,
    { template: 'tile', slots: { key: 'hall', name: 'Mine' } },
    { name: 'Found', count: 2 },
  );
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  assert.equal(card['name'], 'Mine');
  assert.equal(card['count'], 2);
});

test('toValue copies JSON-like data, drops undefined keys, and refuses the rest', () => {
  assert.deepEqual(toValue({ a: 1, b: undefined, c: [{ d: 'x' }, null] }), {
    a: 1,
    c: [{ d: 'x' }, null],
  });
  assert.throws(() => toValue({ f: () => 1 }), TemplateError);
});

test('mistakes are errors that name the template and the place', () => {
  assert.throws(() => expand(T, { template: 'nope' }), /no template named nope/);
  assert.throws(() => expand(T, { template: 'tile', slots: {} }), /tile: the slot key is required/);
  assert.throws(
    () => expand(T, { template: 'tile', slots: { key: 'hall', nmae: 'x' } }),
    /tile: no slot named nmae/,
  );
  assert.throws(
    () => expand(T, { template: 'tile', slots: { key: 'hall', count: 'three' } }),
    /tile: count is not a number/,
  );
  assert.throws(
    () => expand(T, { template: 'tile', slots: { key: 'hall', words: [1] } }),
    /tile: words is not of kind texts/,
  );
  assert.doesNotThrow(() =>
    expand(T, { template: 'tile', slots: { key: 'hall', words: ['on', 'open'] } }),
  );
  const t: Templates = {
    loop: { card: { template: 'loop' } },
    half: { slots: { key: { kind: 'text' } }, card: { popup: '#[[key]]-lights' } },
    typo: { slots: { key: { kind: 'text' } }, card: { popup: '[[kye]]' } },
  };
  assert.throws(() => expand(t, { template: 'loop' }), /loop includes itself/);
  assert.throws(() => expand(t, { template: 'half' }), /half at card\.popup: key is unfilled/);
  assert.throws(
    () => expand(t, { template: 'typo', slots: { key: 'a' } }),
    /typo at card\.popup: no slot named kye/,
  );
  assert.throws(() => expand(t, { template: 'typo', slots: { key: 'a' } }), TemplateError);
});

const FIELDS: Templates = {
  thing: {
    slots: {
      o: {
        kind: 'object',
        fields: {
          c: { kind: 'text', default: 'blue' },
          n: { kind: 'number' },
          e: { kind: 'entity', required: true },
        },
      },
      list: { kind: 'objects', fields: { e: { kind: 'entity' }, flag: { kind: 'flag' } } },
    },
    card: {
      colour: '[[o.c]]',
      rows: [{ each: 'list', as: 'item', entity: '[[item.e]]' }],
    },
  },
  typo: {
    slots: { o: { kind: 'object', fields: { c: { kind: 'text' } } } },
    card: { colour: '[[o.cc]]' },
  },
};

test("an object slot fills its fields' defaults and checks their kinds and requirements", () => {
  const { card } = expand(FIELDS, {
    template: 'thing',
    slots: { o: { e: 'light.a' }, list: [{ e: 'light.b' }] },
  });
  assert.deepEqual(card, { colour: 'blue', rows: [{ entity: 'light.b' }] });
  assert.throws(
    () => expand(FIELDS, { template: 'thing', slots: { o: { e: 'light.a', n: 'x' } } }),
    /thing: o\.n is not a number/,
  );
  assert.throws(
    () => expand(FIELDS, { template: 'thing', slots: { o: { c: 'red' } } }),
    /thing: the slot o\.e is required/,
  );
  assert.throws(
    () =>
      expand(FIELDS, { template: 'thing', slots: { o: { e: 'light.a' }, list: [{ e: 'nope' }] } }),
    /thing: list\[0\]\.e is not of kind entity/,
  );
});

test('a path into an object names one of its fields', () => {
  assert.throws(
    () => expand(FIELDS, { template: 'typo', slots: { o: { c: 'red' } } }),
    /typo at card\.colour: o has no field named cc/,
  );
  assert.throws(
    () => expand(FIELDS, { template: 'thing', slots: { o: { e: 'light.a', x: 1 } } }),
    /thing: o has no field named x/,
  );
});

test("a nested template's slot mistake names the outer template, the place, and the inner template", () => {
  const t: Templates = {
    outer: { card: { item: { template: 'inner', slots: {} } } },
    inner: { slots: { entity: { kind: 'entity', required: true } }, card: { e: '[[entity]]' } },
  };
  assert.throws(
    () => expand(t, { template: 'outer' }),
    /^Error: outer at card\.item: inner: the slot entity is required$/,
  );
  assert.throws(
    () => expand(t, { template: 'inner' }),
    /^Error: inner: the slot entity is required$/,
  );
});

test('a slot of an unknown kind, or with a name that is not lower case, is an error naming it', () => {
  const odd = JSON.parse(
    '{"colour": {"slots": {"tint": {"kind": "colour"}}, "card": {}}, "caps": {"slots": {"Tint": {"kind": "text"}}, "card": {}}, "deep": {"slots": {"o": {"kind": "object", "fields": {"f": {"kind": "nope"}}}}, "card": {}}}',
  ) as Templates;
  assert.throws(
    () => expand(odd, { template: 'colour' }),
    /colour: the slot tint has the kind colour, which is none of text, texts, number, icon, flag, entity, entities, object, objects/,
  );
  assert.throws(
    () => expand(odd, { template: 'caps' }),
    /caps: the slot name Tint is not lower case letters, digits and _/,
  );
  assert.throws(() => expand(odd, { template: 'deep' }), /deep: the slot o\.f has the kind nope/);
});

test('an empty string inside text is unfilled, a [[...]] that is not a slot path is an error, and false is no flag', () => {
  const t: Templates = {
    hash: { slots: { key: { kind: 'text' } }, card: { popup: '#[[key]]-lights' } },
    caps: { slots: { key: { kind: 'text' } }, card: { popup: '#[[Key]]' } },
    dash: { slots: { key: { kind: 'text' } }, card: { popup: '#[[my-key]]' } },
    flag: { slots: { on: { kind: 'flag' } }, card: { type: 'x', primary: '[[on]]' } },
  };
  assert.throws(
    () => expand(t, { template: 'hash', slots: { key: '' } }),
    /hash at card\.popup: key is unfilled/,
  );
  assert.throws(
    () => expand(t, { template: 'caps', slots: { key: 'a' } }),
    /caps at card\.popup: \[\[Key\]\] is not a slot path: paths are lower case letters, digits, _ and \./,
  );
  assert.throws(
    () => expand(t, { template: 'dash', slots: { key: 'a' } }),
    /dash at card\.popup: \[\[my-key\]\] is not a slot path/,
  );
  assert.deepEqual(expand(t, { template: 'flag', slots: { on: false } }).card, { type: 'x' });
});

const LATER: Templates = {
  power: {
    slots: { entity: { kind: 'entity', required: true } },
    card: { type: 'toggle', entity: '[[entity]]', icon: 'mdi:power' },
  },
  room: {
    slots: { ac: { kind: 'entity' }, vacuum: { kind: 'entity' } },
    card: {
      type: 'custom:mnml-tile-card',
      entity: 'light.room',
      controls: [
        { template: 'power', slots: { entity: 'switch.room' } },
        { if: 'ac', template: 'ac-chip', slots: { entity: '[[ac]]' } },
        { if: 'vacuum', template: 'vacuum-chip', slots: { entity: '[[vacuum]]' } },
      ],
    },
  },
};

test('a shipped template not loaded yet is reported as missing, with every other the expansion reaches, and nothing is drawn', () => {
  const expanded = expand(
    LATER,
    { template: 'room', slots: { ac: 'climate.room', vacuum: 'vacuum.room' } },
    {},
    new Set(['ac-chip', 'vacuum-chip']),
  );
  assert.deepEqual(expanded, { card: null, popups: [], missing: ['ac-chip', 'vacuum-chip'] });
});

test('a template behind an if: that is not taken is not missing', () => {
  const expanded = expand(
    LATER,
    { template: 'room', slots: { ac: 'climate.room' } },
    {},
    new Set(['ac-chip', 'vacuum-chip']),
  );
  assert.deepEqual(expanded.missing, ['ac-chip']);
});

test("the instance's own template, not loaded yet, is missing", () => {
  assert.deepEqual(expand({}, { template: 'room' }, {}, new Set(['room'])), {
    card: null,
    popups: [],
    missing: ['room'],
  });
});

test('a name that is neither loaded nor to load later is an error, as before', () => {
  assert.throws(
    () =>
      expand(
        LATER,
        { template: 'room', slots: { ac: 'climate.room' } },
        {},
        new Set(['vacuum-chip']),
      ),
    /room at card\.controls\[1\]: no template named ac-chip/,
  );
});

test('with nothing to load later, an expansion has no missing key', () => {
  assert.equal(
    'missing' in expand(LATER, { template: 'power', slots: { entity: 'switch.a' } }),
    false,
  );
});

test('an error that follows from a template not loaded yet waits for it, instead of failing', () => {
  const templates: Templates = {
    holder: {
      slots: { inner: { kind: 'object', required: true } },
      card: {
        type: 'custom:mnml-heading-card',
        title: 'Holder',
        icon: 'mdi:home',
        child: '[[inner]]',
      },
    },
    wrapper: {
      card: { template: 'holder', slots: { inner: { template: 'later-chip' } } },
    },
  };
  assert.deepEqual(expand(templates, { template: 'wrapper' }, {}, new Set(['later-chip'])), {
    card: null,
    popups: [],
    missing: ['later-chip'],
  });
});

test('a slot label, help and group change nothing in what a template draws', () => {
  const plain: Templates = {
    t: {
      slots: { name: { kind: 'text', required: true } },
      card: { type: 'x', title: '[[name]]' },
    },
  };
  const described: Templates = {
    t: {
      slots: {
        name: { kind: 'text', required: true, label: 'Name', help: 'Shown.', group: 'Basics' },
      },
      card: { type: 'x', title: '[[name]]' },
    },
  };
  assert.deepEqual(
    expand(described, { template: 't', slots: { name: 'Hall' } }),
    expand(plain, { template: 't', slots: { name: 'Hall' } }),
  );
});
