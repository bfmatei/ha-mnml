import { EDITORS_EN } from './editors-en.ts';
import type { EditorWords } from './editors-en.ts';
import { EDITORS_RO } from './editors-ro.ts';
import { pick } from './pick.ts';

const TABLES = new Map<string, EditorWords>([
  ['en', EDITORS_EN],
  ['ro', EDITORS_RO],
]);

export function editorWordsFor(language: string | undefined): EditorWords {
  return pick(TABLES, language, EDITORS_EN);
}
