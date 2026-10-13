import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { explain } from '../templates/explain.ts';
import { fakeStore } from '../test/fake-hass.ts';
import { define, mounted } from '../test/render.ts';

import { MnmlTemplateCardEditor } from './template-card.ts';

const explained = vi.hoisted(() => ({ count: 0 }));

vi.mock('../templates/explain.ts', async (original) => {
  const real = await original<{ explain: typeof explain }>();
  return {
    ...real,
    explain: (...args: Parameters<typeof explain>): ReturnType<typeof explain> => {
      explained.count += 1;
      return real.explain(...args);
    },
  };
});

define('ha-form', class extends HTMLElement {});
define('mnml-template-card-editor', MnmlTemplateCardEditor);

const settle = async (rounds = 6): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  if (rounds > 1) {
    await settle(rounds - 1);
  }
};

test('what an area finds is worked out again only when the registries change, not on every state', async () => {
  const store = fakeStore();
  store.kept = {
    roomy: {
      kind: 'own',
      template: {
        slots: { name: { kind: 'text', required: true, discover: 'area.name' } },
        card: { type: 'custom:mnml-heading-card', title: '[[name]]', icon: 'mdi:sofa' },
      },
    },
  };
  const hass = {
    ...store.hass,
    areas: { living: { area_id: 'living', name: 'Living' } },
    devices: {},
    entities: {},
    states: {},
  };
  const editor = document.createElement('mnml-template-card-editor');
  assert.ok(editor instanceof MnmlTemplateCardEditor);
  editor.setConfig({ type: 'custom:mnml-template-card', template: 'roomy', area: 'living' });
  editor.hass = hass as never;
  await mounted(editor);
  await settle();
  const before = explained.count;
  assert.ok(before > 0);
  editor.hass = { ...hass, states: { 'light.a': { entity_id: 'light.a', state: 'on' } } } as never;
  await settle();
  assert.equal(explained.count, before);
  editor.hass = { ...hass, areas: { ...hass.areas } } as never;
  await settle();
  assert.equal(explained.count, before + 1);
});
