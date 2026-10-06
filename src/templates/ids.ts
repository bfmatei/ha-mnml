import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isMapping } from '../contract/templates.ts';
import type { Template, Templates, Value } from '../contract/templates.ts';

const FILE = resolve(import.meta.dirname, 'ids.json');

function walk(value: Value | undefined, at: readonly string[], found: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = isMapping(item) ? item['id'] : undefined;
      const inner = typeof id === 'string' ? [...at, `#${id}`] : at;
      if (typeof id === 'string') {
        found.push(inner.join('/'));
      }
      walk(item, inner, found);
    }
  } else if (isMapping(value)) {
    for (const [key, inner] of Object.entries(value)) {
      walk(inner, [...at, key], found);
    }
  }
}

export function partPaths(name: string, template: Template): string[] {
  const found: string[] = [];
  walk(template.card, [name, 'card'], found);
  walk(template.popups, [name, 'popups'], found);
  return found;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

function read(): { released: string[]; retired: string[] } {
  const data: unknown = JSON.parse(readFileSync(FILE, 'utf8'));
  return isMapping(data)
    ? { released: strings(data['released']), retired: strings(data['retired']) }
    : { released: [], retired: [] };
}

export const { released: RELEASED, retired: RETIRED } = read();

export function writeIds(templates: Templates): void {
  const now = Object.entries(templates).flatMap(([name, template]) => partPaths(name, template));
  const released = [...new Set([...RELEASED, ...now])].toSorted();
  writeFileSync(FILE, `${JSON.stringify({ released, retired: RETIRED }, undefined, 2)}\n`, 'utf8');
}
