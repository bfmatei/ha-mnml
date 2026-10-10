import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

test('loading the bundle twice defines each card once and throws nothing', async () => {
  await import('./register.ts');
  const first = customElements.get('mnml-list-card');
  const slider = customElements.get('mnml-slider');
  assert.ok(first, 'mnml-list-card is defined');
  assert.ok(slider, 'and the slider its cards draw');
  vi.resetModules();
  await import('./register.ts');
  assert.equal(customElements.get('mnml-list-card'), first);
  assert.equal(customElements.get('mnml-slider'), slider);
  const types = (window.customCards ?? []).map((entry) => entry.type);
  assert.equal(types.filter((type) => type === 'mnml-list-card').length, 1);
});

const COLUMNS: Record<string, number> = {
  'mnml-heading-card': 12,
  'mnml-list-card': 12,
  'mnml-agenda-card': 12,
  'mnml-messages-card': 12,
  'mnml-clients-card': 12,
  'mnml-report-card': 12,
  'mnml-button-card': 6,
  'mnml-select-card': 6,
  'mnml-slider-card': 6,
  'mnml-entity-card': 12,
  'mnml-header-card': 12,
  'mnml-tile-card': 6,
  'mnml-media-card': 12,
  'mnml-car-plan-card': 12,
  'mnml-popups-card': 1,
  'mnml-template-card': 12,
};

test('each card asks for its share of a section: the small ones half, the pop-ups one column', async () => {
  await import('./register.ts');
  const types = (window.customCards ?? []).map((entry) => entry.type);
  assert.deepEqual(Object.keys(COLUMNS).toSorted(), types.toSorted());
  for (const [name, columns] of Object.entries(COLUMNS)) {
    const Card = customElements.get(name) as unknown as new () => { getGridOptions(): unknown };
    assert.deepEqual(new Card().getGridOptions(), { columns, rows: 'auto' }, name);
  }
});

test('every card has a picker entry with a name, a description, a docs link, and a stub', async () => {
  await import('./register.ts');
  for (const entry of window.customCards ?? []) {
    assert.match(entry.name, /^MNML /, entry.type);
    assert.ok(entry.description.length > 0, entry.type);
    assert.equal(
      entry.documentationURL,
      `https://github.com/bfmatei/ha-mnml/blob/main/docs/keys.md#${entry.type}`,
    );
    const Card = customElements.get(entry.type) as unknown as {
      getStubConfig?: unknown;
      getConfigElement?: unknown;
    };
    assert.equal(typeof Card.getStubConfig, 'function', entry.type);
    const editable = entry.type !== 'mnml-popups-card';
    assert.equal(typeof Card.getConfigElement, editable ? 'function' : 'undefined', entry.type);
  }
  assert.equal(window.customCards?.[0]?.type, 'mnml-template-card');
});
