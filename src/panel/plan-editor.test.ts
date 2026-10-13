import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME, HOUSE } from '../builder/fixture.ts';
import { defaultPlan } from '../builder/plan.ts';
import type { Plan } from '../contract/builder.ts';
import type { Template } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { readTemplates } from '../templates/shipped.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlLiveCard } from './live-card.ts';
import { MnmlPlanEditor } from './plan-editor.ts';

define('mnml-plan-editor', MnmlPlanEditor);
define('mnml-live-card', MnmlLiveCard);

const TEMPLATES = readTemplates();
const HASS = { ...HOME, locale: { language: 'en' } } as never as HomeAssistant;

async function editor(
  options: { fresh?: boolean; taken?: string[]; plan?: Plan; hass?: HomeAssistant } = {},
): Promise<{ element: MnmlPlanEditor; root: ShadowRoot; saved: [Plan, string][] }> {
  const saved: [Plan, string][] = [];
  const element = new MnmlPlanEditor();
  element.hass = options.hass ?? HASS;
  element.templates = TEMPLATES;
  element.plan = options.plan ?? defaultPlan(HOME, TEMPLATES);
  element.address = 'dashboard-home';
  element.fresh = options.fresh ?? true;
  element.taken = new Set(options.taken ?? []);
  element.host = {
    save: (plan, address) => {
      saved.push([plan, address]);
      return Promise.resolve();
    },
    leave: () => undefined,
  };
  return { element, root: await mounted(element), saved };
}

function control<T extends Element>(root: ShadowRoot, selector: string): T {
  const found = root.querySelector<T>(selector);
  assert.ok(found, selector);
  return found;
}

function labelled(root: ShadowRoot, label: string): HTMLInputElement | HTMLButtonElement {
  const found = [
    ...root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'),
  ].find((each) => each.getAttribute('aria-label') === label || text(each) === label);
  assert.ok(found, label);
  return found;
}

async function save(element: MnmlPlanEditor, root: ShadowRoot): Promise<void> {
  labelled(root, element.fresh ? 'Create' : 'Rebuild').click();
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}

test("a row's preview holds only the slots its template declares, a retired one left out", async () => {
  const plan = defaultPlan(HOME, TEMPLATES);
  const [first] = plan.people;
  assert.ok(first);
  const people = [
    { ...first, slots: { activities: ['sensor.phone_activity'] } },
    ...plan.people.slice(1),
  ];
  const { root } = await editor({ plan: { ...plan, people } });
  const tiles = [
    ...root.querySelectorAll<HTMLElement & { config?: Record<string, unknown> }>('mnml-live-card'),
  ];
  const configs = tiles.map((tile) => JSON.stringify(tile.config ?? {}));
  assert.ok(configs.some((config) => config.includes('"template":"person"')));
  assert.ok(configs.every((config) => !config.includes('activities')));
});

test('an area with no light offers no room, and one ticked comes last', async () => {
  const plan: Plan = { ...defaultPlan(HOME, TEMPLATES), rooms: [{ area: 'living' }] };
  const { element, root, saved } = await editor({ plan });
  const hallway = labelled(root, 'Show Hallway');
  assert.ok(hallway instanceof HTMLInputElement);
  assert.equal(hallway.disabled, true);
  assert.match(
    text(hallway.closest('.plan-row')),
    /Nothing in this area: its devices are in no area or elsewhere\./,
  );
  assert.doesNotMatch(text(root), /no area, so/);
  labelled(root, 'Show Kitchen').dispatchEvent(new Event('change'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].rooms, [{ area: 'living' }, { area: 'kitchen' }]);
  element.remove();
});

test('an area of phones or of system devices is unticked, says why, and can still be ticked', async () => {
  const hass = { ...HOUSE, locale: { language: 'en' } } as never as HomeAssistant;
  const { element, root, saved } = await editor({ plan: defaultPlan(HOUSE, TEMPLATES), hass });
  const row = (name: string): { box: HTMLInputElement; words: string } => {
    const box = labelled(root, `Show ${name}`);
    assert.ok(box instanceof HTMLInputElement);
    return { box, words: text(box.closest('.plan-row')) };
  };
  assert.equal(row('Living').box.checked, true);
  assert.equal(row('Jane').box.checked, false);
  assert.equal(row('Jane').box.disabled, false);
  assert.match(row('Jane').words, /Only phones and trackers\./);
  assert.equal(row('Infrastructure').box.checked, false);
  assert.equal(row('Infrastructure').box.disabled, false);
  assert.match(row('Infrastructure').words, /Only system devices\./);
  assert.equal(row('Attic').box.disabled, true);
  assert.match(
    row('Attic').words,
    /Nothing in this area: its devices are in no area or elsewhere\./,
  );
  const placing = control<HTMLAnchorElement>(root, 'a[href="/config/devices/dashboard"]');
  assert.match(
    text(placing.closest('p')),
    /^2 devices have no area, so no room shows them\. Give them an area in Home Assistant$/,
  );
  row('Jane').box.dispatchEvent(new Event('change'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].rooms, [{ area: 'living' }, { area: 'jane' }]);
  element.remove();
});

test('rooms move up and down, and the plan keeps the order', async () => {
  const { element, root, saved } = await editor();
  const kitchen = root.querySelector<HTMLButtonElement>('[aria-label="Move Kitchen down"]');
  const living = root.querySelector<HTMLButtonElement>('[aria-label="Move Living down"]');
  assert.ok(kitchen && living);
  assert.equal(living.disabled, true);
  kitchen.click();
  await element.updateComplete;
  assert.equal(root.activeElement?.getAttribute('aria-label'), 'Move Kitchen up');
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].rooms, [{ area: 'living' }, { area: 'kitchen' }]);
  element.remove();
});

test('a person unticked and a pop-up opening chosen reach the saved plan, with the address', async () => {
  const { element, root, saved } = await editor();
  labelled(root, 'Show person.bob').dispatchEvent(new Event('change'));
  const phone = [...root.querySelectorAll('select')].find((each) =>
    text(each.closest('label')).startsWith('On a phone'),
  );
  assert.ok(phone);
  phone.value = 'unfold';
  phone.dispatchEvent(new Event('change'));
  await element.updateComplete;
  await save(element, root);
  const [plan, address] = saved[0] ?? [];
  assert.deepEqual(plan?.people, [{ entity: 'person.jane' }]);
  assert.deepEqual(plan?.open, { phone: 'unfold', tablet: 'unfold', desktop: 'unfold' });
  assert.equal(address, 'dashboard-home');
  element.remove();
});

test('an address without a hyphen, or taken, is refused before anything is saved', async () => {
  const { element, root, saved } = await editor({ taken: ['dashboard-flat'] });
  const inputs = [...root.querySelectorAll<HTMLInputElement>('input.fact-input')];
  const address = inputs[2];
  assert.ok(address);
  address.value = 'home';
  address.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.match(text(control(root, '.problem-line')), /at least one -/);
  address.value = 'dashboard-flat';
  address.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.match(text(control(root, '.problem-line')), /\/dashboard-flat is taken/);
  assert.deepEqual(saved, []);
  element.remove();
});

test('an icon that is not mdi: and a name is refused, and a title is trimmed', async () => {
  const { element, root, saved } = await editor();
  const [title, iconInput] = [...root.querySelectorAll<HTMLInputElement>('input.fact-input')];
  assert.ok(title && iconInput);
  iconInput.value = 'home';
  iconInput.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.match(text(control(root, '.problem-line')), /An icon is mdi:/);
  iconInput.value = 'mdi:home-city';
  iconInput.dispatchEvent(new Event('input'));
  title.value = '  Our flat  ';
  title.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.equal(saved[0]?.[0].title, 'Our flat');
  assert.equal(saved[0]?.[0].icon, 'mdi:home-city');
  element.remove();
});

test('a dashboard MNML built is rebuilt at its own address, which is not asked', async () => {
  const { element, root, saved } = await editor({ fresh: false });
  assert.equal(root.querySelector('.plan-section')?.querySelectorAll('input.fact-input').length, 2);
  await save(element, root);
  assert.equal(saved[0]?.[1], 'dashboard-home');
  element.remove();
});

test('a room unticked leaves every box showing what is chosen', async () => {
  const { element, root } = await editor();
  const kitchen = labelled(root, 'Show Kitchen');
  assert.ok(kitchen instanceof HTMLInputElement);
  kitchen.checked = false;
  kitchen.dispatchEvent(new Event('change'));
  await element.updateComplete;
  const living = labelled(root, 'Show Living');
  const unticked = labelled(root, 'Show Kitchen');
  assert.ok(living instanceof HTMLInputElement && unticked instanceof HTMLInputElement);
  assert.equal(living.checked, true);
  assert.equal(unticked.checked, false);
  unticked.checked = true;
  unticked.dispatchEvent(new Event('change'));
  await element.updateComplete;
  const hallway = labelled(root, 'Show Hallway');
  assert.ok(hallway instanceof HTMLInputElement);
  assert.equal(hallway.checked, false);
  element.remove();
});

test('an address Home Assistant would refuse, with _ or longer than 64, is refused', async () => {
  const { element, root, saved } = await editor();
  const address = [...root.querySelectorAll<HTMLInputElement>('input.fact-input')][2];
  assert.ok(address);
  const refused = async (wrong: string): Promise<void> => {
    address.value = wrong;
    address.dispatchEvent(new Event('input'));
    await save(element, root);
    assert.match(text(control(root, '.problem-line')), /lower case letters and digits/);
  };
  await refused('my_home-x');
  await refused(`dashboard-${'x'.repeat(60)}`);
  assert.deepEqual(saved, []);
  element.remove();
});

test('each section takes a title, an icon and a template, and its rows follow the template', async () => {
  const room = TEMPLATES['room'];
  assert.ok(room);
  const { element, root, saved } = await editor();
  element.templates = { ...TEMPLATES, 'my-room': structuredClone(room) };
  await element.updateComplete;
  const title = root.querySelector<HTMLInputElement>('input[aria-label="Rooms title"]');
  const chosen = root.querySelector<HTMLSelectElement>('select[aria-label="Rooms template"]');
  assert.ok(title && chosen);
  assert.ok([...chosen.options].some((option) => option.value === 'my-room'));
  assert.equal(
    [...chosen.options].some((option) => option.value === 'light-card'),
    false,
  );
  title.value = 'Spaces';
  title.dispatchEvent(new Event('input'));
  chosen.value = 'my-room';
  chosen.dispatchEvent(new Event('change'));
  await element.updateComplete;
  const tile = [...root.querySelectorAll('mnml-live-card')].find(
    (card) => Reflect.get(Reflect.get(card, 'config') ?? {}, 'area') === 'kitchen',
  );
  assert.equal(Reflect.get(Reflect.get(tile ?? {}, 'config') ?? {}, 'template'), 'my-room');
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].sections, { rooms: { title: 'Spaces', template: 'my-room' } });
  element.remove();
});

test("a section's title keeps what is typed, and is trimmed when saved", async () => {
  const { element, root, saved } = await editor();
  const title = root.querySelector<HTMLInputElement>('input[aria-label="Rooms title"]');
  assert.ok(title);
  title.value = 'Living ';
  title.dispatchEvent(new Event('input'));
  await element.updateComplete;
  assert.equal(title.value, 'Living ');
  title.value = 'Living room ';
  title.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].sections, { rooms: { title: 'Living room' } });
  title.value = '   ';
  title.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.equal(saved[1]?.[0].sections, undefined);
  element.remove();
});

test("a section's icon keeps what is typed when Home Assistant's states change, and is saved once it is an icon", async () => {
  const { element, root, saved } = await editor();
  const input = root.querySelector<HTMLInputElement>('input[aria-label="Rooms icon"]');
  assert.ok(input);
  input.value = 'mdi:sof';
  input.dispatchEvent(new Event('input'));
  element.hass = { ...HASS };
  await element.updateComplete;
  assert.equal(input.value, 'mdi:sof');
  input.value = 'mdi:sofa';
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].sections, { rooms: { icon: 'mdi:sofa' } });
  element.remove();
});

test("a section offers the templates that take its rows' slots, and a new one drops the slots it lacks", async () => {
  const room = TEMPLATES['room'];
  assert.ok(room);
  const tiny = {
    description: 'A small room.',
    slots: {
      key: { kind: 'text', required: true, discover: 'area.id' },
      name: { kind: 'text', required: true, discover: 'area.name' },
      lights: room.slots?.['lights'] ?? { kind: 'object' },
    },
    card: room.card,
  } satisfies Template;
  const plan: Plan = {
    ...defaultPlan(HOME, TEMPLATES),
    rooms: [{ area: 'kitchen', slots: { name: 'Cook', temperature: 'sensor.x' } }],
  };
  const { element, root, saved } = await editor({ plan });
  element.templates = { ...TEMPLATES, tiny };
  await element.updateComplete;
  const options = (label: string): string[] =>
    [
      ...(root.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)?.options ?? []),
    ].map((option) => option.value);
  assert.ok(options('People template').includes('person'));
  assert.equal(options('People template').includes('room'), false);
  assert.ok(options('Garage template').includes('car'));
  assert.equal(options('Garage template').includes('section-heading'), false);
  const rooms = root.querySelector<HTMLSelectElement>('select[aria-label="Rooms template"]');
  assert.ok(rooms);
  rooms.value = 'tiny';
  rooms.dispatchEvent(new Event('change'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].rooms, [{ area: 'kitchen', slots: { name: 'Cook' } }]);
  element.remove();
});

const press = (root: ShadowRoot, label: string): void => {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  assert.ok(button, label);
  button.click();
};

test('the sections move up and down, and the page and the plan follow', async () => {
  const { element, root, saved } = await editor();
  press(root, 'Move the People section up');
  await element.updateComplete;
  const headings = [...root.querySelectorAll('.plan-section h2')].map((heading) => text(heading));
  assert.deepEqual(headings, [
    'Dashboard',
    'People',
    'Rooms',
    'Garage',
    'System',
    'Glances',
    'Pop-ups',
  ]);
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].order, ['people', 'rooms', 'garage', 'system']);
  press(root, 'Move the People section down');
  await save(element, root);
  assert.equal('order' in (saved[1]?.[0] ?? {}), false);
  element.remove();
});

test('a section moved clears the problem line and keeps the focus on its button', async () => {
  const { element, root } = await editor({ taken: ['dashboard-home'] });
  await save(element, root);
  assert.match(text(control(root, '.problem-line')), /is taken/);
  const down = labelled(root, 'Move the People section down');
  down.focus();
  down.click();
  await element.updateComplete;
  assert.equal(root.querySelector('.problem-line'), null);
  assert.equal(root.activeElement?.getAttribute('aria-label'), 'Move the People section down');
  labelled(root, 'Move the People section down').click();
  await element.updateComplete;
  const up = labelled(root, 'Move the People section up');
  assert.equal(root.activeElement, up);
  element.remove();
});

test('people, cars and system cards move within their sections', async () => {
  const plan: Plan = {
    ...defaultPlan(HOME, TEMPLATES),
    cars: [
      { key: 'sedan', slots: {} },
      { key: 'suv', slots: {} },
    ],
    system: [{ template: 'home-assistant' }, { template: 'adguard' }],
  };
  const { element, root, saved } = await editor({ plan });
  press(root, 'Move person.bob up');
  press(root, 'Move suv up');
  press(root, 'Move AdGuard Home up');
  await save(element, root);
  const [kept] = saved[0] ?? [];
  assert.deepEqual(kept?.people, [{ entity: 'person.bob' }, { entity: 'person.jane' }]);
  assert.deepEqual(
    kept?.cars.map((car) => car.key),
    ['suv', 'sedan'],
  );
  assert.deepEqual(kept?.system, [{ template: 'adguard' }, { template: 'home-assistant' }]);
  element.remove();
});

test('a system card outside the five is listed, and kept when another changes', async () => {
  const plan: Plan = { ...defaultPlan(HOME, TEMPLATES), system: [{ template: 'room' }] };
  const { element, root, saved } = await editor({ plan });
  assert.ok(root.querySelector('input[aria-label="Show room"]'));
  const title = root.querySelector<HTMLInputElement>('input[aria-label="System title"]');
  assert.ok(title);
  title.value = 'Servers';
  title.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].system, [{ template: 'room' }]);
  element.remove();
});

test('the plan read again for the same dashboard keeps the edits, and another dashboard opens on its own plan', async () => {
  const { element, root } = await editor({ fresh: false });
  const title = (): HTMLInputElement => {
    const found = root.querySelector<HTMLInputElement>('input.fact-input');
    assert.ok(found);
    return found;
  };
  title().value = 'Our flat';
  title().dispatchEvent(new Event('input'));
  await element.updateComplete;
  assert.ok(element.plan);
  element.plan = structuredClone(element.plan);
  await element.updateComplete;
  assert.equal(title().value, 'Our flat');
  element.plan = { ...element.plan, title: 'Cabin' };
  element.address = 'dashboard-cabin';
  await element.updateComplete;
  assert.equal(title().value, 'Cabin');
  element.remove();
});

test("a save Home Assistant refuses says Home Assistant's reason", async () => {
  const { element, root } = await editor();
  element.host = {
    save: () => Promise.reject({ code: 'invalid_format', message: 'expected a dictionary' }),
    leave: () => undefined,
  };
  await save(element, root);
  assert.equal(text(control(root, '.problem-line')), 'expected a dictionary');
  element.remove();
});

test('the Glances strip is shown or not, and the plan follows', async () => {
  const { element, root, saved } = await editor();
  const strip = labelled(root, 'Show the Glances strip');
  assert.ok(strip instanceof HTMLInputElement);
  assert.equal(strip.checked, false);
  strip.dispatchEvent(new Event('change'));
  await element.updateComplete;
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].glances, {});
  labelled(root, 'Show the Glances strip').dispatchEvent(new Event('change'));
  await element.updateComplete;
  await save(element, root);
  assert.equal('glances' in (saved[1]?.[0] ?? {}), false);
  element.remove();
});

test('a spelled room is listed by its name and kept, and unticked it goes', async () => {
  const office = { slots: { key: 'office', name: 'Office' }, spelled: true } as const;
  const plan: Plan = { ...defaultPlan(HOME, TEMPLATES), rooms: [office, { area: 'living' }] };
  const { element, root, saved } = await editor({ plan });
  assert.ok(labelled(root, 'Show Office'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].rooms, [office, { area: 'living' }]);
  labelled(root, 'Show Office').dispatchEvent(new Event('change'));
  await element.updateComplete;
  await save(element, root);
  assert.deepEqual(saved[1]?.[0].rooms, [{ area: 'living' }]);
  element.remove();
});
