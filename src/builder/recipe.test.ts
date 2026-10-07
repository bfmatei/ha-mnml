import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Plan } from '../contract/builder.ts';
import type { Template } from '../contract/templates.ts';
import { readTemplates } from '../templates/shipped.ts';

import { HOME } from './fixture.ts';
import { DEFAULT_RECIPE, defaultPlan, planFrom } from './plan.ts';
import { readRecipe, recipeOf, recipeText, renamedRecipe } from './recipe.ts';

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

test('the shipped recipe refilled is the quick start', () => {
  assert.deepEqual(planFrom(DEFAULT_RECIPE, HOME, SHIPPED), defaultPlan(HOME, SHIPPED));
  assert.equal('sections' in planFrom(DEFAULT_RECIPE, HOME, SHIPPED), false);
});

test("a recipe refilled takes this home's areas and people, its sections' looks, and no car", () => {
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

test('a plan written as a recipe and refilled gives the same layout, with no area or person in it', () => {
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
  const recipe = recipeOf(plan, templates, SHIPPED);
  assert.deepEqual(Object.keys(recipe.templates).toSorted(), ['my-fragment', 'my-room']);
  assert.deepEqual(recipe.sections, {
    rooms: { title: 'Spaces', template: 'my-room' },
    people: {},
    garage: {},
    system: { templates: ['home-assistant'] },
  });
  const text = recipeText(recipe);
  const layout = recipeText({ ...recipe, templates: {} });
  for (const leak of ['kitchen', 'living', 'person.jane', 'sensor.sedan', 'Cook']) {
    assert.equal(layout.includes(leak), false, leak);
  }
  for (const leak of ['person.jane', 'sensor.sedan', 'Cook']) {
    assert.equal(text.includes(leak), false, leak);
  }
  const back = planFrom(readRecipe(text, SHIPPED), HOME, templates);
  assert.deepEqual(back.rooms, [{ area: 'kitchen' }, { area: 'living' }]);
  assert.deepEqual(back.people, [{ entity: 'person.jane' }, { entity: 'person.bob' }]);
  assert.deepEqual(back.sections, { rooms: { title: 'Spaces', template: 'my-room' } });
});

test('a shipped template the home changed travels with the recipe, one left as shipped does not', () => {
  assert.ok(ROOM);
  const changed = { ...structuredClone(ROOM), description: 'Changed here.' };
  const plan = defaultPlan(HOME, SHIPPED);
  assert.deepEqual(Object.keys(recipeOf(plan, SHIPPED, SHIPPED).templates), []);
  assert.deepEqual(Object.keys(recipeOf(plan, { ...SHIPPED, room: changed }, SHIPPED).templates), [
    'room',
  ]);
});

test('text that is not a dashboard template is refused with what it is', () => {
  assert.throws(
    () => readRecipe('views:\n  - title: Home\n', SHIPPED),
    /a dashboard's configuration/,
  );
  assert.throws(
    () => readRecipe('garden:\n  card:\n    type: custom:mnml-heading-card\n', SHIPPED),
    /a set of templates/,
  );
  assert.throws(() => readRecipe('hello: world\n', SHIPPED), /no mnml_dashboard:/);
  assert.throws(() => readRecipe('title: [unclosed\n', SHIPPED), /not YAML/);
  const base = 'mnml_dashboard:\n  title: Home\n  icon: mdi:home\n  open: {}\n';
  assert.throws(
    () => readRecipe(`${base}  sections:\n    rooms: { template: elsewhere }\n`, SHIPPED),
    /elsewhere is neither shipped nor in the dashboard template/,
  );
  assert.throws(
    () => readRecipe(`${base}  sections:\n    attic: {}\n`, SHIPPED),
    /attic is not a section/,
  );
  assert.equal(readRecipe(`${base}  sections:\n    rooms: {}\n`, SHIPPED).title, 'Home');
});

test('a bundled template brought in under another name is the name its recipe uses', () => {
  const recipe = recipeOf(
    {
      ...defaultPlan(HOME, SHIPPED),
      sections: { rooms: { template: 'my-room' } },
    },
    { ...SHIPPED, 'my-room': myRoom(), 'my-fragment': FRAGMENT },
    SHIPPED,
  );
  const renamed = renamedRecipe(recipe, { 'my-room': 'my-room-2', 'my-fragment': 'my-fragment-2' });
  assert.equal(renamed.sections.rooms?.template, 'my-room-2');
  assert.deepEqual(Object.keys(renamed.templates).toSorted(), ['my-fragment-2', 'my-room-2']);
  assert.ok(JSON.stringify(renamed.templates['my-room-2']).includes('"template":"my-fragment-2"'));
});
