import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME, HOUSE } from '../builder/fixture.ts';
import { defaultPlan } from '../builder/plan.ts';
import { MnmlCardNote } from '../cards/parts/card-element.ts';
import type { Plan } from '../contract/plan.ts';
import type { Template } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import type { Registries } from '../ha/registries.ts';
import { homes } from '../templates/corpus.ts';
import { readTemplates } from '../templates/shipped.ts';
import { fakeHass } from '../test/hass.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlLiveCard } from './live-card.ts';
import { MnmlPlanEditor } from './plan-editor.ts';

define('mnml-plan-editor', MnmlPlanEditor);
define('mnml-live-card', MnmlLiveCard);
define('mnml-card-note', MnmlCardNote);

const TEMPLATES = readTemplates();
const HASS = fakeHass(HOME);

async function editor(
  options: { fresh?: boolean; taken?: string[]; plan?: Plan; hass?: HomeAssistant } = {},
): Promise<{
  element: MnmlPlanEditor;
  root: ShadowRoot;
  saved: [Plan, string][];
  sorting: { count: number };
}> {
  const saved: [Plan, string][] = [];
  const sorting = { count: 0 };
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
    sortAreas: () => {
      sorting.count += 1;
    },
  };
  return { element, root: await mounted(element), saved, sorting };
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
  const hass = fakeHass(HOUSE);
  const { element, root, saved, sorting } = await editor({
    plan: defaultPlan(HOUSE, TEMPLATES),
    hass,
  });
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
  const sort = labelled(root, 'Sort them into areas');
  assert.match(
    text(sort.closest('div')?.previousElementSibling),
    /^2 devices are in no area, so no room shows them\.$/,
  );
  sort.click();
  assert.equal(sorting.count, 1);
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
    card: { type: 'custom:mnml-tile-card', entity: '[[lights.group]]', name: '[[name]]' },
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
  const shown = [
    ...(root.querySelector<HTMLSelectElement>('select[aria-label="People template"]')?.options ??
      []),
  ].map((option) => text(option));
  assert.ok(shown.includes('Person'), shown.join(', '));
  assert.equal(shown.includes('person'), false);
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
    'Rooms',
    'People',
    'Devices',
    'Garage',
    'System',
    'Glances',
    'Pop-ups',
  ]);
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].order, ['rooms', 'people', 'devices', 'garage', 'system']);
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
  assert.ok(root.querySelector('input[aria-label="Show Room"]'));
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
    sortAreas: () => undefined,
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

test("a row's tile is drawn but takes no press, focus or key", async () => {
  const { element, root } = await editor();
  const tiles = [...root.querySelectorAll('mnml-live-card')];
  assert.ok(tiles.length > 0);
  assert.ok(tiles.every((tile) => tile.hasAttribute('inert')));
  element.remove();
});

test('the back arrow asks before it drops changes not built, and leaves at once with none', async () => {
  const asked: string[] = [];
  const answers = [false, true];
  const confirm = window.confirm;
  window.confirm = (message?: string): boolean => {
    asked.push(message ?? '');
    return answers.shift() ?? true;
  };
  let left = 0;
  const { element, root } = await editor({ fresh: false });
  element.host = {
    save: () => Promise.resolve(),
    leave: () => (left += 1),
    sortAreas: () => undefined,
  };
  labelled(root, 'Back to the dashboards').click();
  assert.deepEqual([asked.length, left], [0, 1]);
  assert.equal(element.dirty(), false);
  const title = control<HTMLInputElement>(root, 'input.fact-input');
  title.value = 'Flat';
  title.dispatchEvent(new Event('input'));
  await element.updateComplete;
  assert.equal(element.dirty(), true);
  assert.match(text(root), /Not built yet: 1 change\./);
  labelled(root, 'Back to the dashboards').click();
  assert.deepEqual([asked.length, left], [1, 1]);
  labelled(root, 'Back to the dashboards').click();
  assert.deepEqual([asked.length, left], [2, 2]);
  assert.match(asked[0] ?? '', /Leave without building/);
  window.confirm = confirm;
  element.remove();
});

test('the Rooms template lists only the tiles that find something in an area of the home', async () => {
  const { element, root } = await editor();
  const rooms = root.querySelector<HTMLSelectElement>('select[aria-label="Rooms template"]');
  assert.ok(rooms);
  const offered = new Set([...rooms.options].map((option) => option.value));
  assert.ok(offered.has('room'));
  for (const other of ['adguard', 'person', 'car', 'home-assistant']) {
    assert.equal(offered.has(other), false, other);
  }
  element.remove();
});

test("each section's look is labelled, and its icon is Home Assistant's icon picker once the page has it", async () => {
  const { element, root, saved } = await editor();
  const look = root.querySelector('.plan-look');
  assert.match(text(look), /Title.*Icon.*Template/);
  assert.ok(root.querySelector('input[aria-label="Rooms icon"]'));
  customElements.define(
    'ha-icon-picker',
    class extends HTMLElement {
      value = '';
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
  assert.equal(root.querySelector('input[aria-label="Rooms icon"]'), null);
  const picker = root.querySelector<HTMLElement & { value: string }>(
    'ha-icon-picker[aria-label="Rooms icon"]',
  );
  assert.ok(picker);
  picker.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'mdi:sofa' } }));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].sections, { rooms: { icon: 'mdi:sofa' } });
  element.remove();
});

test('pop-ups close after the seconds given, and never once the field is emptied or zero', async () => {
  const { element, root, saved } = await editor();
  const seconds = control<HTMLInputElement>(root, 'input[type="number"]');
  assert.equal(seconds.placeholder, 'Never');
  const typed = async (value: string): Promise<number | undefined> => {
    seconds.value = value;
    seconds.dispatchEvent(new Event('change'));
    await save(element, root);
    return saved.at(-1)?.[0].idle_close;
  };
  assert.equal(await typed('120'), 120);
  assert.equal(await typed('0'), undefined);
  assert.equal(await typed(''), undefined);
  element.remove();
});

test('the tiles are drawn as squares once the switch is on, and as rows once it is off', async () => {
  const { element, root, saved } = await editor();
  const squares = control<HTMLInputElement>(root, 'input[aria-label="Draw the tiles as squares"]');
  assert.equal(squares.checked, false);
  squares.click();
  await save(element, root);
  assert.equal(saved.at(-1)?.[0].squares, true);
  squares.click();
  await save(element, root);
  assert.equal(saved.at(-1)?.[0].squares, undefined);
  element.remove();
});

function devicesHome(): Registries {
  const home = homes()['devices'];
  assert.ok(home);
  return home;
}

function unplaced(home: Registries, device: string): Registries {
  const placed = home.devices[device];
  assert.ok(placed);
  return {
    ...home,
    devices: { ...home.devices, [device]: { ...placed, area_id: null } },
    entities: Object.fromEntries(
      Object.entries(home.entities).map(([id, entry]) => [
        id,
        entry.device_id === device ? { ...entry, area_id: null } : entry,
      ]),
    ),
  };
}

const hassOf = (home: Registries): HomeAssistant => fakeHass(home);

function devicesSection(root: ShadowRoot): Element {
  const found = [...root.querySelectorAll('.plan-section')].find(
    (section) => text(section.querySelector('h2')) === 'Devices',
  );
  assert.ok(found);
  return found;
}

const rowOf = (root: ShadowRoot, name: string): Element | null =>
  labelled(root, `Show ${name}`).closest('.plan-row');

test('the Devices section lists the devices a card stands for by area, marks those their room shows, and ticks one onto the plan', async () => {
  const home = devicesHome();
  const { element, root, saved } = await editor({
    plan: defaultPlan(home, TEMPLATES),
    hass: hassOf(home),
  });
  const section = devicesSection(root);
  assert.deepEqual(
    [...section.querySelectorAll('h3')].map((heading) => text(heading)),
    ['Bedroom', 'Living', 'Office'],
  );
  const boxes = [...section.querySelectorAll<HTMLInputElement>('.plan-row input')];
  assert.deepEqual(
    boxes.map((box) => box.getAttribute('aria-label')),
    [
      'Show Bedroom AC',
      'Show Bedroom heating',
      'Show Living room',
      'Show Living room TV',
      'Show Roborock S8',
      'Show Prusa MK4',
    ],
  );
  assert.ok(boxes.every((box) => !box.checked && !box.disabled));
  assert.match(text(rowOf(root, 'Roborock S8')), /Vacuum.*Its room, Living, shows it\./);
  assert.match(text(rowOf(root, 'Bedroom AC')), /Its room, Bedroom, shows it\./);
  labelled(root, 'Show Roborock S8').dispatchEvent(new Event('change'));
  await element.updateComplete;
  const tile = rowOf(root, 'Roborock S8')?.querySelector<HTMLElement & { config?: unknown }>(
    'mnml-live-card',
  );
  assert.deepEqual(tile?.config, {
    type: 'custom:mnml-template-card',
    template: 'vacuum-card',
    device: 'roborock_s8',
  });
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].devices, [{ device: 'roborock_s8', template: 'vacuum-card' }]);
  element.remove();
});

test('a device in no area is listed last and unmarked, its card is switched among those that fit, and unticked it leaves the plan', async () => {
  const home = unplaced(devicesHome(), 'roborock_s8');
  const plan: Plan = { ...defaultPlan(home, TEMPLATES), rooms: [{ area: 'living' }] };
  const { element, root, saved } = await editor({ plan, hass: hassOf(home), fresh: false });
  const section = devicesSection(root);
  assert.deepEqual(
    [...section.querySelectorAll('h3')].map((heading) => text(heading)),
    ['Bedroom', 'Living', 'Office', 'Not in an area'],
  );
  assert.doesNotMatch(text(rowOf(root, 'Roborock S8')), /shows it/);
  assert.doesNotMatch(text(rowOf(root, 'Bedroom AC')), /shows it/);
  assert.match(text(rowOf(root, 'Living room TV')), /Its room, Living, shows it\./);
  labelled(root, 'Show Prusa MK4').dispatchEvent(new Event('change'));
  await element.updateComplete;
  const picker = control<HTMLSelectElement>(root, 'select[aria-label="Card for Prusa MK4"]');
  assert.deepEqual(
    [...picker.options].map((option) => option.value),
    ['3d-printer-card', 'camera-card'],
  );
  picker.value = 'camera-card';
  picker.dispatchEvent(new Event('change'));
  await element.updateComplete;
  assert.match(text(root), /Not built yet: 1 change\./);
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].devices, [{ device: 'prusa_mk4', template: 'camera-card' }]);
  assert.equal(root.querySelector('select[aria-label="Card for Roborock S8"]'), null);
  labelled(root, 'Show Prusa MK4').dispatchEvent(new Event('change'));
  await save(element, root);
  assert.equal('devices' in (saved[1]?.[0] ?? {}), false);
  element.remove();
});

test('the Devices section says so when no device in the home has a card of its own', async () => {
  const { element, root } = await editor();
  assert.match(text(devicesSection(root)), /No device in this home has a card of its own\./);
  element.remove();
});

const PARTED: Registries = {
  ...HOME,
  entities: {
    ...HOME.entities,
    'sensor.kitchen_temperature': {
      entity_id: 'sensor.kitchen_temperature',
      area_id: 'kitchen',
      platform: 'zha',
    },
  },
  states: {
    ...HOME.states,
    'sensor.kitchen_temperature': {
      attributes: { device_class: 'temperature', friendly_name: 'Kitchen temperature' },
    },
  },
};

test("a room's parts are hidden and shown again by their chips, and a part is swapped for another entity", async () => {
  const office = { slots: { key: 'office', name: 'Office' }, spelled: true } as const;
  const plan: Plan = { ...defaultPlan(PARTED, TEMPLATES), rooms: [{ area: 'living' }, office] };
  const { element, root, saved } = await editor({ plan, hass: fakeHass(PARTED), fresh: false });
  assert.equal(root.querySelector('[aria-label="Parts of Office"]'), null);
  const open = labelled(root, 'Parts of Living');
  assert.equal(open.getAttribute('aria-expanded'), 'false');
  open.click();
  await element.updateComplete;
  assert.equal(open.getAttribute('aria-expanded'), 'true');
  const chips = (): HTMLButtonElement[] => [
    ...control(
      root,
      '[role="group"][aria-label="Parts of Living"]',
    ).querySelectorAll<HTMLButtonElement>('button.chip'),
  ];
  assert.deepEqual(
    chips().map((chip) => [text(chip), chip.getAttribute('aria-pressed')]),
    [
      ['Temperature', 'true'],
      ['Lights', 'true'],
    ],
  );
  chips()[0]?.click();
  await element.updateComplete;
  assert.equal(chips()[0]?.getAttribute('aria-pressed'), 'false');
  assert.equal(root.querySelector('select[aria-label="Swap Temperature"]'), null);
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].rooms, [{ area: 'living', slots: { temperature: null } }, office]);
  chips()[0]?.click();
  await element.updateComplete;
  const swap = control<HTMLSelectElement>(root, 'select[aria-label="Swap Temperature"]');
  assert.deepEqual(
    [...swap.options].map((option) => text(option)),
    ['sensor.living_temperature', 'Kitchen temperature (sensor.kitchen_temperature)'],
  );
  swap.value = 'sensor.kitchen_temperature';
  swap.dispatchEvent(new Event('change'));
  await save(element, root);
  assert.deepEqual(saved[1]?.[0].rooms[0], {
    area: 'living',
    slots: { temperature: 'sensor.kitchen_temperature' },
  });
  const back = control<HTMLSelectElement>(root, 'select[aria-label="Swap Temperature"]');
  back.value = 'sensor.living_temperature';
  back.dispatchEvent(new Event('change'));
  await save(element, root);
  assert.deepEqual(saved[2]?.[0].rooms[0], { area: 'living' });
  element.remove();
});

test('a shown device row gives the same card to another device it fits, which joins the plan', async () => {
  const home = devicesHome();
  const { element, root, saved } = await editor({
    plan: defaultPlan(home, TEMPLATES),
    hass: hassOf(home),
    fresh: false,
  });
  labelled(root, 'Show Bedroom AC').dispatchEvent(new Event('change'));
  labelled(root, 'Show Living room').dispatchEvent(new Event('change'));
  await element.updateComplete;
  assert.equal(
    root.querySelector('select[aria-label="The same card as Bedroom AC, for another device"]'),
    null,
  );
  const same = control<HTMLSelectElement>(
    root,
    'select[aria-label="The same card as Living room, for another device"]',
  );
  assert.deepEqual(
    [...same.options].map((option) => text(option)),
    ['Same for another device', 'Living room TV'],
  );
  same.value = 'apple_tv';
  same.dispatchEvent(new Event('change'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].devices, [
    { device: 'daikin_ac', template: 'ac-item' },
    { device: 'sonos_arc', template: 'media-card' },
    { device: 'apple_tv', template: 'media-card' },
  ]);
  assert.equal(
    root.querySelector('select[aria-label="The same card as Living room, for another device"]'),
    null,
  );
  element.remove();
});
