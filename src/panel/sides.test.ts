import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { html } from 'lit';
import { test } from 'vitest';

import { styled } from '../test/render.ts';

import { PANEL_STYLE } from './style.ts';

const SIDED = new Set([
  'margin',
  'padding',
  'inset',
  'border-width',
  'border-style',
  'border-color',
]);

function sources(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => join(dir, name));
}

function physical(property: string, value: string): boolean {
  const named = value.replaceAll(/--[\w-]+/g, '');
  const each = named.split(' ').filter((word) => word !== '');
  if (/(^|-)(left|right)(-|$)/.test(property) || /\b(left|right)\b/.test(named)) {
    return true;
  }
  if (SIDED.has(property) && each.length === 4) {
    return each[1] !== each[3];
  }
  if (property === 'border-radius' && !named.includes('/') && !named.includes('(')) {
    const [a, b = a, c = a, d = b] = each;
    return a !== b || c !== d;
  }
  return /translateX\(/.test(named);
}

test('no style of the panel or the editors names a physical side, so both mirror right to left', () => {
  const files = [
    ...sources(import.meta.dirname),
    ...sources(join(import.meta.dirname, '..', 'editors')),
  ];
  const sided = files.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/css`([^`]*)`/g)].flatMap((block) =>
      (block[1] ?? '').split(/[;{}]/).flatMap((part) => {
        const found = /^\s*([a-z-]+)\s*:\s*([^]*?)\s*$/.exec(part);
        const [, property = '', value = ''] = found ?? [];
        return found !== null && physical(property, value.replaceAll(/\s+/g, ' '))
          ? [`${file}: ${property}: ${value.trim()}`]
          : [];
      }),
    ),
  );
  assert.ok(files.length > 20);
  assert.deepEqual(sided, []);
});

test('the side check knows a physical side from a logical one', () => {
  assert.deepEqual(
    [
      physical('border-left', '1px solid'),
      physical('text-align', 'left'),
      physical('padding', '12px 8px 12px 16px'),
      physical('border-radius', '4px 0 0 4px'),
      physical('transform', 'translateX(8px)'),
    ],
    [true, true, true, true, true],
  );
  assert.deepEqual(
    [
      physical('border-inline-start', '1px solid'),
      physical('text-align', 'start'),
      physical('padding-inline', '16px 8px'),
      physical('padding', '6px 8px 6px 8px'),
      physical('border-radius', '50%'),
      physical('transform', 'scaleX(-1)'),
      physical('color', 'var(--mnml-left-color)'),
    ],
    [false, false, false, false, false, false, false],
  );
});

test('a back arrow points the other way right to left', () => {
  const root = styled(
    [PANEL_STYLE],
    html`<div dir="ltr">
        <button class="icon-button back"><ha-icon></ha-icon></button>
      </div>
      <div dir="rtl">
        <button class="icon-button back"><ha-icon></ha-icon></button>
      </div>`,
  );
  const turned = (direction: string): string => {
    const arrow = root.querySelector(`[dir="${direction}"] ha-icon`);
    assert.ok(arrow, direction);
    return getComputedStyle(arrow).transform;
  };
  assert.notEqual(turned('ltr'), 'scaleX(-1)');
  assert.equal(turned('rtl'), 'scaleX(-1)');
});
