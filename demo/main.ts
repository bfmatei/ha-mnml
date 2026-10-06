import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { toYaml } from '../src/contract/yaml.ts';
import { build } from '../src/home/view.ts';

import { DEMO } from './home.ts';

const OUT = resolve(import.meta.dirname, '../out/demo.yaml');

const text = toYaml(build(DEMO));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, text, 'utf8');
console.log(`wrote ${OUT} (${text.split('\n').length - 1} lines)`);
