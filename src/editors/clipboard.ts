import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { toValue } from '../templates/expand.ts';

const KEY = 'mnml-clipboard';

export function copyPart(id: string, value: Value): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ id, value }));
  } catch {}
}

export function pasted(id: string): Value | undefined {
  try {
    const text = globalThis.localStorage?.getItem(KEY);
    if (text === null || text === undefined) {
      return undefined;
    }
    const found: unknown = JSON.parse(text);
    return isMapping(found) && found['id'] === id ? toValue(found['value']) : undefined;
  } catch {
    return undefined;
  }
}
