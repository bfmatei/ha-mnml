import assert from 'node:assert/strict';

import { test } from 'vitest';

import { unknownKeys } from '../cards/keys.ts';
import type { KeySchema } from '../cards/keys.ts';
import { CONTROLS, LIST_ROW, STATE_ITEMS } from '../cards/schemas.ts';
import { isMapping } from '../contract/templates.ts';
import type { SlotSpec, Template, Templates, Value } from '../contract/templates.ts';

import { expand } from './expand.ts';
import { rolesOf } from './roles.ts';
import { SHIPPED } from './shipped.ts';

const WHOLE = /^\[\[[a-z_][a-z0-9_.]*\]\]$/;
const FROM_SLOT = 'entity_from_a_slot';
const RULES = new Set(['slots', 'when', 'show', 'alert']);
const CONTROL_TYPES = new Set(['service', 'toggle', 'slider', 'select', 'nav', 'indicator']);
const PARTS: Record<string, KeySchema> = {
  controls: CONTROLS,
  chips: CONTROLS,
  state: STATE_ITEMS,
  rows: LIST_ROW,
};

function marked(node: Value, key = '', item = false): Value {
  if (Array.isArray(node)) {
    return node.map((each) => marked(each, key, Object.hasOwn(PARTS, key)));
  }
  if (!isMapping(node) || RULES.has(key)) {
    return node;
  }
  const out: Record<string, Value> = Object.fromEntries(
    Object.entries(node).map(([inner, value]) => [inner, marked(value, inner)]),
  );
  const entity = node['entity'];
  return item && typeof entity === 'string' && WHOLE.test(entity)
    ? { ...out, [FROM_SLOT]: true }
    : out;
}

const MARKED: Templates = Object.fromEntries(
  Object.entries(SHIPPED).map(([name, template]): [string, Template] => [
    name,
    {
      ...template,
      card: marked(template.card),
      ...(template.popups === undefined ? {} : { popups: template.popups.map((p) => marked(p)) }),
    },
  ]),
);

function minimal(spec: SlotSpec, path: string, objects: boolean): Value {
  const word = path.replaceAll(/[^a-z0-9]+/g, '_');
  switch (spec.kind) {
    case 'entity':
      return `sensor.${word}`;
    case 'entities':
      return [`sensor.${word}`];
    case 'text':
      return word.replaceAll('_', '-');
    case 'texts':
      return ['x'];
    case 'number':
      return 1;
    case 'icon':
      return 'mdi:x';
    case 'flag':
      return true;
    case 'object':
    case 'objects': {
      const fields = Object.entries(spec.fields ?? {});
      const chosen = fields.filter(([, inner]) => wanted(inner, objects));
      const [first] = fields;
      const taken = chosen.length === 0 && first !== undefined ? [first] : chosen;
      const object = Object.fromEntries(
        taken.map(([field, inner]) => [field, minimal(inner, `${path}.${field}`, objects)]),
      );
      return spec.kind === 'objects' ? [object] : object;
    }
  }
}

function wanted(spec: SlotSpec, objects: boolean): boolean {
  return (
    spec.required === true ||
    (objects && (spec.kind === 'object' || spec.kind === 'objects') && spec.default === undefined)
  );
}

function strip(node: Value): Value {
  if (Array.isArray(node)) {
    return node.map(strip);
  }
  if (!isMapping(node)) {
    return node;
  }
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== FROM_SLOT)
      .map(([key, value]) => [key, strip(value)]),
  );
}

function problems(node: Value, at: string, found: string[], key = ''): void {
  if (Array.isArray(node)) {
    const schema = PARTS[key];
    if (schema !== undefined) {
      found.push(...unknownKeys(strip(node), schema).map((path) => `${at}${path}: unknown key`));
    }
    for (const [index, item] of node.entries()) {
      problems(item, `${at}[${index}]`, found, key);
    }
    return;
  }
  if (!isMapping(node)) {
    return;
  }
  const type = node['type'];
  const entity = node['entity'];
  if (typeof type === 'string' && CONTROL_TYPES.has(type) && entity === undefined) {
    found.push(`${at}: a ${type} control without an entity`);
  }
  if (type === 'picture-entity' && entity === undefined) {
    found.push(`${at}: a picture-entity card without an entity`);
  }
  if (type === 'map' && !(Array.isArray(node['entities']) && node['entities'].length > 0)) {
    found.push(`${at}: a map card without entities`);
  }
  if (type === 'grid' && !(Array.isArray(node['cards']) && node['cards'].length > 0)) {
    found.push(`${at}: a grid card without cards`);
  }
  if (node[FROM_SLOT] === true && entity === undefined) {
    found.push(`${at}: its entity slot is unfilled, so it falls back to the card's own`);
  }
  for (const [inner, value] of Object.entries(node)) {
    problems(value, `${at}.${inner}`, found, inner);
  }
}

const roles = rolesOf(SHIPPED);
const PLACED = Object.entries(SHIPPED).filter(([name]) => roles[name] !== 'part');

test('every tile and pop-up, with only its required slots, draws whole cards and controls', () => {
  const found: string[] = [];
  for (const [name, template] of PLACED) {
    for (const objects of [false, true]) {
      const slots = Object.fromEntries(
        Object.entries(template.slots ?? {})
          .filter(([, spec]) => wanted(spec, objects))
          .map(([slot, spec]) => [slot, minimal(spec, slot, objects)]),
      );
      const where = `${name}${objects ? ' with its objects' : ''}`;
      const { card, popups } = expand(MARKED, { template: name, slots });
      const drawn: Value = [card, ...popups];
      if (JSON.stringify(drawn).includes('[[')) {
        found.push(`${where}: draws [[`);
      }
      problems(drawn, where, found);
    }
  }
  assert.deepEqual([...new Set(found)], []);
});
