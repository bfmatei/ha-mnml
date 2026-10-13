import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { Template, WrittenTemplate } from '../contract/templates.ts';
import { MnmlRowMenu } from '../editors/row-menu.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { applyChanges } from '../templates/changes.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlBuilder } from './builder.ts';
import type { BuilderHost } from './builder.ts';
import type { Draft, Entry } from './data.ts';

define('mnml-builder', MnmlBuilder);
define('mnml-row-menu', MnmlRowMenu);

const ROOM: Template = {
  description: 'A room.',
  slots: { name: { kind: 'text' }, window: { kind: 'flag' }, lock: { kind: 'flag' } },
  card: {
    type: 'custom:mnml-tile-card',
    name: '[[name]]',
    'chips?': [
      { id: 'window', if: 'window', type: 'indicator', color: 'orange' },
      { id: 'lock', if: 'lock', type: 'toggle', color: 'red' },
    ],
  },
};

const edited = (change: (template: Template) => void): Template => {
  const copy = structuredClone(ROOM);
  change(copy);
  return copy;
};
const chips = (template: Template): Record<string, unknown>[] =>
  (template.card as { 'chips?': Record<string, unknown>[] })['chips?'];

interface Calls {
  saved: [string, Entry | undefined][];
  left: number;
  history?: Entry;
}

const host = (calls: Calls): BuilderHost => ({
  templates: () => ({ room: ROOM }),
  areas: () => [],
  save: (name, entry) => {
    calls.saved.push([name, entry]);
    return Promise.resolve();
  },
  leave: () => {
    calls.left += 1;
  },
  history: () => Promise.resolve(calls.history),
  duplicate: () => {},
  exportOne: () => {},
  open: () => {},
});

async function opened(
  draft: Draft,
  calls: Calls,
): Promise<{ builder: MnmlBuilder; root: ShadowRoot }> {
  const builder = document.createElement('mnml-builder');
  assert.ok(builder instanceof MnmlBuilder);
  builder.host = host(calls);
  builder.draft = draft;
  const root = await mounted(builder);
  return { builder, root };
}

function pressed(root: ShadowRoot, label: string): void {
  const button = root.querySelector(`button[aria-label="${label}"]`);
  assert.ok(button instanceof HTMLButtonElement, label);
  assert.equal(button.disabled, false, `${label} can be pressed`);
  button.click();
}

async function chosen(builder: MnmlBuilder, root: ShadowRoot, label: string): Promise<void> {
  const menu = root.querySelector('.builder-head mnml-row-menu');
  assert.ok(menu instanceof MnmlRowMenu);
  const inner = await mounted(menu);
  pressed(inner, `More for ${builder.name}`);
  await menu.updateComplete;
  pressed(inner, label);
  await builder.updateComplete;
}

const subtitle = (root: ShadowRoot): string => text(root.querySelector('.builder-title .muted'));

test('a template opened with conflicts can be saved as it is, which keeps the changes that apply and clears the conflicts', async () => {
  const recolour = {
    op: 'set',
    path: ['card', 'chips?', '#lock'],
    key: 'color',
    value: 'amber',
    base: 'old',
  } as const;
  const { template } = applyChanges(ROOM, [recolour]);
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template, shipped: ROOM, conflicts: [{ change: recolour, reason: 'changed' }] },
    calls,
  );
  assert.equal(builder.dirty(), true);
  pressed(root, 'Save');
  await builder.updateComplete;
  await builder.updateComplete;
  assert.equal(calls.saved.length, 1);
  assert.equal(builder.dirty(), false);
  builder.remove();
});

test('a page left with changes not saved is asked about, and one without is not', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const quiet = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  const first = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(first);
  assert.equal(first.defaultPrevented, false);
  quiet.builder.remove();
  const fresh = await opened(
    {
      name: 'new',
      template: structuredClone(ROOM),
      shipped: undefined,
      conflicts: [],
      fresh: true,
    },
    calls,
  );
  const second = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(second);
  assert.equal(second.defaultPrevented, true);
  fresh.builder.remove();
  const third = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(third);
  assert.equal(third.defaultPrevented, false, 'a builder gone from the page asks nothing');
});

test('Reset to shipped puts the shipped template in the draft, and saving it drops the changes', async () => {
  const customised = edited((template) => {
    Object.assign(chips(template)[1] ?? {}, { color: 'amber' });
  });
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: customised, shipped: ROOM, conflicts: [] },
    calls,
  );
  assert.equal(subtitle(root), '1 change to the shipped template');
  await chosen(builder, root, 'Reset to shipped');
  assert.equal(subtitle(root), 'as shipped');
  assert.equal(builder.dirty(), true);
  pressed(root, 'Save');
  await builder.updateComplete;
  await builder.updateComplete;
  assert.deepEqual(calls.saved, [['room', undefined]]);
  builder.remove();
});

test('Discard puts back what is stored, and a new template never saved is left', async () => {
  const customised = edited((template) => {
    Object.assign(chips(template)[1] ?? {}, { color: 'amber' });
  });
  const calls: Calls = { saved: [], left: 0 };
  const stored = await opened(
    { name: 'room', template: customised, shipped: ROOM, conflicts: [] },
    calls,
  );
  await chosen(stored.builder, stored.root, 'Reset to shipped');
  await chosen(stored.builder, stored.root, 'Discard the changes');
  assert.equal(subtitle(stored.root), '1 change to the shipped template');
  assert.equal(stored.builder.dirty(), false);
  stored.builder.remove();
  const fresh = await opened(
    {
      name: 'new',
      template: structuredClone(ROOM),
      shipped: undefined,
      conflicts: [],
      fresh: true,
    },
    calls,
  );
  await chosen(fresh.builder, fresh.root, 'Discard the changes');
  assert.equal(calls.left, 1);
  fresh.builder.remove();
});

test('History puts the version chosen in the draft, to be saved', async () => {
  const older = edited((template) => {
    template.description = 'An older room.';
  });
  const calls: Calls = { saved: [], left: 0, history: { kind: 'own', template: older } };
  const { builder, root } = await opened(
    { name: 'mine', template: structuredClone(ROOM), shipped: undefined, conflicts: [] },
    calls,
  );
  await chosen(builder, root, 'History');
  await builder.updateComplete;
  assert.equal(builder.dirty(), true);
  pressed(root, 'Save');
  await builder.updateComplete;
  await builder.updateComplete;
  const [name, entry] = calls.saved[0] ?? [];
  assert.equal(name, 'mine');
  assert.equal(entry?.kind === 'own' ? entry.template.description : undefined, 'An older room.');
  builder.remove();
});

test('a new hass reaches the forms and the preview without drawing the builder again', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  const first = { states: {} } as unknown as HomeAssistant;
  builder.hass = first;
  await builder.updateComplete;
  const draws = vi.spyOn(builder as unknown as { render: () => unknown }, 'render');
  const next = { states: {} } as unknown as HomeAssistant;
  builder.hass = next;
  await builder.updateComplete;
  assert.equal(draws.mock.calls.length, 0);
  const forms = [...root.querySelectorAll('ha-form, mnml-preview')];
  assert.ok(forms.length > 0);
  assert.ok(forms.every((form) => Reflect.get(form, 'hass') === next));
  builder.remove();
});

test('another draft opens on Design, not on the tab the last one was left on', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  await moreTools(builder, root);
  const slots = [...root.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent?.trim() === 'Slots',
  );
  assert.ok(slots instanceof HTMLButtonElement);
  slots.click();
  await builder.updateComplete;
  builder.draft = {
    name: 'room-copy',
    template: structuredClone(ROOM),
    shipped: undefined,
    conflicts: [],
    fresh: true,
  };
  await builder.updateComplete;
  const active = root.querySelector('[role="tab"][aria-selected="true"]');
  assert.equal(active?.textContent?.trim(), 'Design');
  builder.remove();
});

test('Discard is offered only when the draft differs from what is stored', async () => {
  const recolour = {
    op: 'set',
    path: ['card', 'chips?', '#lock'],
    key: 'color',
    value: 'amber',
    base: 'old',
  } as const;
  const { template } = applyChanges(ROOM, [recolour]);
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template, shipped: ROOM, conflicts: [{ change: recolour, reason: 'changed' }] },
    calls,
  );
  const menu = root.querySelector('.builder-head mnml-row-menu');
  assert.ok(menu instanceof MnmlRowMenu);
  const inner = await mounted(menu);
  pressed(inner, 'More for room');
  await menu.updateComplete;
  const discard = inner.querySelector('button[aria-label="Discard the changes"]');
  assert.ok(discard instanceof HTMLButtonElement);
  assert.equal(discard.disabled, true);
  builder.remove();
});

test('the builder has Design, Card, Pop-ups, Slots and YAML, and the example lives with the slots', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  const names = (): (string | undefined)[] =>
    [...root.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent?.trim());
  assert.deepEqual(names(), ['Design'], 'the other tools are one click away, not in the way');
  await moreTools(builder, root);
  assert.deepEqual(names(), ['Design', 'Card', 'Pop-ups', 'Slots', 'YAML']);
  const slots = [...root.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent?.trim() === 'Slots',
  );
  assert.ok(slots instanceof HTMLButtonElement);
  slots.click();
  await builder.updateComplete;
  assert.match(text(root), /Example values/);
  builder.remove();
});

async function picked(builder: MnmlBuilder, root: ShadowRoot, key: string): Promise<void> {
  const stage = root.querySelector('mnml-preview');
  assert.ok(stage);
  const pick: unknown = Reflect.get(stage, 'pick');
  assert.equal(typeof pick, 'function');
  Reflect.apply(pick as (key: string) => void, undefined, [key]);
  await builder.updateComplete;
}

async function moreTools(builder: MnmlBuilder, root: ShadowRoot): Promise<void> {
  const more = [...root.querySelectorAll('button.tab.more')].at(0);
  assert.ok(more instanceof HTMLButtonElement);
  more.click();
  await builder.updateComplete;
}

const saveOff = (root: ShadowRoot): boolean => {
  const save = root.querySelector('button[aria-label="Save"]');
  assert.ok(save instanceof HTMLButtonElement);
  return save.disabled;
};

test('Design switches a part off and on again, and the template is back as it was', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  await picked(builder, root, 'card/chips?/#lock');
  const lock = root.querySelector('input[type="checkbox"][data-path="card/chips?/#lock"]');
  assert.ok(lock instanceof HTMLInputElement);
  assert.equal(lock.checked, true);
  assert.equal(saveOff(root), true);
  lock.checked = false;
  lock.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  assert.equal(saveOff(root), false);
  await picked(builder, root, 'card/chips?/#lock');
  const again = root.querySelector('input[type="checkbox"][data-path="card/chips?/#lock"]');
  assert.ok(again instanceof HTMLInputElement);
  assert.equal(again.checked, false);
  again.checked = true;
  again.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  assert.equal(saveOff(root), true);
  builder.remove();
});

test('a colour chosen in Design changes the draft', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  await picked(builder, root, 'card/chips?/#window');
  const colour = root.querySelector('select[data-path="card/chips?/#window/color"]');
  assert.ok(colour instanceof HTMLSelectElement);
  assert.equal(colour.value, 'orange');
  colour.value = 'red';
  colour.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  assert.equal(saveOff(root), false);
  builder.remove();
});

test('a look cleared and left empty in Design shows its value again', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const named: Template = {
    ...structuredClone(ROOM),
    card: { ...(structuredClone(ROOM).card as object), name: 'Hall' },
  };
  const { builder, root } = await opened(
    { name: 'hall', template: named, shipped: undefined, conflicts: [] },
    calls,
  );
  await picked(builder, root, 'card');
  const input = root.querySelector<HTMLInputElement>('input[data-path="card/name"]');
  assert.ok(input);
  input.value = '';
  input.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  assert.equal(input.value, 'Hall');
  builder.remove();
});

test('an edit made while a save is on its way is not taken as saved', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  const { promise, resolve } = Promise.withResolvers<undefined>();
  builder.host = { ...host(calls), save: () => promise };
  await picked(builder, root, 'card/chips?/#window');
  const colour = (): HTMLSelectElement => {
    const found = root.querySelector('select[data-path="card/chips?/#window/color"]');
    assert.ok(found instanceof HTMLSelectElement);
    return found;
  };
  colour().value = 'red';
  colour().dispatchEvent(new Event('change'));
  await builder.updateComplete;
  pressed(root, 'Save');
  await builder.updateComplete;
  const other = [...colour().options].find((option) => !['orange', 'red'].includes(option.value));
  assert.ok(other);
  colour().value = other.value;
  colour().dispatchEvent(new Event('change'));
  await builder.updateComplete;
  resolve(undefined);
  await new Promise((done) => setTimeout(done, 0));
  await builder.updateComplete;
  assert.equal(builder.dirty(), true);
  assert.equal(saveOff(root), false);
  pressed(root, 'Undo');
  await builder.updateComplete;
  assert.equal(builder.dirty(), false);
  builder.remove();
});

test("a save the integration refuses says the integration's reason", async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    {
      name: 'hall',
      template: structuredClone(ROOM),
      shipped: undefined,
      conflicts: [],
      fresh: true,
    },
    calls,
  );
  builder.host = {
    ...host(calls),
    save: () =>
      Promise.reject({ code: 'too_large', message: 'a template is at most 262144 bytes' }),
  };
  pressed(root, 'Save');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await builder.updateComplete;
  assert.match(text(root), /Not saved: a template is at most 262144 bytes/);
  builder.remove();
});

const BLANK: Template = {
  description: '',
  slots: { title: { kind: 'text', required: true, label: 'Title' } },
  card: { type: 'custom:mnml-heading-card', title: '[[title]]', icon: 'mdi:star-outline' },
  example: { title: 'New' },
};

test('a new template asks what to make, and the choice is what the template then is', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    {
      name: 'mine',
      template: structuredClone(BLANK),
      shipped: undefined,
      conflicts: [],
      fresh: true,
      blank: true,
    },
    calls,
  );
  const starts = [...root.querySelectorAll('button.start')];
  assert.deepEqual(
    starts.map((start) => start.querySelector('strong')?.textContent),
    ['A tile', 'A list', 'A strip of statuses', 'A pop-up'],
  );
  assert.equal(root.querySelector('mnml-preview'), null, 'nothing to draw yet');
  const list = starts[1];
  assert.ok(list instanceof HTMLButtonElement);
  list.click();
  await builder.updateComplete;
  assert.ok(root.querySelector('mnml-preview'), 'now the stage');
  assert.equal(root.querySelector('button.start'), null);
  const save = root.querySelector('button[aria-label="Save"]');
  assert.ok(save instanceof HTMLButtonElement);
  save.click();
  await builder.updateComplete;
  const saved = calls.saved[0]?.[1];
  assert.equal(saved?.kind, 'own');
  assert.match(JSON.stringify(saved?.template?.card), /mnml-list-card/);
  assert.equal(saved?.template?.slots, undefined, 'and no leftover slot');
  builder.remove();
});

test('a copy of a template opens on the stage, not on the starting points', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    {
      name: 'room-copy',
      template: structuredClone(ROOM),
      shipped: undefined,
      conflicts: [],
      fresh: true,
    },
    calls,
  );
  assert.equal(root.querySelector('button.start'), null);
  assert.ok(root.querySelector('mnml-preview'));
  builder.remove();
});

test('a shared piece can be written out in the card, which then no longer follows it', async () => {
  const chip: Template = {
    slots: { entity: { kind: 'entity', required: true }, color: { kind: 'text', default: 'blue' } },
    card: { type: 'nav', entity: '[[entity]]', popup: '#x', color: '[[color]]' },
  };
  const mine: Template = {
    slots: { ac: { kind: 'entity' } },
    card: {
      type: 'custom:mnml-tile-card',
      name: 'Hall',
      icon: 'mdi:door',
      popup: '#hall',
      chips: [{ id: 'ac', template: 'chip', slots: { entity: '[[ac]]' } }],
    },
  };
  const calls: Calls = { saved: [], left: 0 };
  const builder = document.createElement('mnml-builder');
  assert.ok(builder instanceof MnmlBuilder);
  builder.host = { ...host(calls), templates: () => ({ chip, mine }) };
  builder.draft = {
    name: 'mine',
    template: structuredClone(mine),
    shipped: undefined,
    conflicts: [],
  };
  const root = await mounted(builder);
  await picked(builder, root, 'card/chips/#ac');
  const here = [...root.querySelectorAll('button.chip')].find((button) =>
    button.textContent?.includes('Edit it here'),
  );
  assert.ok(here instanceof HTMLButtonElement);
  here.click();
  await builder.updateComplete;
  const save = root.querySelector('button[aria-label="Save"]');
  assert.ok(save instanceof HTMLButtonElement);
  assert.equal(save.disabled, false, 'it is a change to save');
  save.click();
  await builder.updateComplete;
  const saved = calls.saved[0]?.[1];
  const card = saved?.template?.card;
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  assert.deepEqual(card['chips'], [
    { id: 'my-ac', type: 'nav', entity: '[[ac]]', popup: '#x', color: 'blue' },
  ]);
  builder.remove();
});

const YARD: WrittenTemplate = {
  description: 'A yard.',
  slots: {
    energy: { shape: 'meter', label: 'Energy', fields: { power: { required: true } } },
    lamp: { kind: 'entity' },
  },
  card: { type: 'custom:mnml-heading-card', title: 'Yard', icon: 'mdi:barn' },
  example: { energy: { power: 'sensor.yard_power' } },
};

test("a template of the home's own written with shapes previews, and is saved as written", async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'yard', template: structuredClone(YARD), shipped: undefined, conflicts: [] },
    calls,
  );
  const stage = root.querySelector('mnml-preview');
  assert.ok(stage);
  const trial: unknown = Reflect.get(stage, 'trial');
  assert.equal(typeof trial, 'function');
  assert.doesNotThrow(() => Reflect.apply(trial as () => unknown, undefined, []));
  await picked(builder, root, 'card');
  const title = root.querySelector<HTMLInputElement>('input[data-path="card/title"]');
  assert.ok(title);
  title.value = 'Back yard';
  title.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  pressed(root, 'Save');
  await builder.updateComplete;
  await builder.updateComplete;
  const [name, entry] = calls.saved[0] ?? [];
  assert.equal(name, 'yard');
  assert.equal(entry?.kind, 'own');
  assert.equal(JSON.stringify(entry?.template?.slots), JSON.stringify(YARD.slots));
  assert.deepEqual(entry?.template?.card, { ...(YARD.card as object), title: 'Back yard' });
  assert.equal(builder.dirty(), false);
  builder.remove();
});

async function yamlTab(builder: MnmlBuilder, root: ShadowRoot): Promise<Element> {
  await moreTools(builder, root);
  const yaml = [...root.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent?.trim() === 'YAML',
  );
  assert.ok(yaml instanceof HTMLButtonElement);
  yaml.click();
  await builder.updateComplete;
  const editor = root.querySelector('mnml-yaml');
  assert.ok(editor);
  return editor;
}

test('a shipped template given a slot that names a shape in YAML keeps it as changes with the shape resolved', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  const editor = await yamlTab(builder, root);
  const apply: unknown = Reflect.get(editor, 'apply');
  assert.equal(typeof apply, 'function');
  Reflect.apply(apply as (template: WrittenTemplate) => void, undefined, [
    { ...structuredClone(ROOM), slots: { ...ROOM.slots, energy: { shape: 'meter' } } },
  ]);
  await builder.updateComplete;
  assert.deepEqual(Reflect.get(root.querySelector('mnml-yaml') ?? {}, 'template'), {
    ...ROOM,
    slots: { ...ROOM.slots, energy: { shape: 'meter' } },
  });
  assert.equal(subtitle(root), '1 change to the shipped template');
  pressed(root, 'Save');
  await builder.updateComplete;
  await builder.updateComplete;
  const entry = calls.saved[0]?.[1];
  assert.equal(entry?.kind, 'changes');
  const kept = applyChanges(ROOM, entry?.changes ?? []).template;
  assert.deepEqual(kept.slots?.['energy'], {
    kind: 'object',
    fields: { power: { kind: 'entity' }, today: { kind: 'entity' }, total: { kind: 'entity' } },
  });
  builder.remove();
});

test('the YAML tab shows a slot as written, with its shape', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'yard', template: structuredClone(YARD), shipped: undefined, conflicts: [] },
    calls,
  );
  assert.deepEqual(Reflect.get(await yamlTab(builder, root), 'template'), YARD);
  builder.remove();
});
