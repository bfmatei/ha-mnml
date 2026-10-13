import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';

import { discover } from './discover.ts';
import type { Registries } from './discover.ts';
import { SHIPPED } from './shipped.ts';

export const CORPUS_DIR = resolve(import.meta.dirname, 'corpus');

const EXPECTED = 'expected.json';

type Discoveries = Record<string, Record<string, Record<string, Record<string, Value>>>>;

const byKey = ([a]: [string, unknown], [b]: [string, unknown]): number => a.localeCompare(b);

function sorted(value: Record<string, Value>): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(byKey)
      .map(([key, inner]) => [key, deep(inner)]),
  );
}

function deep(value: Value): Value {
  if (Array.isArray(value)) {
    return value.map(deep);
  }
  return isMapping(value) ? sorted(value) : value;
}

function isRegistries(value: unknown): value is Registries {
  return (
    isMapping(value) &&
    ['areas', 'devices', 'entities', 'states'].every((key) => isMapping(value[key]))
  );
}

export function homes(): Record<string, Registries> {
  return Object.fromEntries(
    readdirSync(CORPUS_DIR)
      .filter((name) => name.endsWith('.json') && name !== EXPECTED)
      .toSorted()
      .map((name) => {
        const parsed: unknown = JSON.parse(readFileSync(join(CORPUS_DIR, name), 'utf8'));
        if (!isRegistries(parsed)) {
          throw new Error(`${name} holds no registries`);
        }
        return [name.slice(0, -'.json'.length), parsed];
      }),
  );
}

export function discoveries(): Discoveries {
  const out: Discoveries = {};
  for (const [home, registries] of Object.entries(homes()).toSorted(byKey)) {
    const areas = ['*', ...Object.keys(registries.areas)].toSorted((a, b) => a.localeCompare(b));
    for (const [name, template] of Object.entries(SHIPPED).toSorted(byKey)) {
      if (!Object.values(template.slots ?? {}).some((slot) => slot.discover !== undefined)) {
        continue;
      }
      for (const area of areas) {
        const found = discover(template, area === '*' ? undefined : area, registries);
        if (Object.keys(found).length > 0) {
          out[home] ??= {};
          out[home][name] ??= {};
          out[home][name][area] = sorted(found);
        }
      }
    }
  }
  return out;
}

export function writeExpected(): void {
  writeFileSync(
    join(CORPUS_DIR, EXPECTED),
    `${JSON.stringify(discoveries(), undefined, 2)}\n`,
    'utf8',
  );
}
