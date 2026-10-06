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
