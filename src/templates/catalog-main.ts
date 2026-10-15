import { writeFileSync } from 'node:fs';

import { CATALOG_FILE, catalogText } from './catalog.ts';

writeFileSync(CATALOG_FILE, catalogText());
