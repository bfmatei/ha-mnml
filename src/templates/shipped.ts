import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parse } from 'yaml';

import { isMapping, isTemplate } from '../contract/templates.ts';
import type { Template, Templates, Value } from '../contract/templates.ts';

const DIR = resolve(import.meta.dirname, '../../templates');

export function familyNames(dir: string = DIR): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .toSorted()
    .map((name) => name.slice(0, -'.yaml'.length));
}

export function readFamily(family: string, dir: string = DIR): Templates {
  const file = `${family}.yaml`;
  const parsed: unknown = parse(readFileSync(join(dir, file), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${file} holds no templates`);
  }
  const found: Record<string, Template> = {};
  for (const [name, template] of Object.entries(parsed)) {
    if (!isTemplate(template)) {
      throw new Error(`${name} in ${file} has no card`);
    }
    found[name] = template;
  }
  return found;
}

export function shapeOf(template: Template): Value | undefined {
  const card = template.card;
  if (!isMapping(card) || typeof card['type'] !== 'string' || card['type'].includes('[[')) {
    return undefined;
  }
  const grid = card['grid_options'];
  return isMapping(grid) && !JSON.stringify(grid).includes('[[')
    ? { type: card['type'], grid_options: grid }
    : { type: card['type'] };
}

export function readTemplates(dir: string = DIR): Templates {
  const found: Record<string, Template> = {};
  const from: Record<string, string> = {};
  for (const family of familyNames(dir)) {
    for (const [name, template] of Object.entries(readFamily(family, dir))) {
      const earlier = from[name];
      if (earlier !== undefined) {
        throw new Error(`${name} is defined in ${earlier}.yaml and ${family}.yaml`);
      }
      found[name] = template;
      from[name] = family;
    }
  }
  return found;
}

export const SHIPPED: Templates = readTemplates();
