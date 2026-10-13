import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

import { test } from 'vitest';

const NOTES = resolve(import.meta.dirname, 'notes.ts');

function notesSince(tag: string, recorded: string | undefined): string {
  const bin = mkdtempSync(join(tmpdir(), 'mnml-notes-'));
  try {
    const record = join(bin, 'interface.json');
    const show = recorded === undefined ? 'exit 128' : `cat '${record}'`;
    if (recorded !== undefined) {
      writeFileSync(record, recorded);
    }
    writeFileSync(
      join(bin, 'git'),
      `#!/bin/sh\ncase "$1" in\n  rev-parse) echo ${'0'.repeat(40)} ;;\n  show) ${show} ;;\n  *) exit 1 ;;\nesac\n`,
    );
    chmodSync(join(bin, 'git'), 0o755);
    return execFileSync(process.execPath, [NOTES, tag], {
      encoding: 'utf8',
      env: { PATH: [bin, '/usr/bin', '/bin'].join(delimiter) },
    });
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

test('the notes of a release whose previous tag recorded another format say so, and list nothing', () => {
  assert.equal(
    notesSince('v0.11.0', JSON.stringify({ cards: { 'custom:mnml-list-card': ['title'] } })),
    "## Interface changes since v0.11.0\n\nThe interface record's format changed since v0.11.0, so nothing is listed: compare its `interface.json` with this one by hand.\n",
  );
});

test('the notes of a release whose previous tag recorded no interface say so', () => {
  assert.equal(
    notesSince('v0.10.0', undefined),
    '## Interface changes since v0.10.0\n\nv0.10.0 records no `interface.json`, so there is nothing to compare.\n',
  );
});
