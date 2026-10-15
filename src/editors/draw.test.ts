import assert from 'node:assert/strict';

import { render } from 'lit';
import { beforeEach, test } from 'vitest';

import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { fakeHass } from '../test/hass.ts';
import { define, everything, text, updated } from '../test/render.ts';

import { DESCRIPTIONS } from './cards.ts';
import { objectForm } from './draw.ts';
import type { Context } from './draw.ts';
import type { Drawing } from './drawing.ts';
import type { Form } from './form.ts';
import { MnmlRowMenu } from './row-menu.ts';
import { MnmlWords } from './words.ts';

define('mnml-row-menu', MnmlRowMenu);
define('mnml-words', MnmlWords);

beforeEach(() => {
  localStorage.clear();
});

const labelled = (root: ParentNode, label: string): HTMLElement | undefined =>
  everything(root).find(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.getAttribute('aria-label') === label,
  );

async function click(node: HTMLElement | undefined): Promise<void> {
  assert.ok(node, 'there is something to click');
  node.click();
  await updated(document);
}

const forms = (root: ParentNode): HTMLElement[] =>
  everything(root).filter(
    (node): node is HTMLElement => node instanceof HTMLElement && node.localName === 'ha-form',
  );

const words = (root: ParentNode): HTMLInputElement[] =>
  everything(root).filter(
    (node): node is HTMLInputElement =>
      node instanceof HTMLInputElement && node.classList.contains('word'),
  );

async function fire(form: HTMLElement | undefined, value: Record<string, Value>): Promise<void> {
  assert.ok(form, 'there is a form');
  form.dispatchEvent(new CustomEvent('value-changed', { detail: { value } }));
  await updated(document);
}

async function type(box: HTMLInputElement | undefined, typed: string): Promise<void> {
  assert.ok(box, 'there is a box');
  box.value = typed;
  box.dispatchEvent(new Event('input'));
  await updated(document);
}

interface Harness {
  readonly root: HTMLElement;
  readonly writes: { value: Record<string, Value>; redraw: boolean }[];
  readonly context: Context & { hass: HomeAssistant | undefined };
  readonly value: () => Record<string, Value>;
}

async function harness(kind: string, start: Record<string, Value>): Promise<Harness> {
  const found = DESCRIPTIONS[kind];
  assert.ok(found);
  const form: Form = found;
  let value = start;
  const writes: { value: Record<string, Value>; redraw: boolean }[] = [];
  const root = document.createElement('div');
  document.body.append(root);
  const context: Context & { hass: HomeAssistant | undefined } = {
    hass: undefined,
    popups: [{ value: '#living', label: 'Living' }],
    open: new Map<string, boolean>(),
    redraw: (): void => {
      draw();
    },
  };
  const slot = {
    get: (): Record<string, Value> => value,
    set: (next: Record<string, Value>, { redraw }: Drawing): void => {
      value = next;
      writes.push({ value: next, redraw });
      draw();
    },
  };
  function draw(): void {
    render(objectForm(form, slot, context, '', true), root);
  }
  draw();
  await updated(document);
  return { root, writes, context, value: () => value };
}

test('the first section is open and drawn; the others are drawn only when opened', async () => {
  const { root } = await harness('custom:mnml-slider-card', {
    type: 'custom:mnml-slider-card',
    entity: 'light.a',
    slider: 'brightness',
  });
  assert.equal(forms(root).length, 1);
  await click(labelled(root, 'Look'));
  assert.equal(forms(root).length, 2);
});

test("a change in Home Assistant's form writes the card without a redraw", async () => {
  const { root, value, writes } = await harness('custom:mnml-slider-card', {
    type: 'custom:mnml-slider-card',
    entity: 'light.a',
    slider: 'brightness',
  });
  const [form] = forms(root);
  await fire(form, { entity: 'light.b', slider: 'brightness', turn_on: true });
  assert.deepEqual(value(), {
    type: 'custom:mnml-slider-card',
    entity: 'light.b',
    slider: 'brightness',
    turn_on: true,
  });
  assert.equal(writes.at(-1)?.redraw, false);
  assert.equal(forms(root)[0], form, 'the form typed in is the same element');
  assert.deepEqual(Reflect.get(form ?? {}, 'data'), {
    entity: 'light.b',
    slider: 'brightness',
    turn_on: true,
  });
});

test("a section's summary follows a change in its form", async () => {
  const { root } = await harness('custom:mnml-slider-card', {
    type: 'custom:mnml-slider-card',
    entity: 'light.a',
    slider: 'brightness',
  });
  const summaries = (): string =>
    [...root.querySelectorAll('.panel-summary')].map((node) => text(node)).join(' | ');
  assert.match(summaries(), /light\.a/);
  await fire(forms(root)[0], { entity: 'light.b', slider: 'brightness' });
  assert.match(summaries(), /light\.b/);
});

test('a control is added by kind, opened, and starts with its type alone', async () => {
  const { root, value } = await harness('custom:mnml-heading-card', {
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
  });
  await click(labelled(root, 'Controls'));
  const add = labelled(root, 'Add a control');
  assert.ok(add instanceof HTMLSelectElement);
  add.value = 'toggle';
  add.dispatchEvent(new Event('change'));
  await updated(document);
  assert.deepEqual(value()['controls'], [{ type: 'toggle' }]);
  assert.ok(labelled(root, 'More for Toggle 1'));
  assert.equal(add.value, '', 'the picker is ready for the next one');
});

test('parts move and delete, and the part that was open stays open', async () => {
  const start = {
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
    controls: [
      { type: 'toggle', entity: 'light.a' },
      { type: 'toggle', entity: 'light.b' },
    ],
  };
  const { root, value, context } = await harness('custom:mnml-heading-card', start);
  await click(labelled(root, 'Controls'));
  await click(labelled(root, 'Toggle: light.b'));
  assert.equal(context.open.get('.controls[1]'), true);
  await click(labelled(root, 'More for Toggle: light.b'));
  await click(labelled(root, 'Move up'));
  assert.deepEqual(value()['controls'], [
    { type: 'toggle', entity: 'light.b' },
    { type: 'toggle', entity: 'light.a' },
  ]);
  assert.equal(context.open.get('.controls[0]'), true);
  assert.notEqual(context.open.get('.controls[1]'), true);
  await click(labelled(root, 'More for Toggle: light.a'));
  await click(labelled(root, 'Delete'));
  assert.deepEqual(value()['controls'], [{ type: 'toggle', entity: 'light.b' }]);
  assert.equal(context.open.get('.controls[0]'), true);
});

test('a copied control pastes into another list of controls, and never into rows', async () => {
  const heading = await harness('custom:mnml-heading-card', {
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
    controls: [{ type: 'toggle', entity: 'light.a' }],
  });
  await click(labelled(heading.root, 'Controls'));
  await click(labelled(heading.root, 'More for Toggle: light.a'));
  await click(labelled(heading.root, 'Copy'));
  const tile = await harness('custom:mnml-tile-card', {
    type: 'custom:mnml-tile-card',
    name: 'Hall',
    icon: 'mdi:door',
    popup: '#hall',
  });
  await click(labelled(tile.root, 'Chips'));
  await click(labelled(tile.root, 'Paste a control'));
  assert.deepEqual(tile.value()['chips'], [{ type: 'toggle', entity: 'light.a' }]);
  const list = await harness('custom:mnml-list-card', {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a' }],
  });
  await click(labelled(list.root, 'Rows'));
  assert.ok(labelled(list.root, 'Add a row'));
  assert.equal(labelled(list.root, 'Paste a row'), undefined);
});

test('switching a card between its kinds keeps what both share, and redraws', async () => {
  const { root, value, writes } = await harness('custom:mnml-tile-card', {
    type: 'custom:mnml-tile-card',
    entity: 'light.a',
    popup: '#hall',
    grid_options: { columns: 6 },
  });
  await click(labelled(root, 'A name and icon'));
  assert.deepEqual(value(), {
    type: 'custom:mnml-tile-card',
    entity: 'light.a',
    name: '',
    popup: '#hall',
    grid_options: { columns: 6 },
  });
  assert.equal(writes.at(-1)?.redraw, true);
  assert.equal(labelled(root, 'A name and icon')?.getAttribute('aria-pressed'), 'true');
});

test('words are pairs of a state and its word, added and removed', async () => {
  const { root, value } = await harness('custom:mnml-list-card', {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a' }],
  });
  await click(labelled(root, 'Rows'));
  await click(labelled(root, 'sensor.a'));
  await click(labelled(root, 'Add a word'));
  const [state, word] = words(root);
  await type(state, 'on');
  await type(word, 'Open');
  assert.deepEqual(value()['rows'], [{ entity: 'sensor.a', words: { on: 'Open' } }]);
});

test("a change in a part's own form relabels its row and its buttons, without a redraw", async () => {
  const { root, writes } = await harness('custom:mnml-heading-card', {
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
    controls: [{ type: 'toggle', entity: '' }],
  });
  await click(labelled(root, 'Controls'));
  await click(labelled(root, 'Toggle 1'));
  const title = labelled(root, 'Toggle 1');
  assert.ok(title);
  await fire(forms(root).at(-1), { entity: 'light.a' });
  assert.equal(writes.at(-1)?.redraw, false);
  assert.equal(labelled(root, 'Toggle: light.a'), title);
  assert.equal(text(title), 'Toggle: light.a');
  assert.equal(title.title, 'Toggle: light.a');
  assert.ok(labelled(root, 'More for Toggle: light.a'));
});

test('Copy takes the part as it is now, edits since the last redraw included', async () => {
  const { root } = await harness('custom:mnml-heading-card', {
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
    controls: [{ type: 'toggle', entity: 'light.a' }],
  });
  await click(labelled(root, 'Controls'));
  await click(labelled(root, 'Toggle: light.a'));
  await fire(forms(root).at(-1), { entity: 'light.b' });
  await click(labelled(root, 'More for Toggle: light.b'));
  await click(labelled(root, 'Copy'));
  assert.deepEqual(JSON.parse(localStorage.getItem('mnml-clipboard') ?? '{}'), {
    id: 'control',
    value: { type: 'toggle', entity: 'light.b' },
  });
});

test('after a state is typed in the new word, another word can be added', async () => {
  const { root } = await harness('custom:mnml-list-card', {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a' }],
  });
  await click(labelled(root, 'Rows'));
  await click(labelled(root, 'sensor.a'));
  await click(labelled(root, 'Add a word'));
  const add = labelled(root, 'Add a word');
  assert.ok(add instanceof HTMLButtonElement);
  assert.equal(add.disabled, true);
  await type(words(root)[0], 'on');
  assert.equal(add.disabled, false);
});

test('a word given a state another word has is not written until it differs, and the rows keep their places', async () => {
  const { root, value } = await harness('custom:mnml-list-card', {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a', words: { on: 'An', off: 'Aus' } }],
  });
  await click(labelled(root, 'Rows'));
  await click(labelled(root, 'sensor.a'));
  const [, , second, secondWord] = words(root);
  assert.ok(second && secondWord);
  await type(second, 'on');
  assert.deepEqual(value()['rows'], [{ entity: 'sensor.a', words: { on: 'An', off: 'Aus' } }]);
  assert.equal(second.getAttribute('aria-invalid'), 'true');
  assert.equal(second.value, 'on', 'the box keeps what was typed');
  await type(second, 'onn');
  assert.deepEqual(value()['rows'], [{ entity: 'sensor.a', words: { on: 'An', onn: 'Aus' } }]);
  assert.equal(second.getAttribute('aria-invalid'), 'false');
  assert.deepEqual(
    words(root).map((box) => box.value),
    ['on', 'An', 'onn', 'Aus'],
  );
});

test('an emptied state meets the new empty word as a duplicate, and no word is lost', async () => {
  const { root, value } = await harness('custom:mnml-list-card', {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a', words: { on: 'An' } }],
  });
  await click(labelled(root, 'Rows'));
  await click(labelled(root, 'sensor.a'));
  await click(labelled(root, 'Add a word'));
  const [first] = words(root);
  assert.ok(first);
  await type(first, '');
  assert.deepEqual(value()['rows'], [{ entity: 'sensor.a', words: { on: 'An' } }]);
  assert.equal(first.getAttribute('aria-invalid'), 'true');
});

test('two states are swapped through the boxes as they show, without a third value', async () => {
  const { root, value } = await harness('custom:mnml-list-card', {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a', words: { on: 'An', off: 'Aus' } }],
  });
  await click(labelled(root, 'Rows'));
  await click(labelled(root, 'sensor.a'));
  const [a, , b] = words(root);
  assert.ok(a && b);
  await type(b, 'on');
  await type(a, 'off');
  assert.deepEqual(value()['rows'], [{ entity: 'sensor.a', words: { off: 'An', on: 'Aus' } }]);
  assert.equal(a.getAttribute('aria-invalid'), 'false');
  assert.equal(b.getAttribute('aria-invalid'), 'false');
});

test('a word is removed on its own, the others kept', async () => {
  const { root, value } = await harness('custom:mnml-list-card', {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a', words: { on: 'An', off: 'Aus' } }],
  });
  await click(labelled(root, 'Rows'));
  await click(labelled(root, 'sensor.a'));
  await click(labelled(root, 'Remove the word for on'));
  assert.deepEqual(value()['rows'], [{ entity: 'sensor.a', words: { off: 'Aus' } }]);
  assert.deepEqual(
    words(root).map((box) => box.value),
    ['off', 'Aus'],
  );
});

test('a row is named by its entity as Home Assistant names it', async () => {
  const { root, context } = await harness('custom:mnml-list-card', {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.a' }],
  });
  context.hass = fakeHass({
    states: { 'sensor.a': { state: '1', attributes: { friendly_name: 'Hall power' } } },
  });
  context.redraw();
  await click(labelled(root, 'Rows'));
  assert.ok(labelled(root, 'Hall power'));
});

test("the report card's colours are picked from the list, word by word", async () => {
  const { root, value } = await harness('custom:mnml-report-card', {
    type: 'custom:mnml-report-card',
    entity: 'sensor.report',
    colors: { warnings: 'orange' },
  });
  const picker = labelled(root, 'Colour for warnings');
  assert.ok(picker instanceof HTMLSelectElement);
  picker.value = 'blue';
  picker.dispatchEvent(new Event('change'));
  await updated(document);
  assert.deepEqual(value()['colors'], { warnings: 'blue' });
});

const schemaNames = (form: HTMLElement | undefined): string[] => {
  const schema: unknown = Reflect.get(form ?? {}, 'schema');
  return Array.isArray(schema)
    ? schema.map((item: unknown) => String(Reflect.get(Object(item), 'name')))
    : [];
};

test('a state line of minutes, a relative time, a serial or the name has no switch for its own kind', async () => {
  const { root, value } = await harness('custom:mnml-heading-card', {
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
    state: [{ entity: 'sensor.a', minutes: true }],
  });
  await click(labelled(root, 'State'));
  await click(labelled(root, 'Minutes: sensor.a'));
  assert.deepEqual(schemaNames(forms(root).at(-1)), ['entity', 'icon', '']);
  await click(labelled(root, 'Relative time'));
  assert.deepEqual(value()['state'], [{ entity: 'sensor.a', relative: true }]);
  assert.deepEqual(schemaNames(forms(root).at(-1)), ['entity', 'icon', '']);
  await click(labelled(root, 'Text'));
  assert.deepEqual(schemaNames(forms(root).at(-1)), ['text', '']);
});

test('a part says whether it is open', async () => {
  const { root } = await harness('custom:mnml-heading-card', {
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
    controls: [{ type: 'toggle', entity: 'light.a' }],
  });
  await click(labelled(root, 'Controls'));
  assert.equal(labelled(root, 'Toggle: light.a')?.getAttribute('aria-expanded'), 'false');
  await click(labelled(root, 'Toggle: light.a'));
  assert.equal(labelled(root, 'Toggle: light.a')?.getAttribute('aria-expanded'), 'true');
});
