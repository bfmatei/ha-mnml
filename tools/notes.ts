import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { FORMAT, INTERFACE_FILE, notes, readSurface } from '../src/contract/interface.ts';

const ROOT = dirname(INTERFACE_FILE);

function git(args: readonly string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

const [tag] = process.argv.slice(2);
const now = readSurface(readFileSync(INTERFACE_FILE, 'utf8'));
if (tag === undefined) {
  console.error('usage: node tools/notes.ts <previous-tag>');
  process.exitCode = 2;
} else if (now === undefined) {
  console.error(`interface.json is not of format ${FORMAT}: run pnpm run fix:interface`);
  process.exitCode = 1;
} else if (git(['rev-parse', '--verify', '--quiet', `${tag}^{commit}`]) === undefined) {
  console.error(`${tag} names no commit`);
  process.exitCode = 1;
} else {
  process.stdout.write(notes(tag, git(['show', `${tag}:interface.json`]), now));
}
