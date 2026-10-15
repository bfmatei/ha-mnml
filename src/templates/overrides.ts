import { sameValue } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';

export function overridesOf(
  found: Readonly<Record<string, Value>>,
  values: Readonly<Record<string, Value>>,
): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [name, value] of Object.entries(values)) {
    if (!sameValue(found[name], value)) {
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
