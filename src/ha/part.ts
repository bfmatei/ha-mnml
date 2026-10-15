import { nothing } from 'lit';

import { PART_KEY } from '../contract/templates.ts';

export function partName(config: object): string | undefined {
  const part: unknown = Reflect.get(config, PART_KEY);
  return typeof part === 'string' ? part : undefined;
}

export function partOf(config: object): string | typeof nothing {
  return partName(config) ?? nothing;
}
