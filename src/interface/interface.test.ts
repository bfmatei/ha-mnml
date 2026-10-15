import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { test } from 'vitest';

import { CARD_STRUCTURES, CONTROL, STATE_ITEM, need, parts, text } from '../contract/structure.ts';
import type { Key, Structure } from '../contract/structure.ts';
import { isMapping } from '../contract/templates.ts';
import { SHIPPED, readShapes } from '../templates/shipped.ts';

import {
  FORMAT,
  INTERFACE_FILE,
  cardPaths,
  compare,
  integrationOf,
  notes,
  readSurface,
  surface,
} from './interface.ts';
import type { Surface } from './interface.ts';

const INTEGRATION = resolve(import.meta.dirname, '../../custom_components/mnml');

const BASE: Surface = {
  format: FORMAT,
  cards: {
    'custom:mnml-heading-card': {
      icon: 'icon!',
      state: 'parts',
      'state[]<otherwise>': 'marked',
      'state[]<otherwise>.entity': 'entity',
      title: 'text!',
    },
    'custom:mnml-media-card': { entity: 'entity!' },
  },
  templates: {
    room: { key: 'text!', lights: 'object', 'lights.group': 'entity!', 'lights.color': 'flag' },
    nav: {},
  },
  shapes: { meter: 'object', 'meter.power': 'entity', 'meter.today': 'entity' },
  theme: { names: ['MNML'], variables: ['mnml-card-shadow', 'mnml-pill-color'] },
  integration: {
    domain: 'mnml',
    options: ['default_theme', 'glass'],
    commands: ['mnml/templates/save'],
  },
  home: { Room: ['key', 'lights', 'name'] },
};

type Keys = Readonly<Record<string, Key>>;

const CARD = 'custom:mnml-test-card';

const one = (structure: Structure): Surface => ({
  ...BASE,
  cards: { [CARD]: cardPaths(structure) },
});

const changes = (before: Structure, after: Structure) => compare(one(before), one(after));

const keyed = (path: string, kind: string): string =>
  `card \`${CARD}\`, key \`${path}\` (\`${kind}\`)`;

function edited(
  structure: Structure,
  when: string | undefined,
  edit: (keys: Keys) => Keys,
): Structure {
  if (structure.kind === 'plain') {
    return { ...structure, keys: edit(structure.keys) };
  }
  return {
    ...structure,
    variants: structure.variants.map((variant) =>
      variant.when === when ? { ...variant, keys: edit(variant.keys) } : variant,
    ),
  };
}

const without = (keys: Keys, name: string): Keys =>
  Object.fromEntries(Object.entries(keys).filter(([key]) => key !== name));

function keyOf(keys: Keys, name: string): Key {
  const found = keys[name];
  assert.ok(found !== undefined, `no key ${name}`);
  return found;
}

const HEADING = CARD_STRUCTURES['custom:mnml-heading-card'];
const CLIENTS = CARD_STRUCTURES['custom:mnml-clients-card'];

test('interface.json records the public interface as it is', () => {
  const recorded = readSurface(readFileSync(INTERFACE_FILE, 'utf8'));
  assert.ok(
    recorded !== undefined,
    `interface.json is not of format ${FORMAT}: run \`pnpm run fix:interface\` to record it`,
  );
  const { removed, changed, added } = compare(recorded, surface());
  const found = [
    ...removed.map((line) => `removed: ${line}`),
    ...changed.map((line) => `changed: ${line}`),
    ...added.map((line) => `added: ${line}`),
  ];
  assert.ok(
    found.length === 0,
    [
      'The public interface is not what interface.json records:',
      ...found.map((line) => `- ${line}`),
      'Run `pnpm run fix:interface` to record it, and list every removal and rename in the release notes, the annotated tag message, with how to migrate.',
    ].join('\n'),
  );
});

test('the interface holds every card, every shipped template, every slot shape, the theme, the integration and the home', () => {
  const now = surface();
  assert.equal(now.format, FORMAT);
  assert.deepEqual(Object.keys(now.cards), Object.keys(CARD_STRUCTURES).toSorted());
  assert.deepEqual(Object.keys(now.templates), Object.keys(SHIPPED).toSorted());
  assert.deepEqual(
    Object.keys(now.shapes).filter((path) => !path.includes('.')),
    Object.keys(readShapes()).toSorted(),
  );
  assert.equal(now.shapes['meter'], 'object');
  assert.equal(now.shapes['meter.power'], 'entity');
  assert.equal(now.shapes['outlet.entity'], 'entity!');
  assert.equal(now.shapes['outlet.energy.today'], 'entity', 'a field that names a shape, resolved');
  assert.equal(now.shapes['vacuum_popup.consumables.entity'], 'entity!');
  assert.equal(now.templates['room']?.['lights.group'], 'entity!');
  assert.equal(now.templates['room']?.['lights.color'], 'flag');
  assert.deepEqual(now.theme.names, ['MNML']);
  assert.ok(now.theme.variables.includes('mnml-pill-color'));
  assert.ok(now.theme.variables.every((name) => name.startsWith('mnml-')));
  assert.equal(now.integration.domain, 'mnml');
  assert.ok(now.integration.commands.includes('mnml/templates/subscribe'));
  assert.ok(now.integration.commands.every((command) => command.startsWith('mnml/')));
  assert.deepEqual(Object.keys(now.home), [
    'Car',
    'Home',
    'Person',
    'Room',
    'SectionTitles',
    'System',
  ]);
  assert.ok(now.home['Room']?.includes('lights'));
});

test("a card's keys are recorded by path, each with its kind, its required flag, its options and its default", () => {
  const { cards } = surface();
  const entity = cards['custom:mnml-entity-card'];
  assert.equal(entity?.['entity'], 'entity!');
  assert.equal(entity?.['label'], 'flag(device)', 'a flag that writes a value other than true');
  assert.equal(entity?.['controls'], 'parts');
  assert.equal(entity?.['controls[]<indicator>'], 'tagged');
  assert.equal(entity?.['controls[]<indicator>.color'], 'color!');
  assert.equal(entity?.['controls[]<toggle>.when.is'], 'texts');
  assert.equal(entity?.['state[]<attribute>'], 'marked');
  assert.equal(entity?.['state[]<attribute>.icon'], 'flag');
  assert.equal(entity?.['state[]<otherwise>.entity'], 'entity');
  assert.equal(entity?.['items[].controls[]<status>.rules[].color'], 'color!');
  assert.equal(entity?.['type'], undefined, "a card's type is the record's key");
  const header = cards['custom:mnml-header-card'];
  assert.equal(header?.['<name>'], 'marked');
  assert.equal(header?.['<name>.name'], 'text!');
  assert.equal(header?.['<otherwise>.entity'], 'entity!');
  const clients = cards['custom:mnml-clients-card'];
  assert.equal(clients?.['attribute'], 'text = "data"');
  assert.equal(clients?.['fields'], 'part');
  assert.equal(clients?.['fields.name'], 'text');
  assert.equal(clients?.['networks[].subnet'], 'text!');
  assert.equal(cards['custom:mnml-car-plan-card']?.['open_states'], 'texts = ["on","open"]');
  assert.match(
    cards['custom:mnml-popups-card']?.['open.phone'] ?? '',
    /^choice\(sheet\|dialog\|unfold\)$/,
  );
  assert.match(cards['custom:mnml-slider-card']?.['slider'] ?? '', /^choice\(.*\|hue\|.*\)!$/);
});

test("a part's whole kind removed is named, its own entry and each of its keys", () => {
  assert.ok(CONTROL.kind === 'tagged');
  const fewer: Structure = {
    ...CONTROL,
    variants: CONTROL.variants.filter((variant) => variant.when !== 'indicator'),
  };
  const after = edited(HEADING, undefined, (keys) => ({ ...keys, controls: parts(fewer) }));
  assert.deepEqual(changes(HEADING, after), {
    removed: [
      keyed('controls[]<indicator>', 'tagged'),
      keyed('controls[]<indicator>.color', 'color!'),
      keyed('controls[]<indicator>.entity', 'entity!'),
      keyed('controls[]<indicator>.show', 'rule'),
      keyed('controls[]<indicator>.show.attribute', 'text'),
      keyed('controls[]<indicator>.show.entity', 'entity'),
      keyed('controls[]<indicator>.show.is', 'texts'),
      keyed('controls[]<indicator>.show.not', 'texts'),
    ],
    changed: [],
    added: [],
  });
});

test('a key removed from one kind of a part is named, though other kinds keep it', () => {
  const state = edited(STATE_ITEM, 'attribute', (keys) => without(keys, 'icon'));
  const after = edited(HEADING, undefined, (keys) => ({ ...keys, state: parts(state) }));
  assert.deepEqual(changes(HEADING, after), {
    removed: [keyed('state[]<attribute>.icon', 'flag')],
    changed: [],
    added: [],
  });
});

test('a key made required is changed', () => {
  const list = CARD_STRUCTURES['custom:mnml-list-card'];
  const after = edited(list, undefined, (keys) => ({ ...keys, title: need(text()) }));
  assert.deepEqual(changes(list, after), {
    removed: [],
    changed: [`card \`${CARD}\`, key \`title\`: \`text\` to \`text!\``],
    added: [],
  });
});

test("a choice's option removed is changed", () => {
  const slider = CARD_STRUCTURES['custom:mnml-slider-card'];
  assert.ok(slider.kind === 'plain');
  const all = keyOf(slider.keys, 'slider').options ?? [];
  assert.ok(all.includes('hue'));
  const kept = all.filter((option) => option !== 'hue');
  const after = edited(slider, undefined, (keys) => ({
    ...keys,
    slider: { ...keyOf(keys, 'slider'), options: kept },
  }));
  assert.deepEqual(changes(slider, after), {
    removed: [],
    changed: [
      `card \`${CARD}\`, key \`slider\`: \`choice(${all.join('|')})!\` to \`choice(${kept.join('|')})!\``,
    ],
    added: [],
  });
});

test('a part that becomes a list of parts is changed, and its keys move', () => {
  const after = edited(CLIENTS, undefined, (keys) => ({
    ...keys,
    fields: { ...keyOf(keys, 'fields'), kind: 'parts' },
  }));
  assert.deepEqual(changes(CLIENTS, after), {
    removed: [
      keyed('fields.ip_address', 'text'),
      keyed('fields.name', 'text'),
      keyed('fields.type', 'text'),
    ],
    changed: [`card \`${CARD}\`, key \`fields\`: \`part\` to \`parts\``],
    added: [
      keyed('fields[].ip_address', 'text'),
      keyed('fields[].name', 'text'),
      keyed('fields[].type', 'text'),
    ],
  });
});

test('a default that moves is changed', () => {
  const after = edited(CLIENTS, undefined, (keys) => ({ ...keys, attribute: text('items') }));
  assert.deepEqual(changes(CLIENTS, after), {
    removed: [],
    changed: [`card \`${CARD}\`, key \`attribute\`: \`text = "data"\` to \`text = "items"\``],
    added: [],
  });
});

test("the integration's options are the fields of its options form", () => {
  const translations: unknown = JSON.parse(
    readFileSync(resolve(INTEGRATION, 'translations/en.json'), 'utf8'),
  );
  const options = isMapping(translations) ? translations['options'] : undefined;
  const step = isMapping(options) ? options['step'] : undefined;
  const init = isMapping(step) ? step['init'] : undefined;
  const data = isMapping(init) ? init['data'] : undefined;
  assert.ok(isMapping(data));
  assert.deepEqual(surface().integration.options, Object.keys(data).toSorted());
});

test('a websocket command whose type the record cannot read fails the record', () => {
  const constants = readFileSync(resolve(INTEGRATION, 'const.py'), 'utf8');
  const websocket = readFileSync(resolve(INTEGRATION, 'websocket.py'), 'utf8');
  assert.deepEqual(integrationOf(constants, websocket), surface().integration);
  const unread = websocket.replace('f"{DOMAIN}/templates/delete"', '"mnml/templates/delete"');
  assert.notEqual(unread, websocket);
  assert.throws(() => integrationOf(constants, unread), /websocket\.py/);
});

test('two equal records have no changes', () => {
  assert.deepEqual(compare(BASE, structuredClone(BASE)), { removed: [], changed: [], added: [] });
});

test('a removed key, slot, variable, option or command is named, and so is a removed card or template whole', () => {
  const after: Surface = {
    ...BASE,
    cards: { 'custom:mnml-heading-card': { icon: 'icon!', title: 'text!' } },
    templates: { room: { key: 'text!', lights: 'object', 'lights.group': 'entity!' } },
    shapes: { meter: 'object', 'meter.power': 'entity' },
    theme: { names: ['MNML'], variables: ['mnml-card-shadow'] },
    integration: { domain: 'mnml', options: ['glass'], commands: [] },
    home: { Room: ['key', 'name'] },
  };
  assert.deepEqual(compare(BASE, after), {
    removed: [
      'card `custom:mnml-heading-card`, key `state` (`parts`)',
      'card `custom:mnml-heading-card`, key `state[]<otherwise>` (`marked`)',
      'card `custom:mnml-heading-card`, key `state[]<otherwise>.entity` (`entity`)',
      'card `custom:mnml-media-card`',
      'template `room`, slot `lights.color` (`flag`)',
      'template `nav`',
      'shape `meter.today` (`entity`)',
      'theme variable `mnml-pill-color`',
      'integration option `default_theme`',
      'websocket command `mnml/templates/save`',
      'home type `Room`, key `lights`',
    ],
    changed: [],
    added: [],
  });
});

test('a slot or a shape whose kind or required flag moves is changed, neither removed nor added', () => {
  const after: Surface = {
    ...BASE,
    templates: {
      room: { key: 'text', lights: 'objects', 'lights.group': 'entity!', 'lights.color': 'flag' },
      nav: {},
    },
    shapes: { ...BASE.shapes, 'meter.power': 'entity!' },
  };
  assert.deepEqual(compare(BASE, after), {
    removed: [],
    changed: [
      'template `room`, slot `key`: `text!` to `text`',
      'template `room`, slot `lights`: `object` to `objects`',
      'shape `meter.power`: `entity` to `entity!`',
    ],
    added: [],
  });
});

test('an added card, key, slot, name or domain is named', () => {
  const after: Surface = {
    ...BASE,
    cards: { ...BASE.cards, 'custom:mnml-new-card': {} },
    templates: { ...BASE.templates, nav: { popup: 'text!' } },
    shapes: { ...BASE.shapes, plant: 'object', 'plant.moisture': 'entity!' },
    theme: { names: ['MNML', 'MNML Flat'], variables: BASE.theme.variables },
    integration: { ...BASE.integration, domain: 'mnml2' },
  };
  assert.deepEqual(compare(BASE, after), {
    removed: ['integration domain `mnml`'],
    changed: [],
    added: [
      'card `custom:mnml-new-card`',
      'template `nav`, slot `popup` (`text!`)',
      'shape `plant` (`object`)',
      'shape `plant.moisture` (`entity!`)',
      'theme name `MNML Flat`',
      'integration domain `mnml2`',
    ],
  });
});

test('the notes list what was removed, changed and added since a tag, each under its heading', () => {
  const after: Surface = {
    ...BASE,
    cards: {
      'custom:mnml-heading-card': { ...BASE.cards['custom:mnml-heading-card'], when: 'rule' },
    },
    templates: { room: { ...BASE.templates['room'], key: 'text' } },
  };
  assert.equal(
    notes('v0.11.0', JSON.stringify(BASE), after),
    [
      '## Interface changes since v0.11.0',
      '',
      '### Removed',
      '',
      '- card `custom:mnml-media-card`',
      '- template `nav`',
      '',
      '### Changed',
      '',
      '- template `room`, slot `key`: `text!` to `text`',
      '',
      '### Added',
      '',
      '- card `custom:mnml-heading-card`, key `when` (`rule`)',
      '',
    ].join('\n'),
  );
});

test('the notes say when nothing changed, and when the tag records no interface', () => {
  assert.equal(
    notes('v0.11.0', JSON.stringify(BASE), BASE),
    '## Interface changes since v0.11.0\n\nNone: the public interface is as v0.11.0 left it.\n',
  );
  assert.equal(
    notes('v0.10.0', undefined, BASE),
    '## Interface changes since v0.10.0\n\nv0.10.0 records no `interface.json`, so there is nothing to compare.\n',
  );
});

test('a record of an older or unknown format is none to compare with, and the notes say to compare by hand', () => {
  const older = Object.fromEntries(Object.entries(BASE).filter(([key]) => key !== 'format'));
  const later = { ...BASE, format: FORMAT + 1 };
  assert.equal(readSurface(JSON.stringify(older)), undefined);
  assert.equal(readSurface(JSON.stringify(later)), undefined);
  const byHand =
    "## Interface changes since v0.11.0\n\nThe interface record's format changed since v0.11.0, so nothing is listed: compare its `interface.json` with this one by hand.\n";
  assert.equal(notes('v0.11.0', JSON.stringify(older), BASE), byHand);
  assert.equal(notes('v0.11.0', JSON.stringify(later), BASE), byHand);
});

test('a record of the current format but another shape is refused', () => {
  assert.deepEqual(readSurface(JSON.stringify(BASE)), BASE);
  assert.throws(
    () => readSurface(`{"format": ${FORMAT}, "cards": {}}`),
    /no record of the public interface/,
  );
  assert.throws(() => readSurface('[]'), /no record of the public interface/);
  assert.throws(
    () => readSurface(JSON.stringify({ ...BASE, templates: { room: { key: true } } })),
    /no record of the public interface/,
  );
  assert.throws(
    () => readSurface(JSON.stringify({ ...BASE, cards: { heading: ['title'] } })),
    /no record of the public interface/,
  );
  assert.throws(
    () => readSurface(JSON.stringify({ ...BASE, shapes: undefined })),
    /no record of the public interface/,
  );
});
