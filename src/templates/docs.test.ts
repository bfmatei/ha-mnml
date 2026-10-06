import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { test } from 'vitest';

import type { SlotSpec } from '../contract/templates.ts';

import { SHIPPED } from './shipped.ts';

function named(spec: SlotSpec, path: string): string[] {
  return [
    path,
    ...Object.entries(spec.fields ?? {}).flatMap(([field, inner]) =>
      named(inner, `${path}.${field}`),
    ),
  ];
}

test('docs/templates.md names every shipped template, its slots and their fields', () => {
  const doc = readFileSync(resolve(import.meta.dirname, '../../docs/templates.md'), 'utf8');
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
