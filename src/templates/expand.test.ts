import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Templates } from '../contract/templates.ts';
import { RO } from '../words/ro.ts';

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
      states: { kind: 'texts' },
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

test('a key ending in ! keeps its places: an unfilled item stays as null, so the items after it keep theirs', () => {
  const t: Templates = {
    row: {
      slots: {
        power: { kind: 'entity' },
        today: { kind: 'entity' },
        total: { kind: 'entity' },
      },
      card: {
        'values!': ['[[power]]', '[[today]]', '[[total]]'],
        entities: ['[[power]]', '[[today]]', '[[total]]'],
      },
    },
  };
  assert.deepEqual(
    expand(t, { template: 'row', slots: { power: 'sensor.p', total: 'sensor.t' } }).card,
    { values: ['sensor.p', null, 'sensor.t'], entities: ['sensor.p', 'sensor.t'] },
  );
});

test('a key ending in ! takes a list written out', () => {
  const t: Templates = {
    row: { slots: { all: { kind: 'entities' } }, card: { 'values!': '[[all]]' } },
  };
  assert.throws(
    () => expand(t, { template: 'row', slots: { all: ['sensor.a'] } }),
    /a key ending in ! takes a list written out/,
  );
});

test('pop-ups are rendered with the slots and returned beside the card', () => {
  const { popups } = expand(T, { template: 'tile', slots: { key: 'hall', name: 'Hall' } });
  assert.deepEqual(popups, [
    { hash: '#hall', cards: [{ type: 'custom:mnml-header-card', name: 'Hall' }] },
  ]);
});

test("a template's own pop-ups come before those its pop-ups' cards bring", () => {
  const t: Templates = {
    item: {
      slots: { key: { kind: 'text' } },
      card: { type: 'tile', popup: '#[[key]]-item' },
      popups: [{ hash: '#[[key]]-item', cards: [] }],
    },
    room: {
      slots: { key: { kind: 'text' } },
      card: { type: 'tile', popup: '#[[key]]' },
      popups: [
        { hash: '#[[key]]', cards: [{ template: 'item', slots: { key: '[[key]]' } }] },
        { hash: '#[[key]]-lights', cards: [] },
      ],
    },
  };
  const { popups } = expand(t, { template: 'room', slots: { key: 'hall' } });
  assert.deepEqual(
    popups.map((popup) => (isMapping(popup) ? popup['hash'] : undefined)),
    ['#hall', '#hall-lights', '#hall-item'],
  );
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
    () => expand(T, { template: 'tile', slots: { key: 'hall', states: [1] } }),
    /tile: states is not of kind texts/,
  );
  assert.doesNotThrow(() =>
    expand(T, { template: 'tile', slots: { key: 'hall', states: ['on', 'open'] } }),
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

const WORDED: Templates = {
  lit: {
    slots: { name: { kind: 'text' } },
    card: {
      type: 'custom:mnml-list-card',
      title: '[[words.lights]]',
      headers: ['[[words.item]]', '[[words.now]]'],
      'chips?': [{ if: 'name', name: '[[name]] • [[words.firmware]]' }],
    },
    popups: [{ hash: '#lit', cards: [{ title: '[[words.all_lights]]' }] }],
  },
};

test('a template names a word, and the expansion writes it in the words it is given, English when it is given none', () => {
  assert.deepEqual(expand(WORDED, { template: 'lit', slots: { name: 'Kitchen' } }), {
    card: {
      type: 'custom:mnml-list-card',
      title: 'Lights',
      headers: ['Item', 'Now'],
      chips: [{ name: 'Kitchen • Firmware' }],
    },
    popups: [{ hash: '#lit', cards: [{ title: 'All lights' }] }],
  });
  const { card, popups } = expand(
    WORDED,
    { template: 'lit', slots: { name: 'Bucătărie' } },
    {},
    new Set(),
    undefined,
    RO.templates,
  );
  assert.deepEqual(card, {
    type: 'custom:mnml-list-card',
    title: 'Lumini',
    headers: ['Element', 'Acum'],
    chips: [{ name: 'Bucătărie • Firmware' }],
  });
  assert.deepEqual(popups, [{ hash: '#lit', cards: [{ title: 'Toate luminile' }] }]);
});

test('an unknown word is an error naming the template, the place and the word, even where nothing is drawn', () => {
  const t: Templates = {
    typo: {
      slots: { name: { kind: 'text' } },
      card: { type: 'x', 'chips?': [{ if: 'name', name: '[[words.lightz]]' }] },
    },
    whole: { card: { type: 'x', title: '[[words]]' } },
    deep: { card: { type: 'x', title: '[[words.lights.name]]' } },
    over: { card: { type: 'x', title: '[[words.*]]' } },
    gate: { card: { type: 'x', if: 'words', title: 'x' } },
  };
  assert.throws(
    () => expand(t, { template: 'typo' }),
    (error: unknown) => {
      assert.ok(error instanceof TemplateError);
      assert.equal(error.message, 'typo at card.chips[0].name: no word named lightz');
      assert.equal(error.said, error.message);
      return true;
    },
  );
  for (const name of ['whole', 'deep', 'over', 'gate']) {
    assert.throws(
      () => expand(t, { template: name }),
      new RegExp(
        ` ${name} at card(\\.title)?: words takes the name of one word, as \\[\\[words\\.lights\\]\\]$`,
      ),
    );
  }
});

test('words is reserved: no slot, and no element of each:, is called words', () => {
  const t: Templates = {
    slot: { slots: { words: { kind: 'texts' } }, card: { type: 'x' } },
    alias: {
      slots: { lights: { kind: 'entities' } },
      card: { type: 'x', rows: [{ each: 'lights', as: 'words', entity: 'light.a' }] },
    },
    field: {
      slots: { light: { kind: 'object', fields: { words: { kind: 'texts' } } } },
      card: { type: 'x', is: ['[[light.words]]'] },
    },
  };
  assert.throws(
    () => expand(t, { template: 'slot' }),
    / slot: the slot name words is reserved for the words of the card's language$/,
  );
  assert.throws(
    () => expand(t, { template: 'alias' }),
    / alias at card\.rows\[0\]: as: words is reserved for the words of the card's language$/,
  );
  assert.deepEqual(expand(t, { template: 'field', slots: { light: { words: ['on'] } } }).card, {
    type: 'x',
    is: ['on'],
  });
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

function saidOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof TemplateError);
    return error.said;
  }
  return assert.fail('it did not throw');
}

test('a slot mistake also says, in the words of the slot labels, what a person filling it must do', () => {
  const t: Templates = {
    car: {
      title: 'Car',
      slots: {
        key: { kind: 'text', required: true, label: 'Short name' },
        fuel: { kind: 'number' },
        lights: {
          kind: 'object',
          label: 'Its lights',
          fields: { group: { kind: 'entity', required: true }, color: { kind: 'flag' } },
        },
        meters: { kind: 'objects', fields: { power: { kind: 'entity', required: true } } },
      },
      card: { name: '[[key]]' },
    },
    outer: { card: { item: { template: 'inner', slots: {} } } },
    inner: {
      title: 'Inner piece',
      slots: { entity: { kind: 'entity', required: true } },
      card: { e: '[[entity]]' },
    },
  };
  assert.equal(
    saidOf(() => expand(t, { template: 'car', slots: {} })),
    'Short name is needed',
  );
  assert.throws(
    () => expand(t, { template: 'car', slots: {} }),
    /^Error: car: the slot key is required$/,
  );
  assert.equal(
    saidOf(() => expand(t, { template: 'car', slots: { key: 'a', fuel: 'full' } })),
    'Fuel takes a number',
  );
  assert.equal(
    saidOf(() => expand(t, { template: 'car', slots: { key: 'a', lights: { color: true } } })),
    'Its lights: Group is needed',
  );
  assert.equal(
    saidOf(() => expand(t, { template: 'car', slots: { key: 'a', meters: [{}] } })),
    'Meters: Power is needed',
  );
  assert.equal(
    saidOf(() => expand(t, { template: 'outer' })),
    'Inner piece: Entity is needed',
  );
  assert.equal(
    saidOf(() => expand(t, { template: 'car', slots: { key: 'a', nmae: 'x' } })),
    'car: no slot named nmae',
  );
});

test('a title is a text and an icon an mdi: icon, or the template is an error naming it', () => {
  const t = JSON.parse(
    '{"titled": {"title": "", "card": {}}, "iconed": {"icon": "sofa", "card": {}}, "fine": {"title": "Fine", "icon": "mdi:sofa", "card": {"a": 1}}}',
  ) as Templates;
  assert.throws(() => expand(t, { template: 'titled' }), /^Error: titled: its title is a text/);
  assert.throws(() => expand(t, { template: 'iconed' }), /^Error: iconed: its icon is mdi:/);
  assert.deepEqual(expand(t, { template: 'fine' }).card, { a: 1 });
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

const RETIRED: Templates = {
  inner: {
    slots: {
      key: { kind: 'text', required: true },
      heating: { kind: 'object', fields: { entity: { kind: 'entity' } } },
      devices: { kind: 'objects', fields: { connected: { kind: 'entity' } } },
    },
    retired: ['meters', 'heating.batteries', 'devices.essential'],
    card: { type: 'x', key: '[[key]]', heating: '[[heating]]', devices: '[[devices]]' },
  },
  outer: {
    slots: {
      key: { kind: 'text' },
      meters: { kind: 'objects' },
      heating: { kind: 'object' },
      devices: { kind: 'objects' },
    },
    card: {
      template: 'inner',
      slots: {
        key: '[[key]]',
        meters: '[[meters]]',
        heating: '[[heating]]',
        devices: '[[devices]]',
      },
    },
  },
  reads: {
    slots: { key: { kind: 'text' } },
    retired: ['meters'],
    card: { type: 'x', meters: '[[meters]]' },
  },
};

const OLD = {
  key: 'hall',
  meters: [{ power: 'sensor.hall_power' }],
  heating: { entity: 'climate.hall', batteries: ['sensor.valve_battery'] },
  devices: [{ connected: 'binary_sensor.router', essential: true }],
};

test('a value given for a retired slot or field is taken and ignored, wherever it comes from', () => {
  const drawn = {
    type: 'x',
    key: 'hall',
    heating: { entity: 'climate.hall' },
    devices: [{ connected: 'binary_sensor.router' }],
  };
  assert.deepEqual(expand(RETIRED, { template: 'inner', slots: OLD }).card, drawn);
  assert.deepEqual(expand(RETIRED, { template: 'outer', slots: OLD }).card, drawn);
  assert.throws(
    () => expand(RETIRED, { template: 'reads', slots: { meters: [] } }),
    /^Error: reads at card\.meters: no slot named meters$/,
  );
  assert.throws(
    () =>
      expand(RETIRED, {
        template: 'inner',
        slots: { key: 'hall', heating: { entity: 'climate.hall', valves: [] } },
      }),
    /^Error: inner: heating has no field named valves$/,
  );
});

test('retired: takes a list of slot paths the template does not declare', () => {
  const odd = JSON.parse(
    '{"word": {"retired": "meters", "card": {}}, "caps": {"retired": ["Meters"], "card": {}}, "slot": {"slots": {"key": {"kind": "text"}}, "retired": ["key"], "card": {}}, "field": {"slots": {"heating": {"kind": "object", "fields": {"batteries": {"kind": "entities"}}}}, "retired": ["heating.batteries"], "card": {}}}',
  ) as Templates;
  assert.throws(
    () => expand(odd, { template: 'word' }),
    /^Error: word: retired: takes a list of slot paths, dotted for a field: heating\.batteries$/,
  );
  assert.throws(
    () => expand(odd, { template: 'caps' }),
    /^Error: caps: retired: takes a list of slot paths, dotted for a field: heating\.batteries$/,
  );
  assert.throws(
    () => expand(odd, { template: 'slot' }),
    /^Error: slot: the retired path key names a slot the template declares$/,
  );
  assert.throws(
    () => expand(odd, { template: 'field' }),
    /^Error: field: the retired path heating\.batteries names a slot the template declares$/,
  );
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

test('a marked expansion tells each part its path, and a fragment use is one part', () => {
  const templates: Templates = {
    ...T,
    marked: {
      slots: { door: { kind: 'entity' }, lights: { kind: 'entities' } },
      card: {
        type: 'custom:mnml-tile-card',
        name: 'Hall',
        icon: 'mdi:door',
        popup: '#hall',
        chips: [
          { id: 'door', if: 'door', type: 'indicator', entity: '[[door]]', color: 'orange' },
          { id: 'power', template: 'power', slots: { entity: 'light.hall' } },
          { id: 'each-lights', each: 'lights', as: 'light', type: 'toggle', entity: '[[light]]' },
        ],
        item: { entity: 'light.hall' },
      },
    },
  };
  const slots = { door: 'binary_sensor.door', lights: ['light.a', 'light.b'] };
  const plain = expand(templates, { template: 'marked', slots });
  assert.ok(!JSON.stringify(plain.card).includes('_part'));
  const out = expand(templates, { template: 'marked', slots }, {}, new Set(), {
    singles: new Set(['card', 'card/item']),
  });
  assert.deepEqual(toValue(out.card), {
    type: 'custom:mnml-tile-card',
    name: 'Hall',
    icon: 'mdi:door',
    popup: '#hall',
    chips: [
      {
        type: 'indicator',
        entity: 'binary_sensor.door',
        color: 'orange',
        _part: 'card/chips/#door',
      },
      {
        type: 'toggle',
        entity: 'light.hall',
        icon: 'mdi:power',
        color: 'amber',
        primary: true,
        _part: 'card/chips/#power',
      },
      { type: 'toggle', entity: 'light.a', _part: 'card/chips/#each-lights' },
      { type: 'toggle', entity: 'light.b', _part: 'card/chips/#each-lights' },
    ],
    item: { entity: 'light.hall', _part: 'card/item' },
    _part: 'card',
  });
});

test('a fragment that draws a list marks each of its cards, and a mark never makes a draw fail', () => {
  const templates: Templates = {
    pair: { card: [{ type: 'a' }, { type: 'b' }] },
    stack: {
      card: {
        type: 'vertical-stack',
        cards: [
          { id: 'pair', template: 'pair' },
          { id: 'one', type: 'c' },
        ],
      },
    },
  };
  const out = expand(templates, { template: 'stack' }, {}, new Set(), { singles: new Set() });
  assert.deepEqual(toValue(out.card), {
    type: 'vertical-stack',
    cards: [
      { type: 'a', _part: 'card/cards/#pair' },
      { type: 'b', _part: 'card/cards/#pair' },
      { type: 'c', _part: 'card/cards/#one' },
    ],
  });
});
