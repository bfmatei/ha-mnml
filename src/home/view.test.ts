import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DEMO } from '../../demo/home.ts';

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
      assert.equal(values.length, headers.length - 1, `row ${String(row['entity'])}`);
      checked += 1;
    }
  });
  assert.ok(checked > 0, 'there are table rows to check');
});

const SURFACE: Record<string, string> = {
  'custom:mnml-popups-card': 'open, popups, type, width',
  'custom:mnml-agenda-card': 'icon, sources, title, type',
  'custom:mnml-button-card': 'entity, service, type',
  'custom:mnml-car-plan-card':
    'doors, hood, icon, sunroof, tailgate, title, type, tyre_low_share, tyre_targets, tyre_warn_share, tyres, windows',
  'custom:mnml-clients-card': 'entity, fold, names, networks, type',
  'custom:mnml-entity-card':
    'color, controls, entity, icon, items, label, name, popup, state, strip_word, type, visibility, when',
  'custom:mnml-header-card': 'back, color, controls, entity, icon, label, name, state, type, when',
  'custom:mnml-heading-card': 'controls, grid_options, icon, state, title, type, visibility',
  'custom:mnml-list-card': 'fold, headers, icon, lowest_first, rows, summary, title, type',
  'custom:mnml-media-card': 'entity, popup, type',
  'custom:mnml-messages-card': 'clear, entity, sources, type',
  'custom:mnml-select-card':
    'active_scene, attribute, entity, icon, name, scenes, type, visibility',
  'custom:mnml-slider-card': 'color, entity, icon, name, slider, turn_on, type, visibility',
  'custom:mnml-tile-card':
    'chips, entity, grid_options, icon, item, label, name, popup, problems, state, type',
  grid_options: 'columns',
  indicator: 'color, entity, type',
  item: 'color, controls, entity, popup, state',
  items: 'color, controls, entity, state, strip_word',
  nav: 'color, entity, popup, type, when',
  networks: 'icon, name, subnet',
  popups: 'cards, hash',
  problems: 'batteries, leaks',
  rows: 'bar, color, critical, critical_high, entity, flag, high, label, low, name, of, relative, reset, show, strip, values, when, words, zero_when_empty',
  rules: 'color, entities, is, label, not, words',
  scenes: 'active_scene, icon, name, scenes, type',
  select: 'attribute, color, entity, primary, show, type, when',
  service: 'entity, icon, name, primary, service, show, type',
  show: 'entity, is, not',
  slider: 'color, entity, icon, name, show, slider, type',
  sources: 'entity, kind, name, source',
  state: 'attribute, entity, icon, minutes, name, serial, text, when',
  status: 'icon, name, rules, type',
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
