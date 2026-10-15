import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { homes } from '../templates/corpus.ts';
import { discover } from '../templates/discover.ts';
import { expand } from '../templates/expand.ts';
import { readTemplates } from '../templates/shipped.ts';

import { dashboardOf } from './dashboard.ts';
import { HOME } from './fixture.ts';
import { defaultPlan } from './plan.ts';
import { strategyPlan } from './strategy.ts';

const TEMPLATES = readTemplates();

test('a strategy that chooses nothing makes the quick start plan', () => {
  assert.deepEqual(
    strategyPlan({ type: 'custom:mnml' }, HOME, TEMPLATES),
    defaultPlan(HOME, TEMPLATES),
  );
});

test("each choice the strategy names replaces the quick start's own, the rest found", () => {
  const plan = strategyPlan(
    {
      type: 'custom:mnml',
      title: 'Our flat',
      rooms: [{ area: 'living', slots: { name: 'Lounge' } }],
      people: [],
      glances: {},
      open: { phone: 'dialog' },
      order: ['system', 'rooms'],
    },
    HOME,
    TEMPLATES,
  );
  assert.deepEqual(plan, {
    ...defaultPlan(HOME, TEMPLATES),
    title: 'Our flat',
    rooms: [{ area: 'living', slots: { name: 'Lounge' } }],
    people: [],
    glances: {},
    open: { phone: 'dialog' },
    order: ['system', 'rooms'],
  });
});

test("the strategy takes the pop-ups' idle close and alerts, and refuses a malformed one by name", () => {
  const alerts = [
    { entity: 'lock.front_door', is: ['jammed'], popup: '#hall', screens: ['tablet'] },
  ];
  const plan = strategyPlan({ type: 'custom:mnml', idle_close: 120, alerts }, HOME, TEMPLATES);
  assert.deepEqual(plan, { ...defaultPlan(HOME, TEMPLATES), idle_close: 120, alerts });
  assert.throws(
    () =>
      strategyPlan(
        { type: 'custom:mnml', idle_close: 0, alerts: [{ entity: 'lock.front_door' }] },
        HOME,
        TEMPLATES,
      ),
    /^Error: MNML strategy: idle_close, alerts are not dashboard choices$/,
  );
});

test('the strategy draws no device by default, and the devices it names on their own cards', () => {
  const home = homes()['devices'];
  assert.ok(home);
  assert.equal('devices' in strategyPlan({ type: 'custom:mnml' }, home, TEMPLATES), false);
  const devices = [{ device: 'roborock_s8', template: 'vacuum-card' }];
  const plan = strategyPlan({ type: 'custom:mnml', devices }, home, TEMPLATES);
  assert.deepEqual(plan, { ...defaultPlan(home, TEMPLATES), devices });
  const cards = dashboardOf(plan, home, TEMPLATES).views.flatMap((view) =>
    view.sections.flatMap((section) => section.cards),
  );
  assert.ok(
    cards.some(
      (card) =>
        card.type === 'custom:mnml-template-card' &&
        card.template === 'vacuum-card' &&
        card.device === 'roborock_s8',
    ),
  );
  assert.throws(
    () =>
      strategyPlan({ type: 'custom:mnml', devices: [{ device: 'roborock_s8' }] }, home, TEMPLATES),
    /^Error: MNML strategy: devices is not a dashboard choice$/,
  );
});

test('a key that is not a choice, or a choice that is not well formed, is refused by name', () => {
  assert.throws(
    () => strategyPlan({ type: 'custom:mnml', room: [] }, HOME, TEMPLATES),
    /^Error: MNML strategy: room is not a dashboard choice$/,
  );
  assert.throws(
    () =>
      strategyPlan(
        { type: 'custom:mnml', rooms: 'living', open: { phone: 'drawer' } },
        HOME,
        TEMPLATES,
      ),
    /^Error: MNML strategy: rooms, open are not dashboard choices$/,
  );
});

function nodes(node: Value): Record<string, Value>[] {
  if (Array.isArray(node)) {
    return node.flatMap(nodes);
  }
  return isMapping(node) ? [node, ...Object.values(node).flatMap(nodes)] : [];
}

test('taking control saves the dashboard the strategy made, a plain one whose every card draws', () => {
  const plan = strategyPlan({ type: 'custom:mnml', glances: {} }, HOME, TEMPLATES);
  const saved = JSON.stringify(dashboardOf(plan, HOME, TEMPLATES));
  const kept: Value = JSON.parse(saved);
  assert.ok(nodes(kept).every((node) => !Object.hasOwn(node, 'strategy')));
  const cards = nodes(kept).filter((node) => node['type'] === 'custom:mnml-template-card');
  assert.ok(cards.some((card) => card['template'] === 'glances'));
  for (const card of cards) {
    const name = typeof card['template'] === 'string' ? card['template'] : '';
    const template = TEMPLATES[name];
    const area = typeof card['area'] === 'string' ? card['area'] : undefined;
    const slots = isMapping(card['slots']) ? card['slots'] : undefined;
    assert.ok(template !== undefined, name);
    const found = area === undefined && slots !== undefined ? {} : discover(template, area, HOME);
    assert.equal(
      expand(TEMPLATES, { template: name, slots: slots ?? {} }, found).missing,
      undefined,
    );
  }
});
