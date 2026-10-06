export type AllKeys<T> = T extends unknown ? keyof T & string : never;

type AllowedKeys<T> = {
  [K in keyof T]-?: [Exclude<T[K], undefined>] extends [never] ? never : K;
}[keyof T] &
  string;

export interface KeySchema {
  keys: ReadonlySet<string>;
  nested?: Readonly<Record<string, KeySchema>>;
  pick?: (value: ReadonlyMap<string, unknown>) => KeySchema | undefined;
}

export const LAYOUT: ReadonlySet<string> = new Set([
  'type',
  'grid_options',
  'visibility',
  'view_layout',
  'layout_options',
  'card_mod',
]);

export function schema<T>(
  keys: Record<AllKeys<T>, true>,
  nested?: Record<string, KeySchema>,
): KeySchema {
  const known = new Set(Object.keys(keys));
  return nested === undefined ? { keys: known } : { keys: known, nested };
}

export function variant<T>(
  keys: Record<AllowedKeys<T>, true>,
  nested?: Record<string, KeySchema>,
): KeySchema {
  const known = new Set(Object.keys(keys));
  return nested === undefined ? { keys: known } : { keys: known, nested };
}

function union(
  variants: readonly KeySchema[],
  pick: (value: ReadonlyMap<string, unknown>) => KeySchema | undefined,
): KeySchema {
  return {
    keys: new Set(variants.flatMap((one) => [...one.keys])),
    nested: Object.fromEntries(variants.flatMap((one) => Object.entries(one.nested ?? {}))),
    pick,
  };
}

export function tagged<T extends { type: string }>(
  variants: Record<T['type'], KeySchema>,
): KeySchema {
  const byType = new Map<string, KeySchema>(Object.entries(variants));
  return union([...byType.values()], (value) => {
    const type = value.get('type');
    return typeof type === 'string' ? byType.get(type) : undefined;
  });
}

export function marked(markers: Record<string, KeySchema>, otherwise: KeySchema): KeySchema {
  const byMarker = Object.entries(markers);
  return union(
    [...byMarker.map(([, one]) => one), otherwise],
    (value) => byMarker.find(([marker]) => value.has(marker))?.[1] ?? otherwise,
  );
}

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
    if (!chosen.keys.has(key) && !(path === '' && LAYOUT.has(key))) {
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
