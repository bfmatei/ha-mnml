import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parse } from 'yaml';

import { isMapping, isTemplate } from '../contract/templates.ts';
import type { Shapes, Template, Templates, Value, WrittenSlot } from '../contract/templates.ts';

import { withShapes } from './slot-shapes.ts';

const DIR = resolve(import.meta.dirname, '../../templates');

const SHAPES_FILE = 'shapes.yaml';

export function familyNames(dir: string = DIR): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') && name !== SHAPES_FILE)
    .toSorted()
    .map((name) => name.slice(0, -'.yaml'.length));
}

function isWrittenSlot(value: unknown): value is WrittenSlot {
  return isMapping(value);
}

export function readShapes(dir: string = DIR): Shapes {
  const path = join(dir, SHAPES_FILE);
  if (!existsSync(path)) {
    return {};
  }
  const parsed: unknown = parse(readFileSync(path, 'utf8'));
  if (!isMapping(parsed)) {
    throw new Error(`${SHAPES_FILE} holds no shapes`);
  }
  const shapes: Record<string, WrittenSlot> = {};
  for (const [name, shape] of Object.entries(parsed)) {
    if (!isWrittenSlot(shape)) {
      throw new Error(`${name} in ${SHAPES_FILE} is no slot`);
    }
    shapes[name] = shape;
  }
  return shapes;
}

export function readFamily(family: string, dir: string = DIR): Templates {
  const file = `${family}.yaml`;
  const parsed: unknown = parse(readFileSync(join(dir, file), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${file} holds no templates`);
  }
  const shapes = readShapes(dir);
  const found: Record<string, Template> = {};
  for (const [name, template] of Object.entries(parsed)) {
    if (!isTemplate(template)) {
      throw new Error(`${name} in ${file} has no card`);
    }
    found[name] = withShapes(name, template, shapes);
  }
  return found;
}

export function sizeOf(template: Template): Value | undefined {
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
