import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { renderTheme } from './build.ts';
import { assertContrast } from './contrast.ts';
import { THEME } from './model.ts';

const [out = 'out'] = process.argv.slice(2);
const failures = assertContrast(THEME);
for (const failure of failures) {
  console.error(failure);
}
if (failures.length > 0) {
  console.error(`${failures.length} of the theme's contrast claims do not hold`);
  process.exitCode = 1;
} else {
  const dir = resolve(process.cwd(), out);
  const file = join(dir, 'mnml.yaml');
  const text = renderTheme();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, text, 'utf8');
  console.log(`wrote ${file} (${text.split('\n').length - 1} lines)`);
}
