import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { test } from 'vitest';

const HASSFEST = resolve(import.meta.dirname, 'hassfest.ts');

interface Run {
  status: number | null;
  output: string;
  docker: string;
}

function hassfest(docker: 'running' | 'stopped' | 'absent', ...args: string[]): Run {
  const bin = mkdtempSync(join(tmpdir(), 'mnml-hassfest-'));
  try {
    const log = join(bin, 'docker.log');
    writeFileSync(log, '');
    if (docker !== 'absent') {
      const info = docker === 'running' ? 'exit 0' : 'exit 1';
      writeFileSync(
        join(bin, 'docker'),
        `#!/bin/sh\necho "$@" >> '${log}'\ncase "$1" in\n  info) ${info} ;;\n  run) exit 3 ;;\nesac\n`,
      );
      chmodSync(join(bin, 'docker'), 0o755);
    }
    const run = spawnSync(process.execPath, [HASSFEST, ...args], {
      encoding: 'utf8',
      env: { PATH: bin },
    });
    return {
      status: run.status,
      output: run.stdout + run.stderr,
      docker: readFileSync(log, 'utf8'),
    };
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

test('hassfest runs in Docker on this checkout, read-only, and fails as the container fails', () => {
  const { status, docker } = hassfest('running');
  assert.equal(status, 3);
  assert.equal(
    docker.split('\n')[1],
    `run --rm --platform linux/amd64 -v ${process.cwd()}:/github/workspace:ro ghcr.io/home-assistant/hassfest`,
  );
});

test('without Docker, hassfest is skipped and says so, and the check goes on', () => {
  for (const docker of ['stopped', 'absent'] as const) {
    const { status, output } = hassfest(docker);
    assert.equal(status, 0, docker);
    assert.match(
      output,
      /^check:hassfest skipped: Docker is not running; CI's hassfest job runs it\n$/,
    );
  }
});

test('where hassfest is required, as in CI, no Docker is a failure', () => {
  assert.equal(hassfest('stopped', '--required').status, 3);
  const absent = hassfest('absent', '--required');
  assert.equal(absent.status, 1);
  assert.match(absent.output, /docker/);
});
