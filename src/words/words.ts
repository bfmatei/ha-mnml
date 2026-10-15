import { EN } from './en.ts';
import type { Words } from './en.ts';
import { RO } from './ro.ts';

const TABLES = new Map<string, Words>([
  ['en', EN],
  ['ro', RO],
]);

export function wordsFor(language: string): Words {
  return TABLES.get(language) ?? TABLES.get(language.split('-')[0] ?? '') ?? EN;
}
