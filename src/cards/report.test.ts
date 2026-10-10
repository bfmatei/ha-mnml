import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import { MnmlReportCard } from './report.ts';

define('mnml-report-card', MnmlReportCard);

const CONFIG = { type: 'custom:mnml-report-card', entity: 'sensor.checks', title: 'Failed checks' };

const DETAILS = [
  '2 failed:',
  '  ha: 22 names in sentence case',
  '       sensor.a: "A B", expected "A b"',
  '       ... 4 more',
  '  media: 14 Jellyfin answers over HTTPS',
].join('\n');

function hassWith(attributes: Record<string, unknown>): unknown {
  return {
    states: { 'sensor.checks': { entity_id: 'sensor.checks', state: '2', attributes } },
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
  };
}

async function paint(attributes: Record<string, unknown>, config: unknown = CONFIG) {
  const made = document.createElement('mnml-report-card');
  assert.ok(made instanceof MnmlReportCard);
  made.setConfig(config as never);
  made.hass = hassWith(attributes) as never;
  return mounted(made);
}

test('each line at the first indent is an entry, the deeper lines under it its details', async () => {
  const root = await paint({ details: DETAILS });
  const entries = [...root.querySelectorAll('.entry')];
  assert.equal(entries.length, 2);
  assert.equal(text(entries[0]?.querySelector('.title')), 'ha: 22 names in sentence case');
  assert.deepEqual(
    [...(entries[0]?.querySelectorAll('.detail') ?? [])].map((node) => text(node)),
    ['sensor.a: "A B", expected "A b"', '... 4 more'],
  );
  assert.equal(text(entries[1]?.querySelector('.title')), 'media: 14 Jellyfin answers over HTTPS');
  assert.equal(entries[1]?.querySelectorAll('.detail').length, 0);
});

test('the heading carries the title and the count, and an unindented line is no entry', async () => {
  const root = await paint({ details: DETAILS });
  assert.equal(text(root.querySelector('.heading [role="heading"]')), 'Failed checks');
  assert.equal(text(root.querySelector('.heading .state')), '2');
});

test('a missing, empty or all-clear attribute draws nothing', async () => {
  const roots = await Promise.all(
    [{}, { details: '' }, { details: 'all ok' }, { details: 3 }].map((attributes) =>
      paint(attributes),
    ),
  );
  for (const root of roots) {
    assert.equal(root.querySelector('.entry'), null);
  }
});

test('a report card without an entity is an error card', () => {
  const made = document.createElement('mnml-report-card');
  assert.ok(made instanceof MnmlReportCard);
  assert.throws(() => {
    made.setConfig({ type: 'custom:mnml-report-card' } as never);
  }, /entity is required/);
});
