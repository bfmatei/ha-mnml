import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { test } from 'vitest';

import { CORPUS_DIR, discoveries, homes } from './corpus.ts';
import { discover } from './discover.ts';
import { SHIPPED } from './shipped.ts';

const room = SHIPPED['room'];

function roomIn(home: string, area: string): Record<string, unknown> {
  const registries = homes()[home];
  assert.ok(registries && room, `${home} exists`);
  return discover(room, area, registries);
}

test('what every shipped template discovers in every corpus home is what was last accepted', () => {
  const expected: unknown = JSON.parse(readFileSync(join(CORPUS_DIR, 'expected.json'), 'utf8'));
  assert.deepEqual(discoveries(), expected, 'run pnpm run fix:corpus to accept a change');
});

test('the corpus has the tidy and the messy home, and a room finds its things in the tidy one', () => {
  assert.ok(Object.keys(homes()).includes('tidy') && Object.keys(homes()).includes('messy'));
  const found = roomIn('tidy', 'living');
  assert.equal(found['name'], 'Living');
  assert.equal(found['temperature'], 'sensor.living_temperature');
  assert.equal(found['window'], 'binary_sensor.living_window');
  assert.equal(found['door'], 'binary_sensor.living_door');
  assert.equal(found['lock'], 'lock.front_door');
  assert.deepEqual(found['heating'], { entity: 'climate.radiator' });
  assert.deepEqual(found['batteries'], ['sensor.window_battery']);
});

test('a hidden entity, an entity with no area and an entity with no device class are not found', () => {
  const found = roomIn('messy', 'den');
  assert.equal(
    found['window'],
    'binary_sensor.den_window_a',
    'not the hidden one, and not the vent',
  );
  assert.equal(found['humidity'], undefined);
  assert.equal(found['lock'], undefined);
  assert.equal(found['temperature'], 'sensor.multi_temperature', 'not the unavailable one');
});

test("an entity's own area beats its device's, and a device in no area has nothing in any room", () => {
  assert.deepEqual(roomIn('messy', 'loft')['batteries'], ['sensor.multi_battery']);
  assert.equal(roomIn('messy', 'den')['batteries'], undefined);
  const everywhere = Object.values(discoveries()['messy']?.['room'] ?? {}).flatMap((slots) =>
    Object.values(slots),
  );
  assert.ok(!JSON.stringify(everywhere).includes('orphan_temperature'));
  assert.ok(!JSON.stringify(everywhere).includes('light.floating'));
});

test('with two matches an entity slot takes the first, a diagnostic one last, and a device lists once', () => {
  const found = roomIn('messy', 'den');
  assert.equal(
    found['temperature'],
    'sensor.multi_temperature',
    'the diagnostic probe comes second',
  );
  assert.equal(
    found['heating'] === undefined ? '' : JSON.stringify(found['heating']),
    '{"entity":"climate.ac"}',
  );
  assert.deepEqual(found['cameras'], [{ entity: 'camera.cams_front' }]);
});

test("a user's own mnml_ labels decide their slots, even over the ranking and an entity with no class", () => {
  const found = roomIn('labelled', 'den');
  assert.equal(found['window'], 'binary_sensor.den_window_b', 'not the first by id');
  assert.equal(found['temperature'], 'sensor.multi_probe_temperature', 'not the primary one');
  assert.equal(
    found['humidity'],
    'sensor.den_unavailable_temperature',
    'an entity with no state at all',
  );
  assert.equal(
    roomIn('messy', 'den')['window'],
    'binary_sensor.den_window_a',
    'and the home without labels is unchanged',
  );
});

test("a tailnet's devices are found with their sensors, from the integration's own keys", () => {
  const registries = homes()['systems'];
  const tailscale = SHIPPED['tailscale'];
  assert.ok(registries && tailscale);
  const found = discover(tailscale, undefined, registries);
  assert.deepEqual(found['devices'], [
    {
      connected: 'binary_sensor.ts_phone_connected',
      ip_address: 'sensor.ts_phone_ip',
      last_seen: 'sensor.ts_phone_last_seen',
      expires: 'sensor.ts_phone_expires',
      update: 'binary_sensor.ts_phone_update',
      udp: 'binary_sensor.ts_phone_udp',
    },
    {
      connected: 'binary_sensor.ts_router_connected',
      ip_address: 'sensor.ts_router_ip',
      last_seen: 'sensor.ts_router_last_seen',
      expires: 'sensor.ts_router_expires',
      update: 'binary_sensor.ts_router_update',
      udp: 'binary_sensor.ts_router_udp',
    },
  ]);
});

test("a UniFi network's devices, latency probes, router load and firmware are found from the integration's own keys", () => {
  const registries = homes()['systems'];
  const unifi = SHIPPED['unifi-network'];
  assert.ok(registries && unifi);
  const found = discover(unifi, undefined, registries);
  assert.deepEqual(found['devices'], ['sensor.ap_state', 'sensor.gateway_state']);
  assert.deepEqual(found['latency'], ['sensor.gateway_cloudflare', 'sensor.gateway_google']);
  assert.deepEqual(found['router'], {
    cpu: 'sensor.gateway_cpu',
    temperature: 'sensor.gateway_cpu_temperature',
  });
  assert.deepEqual(found['firmware'], ['update.ap_firmware', 'update.gateway_firmware']);
});

test("a Proxmox host's load, backups and guests are found from the integration's own keys", () => {
  const registries = homes()['systems'];
  const server = SHIPPED['proxmox-server'];
  assert.ok(registries && server);
  const found = discover(server, undefined, registries);
  assert.equal(found['cpu'], 'sensor.server_cpu');
  assert.equal(found['memory'], 'sensor.server_memory');
  assert.equal(found['last_boot'], 'sensor.server_boot');
  assert.deepEqual(found['backups'], {
    last: 'sensor.server_last_backup',
    problem: 'binary_sensor.server_backup_status',
  });
  assert.deepEqual(found['guests'], [
    {
      status: 'binary_sensor.router_vm_status',
      cpu: 'sensor.router_vm_cpu',
      memory: 'sensor.router_vm_memory',
    },
    {
      status: 'binary_sensor.torrents_status',
      cpu: 'sensor.torrents_cpu',
      memory: 'sensor.torrents_memory',
    },
  ]);
});

test("a media server's streams, requests, movies and shows are found from the integrations' own keys", () => {
  const registries = homes()['systems'];
  const media = SHIPPED['media-server'];
  assert.ok(registries && media);
  const found = discover(media, undefined, registries);
  assert.equal(found['streams'], 'sensor.jellyfin_clients');
  assert.deepEqual(found['requests'], {
    pending: 'sensor.seerr_pending',
    processing: 'sensor.seerr_processing',
  });
  assert.deepEqual(found['movies'], {
    queue: 'sensor.radarr_queue',
    count: 'sensor.radarr_movies',
    health: 'binary_sensor.radarr_health',
    calendar: 'calendar.radarr',
  });
  assert.deepEqual(found['shows'], {
    queue: 'sensor.sonarr_queue',
    count: 'sensor.sonarr_shows',
    wanted: 'sensor.sonarr_wanted',
    upcoming: 'sensor.sonarr_upcoming',
    calendar: 'calendar.sonarr',
  });
});
