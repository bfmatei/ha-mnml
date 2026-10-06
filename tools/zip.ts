import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ZIP = resolve('mnml.zip');
const BUILT = ['mnml-cards-loader.js', 'mnml-cards.js', 'mnml-cards-panel.js', 'mnml.yaml'];
if (BUILT.some((name) => !existsSync(`custom_components/mnml/www/${name}`))) {
  throw new Error('custom_components/mnml/www/ is not built: run pnpm build first');
}
rmSync(ZIP, { force: true });
execFileSync('zip', ['-qr', ZIP, '.', '-x', '*__pycache__*'], {
  cwd: 'custom_components/mnml',
  stdio: 'inherit',
});
console.log(`wrote ${ZIP}`);
