import { camerasOf, customizeOf, packageOf, precisionsOf, trackersOf } from '../demo/entities.ts';
import { DEMO } from '../demo/home.ts';
import { isMapping } from '../src/contract/templates.ts';

import { readEnv } from './env.ts';
import { connect } from './socket.ts';

interface RegistryEntry {
  entity_id: string;
  unique_id: string;
  platform: string;
  name: string | null;
  original_name: string | null;
  icon: string | null;
  options?: { sensor?: { display_precision?: number } };
}

interface Person {
  name: string;
}

const env = readEnv();

const { call, close } = await connect(env);

const api = async <T>(path: string, body?: object): Promise<T> => {
  const response = await fetch(`${env.HA_URL}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${env.HA_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await response.json()) as T;
};
const present = new Set(
  (await api<{ entity_id: string }[]>('states')).map((state) => state.entity_id),
);
for (const [camera, { name, file }] of camerasOf(DEMO)) {
  if (!present.has(camera)) {
    const flow = await api<{ flow_id: string }>('config/config_entries/flow', {
      handler: 'local_file',
    });
    const done = await api<{ type: string }>(`config/config_entries/flow/${flow.flow_id}`, {
      name,
      file_path: `/config/www/${file}`,
    });
    console.log(`${camera}: ${done.type === 'create_entry' ? 'added' : JSON.stringify(done)}`);
  }
}

const objectId = (id: string): string => id.slice(id.indexOf('.') + 1);
const { latitude, longitude } = await call<{ latitude: number; longitude: number }>({
  type: 'get_config',
});
const trackers = trackersOf(DEMO);
for (const [tracker, where] of trackers) {
  await call({
    type: 'call_service',
    domain: 'device_tracker',
    service: 'see',
    service_data:
      where === 'home'
        ? { dev_id: objectId(tracker), location_name: 'home', gps: [latitude, longitude] }
        : { dev_id: objectId(tracker), gps: [latitude + 0.04, longitude + 0.06] },
  });
}

const people = await call<{ storage: Person[]; config: Person[] }>({ type: 'person/list' });
const known = new Set([...people.storage, ...people.config].map((person) => person.name));
for (const person of DEMO.people) {
  const name = objectId(person.entity).replace(/^./, (letter) => letter.toUpperCase());
  if (!known.has(name)) {
    await call({
      type: 'person/create',
      name,
      device_trackers: person.devices.map((device) => device.tracker),
    });
  }
}
const wanted = new Map<string, { id: string; name: string }>();
const groups = packageOf(DEMO)['template'];
for (const group of Array.isArray(groups) ? groups : []) {
  for (const entry of Object.values(isMapping(group) ? group : {}).flat()) {
    if (isMapping(entry)) {
      const { unique_id: unique, default_entity_id: id, name } = entry;
      if (typeof unique === 'string' && typeof id === 'string' && typeof name === 'string') {
        wanted.set(unique, { id, name });
      }
    }
  }
}
const registry = await call<RegistryEntry[]>({ type: 'config/entity_registry/list' });
let overridden = 0;
for (const [entityId, wanted] of customizeOf(DEMO)) {
  const entry = registry.find((each) => each.entity_id === entityId);
  if (entry !== undefined && (entry.name !== wanted.name || entry.icon !== (wanted.icon ?? null))) {
    await call({
      type: 'config/entity_registry/update',
      entity_id: entityId,
      name: wanted.name,
      icon: wanted.icon ?? null,
    });
    overridden += 1;
  }
}
for (const [entityId, precision] of precisionsOf(DEMO)) {
  const entry = registry.find((each) => each.entity_id === entityId);
  if (entry !== undefined && entry.options?.sensor?.display_precision !== precision) {
    await call({
      type: 'config/entity_registry/update',
      entity_id: entityId,
      options_domain: 'sensor',
      options: { display_precision: precision },
    });
    overridden += 1;
  }
}
let renamed = 0;
let removed = 0;
const taken: string[] = [];
for (const entry of registry.filter(
  (each) => each.platform === 'template' && each.unique_id.startsWith('demo_'),
)) {
  const want = wanted.get(entry.unique_id);
  if (want === undefined) {
    await call({ type: 'config/entity_registry/remove', entity_id: entry.entity_id });
    removed += 1;
  } else if (entry.entity_id !== want.id) {
    taken.push(`${want.id} (the demo's is ${entry.entity_id})`);
  } else if ((entry.name ?? entry.original_name) !== want.name) {
    await call({
      type: 'config/entity_registry/update',
      entity_id: entry.entity_id,
      name: want.name,
    });
    renamed += 1;
  }
}
close();
console.log(
  `${trackers.size} device trackers seen, ${DEMO.people.length} people, ${renamed + overridden} names and icons brought in line, ${removed} entities the package no longer makes removed`,
);
if (taken.length > 0) {
  console.error(
    `another integration owns ${taken.join(', ')}: add each to SUPPLIED in demo/entities.ts`,
  );
  process.exitCode = 1;
}
