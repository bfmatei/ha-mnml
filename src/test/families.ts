import type { Templates } from '../contract/templates.ts';
import { familyNames, readFamily } from '../templates/shipped.ts';

export const COMMON_FAMILY = 'common';

export const COMMON: Templates = readFamily(COMMON_FAMILY);

export const OWNER: Readonly<Record<string, string>> = Object.fromEntries(
  familyNames()
    .filter((family) => family !== COMMON_FAMILY)
    .flatMap((family) => Object.keys(readFamily(family)).map((name) => [name, family])),
);

export const SIZES = {};

export const fetched: string[] = [];

export function loadFamily(family: string): Promise<never> {
  fetched.push(family);
  return Promise.reject(new Error(`mnml-cards-${family}.json: 404 Not Found`));
}
