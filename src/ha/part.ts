import { nothing } from 'lit';

import { PART_KEY } from '../contract/templates.ts';

export function partOf(config: object): string | typeof nothing {
  const part: unknown = Reflect.get(config, PART_KEY);
  return typeof part === 'string' ? part : nothing;
}
