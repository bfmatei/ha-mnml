import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fakeStore } from '../test/fake-hass.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlRowMenu } from './row-menu.ts';
import { MnmlTemplateCardEditor } from './template-card.ts';
import { MnmlWords } from './words.ts';

class FakeForm extends HTMLElement {
  hass: unknown;
  data: Record<string, unknown> = {};
  schema: readonly { name: string }[] = [];
  computeHelper: ((item: { name: string }) => string | undefined) | undefined;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(document.createElement('input'));
  }
}

define('ha-form', FakeForm);
define('mnml-row-menu', MnmlRowMenu);
define('mnml-words', MnmlWords);
define('mnml-template-card-editor', MnmlTemplateCardEditor);

type Shown = (entries: { isIntersecting: boolean; target: Element }[]) => void;

const observed: Element[] = [];
const disconnected = { count: 0 };
let shown: Shown | undefined;
Object.assign(globalThis, {
  IntersectionObserver: class {
    constructor(callback: Shown) {
      shown = callback;
    }
    observe(target: Element): void {
      observed.push(target);
    }
    unobserve(): void {}
    disconnect(): void {
      disconnected.count += 1;
    }
  },
});
const built: Record<string, unknown>[] = [];
const cards: HTMLElement[] = [];
window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement(config: object): HTMLElement {
      built.push({ ...config });
      const card = document.createElement('div');
      cards.push(card);
      return card;
    },
  });

const settle = async (rounds = 6): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  if (rounds > 1) {
    await settle(rounds - 1);
  }
};

function everything(root: ParentNode): Element[] {
  const out: Element[] = [];
  for (const element of root.querySelectorAll('*')) {
    out.push(element);
    if (element.shadowRoot !== null) {
      out.push(...everything(element.shadowRoot));
    }
  }
  return out;
}

const labelled = (root: ParentNode, label: string): HTMLElement | undefined =>
  everything(root).find(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.getAttribute('aria-label') === label,
  );

async function click(node: HTMLElement | undefined): Promise<void> {
  assert.ok(node, 'there is something to click');
  node.click();
  await settle();
}

const forms = (root: ParentNode): FakeForm[] =>
  everything(root).filter((node): node is FakeForm => node instanceof FakeForm);

const formWith = (root: ParentNode, name: string): FakeForm | undefined =>
  forms(root).find((form) => form.schema.some((item) => item.name === name));

async function fire(form: FakeForm | undefined, value: Record<string, unknown>): Promise<void> {
  assert.ok(form, 'there is a form');
  form.dispatchEvent(new CustomEvent('value-changed', { detail: { value } }));
  await settle();
}

const checked = (root: ParentNode): string[] =>
  everything(root)
    .filter(
      (node) =>
        node.getAttribute('role') === 'radio' && node.getAttribute('aria-checked') === 'true',
    )
    .map((node) => node.getAttribute('aria-label') ?? '');

const own = (templates: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(templates).map(([name, template]) => [name, { kind: 'own', template }]),
  );

function hanging(store: ReturnType<typeof fakeStore>): Record<string, unknown> {
  return {
    ...store.hass,
    connection: {
      ...store.hass.connection,
      subscribeMessage: (): Promise<never> => new Promise(() => undefined),
    },
  };
}

interface Opened {
  readonly editor: MnmlTemplateCardEditor;
  readonly root: ShadowRoot;
  readonly dispatched: unknown[];
}

function made(): { editor: MnmlTemplateCardEditor; dispatched: unknown[] } {
  const editor = document.createElement('mnml-template-card-editor');
  assert.ok(editor instanceof MnmlTemplateCardEditor);
  const dispatched: unknown[] = [];
  editor.addEventListener('config-changed', (event) => {
    dispatched.push(event instanceof CustomEvent ? event.detail : undefined);
  });
  return { editor, dispatched };
}

async function openWith(config: unknown, hass: unknown): Promise<Opened> {
  const { editor, dispatched } = made();
  editor.setConfig(config);
  editor.hass = hass as never;
  const root = await mounted(editor);
  await settle();
  return { editor, root, dispatched };
}

const open = (config: unknown): Promise<Opened> =>
  openWith(config, {
    ...fakeStore().hass,
    states: {},
    areas: { hall: { area_id: 'hall', name: 'Hall' } },
    devices: {},
    entities: {},
  });

function lastConfig(dispatched: readonly unknown[]): Record<string, unknown> {
  const last = dispatched.at(-1);
  assert.ok(typeof last === 'object' && last !== null && 'config' in last, 'a config was fired');
  const config = last.config;
  assert.ok(typeof config === 'object' && config !== null);
  return { ...config };
}

async function again(opened: Opened): Promise<void> {
  opened.editor.setConfig(lastConfig(opened.dispatched));
  await settle();
}

test('without a template, the gallery lists the tiles by family, and folds the pop-ups and parts', async () => {
  const { root } = await open({ type: 'custom:mnml-template-card', template: '' });
  assert.ok(labelled(root, 'Use section-heading'));
  assert.ok(labelled(root, 'Use room'));
  assert.equal(labelled(root, 'Use light-card'), undefined);
  const fold = [...root.querySelectorAll('button')].find((each) =>
    /^Pop-ups and parts \(\d+\)$/.test(text(each)),
  );
  assert.ok(fold);
  fold.click();
  await settle();
  assert.ok(labelled(root, 'Use light-card'));
});

test('a filter narrows the gallery and looks among the pop-ups and parts too', async () => {
  const { root } = await open({ type: 'custom:mnml-template-card', template: '' });
  const filter = labelled(root, 'Filter the templates');
  assert.ok(filter instanceof HTMLInputElement);
  filter.value = 'vacuum';
  filter.dispatchEvent(new Event('input'));
  await settle();
  assert.equal(labelled(root, 'Use section-heading'), undefined);
  assert.ok(labelled(root, 'Use vacuum-card'));
});

test('a preview is drawn only when its tile is shown', async () => {
  built.length = 0;
  observed.length = 0;
  await open({ type: 'custom:mnml-template-card', template: '' });
  assert.equal(built.length, 0);
  const first = observed[0];
  assert.ok(first && shown);
  shown([{ isIntersecting: true, target: first }]);
  await settle();
  assert.equal(built.length, 1);
  assert.equal(built[0]?.['type'], 'custom:mnml-template-card');
  assert.equal(first.children[0], cards.at(-1), 'the preview sits in its tile');
});

test('picking a template writes it as its tile showed it, and switching sources writes where its values come from', async () => {
  const opened = await open({ type: 'custom:mnml-template-card', template: '' });
  const { root, dispatched } = opened;
  await click(labelled(root, 'Use section-heading'));
  const picked = {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    slots: { title: 'Rooms', icon: 'mdi:floor-plan' },
  };
  assert.deepEqual(lastConfig(dispatched), picked);
  await again(opened);
  const before = dispatched.length;
  await click(labelled(root, 'Find in an area'));
  assert.equal(dispatched.length, before);
  assert.deepEqual(checked(root), ['Find in an area']);
  await click(labelled(root, 'Fill in yourself'));
  assert.deepEqual(lastConfig(dispatched), picked);
});

test('a key the template card does not take is refused, so Home Assistant opens YAML', () => {
  const { editor } = made();
  assert.throws(() => {
    editor.setConfig({ type: 'custom:mnml-template-card', template: 'x', extra: 1 });
  }, /extra is not a key the editor knows/);
});

test('the context Home Assistant hands every card editor does not break it', async () => {
  const { editor } = made();
  Object.assign(editor, { context: {} });
  editor.setConfig({
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    slots: { title: 'MNML', icon: 'mdi:shape' },
  });
  editor.hass = { ...fakeStore().hass, states: {}, areas: {}, devices: {}, entities: {} } as never;
  const root = await mounted(editor);
  await settle();
  assert.ok(labelled(root, 'Fill in yourself'));
});

test('choosing another template keeps the layout and visibility of the card', async () => {
  const { root, dispatched } = await open({
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    slots: { title: 'Hall' },
    grid_options: { columns: 6 },
    visibility: [{ condition: 'screen', media_query: '(min-width: 0px)' }],
  });
  await click(labelled(root, 'Change the template'));
  await click(
    [...root.querySelectorAll<HTMLElement>('button')].find((each) =>
      text(each).startsWith('Pop-ups and parts'),
    ),
  );
  await click(labelled(root, 'Use vacuum-card'));
  const config = lastConfig(dispatched);
  assert.equal(config['template'], 'vacuum-card');
  assert.deepEqual(config['grid_options'], { columns: 6 });
  assert.deepEqual(config['visibility'], [
    { condition: 'screen', media_query: '(min-width: 0px)' },
  ]);
  assert.deepEqual(Object.keys(config).toSorted(), [
    'grid_options',
    'slots',
    'template',
    'type',
    'visibility',
  ]);
});

test('typing in the filter keeps the box being typed in', async () => {
  const { root } = await open({ type: 'custom:mnml-template-card', template: '' });
  const filter = labelled(root, 'Filter the templates');
  assert.ok(filter instanceof HTMLInputElement);
  filter.focus();
  filter.value = 'vac';
  filter.dispatchEvent(new Event('input'));
  await settle();
  assert.equal(labelled(root, 'Filter the templates'), filter);
  assert.equal(root.activeElement, filter);
  assert.equal(labelled(root, 'Use section-heading'), undefined);
});

test('a store that cannot be read is named in the gallery', async () => {
  const store = fakeStore();
  store.refuse = { code: 'unknown_error', message: 'Something broke' };
  const { root } = await openWith(
    { type: 'custom:mnml-template-card', template: '' },
    { ...store.hass, states: {}, areas: {}, devices: {}, entities: {} },
  );
  assert.match(text(root), /the templates MNML keeps could not be read: Something broke/);
  assert.ok(labelled(root, 'Use section-heading'));
});

test('a template that does not exist is named, above the gallery', async () => {
  const { root } = await open({ type: 'custom:mnml-template-card', template: 'no-such-template' });
  assert.match(text(root), /no-such-template is not a template this dashboard knows: pick one/);
  assert.ok(labelled(root, 'Use section-heading'));
});

test("a closed editor no longer redraws when the store's templates change", async () => {
  const store = fakeStore();
  store.kept = own({
    one: { card: { type: 'custom:mnml-heading-card', title: 'One', icon: 'mdi:numeric-1' } },
  });
  const { editor, root } = await openWith(
    { type: 'custom:mnml-template-card', template: '' },
    { ...store.hass, states: {}, areas: {}, devices: {}, entities: {} },
  );
  assert.ok(labelled(root, 'Use one'));
  store.keep(
    own({
      two: { card: { type: 'custom:mnml-heading-card', title: 'Two', icon: 'mdi:numeric-2' } },
    }),
  );
  await settle();
  assert.ok(labelled(root, 'Use two'), 'an open editor follows the change');
  editor.remove();
  store.keep(
    own({
      three: { card: { type: 'custom:mnml-heading-card', title: 'Three', icon: 'mdi:numeric-3' } },
    }),
  );
  await settle();
  assert.equal(labelled(root, 'Use three'), undefined);
  assert.ok(labelled(root, 'Use two'));
});

test('a reopened editor draws again, with what changed while it was closed', async () => {
  const config = { type: 'custom:mnml-template-card', template: '' };
  const store = fakeStore();
  store.kept = own({
    one: { card: { type: 'custom:mnml-heading-card', title: 'One', icon: 'mdi:numeric-1' } },
  });
  const { editor, root } = await openWith(config, {
    ...store.hass,
    states: {},
    areas: {},
    devices: {},
    entities: {},
  });
  assert.ok(labelled(root, 'Use one'));
  const before = disconnected.count;
  editor.remove();
  assert.equal(disconnected.count, before + 1);
  store.keep(
    own({
      two: { card: { type: 'custom:mnml-heading-card', title: 'Two', icon: 'mdi:numeric-2' } },
    }),
  );
  await settle();
  document.body.append(editor);
  editor.setConfig(config);
  await settle();
  assert.ok(labelled(root, 'Use two'));
});

test("a template of the store is not called unknown while the store's templates are still on their way", async () => {
  const { root } = await openWith(
    { type: 'custom:mnml-template-card', template: 'my-own' },
    { ...hanging(fakeStore()), states: {}, areas: {}, devices: {}, entities: {} },
  );
  assert.doesNotMatch(text(root), /is not a template this dashboard knows/);
});

test('a shipped template is not called unknown before its family has arrived', async () => {
  const { editor } = made();
  editor.setConfig({ type: 'custom:mnml-template-card', template: 'vacuum-card' });
  editor.hass = { ...fakeStore().hass, states: {}, areas: {}, devices: {}, entities: {} } as never;
  const root = await mounted(editor);
  assert.doesNotMatch(text(root), /is not a template this dashboard knows/);
});

test('by hand, emptying the last slot keeps slots, which means discover nothing', async () => {
  const { root, dispatched } = await open({
    type: 'custom:mnml-template-card',
    template: 'batteries',
    slots: { low: 15 },
  });
  await fire(forms(root).at(-1), {});
  assert.deepEqual(lastConfig(dispatched), {
    type: 'custom:mnml-template-card',
    template: 'batteries',
    slots: {},
  });
});

const ROOM_LIKE = {
  description: 'A room.',
  slots: {
    key: {
      kind: 'text',
      required: true,
      discover: 'area.id',
      group: 'Basics',
      help: "Names the room's pop-ups.",
    },
    name: { kind: 'text', required: true, discover: 'area.name', group: 'Basics' },
    temperature: {
      kind: 'entity',
      discover: { domain: 'sensor', device_class: 'temperature' },
      group: 'Sensors',
    },
    heating: {
      kind: 'object',
      group: 'Climate',
      fields: { entity: { kind: 'entity', required: true } },
    },
  },
  card: { type: 'custom:mnml-heading-card', title: '[[name]]', icon: 'mdi:sofa' },
};

const PERSONISH = {
  description: 'A person.',
  slots: { who: { kind: 'entity', required: true } },
  card: { type: 'custom:mnml-heading-card', title: '[[who]]', icon: 'mdi:account' },
};

const HOMEY = {
  description: 'The updates of the home.',
  slots: { updates: { kind: 'entities', discover: { domain: 'update', scope: 'all' } } },
  card: { type: 'custom:mnml-heading-card', title: 'Updates', icon: 'mdi:update' },
};

function roomHass(): Record<string, unknown> {
  const store = fakeStore();
  store.kept = own({ 'room-like': ROOM_LIKE, personish: PERSONISH, homey: HOMEY });
  return {
    ...store.hass,
    areas: {
      bathroom: { area_id: 'bathroom', name: 'Bathroom' },
      living: { area_id: 'living', name: 'Living' },
    },
    devices: {},
    entities: {
      'sensor.living_temperature': { entity_id: 'sensor.living_temperature', area_id: 'living' },
      'update.core': { entity_id: 'update.core' },
    },
    states: {
      'sensor.living_temperature': {
        entity_id: 'sensor.living_temperature',
        state: '21',
        attributes: { device_class: 'temperature', friendly_name: 'Living Temperature' },
      },
      'climate.living': {
        entity_id: 'climate.living',
        state: 'heat',
        attributes: { friendly_name: 'Living Heating' },
      },
    },
  };
}

const openRoom = (config: Record<string, unknown>): Promise<Opened> => openWith(config, roomHass());

const MINE = {
  type: 'custom:mnml-template-card',
  template: 'room-like',
  slots: {
    key: 'living',
    name: 'Living room',
    temperature: 'sensor.living_temperature',
    heating: { entity: 'climate.living' },
  },
};

const summaries = (root: ParentNode): string =>
  [...root.querySelectorAll('.panel-summary')].map((node) => text(node)).join(' | ');

test('the sources are named and explained, and the whole home is offered only where it works', async () => {
  const { root } = await openRoom(MINE);
  assert.ok(labelled(root, 'Find in an area'));
  assert.ok(labelled(root, 'Fill in yourself'));
  assert.equal(labelled(root, 'Find in the whole home'), undefined);
  assert.match(text(root), /The template finds its devices in the area you pick/);
  assert.match(text(root), /You pick each device/);
});

test("the slots sit in the template's panels, Basics open, the others summed up", async () => {
  const { root } = await openRoom(MINE);
  assert.match(text(root), /Basics/);
  assert.match(text(root), /Sensors.*Living Temperature/);
  assert.match(text(root), /Climate.*Living Heating/);
  assert.equal(forms(root).length, 1);
});

test('switching a card filled by hand to an area keeps every value, and back again gives the same card', async () => {
  const opened = await openRoom(MINE);
  const { root, dispatched } = opened;
  await click(labelled(root, 'Find in an area'));
  assert.deepEqual(lastConfig(dispatched), {
    type: 'custom:mnml-template-card',
    template: 'room-like',
    area: 'living',
    slots: { name: 'Living room', heating: { entity: 'climate.living' } },
  });
  await again(opened);
  await click(labelled(root, 'Fill in yourself'));
  assert.deepEqual(lastConfig(dispatched), MINE);
});

test('in an area, every field says where its value comes from', async () => {
  const { root } = await openRoom({ ...MINE, area: 'living', slots: { name: 'Living room' } });
  await click(labelled(root, 'Change what it found'));
  const form = formWith(root, 'name');
  assert.equal(form?.computeHelper?.({ name: 'name' }), 'Set by you');
  assert.equal(form?.computeHelper?.({ name: 'key' }), "Names the room's pop-ups. Found in Living");
});

test('in an area, the notes, the summary and the way back follow an edit while the form stays', async () => {
  const { root } = await openRoom({ ...MINE, area: 'living', slots: {} });
  await click(labelled(root, 'Change what it found'));
  const form = formWith(root, 'name');
  assert.ok(form);
  const helper = (name: string): string | undefined => form.computeHelper?.({ name });
  const back = (): HTMLElement | undefined => labelled(root, 'Use what the area found');
  assert.equal(helper('name'), 'Found in Living');
  assert.ok(back() === undefined || back()?.hidden);
  await fire(form, { key: 'living', name: 'Den' });
  assert.equal(formWith(root, 'name'), form);
  assert.equal(helper('name'), 'Set by you');
  assert.equal(back()?.hidden, false);
  assert.match(summaries(root), /Den/);
  await fire(form, { key: 'living', name: 'Living' });
  assert.equal(helper('name'), 'Found in Living');
  assert.equal(back()?.hidden, true);
});

test('an optional part the room lacks is offered, not shown with its required fields', async () => {
  const { root, dispatched } = await openRoom({
    ...MINE,
    slots: { key: 'living', name: 'Living' },
  });
  await click(labelled(root, 'Climate'));
  assert.ok(labelled(root, 'Add Heating'));
  await click(labelled(root, 'Add Heating'));
  assert.deepEqual(lastConfig(dispatched)['slots'], {
    key: 'living',
    name: 'Living',
    heating: {},
  });
});

test('nothing is shown as JSON', async () => {
  const { root } = await openRoom({ ...MINE, area: 'living', slots: {} });
  assert.doesNotMatch(text(root), /[{[]"/);
});

test('typing in a field does not redraw the form, in an area too', async () => {
  const { root } = await openRoom({ ...MINE, area: 'living', slots: {} });
  const [form] = forms(root);
  const box = form?.shadowRoot?.querySelector('input');
  assert.ok(form && box);
  box.focus();
  await fire(form, { key: 'living', name: 'Den' });
  assert.equal(forms(root)[0], form);
  assert.equal(root.activeElement, form);
});

test('in an area, an edit back to what was found leaves no override, and slots goes when none is left', async () => {
  const { root, dispatched } = await openRoom({ ...MINE, area: 'living', slots: {} });
  await click(labelled(root, 'Change what it found'));
  const form = formWith(root, 'name');
  await fire(form, { key: 'living', name: 'Living room' });
  assert.deepEqual(lastConfig(dispatched)['slots'], { name: 'Living room' });
  await fire(form, { key: 'living', name: 'Living' });
  assert.equal(lastConfig(dispatched)['slots'], undefined);
});

test('a panel that holds one part named like the panel does not repeat its name as a heading', async () => {
  const store = fakeStore();
  store.kept = own({
    lit: {
      slots: {
        lights: {
          kind: 'object',
          group: 'Lights',
          fields: { group: { kind: 'entity', required: true } },
        },
      },
      card: { type: 'custom:mnml-heading-card', title: 'Lit', icon: 'mdi:lightbulb' },
    },
  });
  const { root } = await openWith(
    {
      type: 'custom:mnml-template-card',
      template: 'lit',
      slots: { lights: { group: 'light.hall' } },
    },
    { ...store.hass, states: {}, areas: {}, devices: {}, entities: {} },
  );
  assert.deepEqual(
    [...root.querySelectorAll('.heading')].map((node) => text(node)),
    [],
  );
});

test('while the templates load, a card that names one waits for them, with no gallery', async () => {
  const { root } = await openWith(
    { type: 'custom:mnml-template-card', template: 'room-like', area: 'living' },
    { ...hanging(fakeStore()), areas: {}, devices: {}, entities: {}, states: {} },
  );
  assert.equal(labelled(root, 'Filter the templates'), undefined);
  assert.match(text(root), /Loading the templates/);
});

test('values remembered for one template do not follow the card to another', async () => {
  const opened = await openRoom({ ...MINE, area: 'living', slots: {} });
  const { root, dispatched } = opened;
  await click(labelled(root, 'Change what it found'));
  await fire(formWith(root, 'name'), { key: 'living', name: 'Den' });
  await again(opened);
  await click(labelled(root, 'Change the template'));
  await click(labelled(root, 'Use personish'));
  await again(opened);
  await fire(formWith(root, 'who'), { who: 'person.a' });
  assert.deepEqual(lastConfig(dispatched)['slots'], { who: 'person.a' });
});

test('picking the template already chosen closes the gallery and keeps the card', async () => {
  const { root, dispatched } = await openRoom(MINE);
  const before = dispatched.length;
  await click(labelled(root, 'Change the template'));
  await click(labelled(root, 'Use room-like'));
  assert.equal(dispatched.length, before);
  assert.ok(labelled(root, 'Fill in yourself'));
});

test('a template picked from the gallery starts as its tile showed it, with one source chosen', async () => {
  const opened = await openRoom(MINE);
  const { root, dispatched } = opened;
  await click(labelled(root, 'Change the template'));
  await click(labelled(root, 'Use personish'));
  assert.deepEqual(lastConfig(dispatched), {
    type: 'custom:mnml-template-card',
    template: 'personish',
    slots: {},
  });
  await again(opened);
  assert.deepEqual(checked(root), ['Fill in yourself']);
  await click(labelled(root, 'Change the template'));
  await click(labelled(root, 'Use room-like'));
  const picked = lastConfig(dispatched);
  assert.equal(typeof picked['area'], 'string');
  assert.notEqual(picked['area'], '');
  await again(opened);
  assert.deepEqual(checked(root), ['Find in an area']);
});

test('finding in an area that nothing names waits for an area, and never writes an empty one', async () => {
  const { root, dispatched } = await openRoom({
    ...MINE,
    slots: { key: 'office', name: 'Office' },
  });
  const before = dispatched.length;
  await click(labelled(root, 'Find in an area'));
  assert.equal(dispatched.length, before);
  assert.deepEqual(checked(root), ['Find in an area']);
  assert.doesNotMatch(text(root), /Found in $|Nothing found in $/m);
  await fire(formWith(root, 'area'), { area: 'living' });
  assert.deepEqual(lastConfig(dispatched), {
    type: 'custom:mnml-template-card',
    template: 'room-like',
    area: 'living',
    slots: { key: 'office', name: 'Office', temperature: null },
  });
});

test('in the whole home, the form shows what the home found, not what was set before', async () => {
  const opened = await openRoom({
    type: 'custom:mnml-template-card',
    template: 'homey',
    slots: { updates: ['update.mine'] },
  });
  await click(labelled(opened.root, 'Find in the whole home'));
  await again(opened);
  await click(labelled(opened.root, 'Change what it found'));
  assert.deepEqual(formWith(opened.root, 'updates')?.data['updates'], ['update.core']);
});

test('in the whole home, the first edit fills the card in yourself and keeps the field and its focus', async () => {
  const { root, dispatched } = await openRoom({
    type: 'custom:mnml-template-card',
    template: 'homey',
  });
  assert.deepEqual(checked(root), ['Find in the whole home']);
  await click(labelled(root, 'Change what it found'));
  const form = formWith(root, 'updates');
  const box = form?.shadowRoot?.querySelector('input');
  assert.ok(form && box);
  box.focus();
  await fire(form, { updates: ['update.core', 'update.mine'] });
  assert.deepEqual(lastConfig(dispatched)['slots'], { updates: ['update.core', 'update.mine'] });
  assert.deepEqual(checked(root), ['Fill in yourself']);
  assert.equal(formWith(root, 'updates'), form, 'the form is the same element');
  assert.equal(root.activeElement, form, 'the focus stays in the form');
});

test('in an area, a part says where its value comes from too', async () => {
  const { root } = await openRoom({
    ...MINE,
    area: 'living',
    slots: { heating: { entity: 'climate.living' } },
  });
  await click(labelled(root, 'Climate'));
  assert.deepEqual(
    [...root.querySelectorAll('.slot-note')].map((node) => text(node)),
    ['Set by you'],
  );
});

test('in an area, a value cleared reads as not set', async () => {
  const { root, dispatched } = await openRoom({ ...MINE, area: 'living', slots: {} });
  await click(labelled(root, 'Sensors'));
  const form = formWith(root, 'temperature');
  assert.equal(form?.computeHelper?.({ name: 'temperature' }), 'Found in Living');
  await fire(form, {});
  assert.deepEqual(lastConfig(dispatched)['slots'], { temperature: null });
  assert.equal(form?.computeHelper?.({ name: 'temperature' }), 'Not set');
});

test("a preview in the gallery leaves the dashboard's pop-ups alone", async () => {
  cards.length = 0;
  observed.length = 0;
  await open({ type: 'custom:mnml-template-card', template: '' });
  const first = observed[0];
  assert.ok(first && shown);
  shown([{ isIntersecting: true, target: first }]);
  await settle();
  assert.equal(Reflect.get(cards[0] ?? {}, 'preview'), true);
});

const panelHeads = (root: ParentNode): Record<string, string | null> =>
  Object.fromEntries(
    [...root.querySelectorAll('.panel-head')].map((head) => [
      head.getAttribute('aria-label') ?? '',
      head.getAttribute('aria-expanded'),
    ]),
  );

test('placed by area, the editor says what it found there, and folds every panel with nothing missing', async () => {
  const { root } = await openRoom({ ...MINE, area: 'living' });
  const summary = root.querySelector('.found');
  assert.ok(summary);
  assert.equal(text(summary), 'Found in Living: Key, Name, Temperature');
  assert.equal(root.querySelector('.needs'), null);
  assert.deepEqual(panelHeads(root), { Basics: 'false', Sensors: 'false', Climate: 'false' });
  await click(labelled(root, 'Change what it found'));
  assert.deepEqual(panelHeads(root), { Basics: 'true', Sensors: 'true', Climate: 'true' });
});

test('a template with no discovery placed in an area shows no summary, and its first panel open', async () => {
  const { root } = await openRoom({
    type: 'custom:mnml-template-card',
    template: 'personish',
    area: 'living',
  });
  assert.equal(root.querySelector('.found'), null);
  assert.equal(Object.values(panelHeads(root))[0], 'true');
});

test('in the whole home, the summary says so; filled in yourself, there is none', async () => {
  const home = await openRoom({ type: 'custom:mnml-template-card', template: 'homey' });
  assert.equal(text(home.root.querySelector('.found')), 'Found in the whole home: Updates');
  const yourself = await openRoom({ ...MINE, slots: { key: 'living', name: 'Living' } });
  assert.equal(yourself.root.querySelector('.found'), null);
  assert.equal(Object.values(panelHeads(yourself.root))[0], 'true');
});

const LIGHTY = {
  description: 'Lights by area.',
  slots: {
    lights: {
      kind: 'object',
      required: true,
      label: 'Lights',
      group: 'Lights',
      fields: { group: { kind: 'entity', required: true }, scenes: { kind: 'entities' } },
      discover: { fields: { scenes: { domain: 'scene' } } },
    },
  },
  card: { type: 'custom:mnml-heading-card', title: 'Lights', icon: 'mdi:lightbulb' },
};

const PLAIN = {
  description: 'Set by hand.',
  slots: { title: { kind: 'text', required: true } },
  card: { type: 'custom:mnml-heading-card', title: '[[title]]', icon: 'mdi:star' },
};

function sceneHass(): Record<string, unknown> {
  const store = fakeStore();
  store.kept = own({ lighty: LIGHTY, plain: PLAIN });
  return {
    ...store.hass,
    areas: { living: { area_id: 'living', name: 'Living' } },
    devices: {},
    entities: { 'scene.living_relax': { entity_id: 'scene.living_relax', area_id: 'living' } },
    states: {
      'scene.living_relax': { entity_id: 'scene.living_relax', state: 'x', attributes: {} },
    },
  };
}

test('an object discovery finds only in part is not found, and the slot it fills is named as needed', async () => {
  const { root } = await openWith(
    { type: 'custom:mnml-template-card', template: 'lighty', area: 'living' },
    sceneHass(),
  );
  assert.equal(text(root.querySelector('.found')), 'Nothing found in Living');
  assert.equal(text(root.querySelector('.needs')), 'Needs: Lights');
  assert.ok(Object.values(panelHeads(root)).includes('true'));
});

test('a template that finds nothing anywhere says nothing about what it found', async () => {
  const { root } = await openWith(
    { type: 'custom:mnml-template-card', template: 'plain', area: 'living' },
    sceneHass(),
  );
  assert.equal(root.querySelector('.found'), null);
});

test('another template picked starts with its own folds, not the ones opened on the last', async () => {
  const store = fakeStore();
  store.kept = own({
    'room-like': ROOM_LIKE,
    'basic-two': {
      description: 'Basics again.',
      slots: {
        first: { kind: 'text', group: 'Other' },
        label: { kind: 'text', discover: 'area.name', group: 'Basics' },
      },
      card: { type: 'custom:mnml-heading-card', title: '[[label]]', icon: 'mdi:star' },
    },
  });
  const { root } = await openWith({ ...MINE, area: 'living' }, { ...roomHass(), ...store.hass });
  await click(labelled(root, 'Change what it found'));
  assert.equal(panelHeads(root)['Basics'], 'true');
  await click(labelled(root, 'Change the template'));
  await click(labelled(root, 'Use basic-two'));
  assert.equal(panelHeads(root)['Basics'], 'false');
});
