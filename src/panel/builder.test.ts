import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { Template } from '../contract/templates.ts';
import { MnmlRowMenu } from '../editors/row-menu.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { applyChanges, baseOf, changesOf } from '../templates/changes.ts';
import { define, mounted, text } from '../test/render.ts';

import { changedParts, entryOf, MnmlBuilder, roundTrips, storedAs } from './builder.ts';
import type { BuilderHost, Entry } from './builder.ts';
import type { Draft } from './data.ts';

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

test("a template of the home's own is saved whole", () => {
  assert.deepEqual(entryOf(ROOM, undefined), { kind: 'own', template: ROOM });
});

test('a shipped template left as it was saves no change, so an edit undone resets it', () => {
  assert.equal(entryOf(structuredClone(ROOM), ROOM), undefined);
  const recoloured = edited((template) => {
    Object.assign(chips(template)[1] ?? {}, { color: 'amber' });
  });
  const entry = entryOf(recoloured, ROOM);
  assert.equal(entry?.kind, 'changes');
  assert.equal(entryOf(structuredClone(ROOM), ROOM), undefined, 'and back to the shipped one');
});

test('a shipped template edited is saved as the changes that turn the shipped one into the draft', () => {
  const draft = edited((template) => {
    chips(template).splice(1, 1);
    Object.assign(template.card as object, { name: 'Hall' });
  });
  const entry = entryOf(draft, ROOM);
  assert.ok(entry?.kind === 'changes');
  assert.deepEqual(applyChanges(ROOM, entry.changes).template, draft);
});

test('the parts a change touches are marked in the outline: the part, the inserted one, the moved one, the parent of a removed one', () => {
  const lock = ['card', 'chips?', '#lock'];
  const marks = changedParts([
    { op: 'set', path: lock, key: 'color', value: 'amber', base: '' },
    { op: 'insert', path: ['card', 'chips?'], after: null, value: { id: 'door' }, base: '' },
    { op: 'move', path: ['card', 'chips?'], id: 'window', after: 'door', base: '' },
    { op: 'remove', path: ['card', 'name'], base: '' },
    { op: 'set', path: [...lock, 'tap_action'], key: 'action', value: 'none', base: '' },
  ]);
  assert.deepEqual([...marks].toSorted(), [
    'card',
    'card/chips?/#door',
    'card/chips?/#lock',
    'card/chips?/#window',
  ]);
});

test('a customised template whose part a release removed saves only the changes that still apply', () => {
  const recolour = {
    op: 'set',
    path: ['card', 'chips?', '#lock'],
    key: 'color',
    value: 'amber',
    base: '',
  } as const;
  const rename = { op: 'set', path: ['card'], key: 'name', value: 'Hall', base: '' } as const;
  const changes = [
    { ...recolour, base: baseOf(ROOM, recolour) },
    { ...rename, base: baseOf(ROOM, rename) },
  ];
  const released = edited((template) => {
    chips(template).splice(1, 1);
  });
  const { template: draft, conflicts } = applyChanges(released, changes);
  assert.deepEqual(conflicts, [{ index: 0, reason: 'gone' }]);
  const entry = entryOf(draft, released);
  assert.ok(entry?.kind === 'changes');
  assert.deepEqual(entry.changes, changesOf(released, draft));
  assert.deepEqual(
    entry.changes.map((change) => change.op === 'set' && change.key),
    ['name'],
  );
});

test('a draft whose changes would not give it back, such as two parts with one id, is not kept as those changes', () => {
  const twice = edited((template) => {
    chips(template).push({ id: 'lock', if: 'lock', type: 'toggle', color: 'blue' });
  });
  const entry = entryOf(twice, ROOM);
  assert.equal(roundTrips(entry, twice, ROOM), false);
  const fine = edited((template) => {
    Object.assign(chips(template)[1] ?? {}, { color: 'amber' });
  });
  assert.equal(roundTrips(entryOf(fine, ROOM), fine, ROOM), true);
  assert.equal(roundTrips(undefined, structuredClone(ROOM), ROOM), true);
});

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

test('a save that would store what MNML keeps already is not sent', () => {
  const recolour = edited((template) => {
    Object.assign(chips(template)[1] ?? {}, { color: 'amber' });
  });
  const entry = entryOf(recolour, ROOM);
  assert.ok(entry?.kind === 'changes');
  assert.equal(storedAs(entry, { own: {}, changes: { room: entry.changes } }, 'room'), true);
  assert.equal(storedAs(entry, { own: {}, changes: {} }, 'room'), false);
  assert.equal(
    storedAs(
      { kind: 'own', template: ROOM },
      { own: { room: structuredClone(ROOM) }, changes: {} },
      'room',
    ),
    true,
  );
  assert.equal(
    storedAs(undefined, { own: {}, changes: {} }, 'room'),
    true,
    'no entry and none kept',
  );
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

test('another draft opens on Simple, not on the tab the last one was left on', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
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
  assert.equal(active?.textContent?.trim(), 'Simple');
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

test('the builder has Simple, Card, Pop-ups, Slots and YAML, and the example lives with the slots', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  const tabs = [...root.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent?.trim());
  assert.deepEqual(tabs, ['Simple', 'Card', 'Pop-ups', 'Slots', 'YAML']);
  const slots = [...root.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent?.trim() === 'Slots',
  );
  assert.ok(slots instanceof HTMLButtonElement);
  slots.click();
  await builder.updateComplete;
  assert.match(text(root), /Example values/);
  builder.remove();
});

const saveOff = (root: ShadowRoot): boolean => {
  const save = root.querySelector('button[aria-label="Save"]');
  assert.ok(save instanceof HTMLButtonElement);
  return save.disabled;
};

test('Simple switches a part off and on again, and the template is back as it was', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  const lock = root.querySelector('input[type="checkbox"][data-path="card/chips?/#lock"]');
  assert.ok(lock instanceof HTMLInputElement);
  assert.equal(lock.checked, true);
  assert.equal(saveOff(root), true);
  lock.checked = false;
  lock.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  assert.equal(saveOff(root), false);
  const again = root.querySelector('input[type="checkbox"][data-path="card/chips?/#lock"]');
  assert.ok(again instanceof HTMLInputElement);
  assert.equal(again.checked, false);
  again.checked = true;
  again.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  assert.equal(saveOff(root), true);
  builder.remove();
});

test('a colour chosen in Simple changes the draft', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const { builder, root } = await opened(
    { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] },
    calls,
  );
  const colour = root.querySelector('select[data-path="card/chips?/#window/color"]');
  assert.ok(colour instanceof HTMLSelectElement);
  assert.equal(colour.value, 'orange');
  colour.value = 'red';
  colour.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  assert.equal(saveOff(root), false);
  builder.remove();
});

test('a look cleared and left empty in Simple shows its value again', async () => {
  const calls: Calls = { saved: [], left: 0 };
  const named: Template = {
    ...structuredClone(ROOM),
    card: { ...(structuredClone(ROOM).card as object), name: 'Hall' },
  };
  const { builder, root } = await opened(
    { name: 'hall', template: named, shipped: undefined, conflicts: [] },
    calls,
  );
  const input = root.querySelector<HTMLInputElement>('input[data-path="card/name"]');
  assert.ok(input);
  input.value = '';
  input.dispatchEvent(new Event('change'));
  await builder.updateComplete;
  assert.equal(input.value, 'Hall');
  builder.remove();
});
