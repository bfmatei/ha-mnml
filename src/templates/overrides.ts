import type { Value } from '../contract/templates.ts';

const same = (a: Value | undefined, b: Value | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function overridesOf(
  found: Readonly<Record<string, Value>>,
  values: Readonly<Record<string, Value>>,
): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [name, value] of Object.entries(values)) {
    if (!same(found[name], value)) {
      out[name] = value;
    }
  }
  for (const name of Object.keys(found)) {
    if (!Object.hasOwn(values, name)) {
      out[name] = null;
    }
  }
  return out;
}
