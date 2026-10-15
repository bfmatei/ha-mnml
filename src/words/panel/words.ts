import { PANEL_EN } from './en.ts';
import type { PanelWords } from './en.ts';
import { pick } from './pick.ts';
import { PANEL_RO } from './ro.ts';

const TABLES = new Map<string, PanelWords>([
  ['en', PANEL_EN],
  ['ro', PANEL_RO],
]);

export function panelWordsFor(language: string | undefined): PanelWords {
  return pick(TABLES, language, PANEL_EN);
}
