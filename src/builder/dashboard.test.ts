import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/builder.ts';
import type { CustomCard, TemplateCard } from '../contract/cards.ts';
import type { Dashboard } from '../home/types.ts';
import { discover } from '../templates/discover.ts';
import { expand } from '../templates/expand.ts';
import { readTemplates } from '../templates/shipped.ts';

import { dashboardOf } from './dashboard.ts';
import { HOME } from './fixture.ts';
import { defaultPlan } from './plan.ts';

const TEMPLATES = readTemplates();

const PLAN: Plan = {
  title: 'Our flat',
  icon: 'mdi:home-city',
  rooms: [{ area: 'living', slots: { name: 'Lounge' } }, { area: 'kitchen' }],
  people: [{ entity: 'person.jane' }],
  cars: [],
  system: [],
  open: { desktop: 'unfold' },
};

function sent(plan: Plan): Dashboard {
  const wire = JSON.stringify(dashboardOf(plan, HOME, TEMPLATES));
  return JSON.parse(wire);
}

function cardsOf(plan: Plan): CustomCard[] {
  return sent(plan).views.flatMap((view) => view.sections.flatMap((section) => section.cards));
}

function templateCards(plan: Plan): TemplateCard[] {
  return cardsOf(plan).filter(
    (card): card is TemplateCard => card.type === 'custom:mnml-template-card',
  );
}

test('a plan makes one sections view, a heading and its cards per part, and the pop-ups', () => {
  const dashboard = sent(PLAN);
  assert.equal(dashboard.title, 'Our flat');
  assert.equal(dashboard.views.length, 1);
  const [view] = dashboard.views;
  assert.deepEqual(
    { ...view, sections: undefined },
    {
      title: 'Our flat',
      path: 'home',
      icon: 'mdi:home-city',
      type: 'sections',
      max_columns: 3,
      sections: undefined,
    },
  );
  assert.deepEqual(
    view?.sections.map((section) =>
      section.cards.map((card) => ('template' in card ? card.template : card.type)),
    ),
    [
      ['section-heading', 'room', 'room'],
      ['section-heading', 'person'],
      ['custom:mnml-popups-card'],
    ],
  );
  assert.deepEqual(view?.sections.at(-1)?.cards, [
    { type: 'custom:mnml-popups-card', width: '560px', open: { desktop: 'unfold' } },
  ]);
});

test('a room is its area, discovered live, and its overrides', () => {
  const rooms = templateCards(PLAN).filter((card) => card.template === 'room');
  assert.deepEqual(rooms, [
    {
      type: 'custom:mnml-template-card',
      template: 'room',
      area: 'living',
      slots: { name: 'Lounge' },
    },
    { type: 'custom:mnml-template-card', template: 'room', area: 'kitchen' },
  ]);
});

test("a person's card holds their slots, and the plan's overrides win", () => {
  const [person] = templateCards({
    ...PLAN,
    people: [{ entity: 'person.jane', slots: { batteries: [] } }],
  }).filter((card) => card.template === 'person');
  assert.equal(person?.slots?.['key'], 'jane');
  assert.deepEqual(person?.slots?.['batteries'], []);
  assert.equal(Array.isArray(person?.slots?.['devices']), true);
});

test('a car is its slots and its key', () => {
  const [car] = templateCards({
    ...PLAN,
    cars: [{ key: 'sedan', slots: { metadata: 'sensor.sedan' } }],
  }).filter((card) => card.template === 'car');
  assert.deepEqual(car?.slots, { metadata: 'sensor.sedan', key: 'sedan' });
});

test('a system template without overrides discovers live; with them, it holds what discovery found', () => {
  const cards = templateCards({
    ...PLAN,
    system: [
      { template: 'home-assistant' },
      { template: 'home-assistant', slots: { cpu: 'sensor.cpu' } },
    ],
  }).filter((card) => card.template === 'home-assistant');
  assert.deepEqual(cards[0], { type: 'custom:mnml-template-card', template: 'home-assistant' });
  assert.deepEqual(cards[1]?.slots, {
    ...discover(TEMPLATES['home-assistant'] ?? { card: null }, undefined, HOME),
    cpu: 'sensor.cpu',
  });
});

test('a part with nothing chosen has no section', () => {
  const titles = templateCards({ ...PLAN, people: [] })
    .filter((card) => card.template === 'section-heading')
    .map((card) => card.slots?.['title']);
  assert.deepEqual(titles, ['Rooms']);
});

test('every card of the default plan draws', () => {
  for (const card of templateCards(defaultPlan(HOME, TEMPLATES))) {
    const template = TEMPLATES[card.template];
    assert.notEqual(template, undefined, card.template);
    const found =
      template === undefined || (card.area === undefined && card.slots !== undefined)
        ? {}
        : discover(template, card.area, HOME);
    const expanded = expand(TEMPLATES, { template: card.template, slots: card.slots ?? {} }, found);
    assert.equal(expanded.missing, undefined, card.template);
  }
});

test('a room whose area is gone and a person who is gone are left out', () => {
  const cards = templateCards({
    ...PLAN,
    rooms: [{ area: 'attic' }, { area: 'kitchen' }],
    people: [{ entity: 'person.gone' }, { entity: 'person.jane' }],
  });
  assert.deepEqual(
    cards.filter((card) => card.template === 'room').map((card) => card.area),
    ['kitchen'],
  );
  assert.deepEqual(
    cards.filter((card) => card.template === 'person').map((card) => card.slots?.['entity']),
    ['person.jane'],
  );
});

test("a section's look names its heading and the template of its cards; a plan without looks is as before", () => {
  const plain = sent(PLAN);
  assert.deepEqual(sent({ ...PLAN, sections: {} }), plain);
  const looked = sent({
    ...PLAN,
    sections: {
      rooms: { title: 'Spaces', icon: 'mdi:home-floor-1', template: 'room' },
      people: { title: 'Us' },
    },
  });
  const cards = looked.views.flatMap((view) => view.sections.flatMap((section) => section.cards));
  const headings = cards
    .filter(
      (card): card is TemplateCard => 'template' in card && card.template === 'section-heading',
    )
    .map((card) => [card.slots?.['title'], card.slots?.['icon']]);
  assert.deepEqual(headings, [
    ['Spaces', 'mdi:home-floor-1'],
    ['Us', 'mdi:account-group'],
  ]);
  const own = sent({ ...PLAN, sections: { rooms: { template: 'my-room' } } });
  const rooms = own.views
    .flatMap((view) => view.sections.flatMap((section) => section.cards))
    .filter((card): card is TemplateCard => 'area' in card && card.area !== undefined);
  assert.deepEqual(
    rooms.map((card) => card.template),
    ['my-room', 'my-room'],
  );
});

test('the sections come in the order the plan gives', () => {
  const titles = templateCards({ ...PLAN, order: ['people', 'rooms'] })
    .filter((card) => card.template === 'section-heading')
    .map((card) => card.slots?.['title']);
  assert.deepEqual(titles, ['People', 'Rooms']);
});
