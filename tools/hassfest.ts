import { spawnSync } from 'node:child_process';

const IMAGE = 'ghcr.io/home-assistant/hassfest';
const required = process.argv.slice(2).includes('--required');
const running = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
if (running || required) {
  const run = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--platform',
      'linux/amd64',
      '-v',
      `${process.cwd()}:/github/workspace:ro`,
      IMAGE,
    ],
    { stdio: 'inherit' },
  );
  if (run.error !== undefined) {
    console.error(`docker: ${run.error.message}`);
  }
  process.exitCode = run.status ?? 1;
} else {
  console.log("check:hassfest skipped: Docker is not running; CI's hassfest job runs it");
}
