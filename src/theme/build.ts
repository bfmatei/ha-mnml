import { stringify } from 'yaml';

import { THEME } from './model.ts';
import { buildTheme } from './theme.ts';

export function renderTheme(): string {
  return stringify(buildTheme(THEME), {
    aliasDuplicateObjects: false,
    lineWidth: 0,
    singleQuote: true,
  });
}
