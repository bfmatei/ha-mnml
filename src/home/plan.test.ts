import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DEMO } from '../../demo/home.ts';
import { dashboardOf } from '../builder/dashboard.ts';
import { HOME } from '../builder/fixture.ts';
import { isPlan } from '../contract/builder.ts';
import { SHIPPED } from '../templates/shipped.ts';

import { homePlan } from './plan.ts';
import { build } from './view.ts';

test("a home's plan is one the builder keeps, every choice spelled", () => {
  const plan = homePlan(DEMO);
  assert.equal(isPlan(plan), true);
  assert.equal(plan.glances?.spelled, true);
  assert.ok(plan.rooms.length > 0 && plan.rooms.every((room) => room.spelled === true));
  assert.ok(plan.people.length > 0 && plan.people.every((person) => person.spelled === true));
  assert.ok(plan.system.length > 0 && plan.system.every((choice) => choice.spelled === true));
  assert.deepEqual(
    plan.cars.map((car) => car.key),
    DEMO.cars.map((car) => car.key),
  );
});

test("nothing is discovered: a home's dashboard is the same whatever the registries hold", () => {
  assert.equal(
    JSON.stringify(dashboardOf(homePlan(DEMO), HOME, SHIPPED)),
    JSON.stringify(build(DEMO)),
  );
});

test("a home's section titles are its plan's section looks, and its pop-ups open as it says", () => {
  const plan = homePlan(DEMO);
  assert.deepEqual(plan.sections, {
    rooms: { title: DEMO.sections.rooms },
    people: { title: DEMO.sections.people },
    garage: { title: DEMO.sections.garage },
    system: { title: DEMO.sections.system },
  });
  assert.deepEqual(plan.open, DEMO.popupOpen ?? {});
});

test("a home's order is its plan's", () => {
  assert.equal('order' in homePlan(DEMO), false);
  const ordered = homePlan({ ...DEMO, order: ['system', 'rooms', 'people', 'garage'] });
  assert.deepEqual(ordered.order, ['system', 'rooms', 'people', 'garage']);
  assert.equal(isPlan(ordered), true);
});
