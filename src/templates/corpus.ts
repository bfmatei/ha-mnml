import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Value } from '../contract/templates.ts';

import { discover } from './discover.ts';
import type { Registries } from './discover.ts';
import { SHIPPED } from './shipped.ts';

export const CORPUS_DIR = resolve(import.meta.dirname, 'corpus');

const EXPECTED = 'expected.json';

type Discoveries = Record<string, Record<string, Record<string, Record<string, Value>>>>;

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sorted);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]) => [key, sorted(inner)]),
    );
  }
  return value;
}

export function homes(): Record<string, Registries> {
  return Object.fromEntries(
    readdirSync(CORPUS_DIR)
      .filter((name) => name.endsWith('.json') && name !== EXPECTED)
      .toSorted()
      .map((name) => {
        const parsed: unknown = JSON.parse(readFileSync(join(CORPUS_DIR, name), 'utf8'));
        return [name.slice(0, -'.json'.length), parsed as Registries];
      }),
  );
}

export function discoveries(): Discoveries {
  const out: Discoveries = {};
  for (const [home, registries] of Object.entries(homes())) {
    const areas = ['', ...Object.keys(registries.areas).toSorted()];
    for (const [name, template] of Object.entries(SHIPPED)) {
      if (!Object.values(template.slots ?? {}).some((slot) => slot.discover !== undefined)) {
        continue;
      }
      for (const area of areas) {
        const found = discover(template, area === '' ? undefined : area, registries);
        if (Object.keys(found).length > 0) {
          out[home] ??= {};
          out[home][name] ??= {};
          out[home][name][area === '' ? '*' : area] = found;
        }
      }
    }
  }
  return sorted(out) as Discoveries;
}

export function writeExpected(): void {
  writeFileSync(
    join(CORPUS_DIR, EXPECTED),
    `${JSON.stringify(discoveries(), undefined, 2)}\n`,
    'utf8',
  );
}
