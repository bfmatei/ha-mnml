import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { html } from 'lit';
import { test } from 'vitest';

import { stateLine } from '../ha/format.ts';
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

const ROOM = {
  states: {
    'sensor.temperature': {
      entity_id: 'sensor.temperature',
      state: '21',
      attributes: { friendly_name: 'Temperature' },
    },
  },
  entities: {},
  devices: {},
  locale: { language: 'en' },
  formatEntityState: (stateObj: { state: string }): string => `${stateObj.state} °C`,
};

test("each part of a row's state line is the box that centres its icon on its value and cuts the value with an ellipsis", () => {
  const line = stateLine(ROOM as never, 'sensor.temperature', [{ icon: true }, { text: 'Warm' }]);
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
