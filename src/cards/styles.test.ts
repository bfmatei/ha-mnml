import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { test } from 'vitest';

import { BASE_STYLE } from './styles.ts';

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
  const rule = [...BASE_STYLE.cssText.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, , body]) =>
    /(?:^|;|\s)user-select:\s*none/.test(body ?? ''),
  );
  assert.ok(rule, 'a rule turns selection off');
  const selectors = new Set((rule[1] ?? '').split(',').map((selector) => selector.trim()));
  for (const pressed of ['button', "[role='button']", '.link', '.heading.fold']) {
    assert.ok(selectors.has(pressed), pressed);
  }
  assert.ok(!selectors.has('.card') && !selectors.has('*'), 'not the whole card');
});

test('a linking row keeps its hover wash while one of its controls is hovered, so sweeping across it does not blink', () => {
  const css = BASE_STYLE.cssText;
  assert.ok(css.includes('.row.link:hover::before'), 'the row washes while hovered');
  assert.doesNotMatch(css, /\.row\.link:hover:not\(/, 'whatever is under the pointer in it');
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

test('the same overlay washes all eight surfaces: under the content, clear at rest, fading in 120 ms', () => {
  const css = BASE_STYLE.cssText;
  for (const surface of WASHED) {
    assert.ok(css.includes(`${surface}::before`), `${surface} has the overlay`);
    assert.ok(
      css.includes(`${surface},`) || css.includes(`${surface} {`),
      `${surface} is isolated`,
    );
  }
  const rule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(
    ([, selector, body]) =>
      (selector ?? '').includes('.tile::before') && /content:\s*''/.test(body ?? ''),
  );
  assert.ok(rule, 'a rule draws the overlay');
  const body = rule[2] ?? '';
  assert.match(body, /z-index:\s*-1/);
  assert.match(body, /opacity:\s*0/);
  assert.match(body, /pointer-events:\s*none/);
  assert.match(body, /transition:\s*opacity 120ms ease-out/);
  assert.match(body, /background:\s*var\(--m-hover\)/);
  assert.match(css, /isolation:\s*isolate/);
});

const read = (name: string): string => readFileSync(join(import.meta.dirname, name), 'utf8');

test('a menu item and a select ease into their hover too', () => {
  assert.match(
    read('parts/menu.ts'),
    /\.menu button \{[^}]*transition:\s*background-color 120ms ease-out/,
  );
  assert.match(read('styles.ts'), /select,[^{]*\{[^}]*transition:\s*border-color 120ms ease-out/);
});
