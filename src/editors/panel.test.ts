import assert from 'node:assert/strict';

import { html, render } from 'lit';
import type { CSSResultGroup } from 'lit';
import { test } from 'vitest';

import { text } from '../test/render.ts';

import { sectionPanel } from './panel.ts';
import { MnmlRowMenu } from './row-menu.ts';
import { EDITOR_STYLE } from './style.ts';
import { MnmlWords } from './words.ts';

const sheets = (group: CSSResultGroup): string[] =>
  Array.isArray(group)
    ? group.flatMap((inner: CSSResultGroup) => sheets(inner))
    : [(group as { cssText: string }).cssText];

test("without HA's panel, a look-alike shows its title and summary, and draws its body only when open", () => {
  let drawn = 0;
  const box = document.createElement('div');
  const folds = {
    open: new Map<string, boolean>(),
    redraw: (): void => {
      draw();
    },
  };
  const draw = (): void => {
    render(
      sectionPanel(folds, '#Sensors', false, {
        icon: 'mdi:thermometer',
        title: 'Sensors',
        summary: 'Living Temperature, Living Humidity',
        body: () => {
          drawn += 1;
          return html`<p>body</p>`;
        },
      }),
      box,
    );
  };
  draw();
  assert.match(text(box), /Sensors.*Living Temperature, Living Humidity/);
  assert.equal(drawn, 0);
  assert.equal(box.querySelector('.panel-body'), null);
  const head = box.querySelector<HTMLButtonElement>('.panel-head');
  assert.equal(head?.getAttribute('aria-label'), 'Sensors');
  assert.equal(head?.getAttribute('aria-expanded'), 'false');
  head?.click();
  assert.equal(folds.open.get('#Sensors'), true);
  assert.equal(drawn, 1);
  assert.equal(text(box.querySelector('.panel-body')), 'body');
  assert.equal(head?.getAttribute('aria-expanded'), 'true');
  head?.click();
  assert.equal(box.querySelector('.panel-body'), null);
});

test('every control the editors unstyle keeps a focus ring', () => {
  const all = [EDITOR_STYLE.cssText, ...sheets(MnmlRowMenu.styles), ...sheets(MnmlWords.styles)];
  let unstyled = 0;
  for (const sheet of all) {
    const selectors = [...sheet.matchAll(/^([^{}\n]+?)\s*\{[^}]*all: unset/gm)].map((match) =>
      (match[1] ?? '').trim(),
    );
    unstyled += selectors.length;
    for (const selector of selectors) {
      assert.ok(sheet.includes(`${selector}:focus-visible`), selector);
    }
  }
  assert.ok(unstyled > 0);
});

test('an element the editors hide stays hidden, whatever display its class gives it', () => {
  assert.match(EDITOR_STYLE.cssText, /^\s*\[hidden\]\s*\{\s*display: none !important;\s*\}/m);
});
