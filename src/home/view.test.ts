import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DEMO } from '../../demo/home.ts';

import type { Home } from './types.ts';
import { build, drawn } from './view.ts';

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(
  value: unknown,
  visit: (node: Json, parentKey: string) => void,
  parentKey = 'root',
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit, parentKey);
    }
    return;
  }
  if (!isJson(value)) {
    return;
  }
  visit(value, parentKey);
  for (const [key, child] of Object.entries(value)) {
    walk(child, visit, key);
  }
}

const dashboard = drawn(DEMO);

test('every table row fills exactly the columns its card declares', () => {
  let checked = 0;
  walk(dashboard, (node) => {
    const headers = node['headers'];
    if (node['type'] !== 'custom:mnml-list-card' || !Array.isArray(headers)) {
      return;
    }
    const rows: unknown = node['rows'];
    assert.ok(Array.isArray(rows));
    for (const row of rows) {
      assert.ok(isJson(row));
      const values = row['values'];
      if (values === undefined) {
        continue;
      }
      assert.ok(Array.isArray(values));
      const columns: number = headers.length - 1;
      const shared: boolean = rows.some(
        (other: unknown) => isJson(other) && other['of'] !== undefined,
      );
      assert.ok(
        values.length === columns || (shared && values.length === columns - 1),
        `row ${String(row['entity'])}`,
      );
      checked += 1;
    }
  });
  assert.ok(checked > 0, 'there are table rows to check');
});

const SURFACE: Record<string, string> = {
  'custom:mnml-popups-card': 'open, popups, type, width',
  'custom:mnml-agenda-card': 'icon, sources, title, type',
  'custom:mnml-button-card': 'entity, service, type, visibility',
  'custom:mnml-car-plan-card':
    'doors, hood, icon, sunroof, tailgate, title, type, tyre_low_share, tyre_targets, tyre_warn_share, tyres, windows',
  'custom:mnml-clients-card': 'entity, fold, names, networks, type',
  'custom:mnml-entity-card':
    'color, controls, entity, icon, items, label, name, popup, state, strip_word, type, visibility, when',
  'custom:mnml-header-card': 'back, color, controls, entity, icon, label, name, state, type, when',
  'custom:mnml-glances-card': 'grid_options, items, type',
  'custom:mnml-heading-card': 'grid_options, icon, state, title, type, visibility',
  'custom:mnml-list-card': 'fold, headers, icon, lowest_first, rows, summary, title, type',
  'custom:mnml-media-card': 'entity, popup, type',
  'custom:mnml-messages-card': 'clear, entity, sources, type',
  'custom:mnml-report-card': 'colors, entity, icon, title, type',
  'custom:mnml-weather-card': 'entity, title, type',
  'custom:mnml-select-card':
    'active_scene, attribute, entity, icon, name, scenes, type, visibility',
  'custom:mnml-slider-card': 'color, entity, icon, name, slider, turn_on, type, visibility',
  'custom:mnml-tile-card':
    'chips, entity, grid_options, icon, item, label, name, popup, state, type',
  grid_options: 'columns',
  indicator: 'color, entity, show, type',
  item: 'color, controls, entity, popup, state',
  items:
    'alert, bare, below, color, controls, critical, entities, entity, icon, is, name, people, popup, quiet, show, state, strip_word, sum, toggle, when',
  nav: 'color, entity, popup, type, when',
  networks: 'icon, name, subnet',
  popups: 'cards, hash',
  rows: 'bar, color, critical, critical_high, entity, flag, high, label, low, low_only, name, of, relative, reset, show, strip, values, when, words, zero_when_empty',
  rules: 'below, color, entities, is, label, not, words',
  scenes: 'active_scene, icon, name, scenes, type',
  select: 'attribute, color, entity, primary, show, type, when',
  service: 'entity, icon, name, primary, service, show, type',
  show: 'entity, is, not',
  slider: 'color, entity, icon, name, show, slider, type',
  sources: 'entity, kind, name, source',
  state: 'attribute, entity, icon, minutes, name, serial, text, when',
  status: 'icon, name, rules, silent, type',
  toggle: 'color, entity, icon, primary, show, type, when',
  tyres: 'low_share, targets, type, tyres, warn_share',
  visibility: 'condition, entity, state_not',
  when: 'entity, is, not',
};

test('the contract surface the generator writes has not drifted', () => {
  const found = new Map<string, Set<string>>();
  walk(dashboard, (node, parentKey) => {
    const bucket = typeof node['type'] === 'string' ? node['type'] : parentKey;
    let keys = found.get(bucket);
    if (keys === undefined) {
      keys = new Set();
      found.set(bucket, keys);
    }
    for (const [key, value] of Object.entries(node)) {
      if (value !== undefined) {
        keys.add(key);
      }
    }
  });
  for (const [bucket, expected] of Object.entries(SURFACE)) {
    const keys = found.get(bucket);
    assert.ok(keys, `${bucket} is still written`);
    assert.equal([...keys].sort().join(', '), expected, bucket);
  }
});

test('build() is a pure function of the home', () => {
  assert.equal(JSON.stringify(build(DEMO)), JSON.stringify(build(DEMO)));
});

test('the dashboard names no minimal- card any more', () => {
  assert.ok(!JSON.stringify(build(DEMO)).includes('minimal-'));
});

function titles(home: typeof DEMO): unknown[] {
  return (build(home).views[0]?.sections ?? []).map((section) => {
    const [first] = section.cards;
    return first !== undefined && 'slots' in first ? first.slots?.['title'] : undefined;
  });
}

test('the untitled outlook comes first, the titled sections in the order the home gives, the pop-up shell last', () => {
  assert.deepEqual(titles(DEMO), [
    undefined,
    DEMO.sections.rooms,
    DEMO.sections.people,
    DEMO.sections.garage,
    DEMO.sections.infrastructure,
    undefined,
  ]);
  assert.deepEqual(titles({ ...DEMO, order: ['rooms', 'garage', 'infrastructure', 'people'] }), [
    undefined,
    DEMO.sections.rooms,
    DEMO.sections.garage,
    DEMO.sections.infrastructure,
    DEMO.sections.people,
    undefined,
  ]);
});

function checksButtons(home: Home, suffix: string): Json[] {
  const found: Json[] = [];
  walk(drawn(home), (node) => {
    if (
      node['type'] === 'custom:mnml-button-card' &&
      node['service'] === 'button.press' &&
      typeof node['entity'] === 'string' &&
      node['entity'].endsWith(suffix)
    ) {
      found.push(node);
    }
  });
  return found;
}

test('the server and checks pop-ups draw a button that runs the checks only when the home gives one', () => {
  assert.deepEqual(
    checksButtons(DEMO, '_checks_run').map((node) => node['entity']),
    ['button.infrastructure_server_checks_run', 'button.infrastructure_server_checks_run'],
  );
  const without = structuredClone(DEMO);
  const checks = without.system.proxmox?.checks;
  assert.ok(checks);
  delete checks.run;
  assert.deepEqual(checksButtons(without, '_checks_run'), []);
});

test('the same pop-ups draw a stop button that shows only while its entity is available', () => {
  const stops = checksButtons(DEMO, '_checks_stop');
  assert.equal(stops.length, 2);
  for (const node of stops) {
    assert.deepEqual(node['visibility'], [
      {
        condition: 'state',
        entity: 'button.infrastructure_server_checks_stop',
        state_not: 'unavailable',
      },
    ]);
  }
  const without = structuredClone(DEMO);
  const checks = without.system.proxmox?.checks;
  assert.ok(checks);
  delete checks.stop;
  assert.deepEqual(checksButtons(without, '_checks_stop'), []);
});
