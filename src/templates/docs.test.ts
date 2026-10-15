import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

import type { SlotSpec } from '../contract/templates.ts';

import { CATALOG_FILE, catalogText } from './catalog.ts';
import { SHIPPED, readShapes } from './shipped.ts';

function named(spec: SlotSpec, path: string): string[] {
  return [
    path,
    ...Object.entries(spec.fields ?? {}).flatMap(([field, inner]) =>
      named(inner, `${path}.${field}`),
    ),
  ];
}

test('docs/catalog.md names every shipped template, its slots and their fields', () => {
  const doc = readFileSync(CATALOG_FILE, 'utf8');
  const missing: string[] = [];
  for (const [name, template] of Object.entries(SHIPPED)) {
    const start = doc.indexOf(`### \`${name}\``);
    if (start === -1) {
      missing.push(name);
      continue;
    }
    const end = doc.indexOf('\n### ', start + 1);
    const section = doc.slice(start, end === -1 ? undefined : end);
    for (const [slot, spec] of Object.entries(template.slots ?? {})) {
      for (const path of named(spec, slot)) {
        if (!new RegExp(`\`${path}\``).test(section)) {
          missing.push(`${name}.${path}`);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('docs/catalog.md marks a slot required exactly when its template requires it', () => {
  const doc = readFileSync(CATALOG_FILE, 'utf8');
  const wrong: string[] = [];
  for (const [name, template] of Object.entries(SHIPPED)) {
    const start = doc.indexOf(`### \`${name}\``);
    const end = doc.indexOf('\n### ', start + 1);
    const section = doc.slice(start, end === -1 ? undefined : end);
    for (const [slot, spec] of Object.entries(template.slots ?? {})) {
      const row = section.split('\n').find((line) => line.startsWith(`| \`${slot}\` `));
      const said = (row?.split('|')[3] ?? '').trim() === 'required';
      if (row !== undefined && said !== (spec.required === true)) {
        wrong.push(`${name}.${slot}`);
      }
    }
  }
  assert.deepEqual(wrong, []);
});

test('docs/catalog.md names every shipped shape under Shapes', () => {
  const doc = readFileSync(CATALOG_FILE, 'utf8');
  const start = doc.indexOf('\n## Shapes\n');
  const named = new Set(
    [...doc.slice(start, doc.indexOf('\n## ', start + 1)).matchAll(/^- `([a-z0-9_]+)`: /gm)].map(
      (match) => match[1],
    ),
  );
  const missing = Object.keys(readShapes()).filter((name) => !named.has(name));
  assert.ok(start !== -1);
  assert.deepEqual(missing, []);
});

test('docs/catalog.md is the one pnpm run fix:docs writes from templates/*.yaml', () => {
  assert.equal(readFileSync(CATALOG_FILE, 'utf8'), catalogText(), 'stale: run pnpm run fix:docs');
});
