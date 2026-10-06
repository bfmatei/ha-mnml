import { resolve } from 'node:path';

import { buildBundle } from './bundle.ts';
import { BUNDLE } from './names.ts';

const [out = 'out'] = process.argv.slice(2);
const file = resolve(process.cwd(), out, BUNDLE);
console.log(`wrote ${file} (${await buildBundle(file)} bytes), its map and the template families`);
