import { readFileSync } from 'node:fs';

import { parse } from 'yaml';

import { DEMO } from '../demo/home.ts';
import { drawn } from '../src/home/view.ts';

import { readEnv } from './env.ts';

const SERVICES = new Set(['button.press']);

const env = readEnv();
const response = await fetch(`${env.HA_URL}/api/states`, {
  headers: { Authorization: `Bearer ${env.HA_TOKEN}` },
});
const states: unknown = await response.json();
const known = new Set(
  (Array.isArray(states) ? states : []).flatMap((state: unknown) => {
    const id: unknown =
      typeof state === 'object' && state !== null ? Reflect.get(state, 'entity_id') : undefined;
    return typeof id === 'string' ? [id] : [];
  }),
);
const ids = new Set<string>();
const walk = (value: unknown): void => {
  if (typeof value === 'string' && /^[a-z_]+\.[a-z0-9_]+$/.test(value) && !SERVICES.has(value)) {
    ids.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      walk(item);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key !== 'service' && key !== 'source') {
        walk(item);
      }
    }
  }
};
for (const file of ['examples/cards.yaml', 'examples/templates.yaml']) {
  walk(parse(readFileSync(file, 'utf8')));
}
walk(drawn(DEMO));
const missing = [...ids].filter((id) => !known.has(id));
console.log(missing.length === 0 ? `all ${ids.size} ids exist` : `missing: ${missing.join(', ')}`);
process.exitCode = missing.length === 0 ? 0 : 1;
