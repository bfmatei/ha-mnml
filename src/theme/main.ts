import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { renderTheme } from './build.ts';
import { assertContrast } from './contrast.ts';
import { THEMES } from './model.ts';

const FILES = { glass: 'mnml.yaml', flat: 'mnml-flat.yaml' } as const;

const [out = 'out'] = process.argv.slice(2);
const dir = resolve(process.cwd(), out);
let failed = 0;
for (const [design, theme] of Object.entries(THEMES)) {
  const failures = assertContrast(theme);
  for (const failure of failures) {
    console.error(`${design}: ${failure}`);
  }
  failed += failures.length;
}
if (failed > 0) {
  console.error(`${failed} of the themes' contrast claims do not hold`);
  process.exitCode = 1;
} else {
  mkdirSync(dir, { recursive: true });
  for (const [design, theme] of Object.entries(THEMES)) {
    const file = join(dir, FILES[theme.design]);
    const text = renderTheme(theme);
    writeFileSync(file, text, 'utf8');
    console.log(`wrote ${file} (${design}, ${text.split('\n').length - 1} lines)`);
  }
}
