import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Env } from './env.ts';
import { readEnv } from './env.ts';
import { connect } from './socket.ts';

const NAME = 'mnml-ha';
const PORT = 8124;
const IMAGE = 'ghcr.io/home-assistant/home-assistant:beta';
const URL = `http://localhost:${PORT}`;
const OWNER = { name: 'Demo', username: 'demo', password: 'demo' };
const CONFIG = [
  'default_config:',
  'demo:',
  'frontend:',
  '  themes: !include_dir_merge_named themes',
  'homeassistant:',
  '  packages: !include_dir_named packages',
  '',
].join('\n');

const run = (command: string, args: string[]): void => {
  execFileSync(command, args, { stdio: 'inherit' });
};
const node = (script: string): void => {
  run(process.execPath, [script]);
};

interface Step {
  step: string;
  done: boolean;
}

async function ready(): Promise<Step[]> {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${URL}/manifest.json`)).ok) {
        const onboarding = await fetch(`${URL}/api/onboarding`);
        return onboarding.ok ? ((await onboarding.json()) as Step[]) : [];
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 2000));
  }
  throw new Error(`Home Assistant did not answer at ${URL} within five minutes`);
}

async function running(): Promise<void> {
  const { call, close } = await connect(readEnv());
  try {
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
      const { state } = await call<{ state: string }>({ type: 'get_config' });
      if (state === 'RUNNING') {
        return;
      }
      await new Promise((done) => setTimeout(done, 2000));
    }
    throw new Error('Home Assistant did not finish starting within five minutes');
  } finally {
    close();
  }
}

async function post<T>(path: string, body: object, token?: string): Promise<T> {
  const response = await fetch(`${URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function onboard(): Promise<void> {
  const client_id = `${URL}/`;
  const { auth_code } = await post<{ auth_code: string }>('/api/onboarding/users', {
    client_id,
    language: 'en',
    ...OWNER,
  });
  const tokens = await fetch(`${URL}/auth/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'authorization_code', code: auth_code, client_id }),
  }).then(async (response) => (await response.json()) as { access_token: string });
  await post('/api/onboarding/core_config', {}, tokens.access_token);
  await post('/api/onboarding/analytics', {}, tokens.access_token);
  await post(
    '/api/onboarding/integration',
    { client_id, redirect_uri: `${URL}/?auth_callback=1` },
    tokens.access_token,
  );
  const owner: Env = { HA_URL: URL, HA_TOKEN: tokens.access_token };
  const { call, close } = await connect(owner);
  const token = await call<string>({
    type: 'auth/long_lived_access_token',
    client_name: 'MNML Cards demo',
    lifespan: 3650,
  });
  close();
  writeFileSync('.env', `HA_URL=${URL}\nHA_TOKEN=${token}\n`, { mode: 0o600 });
}

for (const dir of ['.ha/www', '.ha/themes', '.ha/packages']) {
  mkdirSync(dir, { recursive: true });
}
if (!existsSync('.ha/configuration.yaml')) {
  writeFileSync('.ha/configuration.yaml', CONFIG);
}
copyFileSync('recipes/messages.yaml', '.ha/packages/messages.yaml');
copyFileSync('examples/fixtures.yaml', '.ha/packages/fixtures.yaml');
node('demo/entities.ts');
run('pnpm', ['run', '--silent', 'build']);

try {
  execFileSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
} catch {}
run('docker', [
  'run',
  '-d',
  '--name',
  NAME,
  '-p',
  `127.0.0.1:${PORT}:8123`,
  '-v',
  `${resolve('.ha')}:/config`,
  '-v',
  `${resolve('custom_components/mnml')}:/config/custom_components/mnml:ro`,
  IMAGE,
]);
const steps = await ready();
if (!existsSync('.env')) {
  if (!steps.some((step) => step.step === 'user' && !step.done)) {
    throw new Error(
      `.ha/ already has an owner and there is no .env: write HA_URL=${URL} and a long-lived HA_TOKEN into .env, or delete .ha/ to start over`,
    );
  }
  await onboard();
  console.log(`made the owner ${OWNER.username} (password ${OWNER.password}) and wrote .env`);
}
await running();

node('tools/demo.ts');
node('tools/areas.ts');
node('tools/ids.ts');
node('tools/dashboard.ts');
console.log(`the demo: ${URL}/mnml-demo/home, the examples: ${URL}/mnml-examples`);
