import { stringify } from 'yaml';

import type { Theme } from './model.ts';
import { buildTheme } from './theme.ts';

export function renderTheme(theme: Theme): string {
  return stringify(buildTheme(theme), {
    aliasDuplicateObjects: false,
    lineWidth: 0,
    singleQuote: true,
  });
}
