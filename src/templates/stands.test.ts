import assert from 'node:assert/strict';

import { test } from 'vitest';

import { problemsOf } from '../contract/required.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import { isMapping } from '../contract/templates.ts';
import type { SlotSpec, Template, Templates, Value } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';

import { homes } from './corpus.ts';
import { discover } from './discover.ts';
import { expand } from './expand.ts';
import { SHIPPED } from './shipped.ts';
import {
  anchorOf,
  cardsFor,
  devicesFor,
  drawsCard,
  suggestionsFor,
  templateIndex,
} from './stands.ts';
import { TEMPLATE_INDEX } from './template-index.ts';

const DEVICES = homes()['devices'];
const TIDY = homes()['tidy'];
const ROOM = SHIPPED['room'];

function roomSlot(name: string): SlotSpec {
  const spec = ROOM?.slots?.[name];
  assert.ok(spec);
  return spec;
}

const KEY: SlotSpec = { kind: 'text', required: true, discover: 'area.id' };
const item = (entity: string) => ({ type: 'custom:mnml-entity-card', entity });

const VACUUM: Template = {
  title: 'Vacuum',
  icon: 'mdi:robot-vacuum',
  slots: {
    key: KEY,
    vacuum: { ...roomSlot('vacuum'), required: true },
    battery: { kind: 'entity', discover: { domain: 'sensor', device_class: 'battery' } },
  },
  card: item('[[vacuum.entity]]'),
};

const TEMPLATES: Templates = {
  ...(ROOM === undefined ? {} : { room: ROOM }),
  'vacuum-card': VACUUM,
  'vacuum-chip': {
    title: 'Vacuum chip',
    slots: { vacuum: { kind: 'entity', required: true, discover: { domain: 'vacuum' } } },
    card: item('[[vacuum]]'),
  },
  'ac-item': {
    title: 'AC item',
    icon: 'mdi:air-conditioner',
    slots: {
      key: KEY,
      entity: {
        kind: 'entity',
        required: true,
        discover: { domain: 'climate', attribute: { hvac_modes: 'cool' } },
      },
    },
    card: item('[[entity]]'),
  },
  'heating-item': {
    title: 'Heating item',
    slots: {
      key: KEY,
      entity: {
        kind: 'entity',
        required: true,
        discover: { domain: 'climate', exclude: { attribute: { hvac_modes: 'cool' } } },
      },
    },
    card: item('[[entity]]'),
  },
  'vacuum-actions': {
    slots: { entity: { kind: 'entity', required: true, discover: { domain: 'vacuum' } } },
    card: { type: 'service', entity: '[[entity]]', service: 'vacuum.start' },
  },
  'by-hand': {
    slots: { entity: { kind: 'entity', required: true } },
    card: item('[[entity]]'),
  },
  'any-climate': {
    slots: {
      entity: { kind: 'entity', required: true, discover: { domain: 'climate', scope: 'all' } },
    },
    card: item('[[entity]]'),
  },
};

const INDEX = templateIndex(TEMPLATES);
const CARD = 'custom:mnml-template-card';

test('only a template whose card has a type of its own is previewed', () => {
  assert.equal(drawsCard(VACUUM), true);
  assert.equal(drawsCard({ card: { type: '[[kind]]' } }), false);
  assert.equal(drawsCard({ card: [{ entity: '[[entity]]' }] }), false);
});

test('a template that draws a control, such as a chip, is a part and has no preview', () => {
  assert.equal(
    drawsCard({ card: { type: 'nav', entity: '[[entity]]', popup: '[[popup]]' } }),
    false,
  );
  assert.equal(drawsCard({ card: { type: 'toggle', entity: '[[entity]]' } }), false);
});

test("a template stands for one device by its first required slot's device anchor or entity rule, and every required slot discovered", () => {
  assert.deepEqual(anchorOf(VACUUM), [{ domain: 'vacuum' }]);
  assert.deepEqual(anchorOf(TEMPLATES['ac-item']), [
    { domain: 'climate', attribute: { hvac_modes: 'cool' } },
  ]);
  assert.equal(anchorOf(ROOM), undefined, 'the room stands for an area');
  assert.equal(anchorOf(TEMPLATES['vacuum-actions']), undefined, 'draws a control, not a card');
  assert.equal(anchorOf(TEMPLATES['by-hand']), undefined, 'nothing to discover it by');
  assert.equal(anchorOf(TEMPLATES['any-climate']), undefined, 'looks at the whole home');
  assert.equal(
    anchorOf({ ...VACUUM, slots: { ...VACUUM.slots, name: { kind: 'text', required: true } } }),
    undefined,
    'a required slot no rule fills',
  );
});

test("the index holds each device template's title, icon, anchor and discovered slots, and the room, as plain data", () => {
  assert.deepEqual(Object.keys(INDEX).toSorted(), [
    'ac-item',
    'heating-item',
    'room',
    'vacuum-card',
    'vacuum-chip',
  ]);
  const vacuum = INDEX['vacuum-card'];
  assert.ok(vacuum);
  assert.equal(vacuum.title, 'Vacuum');
  assert.equal(vacuum.icon, 'mdi:robot-vacuum');
  assert.deepEqual(vacuum.anchor, [{ domain: 'vacuum' }]);
  assert.equal(vacuum.slots['key']?.discover, 'area.id');
  assert.equal(INDEX['heating-item']?.icon, 'mdi:puzzle-outline');
  const room = INDEX['room'];
  assert.equal(room?.anchor, undefined);
  assert.equal(room?.slots['key']?.help, undefined, 'only what discovery reads');
  assert.equal(room?.slots['low'], undefined, 'a slot no rule fills');
});

test("a device's cards are the templates it fills every required slot of, most slots first", () => {
  assert.ok(DEVICES);
  const cards = (device: string) =>
    cardsFor(INDEX, device, DEVICES).map((placed) => placed.template);
  assert.deepEqual(cards('roborock_s8'), ['vacuum-card', 'vacuum-chip']);
  assert.deepEqual(cards('daikin_ac'), ['ac-item']);
  assert.deepEqual(cards('better_thermostat'), ['heating-item']);
  assert.deepEqual(cards('roborock_s8_dock'), [], 'its parent is the vacuum');
  assert.deepEqual(cards('shelly_plug'), []);
  assert.deepEqual(
    devicesFor(INDEX, 'vacuum-card', DEVICES).map((fit) => fit.scope.device),
    ['roborock_s8'],
  );
  assert.deepEqual(
    devicesFor(INDEX, 'heating-item', DEVICES).map((fit) => fit.scope.device),
    ['better_thermostat'],
    'the radiator valve under it holds a hidden climate only',
  );
});

test("an entity suggests its device's cards, labelled with the device's name, then its area's room", () => {
  assert.ok(DEVICES);
  assert.deepEqual(suggestionsFor(INDEX, 'vacuum.roborock_s8', DEVICES), [
    {
      config: { type: CARD, template: 'vacuum-card', device: 'roborock_s8' },
      label: 'Roborock S8: Vacuum',
    },
    {
      config: { type: CARD, template: 'vacuum-chip', device: 'roborock_s8' },
      label: 'Roborock S8: Vacuum chip',
    },
    { config: { type: CARD, template: 'room', area: 'living' }, label: 'Living: Room' },
  ]);
  assert.deepEqual(
    suggestionsFor(INDEX, 'sensor.roborock_s8_battery', DEVICES).map((each) => each.label),
    ['Roborock S8: Vacuum', 'Living: Room'],
    'the chip does not show the battery',
  );
});

test('a climate that cools is offered the AC item, one that only heats the heating item', () => {
  assert.ok(DEVICES);
  const labels = (entity: string) =>
    suggestionsFor(INDEX, entity, DEVICES).map((each) => each.label);
  assert.deepEqual(labels('climate.bedroom_ac'), ['Bedroom AC: AC item', 'Bedroom: Room']);
  assert.deepEqual(labels('climate.bedroom_heating'), [
    'Bedroom heating: Heating item',
    'Bedroom: Room',
  ]);
});

test('an entity no template stands for suggests nothing', () => {
  assert.ok(DEVICES);
  assert.deepEqual(suggestionsFor(INDEX, 'update.kettle_plug_firmware', DEVICES), []);
  assert.deepEqual(suggestionsFor(INDEX, 'light.nowhere', DEVICES), []);
  assert.deepEqual(suggestionsFor({}, 'vacuum.roborock_s8', DEVICES), []);
});

const shipped = (entity: string, registries: Registries): string[] =>
  suggestionsFor(TEMPLATE_INDEX, entity, registries).map((each) => each.label);

const placed = (template: string, registries: Registries): (string | undefined)[] =>
  devicesFor(TEMPLATE_INDEX, template, registries).map((fit) => fit.scope.device);

test("the shipped templates offer a robot vacuum its device's vacuum card first, then its room", () => {
  assert.ok(DEVICES);
  assert.deepEqual(suggestionsFor(TEMPLATE_INDEX, 'vacuum.roborock_s8', DEVICES), [
    {
      config: { type: CARD, template: 'vacuum-card', device: 'roborock_s8' },
      label: 'Roborock S8: Vacuum',
    },
    { config: { type: CARD, template: 'room', area: 'living' }, label: 'Living: Room' },
  ]);
  assert.deepEqual(placed('vacuum-card', DEVICES), ['roborock_s8'], 'the dock is no vacuum');
  assert.deepEqual(shipped('switch.roborock_s8_dock_dust_emptying', DEVICES), ['Living: Room']);
});

test('the shipped templates offer the air conditioner the AC item and the radiator thermostat the heating item, never the other way round', () => {
  assert.ok(DEVICES);
  assert.deepEqual(shipped('climate.bedroom_ac', DEVICES), [
    'Bedroom AC: AC item',
    'Bedroom: Room',
  ]);
  assert.deepEqual(shipped('climate.bedroom_heating', DEVICES), [
    'Bedroom heating: Heating item',
    'Bedroom: Room',
  ]);
  assert.deepEqual(placed('ac-item', DEVICES), ['daikin_ac']);
  assert.deepEqual(placed('heating-item', DEVICES), ['better_thermostat']);
});

test("the shipped templates offer a light, a printer and a player their own device's card", () => {
  assert.ok(DEVICES);
  assert.ok(TIDY);
  assert.deepEqual(shipped('light.floor_lamp', TIDY), ['Floor lamp: Light', 'Living: Room']);
  assert.deepEqual(placed('light-card', TIDY), ['hue_lamp', 'hue_strip']);
  const light = SHIPPED['light-card'];
  assert.ok(light);
  assert.equal(discover(light, 'living', TIDY)['entity'], 'light.living_group', "the area's group");
  assert.equal(discover(light, undefined, TIDY, 'hue_lamp')['entity'], 'light.floor_lamp');
  assert.deepEqual(shipped('sensor.prusa_mk4', DEVICES), ['Prusa MK4: 3D printer', 'Office: Room']);
  assert.deepEqual(shipped('camera.prusa_mk4_preview', DEVICES), [
    'Prusa MK4: 3D printer',
    'Prusa MK4: Camera',
    'Office: Room',
  ]);
  assert.deepEqual(shipped('media_player.living_room_tv', DEVICES), [
    'Living room TV: Media player',
    'Living: Room',
  ]);
});

function customCards(value: Value, found: Record<string, Value>[] = []): Record<string, Value>[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      customCards(item, found);
    }
  } else if (typeof value === 'object' && value !== null) {
    if (typeof value['type'] === 'string' && Object.hasOwn(CARD_STRUCTURES, value['type'])) {
      found.push(value);
    }
    for (const item of Object.values(value)) {
      customCards(item, found);
    }
  }
  return found;
}

test('every suggestion of the shipped templates, expanded with discovery on its device or area, draws cards that fit their structures', () => {
  const drawn = new Set<string>();
  const checked = new Set<string>();
  for (const registries of [DEVICES, TIDY]) {
    assert.ok(registries);
    const configs = new Map(
      Object.keys(registries.entities)
        .flatMap((entity) => suggestionsFor(TEMPLATE_INDEX, entity, registries))
        .map(({ config }) => [JSON.stringify(config), config]),
    );
    for (const config of configs.values()) {
      const template = SHIPPED[config.template];
      assert.ok(template, config.template);
      const found = discover(template, config.area, registries, config.device);
      const expanded = expand(SHIPPED, { template: config.template }, found);
      assert.equal(expanded.missing, undefined);
      for (const card of customCards([expanded.card, ...expanded.popups])) {
        const structure = Object.entries(CARD_STRUCTURES).find(([type]) => type === card['type']);
        assert.ok(structure);
        const [type, spec] = structure;
        assert.deepEqual(problemsOf(spec, card), [], `${config.template}: ${type}`);
        checked.add(type);
      }
      drawn.add(config.template);
    }
  }
  assert.ok(checked.has('custom:mnml-entity-card') && checked.has('custom:mnml-tile-card'));
  assert.deepEqual([...drawn].toSorted(), [
    '3d-printer-card',
    'ac-item',
    'camera-card',
    'cover-card',
    'heating-item',
    'light-card',
    'media-card',
    'room',
    'vacuum-card',
  ]);
});

const hashesOf = (popups: readonly Value[]): (Value | undefined)[] =>
  popups.map((popup) => (isMapping(popup) ? popup['hash'] : undefined));

function popupOf(popups: readonly Value[], hash: string): Record<string, Value> {
  const popup = popups.find((each) => isMapping(each) && each['hash'] === hash);
  assert.ok(isMapping(popup), hash);
  return popup;
}

const DEVICE_CARDS = [
  {
    entity: 'vacuum.roborock_s8',
    template: 'vacuum-card',
    area: 'living',
    hash: '-vacuum',
    key: 'roborock_s8',
    name: 'Roborock S8',
  },
  {
    entity: 'climate.bedroom_ac',
    template: 'ac-item',
    area: 'bedroom',
    hash: '-ac',
    key: 'bedroom_ac',
    name: 'Bedroom AC',
  },
  {
    entity: 'climate.bedroom_heating',
    template: 'heating-item',
    area: 'bedroom',
    hash: '-heating',
    key: 'bedroom_heating',
    name: 'Bedroom heating',
  },
  {
    entity: 'sensor.prusa_mk4',
    template: '3d-printer-card',
    area: 'office',
    hash: '-3d-printer',
    key: 'prusa_mk4',
    name: 'Prusa MK4',
  },
] as const;

test("each device's suggested card, expanded with discovery on its device, brings the pop-up it links to, and only that one", () => {
  assert.ok(DEVICES);
  for (const { entity, template, hash, key } of DEVICE_CARDS) {
    const [suggestion] = suggestionsFor(TEMPLATE_INDEX, entity, DEVICES);
    assert.equal(suggestion?.config.template, template, entity);
    const shipped = SHIPPED[template];
    assert.ok(shipped);
    const found = discover(shipped, undefined, DEVICES, suggestion.config.device);
    const expanded = expand(SHIPPED, { template }, found);
    assert.equal(expanded.missing, undefined);
    assert.ok(isMapping(expanded.card));
    assert.equal(expanded.card['popup'], `#${key}${hash}`, template);
    assert.deepEqual(hashesOf(expanded.popups), [`#${key}${hash}`], template);
  }
});

test("a device's card on its device brings the pop-up the room brings for it in its area, under the device's key and name", () => {
  assert.ok(DEVICES && ROOM);
  for (const { entity, template, area, hash, key, name } of DEVICE_CARDS) {
    const [suggestion] = suggestionsFor(TEMPLATE_INDEX, entity, DEVICES);
    const shipped = SHIPPED[template];
    assert.ok(shipped && suggestion);
    const own: Value[] = expand(
      SHIPPED,
      { template },
      discover(shipped, undefined, DEVICES, suggestion.config.device),
    ).popups;
    const room: Value[] = expand(
      SHIPPED,
      { template: 'room' },
      discover(ROOM, area, DEVICES),
    ).popups;
    const roomName: string | undefined = DEVICES.areas[area]?.name;
    assert.ok(roomName);
    assert.equal(
      JSON.stringify(popupOf(own, `#${key}${hash}`)),
      JSON.stringify(popupOf(room, `#${area}${hash}`))
        .replaceAll(`"#${area}${hash}"`, `"#${key}${hash}"`)
        .replaceAll(`"text":"${roomName}"`, `"text":"${name}"`),
      template,
    );
  }
});

test('the room in an area holding each of these devices brings each of their pop-ups once', () => {
  assert.ok(DEVICES && ROOM);
  for (const area of ['living', 'bedroom', 'office']) {
    const hashes = hashesOf(
      expand(SHIPPED, { template: 'room' }, discover(ROOM, area, DEVICES)).popups,
    );
    assert.deepEqual(
      hashes.filter((hash, at) => hashes.indexOf(hash) !== at),
      [],
      area,
    );
    for (const device of DEVICE_CARDS.filter((each) => each.area === area)) {
      assert.ok(hashes.includes(`#${area}${device.hash}`), `${area}${device.hash}`);
    }
  }
});
