import type { Shapes, Templates, Value } from '../contract/templates.ts';

import { familyNames, readFamily, readShapes, sizeOf } from './shipped.ts';

export const COMMON_FAMILY = 'common';

export const COMMON: Templates = readFamily(COMMON_FAMILY);

export const OWNER: Readonly<Record<string, string>> = Object.fromEntries(
  familyNames()
    .filter((family) => family !== COMMON_FAMILY)
    .flatMap((family) => Object.keys(readFamily(family)).map((name) => [name, family])),
);

export const SIZES: Readonly<Record<string, Value>> = Object.fromEntries(
  familyNames()
    .filter((family) => family !== COMMON_FAMILY)
    .flatMap((family) =>
      Object.entries(readFamily(family)).flatMap(([name, template]) => {
        const size = sizeOf(template);
        return size === undefined ? [] : [[name, size]];
      }),
    ),
);

export const SLOT_SHAPES: Shapes = readShapes();

export function loadFamily(family: string): Promise<Templates> {
  return Promise.resolve(readFamily(family));
}
