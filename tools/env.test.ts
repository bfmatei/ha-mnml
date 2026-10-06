import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test } from 'vitest';

import { readEnv } from './env.ts';

function envFile(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-env-'));
  writeFileSync(join(dir, '.env'), text);
  return dir;
}

test('the tools talk to a local Home Assistant only', () => {
  const local = envFile('HA_URL=http://localhost:8124\nHA_TOKEN=abc\n');
  const home = envFile('HA_URL=https://home.example.org\nHA_TOKEN=abc\n');
  try {
    assert.equal(readEnv(join(local, '.env')).HA_URL, 'http://localhost:8124');
    assert.throws(() => readEnv(join(home, '.env')), /local Home Assistant/);
  } finally {
    rmSync(local, { recursive: true });
    rmSync(home, { recursive: true });
  }
});
