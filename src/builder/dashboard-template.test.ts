import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/plan.ts';
import type { Template } from '../contract/templates.ts';
import { readTemplates } from '../templates/shipped.ts';

import {
  readDashboardTemplate,
  dashboardTemplateOf,
  dashboardTemplateText,
  renamedDashboardTemplate,
} from './dashboard-template.ts';
import { HOME } from './fixture.ts';
import { DEFAULT_DASHBOARD_TEMPLATE, defaultPlan, planFrom } from './plan.ts';

const SHIPPED = readTemplates();
const ROOM = SHIPPED['room'];

function myRoom(): Template {
  assert.ok(ROOM);
  return {
    ...structuredClone(ROOM),
    description: 'My room.',
    popups: [...(ROOM.popups ?? []), { id: 'mine', template: 'my-fragment', slots: {} }],
  };
}

const FRAGMENT: Template = { card: { hash: '#mine', cards: [] } };

test('the shipped dashboard template refilled is the quick start', () => {
  assert.deepEqual(planFrom(DEFAULT_DASHBOARD_TEMPLATE, HOME, SHIPPED), defaultPlan(HOME, SHIPPED));
  assert.equal('sections' in planFrom(DEFAULT_DASHBOARD_TEMPLATE, HOME, SHIPPED), false);
});

test("a dashboard template refilled takes this home's areas and people, its sections' looks, and no car", () => {
  const plan = planFrom(
    {
      title: 'Our flat',
      icon: 'mdi:home-city',
      open: { desktop: 'dialog' },
      sections: {
        rooms: { title: 'Spaces', template: 'room' },
        garage: { title: 'Cars' },
        system: { templates: ['home-assistant'] },
      },
      templates: {},
    },
    HOME,
    SHIPPED,
  );
  assert.deepEqual(plan, {
    title: 'Our flat',
    icon: 'mdi:home-city',
    rooms: [{ area: 'kitchen' }, { area: 'living' }],
    people: [],
    cars: [],
    system: [],
    open: { desktop: 'dialog' },
    sections: { rooms: { title: 'Spaces' }, garage: { title: 'Cars' } },
  });
});

test('a plan written as a dashboard template and refilled gives the same layout, with no area or person in it', () => {
  const plan: Plan = {
    title: 'Home',
    icon: 'mdi:home-variant',
    rooms: [{ area: 'kitchen', slots: { name: 'Cook' } }, { area: 'living' }],
    people: [{ entity: 'person.jane' }],
    cars: [{ key: 'sedan', slots: { metadata: 'sensor.sedan' } }],
    system: [{ template: 'home-assistant' }],
    open: { tablet: 'unfold' },
    sections: { rooms: { title: 'Spaces', template: 'my-room' } },
  };
  const templates = { ...SHIPPED, 'my-room': myRoom(), 'my-fragment': FRAGMENT };
  const dashboardTemplate = dashboardTemplateOf(plan, templates, SHIPPED);
  assert.deepEqual(Object.keys(dashboardTemplate.templates).toSorted(), ['my-fragment', 'my-room']);
  assert.deepEqual(dashboardTemplate.sections, {
    rooms: { title: 'Spaces', template: 'my-room' },
    people: {},
    garage: {},
    system: { templates: ['home-assistant'] },
  });
  const text = dashboardTemplateText(dashboardTemplate);
  const layout = dashboardTemplateText({ ...dashboardTemplate, templates: {} });
  for (const leak of ['kitchen', 'living', 'person.jane', 'sensor.sedan', 'Cook']) {
    assert.equal(layout.includes(leak), false, leak);
  }
  for (const leak of ['person.jane', 'sensor.sedan', 'Cook']) {
    assert.equal(text.includes(leak), false, leak);
  }
  const back = planFrom(readDashboardTemplate(text, SHIPPED), HOME, templates);
  assert.deepEqual(back.rooms, [{ area: 'kitchen' }, { area: 'living' }]);
  assert.deepEqual(back.people, [{ entity: 'person.jane' }, { entity: 'person.bob' }]);
  assert.deepEqual(back.sections, { rooms: { title: 'Spaces', template: 'my-room' } });
});

test('a shipped template the home changed travels with the dashboard template, one left as shipped does not', () => {
  assert.ok(ROOM);
  const changed = { ...structuredClone(ROOM), description: 'Changed here.' };
  const plan = defaultPlan(HOME, SHIPPED);
  assert.deepEqual(Object.keys(dashboardTemplateOf(plan, SHIPPED, SHIPPED).templates), []);
  assert.deepEqual(
    Object.keys(dashboardTemplateOf(plan, { ...SHIPPED, room: changed }, SHIPPED).templates),
    ['room'],
  );
});

test('text that is not a dashboard template is refused with what it is', () => {
  assert.throws(
    () => readDashboardTemplate('views:\n  - title: Home\n', SHIPPED),
    /a dashboard's configuration/,
  );
  assert.throws(
    () => readDashboardTemplate('garden:\n  card:\n    type: custom:mnml-heading-card\n', SHIPPED),
    /a set of templates/,
  );
  assert.throws(() => readDashboardTemplate('hello: world\n', SHIPPED), /no mnml_dashboard:/);
  assert.throws(() => readDashboardTemplate('title: [unclosed\n', SHIPPED), /not YAML/);
  const base = 'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n  open: {}\n';
  assert.throws(
    () =>
      readDashboardTemplate(`${base}  sections:\n    rooms: { template: elsewhere }\n`, SHIPPED),
    /elsewhere is neither shipped nor in the dashboard template/,
  );
  assert.throws(
    () => readDashboardTemplate(`${base}  sections:\n    attic: {}\n`, SHIPPED),
    /attic is not a section/,
  );
  assert.equal(readDashboardTemplate(`${base}  sections:\n    rooms: {}\n`, SHIPPED).title, 'Home');
});

test('a bundled template the store would refuse is refused when the dashboard template is read', () => {
  const base = 'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n  open: {}\n  templates:\n';
  assert.throws(
    () =>
      readDashboardTemplate(`${base}    parts:\n      card:\n        - type: toggle\n`, SHIPPED),
    /parts in the dashboard template is not a template/,
  );
  assert.throws(
    () =>
      readDashboardTemplate(
        `${base}    garden:\n      card: { type: custom:mnml-heading-card }\n      popups: [one]\n`,
        SHIPPED,
      ),
    /garden in the dashboard template is not a template/,
  );
});

test('a bundled change to a shipped fragment keeps its list card', () => {
  const base = 'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n  open: {}\n  templates:\n';
  const dashboardTemplate = readDashboardTemplate(
    `${base}    batteries:\n      card:\n        - type: toggle\n`,
    SHIPPED,
  );
  assert.deepEqual(dashboardTemplate.templates['batteries']?.card, [{ type: 'toggle' }]);
});

test('a bundled template brought in under another name is the name its dashboard template uses', () => {
  const dashboardTemplate = dashboardTemplateOf(
    {
      ...defaultPlan(HOME, SHIPPED),
      sections: { rooms: { template: 'my-room' } },
    },
    { ...SHIPPED, 'my-room': myRoom(), 'my-fragment': FRAGMENT },
    SHIPPED,
  );
  const renamed = renamedDashboardTemplate(dashboardTemplate, {
    'my-room': 'my-room-2',
    'my-fragment': 'my-fragment-2',
  });
  assert.equal(renamed.sections.rooms?.template, 'my-room-2');
  assert.deepEqual(Object.keys(renamed.templates).toSorted(), ['my-fragment-2', 'my-room-2']);
  assert.ok(JSON.stringify(renamed.templates['my-room-2']).includes('"template":"my-fragment-2"'));
});

test('a default section template brought in beside the home one is the name its section uses', () => {
  const dashboardTemplate = { ...DEFAULT_DASHBOARD_TEMPLATE, sections: { rooms: {}, people: {} } };
  const renamed = renamedDashboardTemplate(dashboardTemplate, { room: 'room-2' });
  assert.equal(renamed.sections.rooms?.template, 'room-2');
  assert.equal(renamed.sections.people?.template, undefined);
});

test('a dashboard template is refused when a template it needs, inside another, is nowhere, or a template is no card', () => {
  const base = 'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n  open: {}\n';
  const nested = `${base}  sections:\n    rooms: { template: mine }\n  templates:\n    mine:\n      card: { type: custom:mnml-tile-card }\n      popups: [{ id: a, template: missing-fragment }]\n`;
  assert.throws(
    () => readDashboardTemplate(nested, SHIPPED),
    /missing-fragment is neither shipped nor in the dashboard template/,
  );
  const broken = `${base}  sections:\n    rooms: {}\n  templates:\n    mine: { card: 5 }\n`;
  assert.throws(
    () => readDashboardTemplate(broken, SHIPPED),
    /mine in the dashboard template is not a template/,
  );
});

test('a section left empty in YAML is a section, and a templates export says what it is', () => {
  const base = 'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n  open: {}\n';
  assert.deepEqual(readDashboardTemplate(`${base}  sections:\n    people:\n`, SHIPPED).sections, {
    people: {},
  });
  assert.throws(
    () => readDashboardTemplate('mnml_templates:\n  garden:\n    card: { type: x }\n', SHIPPED),
    /a set of templates/,
  );
});

test("a dashboard template keeps its sections' order, and refills it", () => {
  const plan = {
    ...defaultPlan(HOME, SHIPPED),
    order: ['people', 'rooms', 'garage', 'system'] as const,
  };
  const dashboardTemplate = dashboardTemplateOf(
    { ...plan, order: [...plan.order] },
    SHIPPED,
    SHIPPED,
  );
  assert.deepEqual(dashboardTemplate.order, ['people', 'rooms', 'garage', 'system']);
  const back = planFrom(
    readDashboardTemplate(dashboardTemplateText(dashboardTemplate), SHIPPED),
    HOME,
    SHIPPED,
  );
  assert.deepEqual(back.order, ['people', 'rooms', 'garage', 'system']);
  assert.throws(
    () =>
      readDashboardTemplate(
        'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n  order: [rooms, rooms]\n',
        SHIPPED,
      ),
    /order/,
  );
});

test("a dashboard template keeps whether the Glances strip shows, without the strip's slots, and refills it", () => {
  const plan: Plan = {
    ...defaultPlan(HOME, SHIPPED),
    glances: { slots: { weather: 'weather.home' } },
  };
  const dashboardTemplate = dashboardTemplateOf(plan, SHIPPED, SHIPPED);
  assert.equal(dashboardTemplate.glances, true);
  const back = planFrom(
    readDashboardTemplate(dashboardTemplateText(dashboardTemplate), SHIPPED),
    HOME,
    SHIPPED,
  );
  assert.deepEqual(back.glances, {});
  const plain = dashboardTemplateOf(defaultPlan(HOME, SHIPPED), SHIPPED, SHIPPED);
  assert.equal('glances' in plain, false);
  const read = planFrom(
    readDashboardTemplate(dashboardTemplateText(plain), SHIPPED),
    HOME,
    SHIPPED,
  );
  assert.equal('glances' in read, false);
  const head = 'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n';
  assert.throws(() => readDashboardTemplate(`${head}  glances: yes please\n`, SHIPPED), /Glances/);
});

test('a dashboard template keeps whether the tiles are squares, and refills it', () => {
  const plan: Plan = { ...defaultPlan(HOME, SHIPPED), squares: true };
  const dashboardTemplate = dashboardTemplateOf(plan, SHIPPED, SHIPPED);
  assert.equal(dashboardTemplate.squares, true);
  const back = planFrom(
    readDashboardTemplate(dashboardTemplateText(dashboardTemplate), SHIPPED),
    HOME,
    SHIPPED,
  );
  assert.equal(back.squares, true);
  const plain = dashboardTemplateOf(defaultPlan(HOME, SHIPPED), SHIPPED, SHIPPED);
  assert.equal('squares' in plain, false);
  const read = planFrom(
    readDashboardTemplate(dashboardTemplateText(plain), SHIPPED),
    HOME,
    SHIPPED,
  );
  assert.equal('squares' in read, false);
  const head = 'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n';
  assert.throws(
    () => readDashboardTemplate(`${head}  squares: yes please\n`, SHIPPED),
    /squares is true, for square tiles, or left out/,
  );
});
