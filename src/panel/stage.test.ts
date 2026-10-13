import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { Template, Value } from '../contract/templates.ts';
import { define, drawn, mounted } from '../test/render.ts';

import { dataFields } from './binding.ts';
import { chainTo, groupOf, partOf, singlesOf } from './outline.ts';
import { MnmlPreview } from './preview.ts';
import type { Trial } from './preview.ts';
import { simpleOf } from './simple.ts';
import { drawStagePanel } from './stage-panel.ts';
import type { StageActions } from './stage-panel.ts';

define('mnml-preview', MnmlPreview);

const TEMPLATE: Template = {
  card: {
    type: 'custom:mnml-tile-card',
    name: 'Hall',
    icon: 'mdi:door',
    popup: '#hall',
    chips: [
      { id: 'window', type: 'indicator', entity: 'binary_sensor.w', color: 'orange', if: 'window' },
      { id: 'lock', type: 'toggle', entity: 'lock.l', color: 'red' },
    ],
    item: { entity: 'light.hall' },
  },
};

function rootOf(template: Template) {
  const card = template.card;
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  return partOf(card, ['card'], undefined, 0);
}

test('the single parts of a card are the ones without a list, and the card itself', () => {
  assert.deepEqual([...singlesOf(rootOf(TEMPLATE))].toSorted(), ['card', 'card/item']);
  const popups = groupOf(
    [{ id: 'sheet', hash: '#x', cards: [{ id: 'header', type: 'custom:mnml-header-card' }] }],
    ['popups'],
    'popups',
  );
  assert.deepEqual([...singlesOf(popups)], []);
});

test('the chain to a part runs from the card down to it, and is empty for a part that is not there', () => {
  const chain = chainTo(rootOf(TEMPLATE), 'card/chips/#lock');
  assert.deepEqual(
    chain.map((part) => part.path.join('/')),
    ['card', 'card/chips/#lock'],
  );
  assert.deepEqual(chainTo(rootOf(TEMPLATE), 'card/chips/#gone'), []);
});

function actions(calls: string[]): StageActions {
  return {
    select: (key) => calls.push(`select ${key}`),
    toggle: (row, on) => calls.push(`toggle ${row.path.join('/')} ${on}`),
    look: (look, value) => calls.push(`look ${look.key} ${value}`),
    duplicate: (part) => calls.push(`duplicate ${part.path.join('/')}`),
    remove: (part) => calls.push(`remove ${part.path.join('/')}`),
    move: (_group, from, to) => calls.push(`move ${from} ${to}`),
    add: (group, starter) => calls.push(`add ${group.label} ${starter.label}`),
    open: (template) => calls.push(`open ${template}`),
    detach: (part) => calls.push(`detach ${part.path.join('/')}`),
    pick: (data, entity) => calls.push(`pick ${data.key} ${entity}`),
    fix: (data) => calls.push(`fix ${data.key}`),
    automate: (data) => calls.push(`automate ${data.key}`),
    condition: (part, show, slots) =>
      calls.push(`condition ${part.path.join('/')} ${show} ${slots.join(',')}`),
  };
}

function panel(selected: string, calls: string[]): HTMLElement {
  const root = rootOf(TEMPLATE);
  return drawn(
    drawStagePanel(
      {
        root,
        selected,
        template: TEMPLATE,
        templates: {},
        values: {},
        data: [],
        detachable: false,
        chain: chainTo(root, selected),
        rows: simpleOf(TEMPLATE, TEMPLATE),
        hass: undefined,
        advanced: undefined as never,
      },
      actions(calls),
    ),
  );
}

test('with nothing picked the panel says to click a part and offers what can be added to the card', () => {
  const calls: string[] = [];
  const box = panel('', calls);
  assert.match(box.textContent ?? '', /Click anything on the card/);
  const add = [...box.querySelectorAll('button.chip')].find((button) =>
    button.textContent?.includes('Toggle'),
  );
  assert.ok(add instanceof HTMLButtonElement);
  add.click();
  assert.deepEqual(calls, ['add chips Toggle']);
});

test('a part picked is named by its id, with its place and the moves, copy and delete', () => {
  const calls: string[] = [];
  const box = panel('card/chips/#lock', calls);
  assert.equal(box.querySelector('.stage-title')?.textContent, 'Lock');
  assert.match(box.textContent ?? '', /A chip of the tile/);
  const press = (word: string): void => {
    const button = [...box.querySelectorAll('button')].find((each) =>
      each.textContent?.includes(word),
    );
    assert.ok(button instanceof HTMLButtonElement, word);
    button.click();
  };
  press('Earlier');
  press('Copy');
  press('Delete');
  const later = [...box.querySelectorAll('button')].find((each) =>
    each.textContent?.includes('Later'),
  );
  assert.ok(later instanceof HTMLButtonElement);
  assert.equal(later.disabled, true, 'the last chip cannot move later');
  assert.deepEqual(calls, ['move 1 0', 'duplicate card/chips/#lock', 'remove card/chips/#lock']);
});

test('a crumb picks the part above, and the colour of a chip is a look to change', () => {
  const calls: string[] = [];
  const box = panel('card/chips/#window', calls);
  const crumbs = [...box.querySelectorAll('.crumb')];
  assert.deepEqual(
    crumbs.map((crumb) => crumb.textContent?.trim()),
    ['Tile', 'Window'],
  );
  crumbs[0]?.dispatchEvent(new MouseEvent('click'));
  assert.deepEqual(calls, ['select card']);
  const colour = box.querySelector('select[data-path="card/chips/#window/color"]');
  assert.ok(colour instanceof HTMLSelectElement);
});

function trial(card: Value): Trial {
  return { card, popups: [], sources: [] };
}

test('in the stage a click on a part picks it, and nothing the card would do', async () => {
  const picked: string[] = [];
  let pressed = 0;
  window.loadCardHelpers = (): Promise<never> =>
    Promise.resolve({
      createCardElement: () => {
        const card = document.createElement('div');
        const root = card.attachShadow({ mode: 'open' });
        const chip = document.createElement('button');
        chip.setAttribute('data-part', 'card/chips/#lock');
        chip.addEventListener('click', () => {
          pressed += 1;
        });
        root.append(chip);
        return Object.assign(card, { hass: undefined, preview: false });
      },
    }) as never;
  const stage = document.createElement('mnml-preview');
  assert.ok(stage instanceof MnmlPreview);
  stage.trial = () => trial({ type: 'custom:mnml-tile-card' });
  stage.staged = true;
  stage.pick = (key) => {
    picked.push(key);
  };
  const root = await mounted(stage);
  await new Promise((done) => setTimeout(done, 0));
  const card = root.querySelector('.cards > div');
  const chip = card?.shadowRoot?.querySelector('button');
  assert.ok(chip);
  chip.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  assert.deepEqual(picked, ['card/chips/#lock']);
  assert.equal(pressed, 0, 'the chip did not act');
  stage.remove();
  Reflect.deleteProperty(window, 'loadCardHelpers');
});

function panelWith(selected: string, calls: string[], values: Record<string, string>): HTMLElement {
  const root = rootOf(TEMPLATE);
  const chain = chainTo(root, selected);
  const part = chain.at(-1);
  assert.ok(part);
  return drawn(
    drawStagePanel(
      {
        root,
        selected,
        template: TEMPLATE,
        templates: {},
        values,
        data: dataFields(part, TEMPLATE, {}),
        detachable: false,
        chain,
        rows: simpleOf(TEMPLATE, TEMPLATE),
        hass: undefined,
        advanced: undefined as never,
      },
      actions(calls),
    ),
  );
}

test('a part tells what it shows, and a fixed entity can be made to change with the room', () => {
  const calls: string[] = [];
  const box = panelWith('card/chips/#lock', calls, {});
  assert.match(box.textContent ?? '', /What it shows/);
  assert.match(box.textContent ?? '', /The same one everywhere\./);
  const modes = [...box.querySelectorAll('.stage-modes button')];
  assert.deepEqual(
    modes.map((mode) => mode.textContent?.trim()),
    ['Always this one', 'Changes with the room'],
  );
  assert.equal(modes[0]?.getAttribute('aria-pressed'), 'true');
  modes[1]?.dispatchEvent(new MouseEvent('click'));
  assert.deepEqual(calls, ['automate entity']);
});

test('a part that changes with the room says what it found, and can be made fixed', () => {
  const template: Template = {
    slots: { door: { kind: 'entity', label: 'Door', discover: { domain: 'binary_sensor' } } },
    card: {
      type: 'custom:mnml-tile-card',
      name: 'Hall',
      icon: 'mdi:door',
      popup: '#hall',
      chips: [{ id: 'door', type: 'indicator', entity: '[[door]]', color: 'orange' }],
    },
  };
  const calls: string[] = [];
  const card = template.card;
  assert.ok(typeof card === 'object' && card !== null && !Array.isArray(card));
  const root = partOf(card, ['card'], undefined, 0);
  const chain = chainTo(root, 'card/chips/#door');
  const part = chain.at(-1);
  assert.ok(part);
  const box = drawn(
    drawStagePanel(
      {
        root,
        selected: 'card/chips/#door',
        template,
        templates: {},
        values: { door: 'binary_sensor.hall_door' },
        data: dataFields(part, template, {}),
        detachable: false,
        chain,
        rows: simpleOf(template, template),
        hass: undefined,
        advanced: undefined as never,
      },
      actions(calls),
    ),
  );
  assert.match(
    box.textContent ?? '',
    /Picked for each room by itself\. Here: binary_sensor\.hall_door\./,
  );
  const modes = [...box.querySelectorAll('.stage-modes button')];
  assert.equal(modes[1]?.getAttribute('aria-pressed'), 'true');
  modes[0]?.dispatchEvent(new MouseEvent('click'));
  assert.deepEqual(calls, ['fix entity']);
});

function fakeStage(): void {
  window.loadCardHelpers = (): Promise<never> =>
    Promise.resolve({
      createCardElement: (config: Record<string, unknown>) => {
        const card = document.createElement('div');
        const root = card.attachShadow({ mode: 'open' });
        for (const [index, key] of ['card/chips/#a', 'card/chips/#b', 'card/chips/#c'].entries()) {
          const chip = document.createElement('button');
          chip.setAttribute('data-part', key);
          chip.getBoundingClientRect = () =>
            ({ left: index * 50, top: 0, width: 40, height: 20, right: 0, bottom: 0 }) as DOMRect;
          root.append(chip);
        }
        card.setAttribute('data-part', String(config['_part']));
        return Object.assign(card, { hass: undefined, preview: false });
      },
    }) as never;
}

async function staged(extra: (stage: MnmlPreview) => void): Promise<{
  stage: MnmlPreview;
  root: ShadowRoot;
}> {
  fakeStage();
  const stage = document.createElement('mnml-preview');
  assert.ok(stage instanceof MnmlPreview);
  stage.trial = () => trial({ type: 'custom:mnml-tile-card', _part: 'card' });
  stage.staged = true;
  extra(stage);
  const root = await mounted(stage);
  await new Promise((done) => setTimeout(done, 0));
  return { stage, root };
}

test('the arrow keys walk the parts of the card, and Escape lets go', async () => {
  const picked: string[] = [];
  const { stage, root } = await staged((each) => {
    each.pick = (key) => {
      picked.push(key);
    };
  });
  const frame = root.querySelector('.stage-box');
  assert.ok(frame instanceof HTMLElement);
  const press = (key: string, options: KeyboardEventInit = {}): void => {
    frame.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
  };
  press('ArrowRight');
  press('ArrowRight');
  press('ArrowLeft');
  press('End');
  press('Escape');
  assert.deepEqual(picked, ['card', 'card/chips/#a', 'card', 'card/chips/#c', '']);
  stage.remove();
  Reflect.deleteProperty(window, 'loadCardHelpers');
});

test('Delete and Alt with the arrows act on the part that is picked', async () => {
  const done: string[] = [];
  const { stage, root } = await staged((each) => {
    each.selected = 'card/chips/#b';
    each.act = (action) => {
      done.push(action);
    };
  });
  const frame = root.querySelector('.stage-box');
  assert.ok(frame instanceof HTMLElement);
  const press = (key: string, options: KeyboardEventInit = {}): void => {
    frame.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
  };
  press('ArrowLeft', { altKey: true });
  press('ArrowRight', { altKey: true });
  press('Delete');
  assert.deepEqual(done, ['earlier', 'later', 'remove']);
  stage.remove();
  Reflect.deleteProperty(window, 'loadCardHelpers');
});

const pointer = (type: string, x: number, buttons: number): PointerEvent =>
  new PointerEvent(type, {
    bubbles: true,
    composed: true,
    clientX: x,
    clientY: 10,
    button: 0,
    buttons,
    pointerType: 'mouse',
  });

test('a part dragged onto a neighbour of its list is moved there, and the click that ends the drag picks nothing', async () => {
  const moved: string[][] = [];
  const picked: string[] = [];
  const { stage, root } = await staged((each) => {
    each.reorder = (from, to) => {
      moved.push([from, to]);
    };
    each.pick = (key) => {
      picked.push(key);
    };
  });
  const cards = root.querySelector('.cards');
  const chip = cards?.querySelector('div')?.shadowRoot?.querySelector('button');
  assert.ok(cards && chip);
  chip.dispatchEvent(pointer('pointerdown', 20, 1));
  chip.dispatchEvent(pointer('pointermove', 70, 1));
  chip.dispatchEvent(pointer('pointermove', 120, 1));
  chip.dispatchEvent(pointer('pointerup', 120, 0));
  chip.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  assert.deepEqual(moved, [['card/chips/#a', 'card/chips/#c']]);
  assert.deepEqual(picked, []);
  stage.remove();
  Reflect.deleteProperty(window, 'loadCardHelpers');
});

const touch = (type: string, x: number, buttons: number): PointerEvent =>
  new PointerEvent(type, {
    bubbles: true,
    composed: true,
    clientX: x,
    clientY: 10,
    button: 0,
    buttons,
    pointerType: 'touch',
  });

test('a touch drags after a press, and a touch that moves first is a scroll and moves nothing', async () => {
  const moved: string[][] = [];
  const { stage, root } = await staged((each) => {
    each.reorder = (from, to) => {
      moved.push([from, to]);
    };
  });
  const cards = root.querySelector('.cards');
  const chip = cards?.querySelector('div')?.shadowRoot?.querySelector('button');
  assert.ok(cards && chip);
  vi.useFakeTimers();
  chip.dispatchEvent(touch('pointerdown', 20, 1));
  await vi.advanceTimersByTimeAsync(450);
  chip.dispatchEvent(touch('pointermove', 70, 1));
  chip.dispatchEvent(touch('pointermove', 120, 1));
  chip.dispatchEvent(touch('pointerup', 120, 0));
  assert.deepEqual(moved, [['card/chips/#a', 'card/chips/#c']]);
  chip.dispatchEvent(touch('pointerdown', 20, 1));
  chip.dispatchEvent(touch('pointermove', 60, 1));
  await vi.advanceTimersByTimeAsync(450);
  chip.dispatchEvent(touch('pointermove', 120, 1));
  chip.dispatchEvent(touch('pointerup', 120, 0));
  assert.equal(moved.length, 1, 'no second move');
  stage.remove();
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'loadCardHelpers');
});

test('a native card inside a native card is picked by the configuration it was given', async () => {
  window.loadCardHelpers = (): Promise<never> =>
    Promise.resolve({
      createCardElement: () => {
        const stack = document.createElement('div');
        stack.setAttribute('data-part', 'card');
        const root = stack.attachShadow({ mode: 'open' });
        const inner = document.createElement('div');
        Object.assign(inner, { config: { type: 'picture-entity', _part: 'card/cards/#camera' } });
        root.append(inner);
        return Object.assign(stack, { hass: undefined, preview: false });
      },
    }) as never;
  const stage = document.createElement('mnml-preview');
  assert.ok(stage instanceof MnmlPreview);
  stage.trial = () => trial({ type: 'vertical-stack', _part: 'card' });
  stage.staged = true;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    const root = await mounted(stage);
    await vi.advanceTimersByTimeAsync(1000);
    const inner = root.querySelector('.cards > div')?.shadowRoot?.querySelector('div');
    assert.equal(inner?.getAttribute('data-part'), 'card/cards/#camera');
  } finally {
    vi.useRealTimers();
    stage.remove();
    Reflect.deleteProperty(window, 'loadCardHelpers');
  }
});
