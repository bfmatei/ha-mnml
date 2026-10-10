import { readFileSync, readdirSync, rmSync } from 'node:fs';

import { parse } from 'yaml';

import { DEMO } from '../demo/home.ts';
import { build } from '../src/home/view.ts';

import { readEnv } from './env.ts';
import { connect } from './socket.ts';

interface Resource {
  id: string;
  url: string;
}

interface Dashboard {
  id: string;
  url_path: string;
  title: string;
}

const env = readEnv();
const { call, close } = await connect(env);

for (const name of readdirSync('.ha/www').filter((name) => name.startsWith('mnml-cards'))) {
  rmSync(`.ha/www/${name}`);
}
rmSync('.ha/themes/mnml.yaml', { force: true });
const resources = await call<Resource[]>({ type: 'lovelace/resources' });
for (const stale of resources.filter((entry) => entry.url.startsWith('/local/mnml'))) {
  await call({ type: 'lovelace/resources/delete', resource_id: stale.id });
}
const entries = await call<{ entry_id: string }[]>({ type: 'config_entries/get', domain: 'mnml' });
const [entry] = entries;
if (entry === undefined) {
  const headers = { authorization: `Bearer ${env.HA_TOKEN}`, 'content-type': 'application/json' };
  const started = await fetch(`${env.HA_URL}/api/config/config_entries/flow`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ handler: 'mnml' }),
  });
  if (!started.ok) {
    throw new Error(`adding MNML answered ${started.status}: ${await started.text()}`);
  }
  const { flow_id } = (await started.json()) as { flow_id: string };
  const chosen = await fetch(`${env.HA_URL}/api/config/config_entries/flow/${flow_id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ glass: true, default_theme: false }),
  });
  if (!chosen.ok) {
    throw new Error(`setting MNML up answered ${chosen.status}: ${await chosen.text()}`);
  }
} else {
  await call({
    type: 'call_service',
    domain: 'homeassistant',
    service: 'reload_config_entry',
    service_data: { entry_id: entry.entry_id },
  });
}
const dashboards = await call<Dashboard[]>({ type: 'lovelace/dashboards/list' });
const place = async (
  url_path: string,
  title: string,
  config: unknown,
  sidebar = true,
): Promise<void> => {
  const existing = dashboards.find((entry) => entry.url_path === url_path);
  if (existing === undefined) {
    await call({
      type: 'lovelace/dashboards/create',
      url_path,
      title,
      mode: 'storage',
      show_in_sidebar: sidebar,
      require_admin: false,
    });
  } else if (existing.title !== title) {
    await call({ type: 'lovelace/dashboards/update', dashboard_id: existing.id, title });
  }
  await call({ type: 'lovelace/config/save', url_path, config });
};
const retired = dashboards.find((entry) => entry.url_path === 'mnml-templates');
if (retired !== undefined) {
  await call({ type: 'lovelace/dashboards/delete', dashboard_id: retired.id });
}
const templates: unknown = parse(readFileSync('examples/home-templates.yaml', 'utf8'));
for (const [name, template] of Object.entries(
  typeof templates === 'object' && templates !== null ? templates : {},
)) {
  await call({ type: 'mnml/templates/save', name, entry: { kind: 'own', template } });
}
await place('mnml-examples', 'MNML Cards', {
  views: ['examples/cards.yaml', 'examples/templates.yaml'].flatMap((file): unknown[] => {
    const views: unknown = Reflect.get(parse(readFileSync(file, 'utf8')) ?? {}, 'views');
    return Array.isArray(views) ? views : [];
  }),
});
await place('mnml-demo', 'MNML Cards demo', build(DEMO));
await call({ type: 'call_service', domain: 'frontend', service: 'reload_themes' });
console.log('saved the home templates, mnml-examples and mnml-demo, with the MNML integration');
close();
