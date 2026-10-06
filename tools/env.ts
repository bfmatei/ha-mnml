import { readFileSync } from 'node:fs';

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface Env {
  HA_URL: string;
  HA_TOKEN: string;
}

export function readEnv(file = '.env'): Env {
  const pairs = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const [key = '', value = ''] = line.split(/=(.*)/s);
      return [key.trim(), value.trim()] as const;
    });
  const values = new Map(pairs);
  const url = values.get('HA_URL') ?? '';
  const token = values.get('HA_TOKEN') ?? '';
  const host = URL.canParse(url) ? new URL(url).hostname : '';
  if (!LOCAL.has(host)) {
    throw new Error(
      `HA_URL must name a local Home Assistant (localhost), not ${host || 'nothing'}`,
    );
  }
  return { HA_URL: url, HA_TOKEN: token };
}
