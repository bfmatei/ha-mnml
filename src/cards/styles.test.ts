import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { html } from 'lit';
import { test } from 'vitest';

import { stateLine } from '../ha/format.ts';
import { fakeHass } from '../test/hass.ts';
import { styled } from '../test/render.ts';

import { MENU_STYLE } from './parts/menu.ts';
import { BASE_STYLE, ROW_STYLE, SELECT_STYLE } from './styles.ts';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

test('every --mnml- variable a card reads has a fallback, so the cards work without the theme', () => {
  const bare = sources(import.meta.dirname).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/var\(--mnml-[a-z-]+\)/g)].map(
      (match) => `${file}: ${match[0]}`,
    ),
  );
  assert.deepEqual(bare, []);
});

test('no card still reads a --minimal- variable', () => {
  const left = sources(import.meta.dirname).filter((file) =>
    readFileSync(file, 'utf8').includes('--minimal-'),
  );
  assert.deepEqual(left, []);
});

test('what is pressed cannot be selected, so quick clicks select no text; values stay selectable', () => {
  const root = styled(
    [BASE_STYLE],
    html`<div class="card">
      <button>Press</button>
      <span role="button">Press</span>
      <span class="link">Open</span>
      <div class="heading fold">Fold</div>
      <span class="value">21</span>
    </div>`,
  );
  const selection = (selector: string): string => {
    const node = root.querySelector(selector);
    assert.ok(node, selector);
    return getComputedStyle(node).userSelect;
  };
  for (const pressed of ['button', "[role='button']", '.link', '.heading.fold']) {
    assert.equal(selection(pressed), 'none', pressed);
  }
  assert.notEqual(selection('.card'), 'none', 'not the whole card');
  assert.notEqual(selection('.value'), 'none', 'a value');
});

const WASHED = [
  '.tile',
  '.card.button',
  '.glance.link',
  '.row.link',
  '.control:not(.inert)',
  '.reset',
  '.heading.fold .chevron',
  '.header .round:not(.inert)',
];

test('every hover wash is one overlay that fades, never a gradient or an inset shadow that snaps', () => {
  const left = sources(import.meta.dirname).flatMap((file) =>
    [
      ...readFileSync(file, 'utf8').matchAll(
        /linear-gradient\(var\(--m-hover\)|999px var\(--m-hover\)/g,
      ),
    ].map((match) => `${file}: ${match[0]}`),
  );
  assert.deepEqual(left, []);
});

test('each of the eight washed surfaces holds its overlay under its own content, and an inert control has none', () => {
  const root = styled(
    [BASE_STYLE],
    html`<div class="tile"></div>
      <div class="card button"></div>
      <div class="glance link"></div>
      <div class="row link"></div>
      <div class="control"></div>
      <button class="reset"></button>
      <div class="heading fold"><span class="chevron"></span></div>
      <div class="header"><span class="round"></span></div>
      <div class="control inert"></div>`,
  );
  for (const surface of WASHED) {
    const node = root.querySelector(surface);
    assert.ok(node, surface);
    const style = getComputedStyle(node);
    assert.equal(style.isolation, 'isolate', surface);
    assert.equal(style.position, 'relative', surface);
  }
  const inert = root.querySelector('.control.inert');
  assert.ok(inert);
  assert.notEqual(getComputedStyle(inert).isolation, 'isolate');
});

function values(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let word = '';
  for (const letter of value) {
    depth += letter === '(' ? 1 : letter === ')' ? -1 : 0;
    if (letter === ' ' && depth === 0) {
      out.push(word);
      word = '';
    } else {
      word += letter;
    }
  }
  return [...out, word].filter((each) => each !== '');
}

const SIDES = new Set([
  'margin',
  'padding',
  'inset',
  'scroll-margin',
  'scroll-padding',
  'border-width',
  'border-style',
  'border-color',
]);

function physical(property: string, value: string): boolean {
  const named = value.replaceAll(/--[\w-]+/g, '');
  const each = values(named);
  if (/(^|-)(left|right)(-|$)/.test(property) || /\b(left|right)\b/.test(named)) {
    return true;
  }
  if (SIDES.has(property) && each.length === 4) {
    return each[1] !== each[3];
  }
  if (property === 'border-radius' && !named.includes('/')) {
    const [a, b = a, c = a, d = b] = each;
    return a !== b || c !== d;
  }
  return /translate(X|3d)?\((?!-50%\))/.test(named) && !/translate\((0|-50%), /.test(named);
}

test('no card style names a physical side, so a card mirrors when Home Assistant reads right to left', () => {
  const sided = sources(import.meta.dirname).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/css`([^`]*)`/g)].flatMap((block) =>
      (block[1] ?? '').split(/[;{}]/).flatMap((part) => {
        const found = /^\s*([a-z-]+)\s*:\s*([^]*?)\s*$/.exec(part);
        const [, property = '', value = ''] = found ?? [];
        return found !== null && physical(property, value.replaceAll(/\s+/g, ' '))
          ? [`${file.slice(import.meta.dirname.length + 1)}: ${property}: ${value.trim()}`]
          : [];
      }),
    ),
  );
  assert.deepEqual(sided, []);
});

test('the side check knows a physical side from a logical one', () => {
  assert.deepEqual(
    [
      physical('margin-left', 'auto'),
      physical('text-align', 'left'),
      physical('padding', '0 34px 0 14px'),
      physical('inset', '0 auto 0 0'),
      physical('border-radius', '4px 0 0 4px'),
      physical('transform', 'translateX(8px)'),
    ],
    [true, true, true, true, true, true],
  );
  assert.deepEqual(
    [
      physical('margin-inline-start', 'auto'),
      physical('text-align', 'start'),
      physical('padding', '6px 8px 0'),
      physical('inset', 'auto 0 0'),
      physical('border-radius', 'var(--ha-card-border-radius, 22px)'),
      physical('transform', 'translateX(-50%)'),
      physical('transform', 'translateY(8px)'),
      physical('color', 'var(--mnml-left-color)'),
    ],
    [false, false, false, false, false, false, false, false],
  );
});

test('a menu item and a select ease into their hover too', () => {
  const root = styled(
    [MENU_STYLE, SELECT_STYLE],
    html`<div class="menu"><button>Cool</button></div>
      <select></select>`,
  );
  const item = root.querySelector('.menu button');
  const select = root.querySelector('select');
  assert.ok(item && select);
  assert.equal(getComputedStyle(item).transition, 'background-color 120ms ease-out');
  assert.equal(getComputedStyle(select).transition, 'border-color 120ms ease-out');
});

const ROOM = fakeHass({
  states: { 'sensor.temperature': { state: '21', attributes: { friendly_name: 'Temperature' } } },
  formatEntityState: (stateObj) => `${stateObj.state} °C`,
});

test("each part of a row's state line is the box that centres its icon on its value and cuts the value with an ellipsis", () => {
  const line = stateLine(ROOM, 'sensor.temperature', [{ icon: true }, { text: 'Warm' }]);
  const root = styled([BASE_STYLE, ROW_STYLE], html`<div class="state">${line}</div>`);
  const parts = [...root.querySelectorAll('.state > span')];
  assert.equal(parts.length, 2);
  for (const part of parts) {
    const value = part.querySelector('.value');
    assert.ok(value);
    const box = getComputedStyle(part);
    const cut = getComputedStyle(value);
    assert.deepEqual(
      [box.display, box.alignItems, box.gap, box.maxWidth],
      ['inline-flex', 'center', '3px', '100%'],
    );
    assert.deepEqual([cut.minWidth, cut.overflow, cut.textOverflow], ['0px', 'hidden', 'ellipsis']);
  }
});
