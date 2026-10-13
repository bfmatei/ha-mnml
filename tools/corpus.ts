import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readEnv } from './env.ts';
import { snapshotOf } from './snapshot.ts';
import type { Rows } from './snapshot.ts';
import { connect } from './socket.ts';

const session = await connect(readEnv());
const rows: Rows = {
  areas: await session.call<Rows['areas']>({ type: 'config/area_registry/list' }),
  devices: await session.call<Rows['devices']>({ type: 'config/device_registry/list' }),
  entities: await session.call<Rows['entities']>({ type: 'config/entity_registry/list' }),
  states: await session.call<Rows['states']>({ type: 'get_states' }),
};
session.close();

const snapshot = snapshotOf(rows);

const sorted = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sorted)
    : typeof value === 'object' && value !== null
      ? Object.fromEntries(
          Object.entries(value)
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([key, inner]) => [key, sorted(inner)]),
        )
      : value;

const file = resolve(import.meta.dirname, '../src/templates/corpus/demo.json');
writeFileSync(file, `${JSON.stringify(sorted(snapshot), undefined, 2)}\n`, 'utf8');
console.log(
  `${file}: ${rows.areas.length} areas, ${rows.devices.length} devices, ${Object.keys(snapshot.entities).length} entities`,
);
