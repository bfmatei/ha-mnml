import { writeFileSync } from 'node:fs';

import { format } from 'oxfmt';

import config from '../../oxfmt.config.ts';

import { INTERFACE_FILE, surface } from './interface.ts';

const { code, errors } = await format(
  INTERFACE_FILE,
  `${JSON.stringify(surface(), undefined, 2)}\n`,
  config,
);
if (errors.length > 0) {
  throw new Error(errors.map((error) => error.message).join('\n'));
}
writeFileSync(INTERFACE_FILE, code, 'utf8');
