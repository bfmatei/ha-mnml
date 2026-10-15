import { requireStructure } from '../contract/required.ts';
import { chooseVariant } from '../contract/structure.ts';
import type { Key, Structure } from '../contract/structure.ts';
import { LAYOUT_KEYS, PART_KEY } from '../contract/templates.ts';

export interface KeySchema {
  keys: ReadonlySet<string>;
  nested?: Readonly<Record<string, KeySchema>>;
  pick?: (value: ReadonlyMap<string, unknown>) => KeySchema | undefined;
}

export const TYPE_AND_LAYOUT: ReadonlySet<string> = new Set(['type', ...LAYOUT_KEYS]);

function plainKeys(keys: Readonly<Record<string, Key>>, own: readonly string[]): KeySchema {
  const known = new Set([...own, ...Object.keys(keys)]);
  const nested = Object.entries(keys).flatMap(([key, spec]): [string, KeySchema][] =>
    spec.of === undefined ? [] : [[key, keysOf(spec.of)]],
  );
  return nested.length === 0
    ? { keys: known }
    : { keys: known, nested: Object.fromEntries(nested) };
}

function variantKeys(structure: Structure, own: readonly string[]): KeySchema {
  if (structure.kind === 'plain') {
    return plainKeys(structure.keys, own);
  }
  const tags = structure.kind === 'tagged' ? ['type', ...own] : own;
  const schemas = new Map(
    structure.variants.map((variant) => [variant, plainKeys(variant.keys, tags)]),
  );
  const all = [...schemas.values()];
  return {
    keys: new Set(all.flatMap((one) => [...one.keys])),
    nested: Object.fromEntries(all.flatMap((one) => Object.entries(one.nested ?? {}))),
    pick: (value) => {
      const found = chooseVariant(structure, (key) => value.has(key), value.get('type'));
      return found === undefined ? undefined : schemas.get(found);
    },
  };
}

const PARTS = new Map<Structure, KeySchema>();
const CARDS = new Map<Structure, KeySchema>();
const CARD_KEYS = ['type'];

function remembered(
  known: Map<Structure, KeySchema>,
  structure: Structure,
  own: readonly string[],
): KeySchema {
  const found = known.get(structure);
  if (found !== undefined) {
    return found;
  }
  const made = variantKeys(structure, own);
  known.set(structure, made);
  return made;
}

export const keysOf = (structure: Structure): KeySchema => remembered(PARTS, structure, []);

export const cardKeysOf = (structure: Structure): KeySchema =>
  remembered(CARDS, structure, CARD_KEYS);

export function unknownKeys(value: unknown, of: KeySchema, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => unknownKeys(item, of, `${path}[${index}]`));
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const entries = new Map(Object.entries(value));
  const chosen = of.pick?.(entries) ?? of;
  const found: string[] = [];
  for (const [key, child] of entries) {
    const where = path === '' ? key : `${path}.${key}`;
    if (!chosen.keys.has(key) && key !== PART_KEY && !(path === '' && TYPE_AND_LAYOUT.has(key))) {
      found.push(where);
    }
    const inner = chosen.nested?.[key];
    if (inner !== undefined) {
      found.push(...unknownKeys(child, inner, where));
    }
  }
  return found;
}

export function requireKnownKeys(config: unknown, of: KeySchema): void {
  const found = unknownKeys(config, of);
  if (found.length > 0) {
    throw new Error(`unknown ${found.length === 1 ? 'key' : 'keys'}: ${found.join(', ')}`);
  }
}

export function requireCard(config: unknown, structure: Structure): void {
  requireKnownKeys(config, cardKeysOf(structure));
  requireStructure(structure, config);
}
