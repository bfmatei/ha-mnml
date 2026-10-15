import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import type { explain } from '../templates/explain.ts';
import { fakeHass, fakeStore } from '../test/hass.ts';
import { created, define, mounted, updated } from '../test/render.ts';
import { until } from '../test/until.ts';

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
  const hass = { ...store.hass, areas: { living: { area_id: 'living', name: 'Living' } } };
  const editor = created('mnml-template-card-editor', MnmlTemplateCardEditor);
  editor.setConfig({ type: 'custom:mnml-template-card', template: 'roomy', area: 'living' });
  editor.hass = hass;
  const root = await mounted(editor);
  await until(() => explained.count > 0, 'what the area finds');
  await updated(root);
  const before = explained.count;
  editor.hass = fakeHass({ ...hass, states: { 'light.a': { state: 'on' } } });
  await updated(root);
  assert.equal(explained.count, before);
  editor.hass = { ...hass, areas: { ...hass.areas } };
  await until(() => explained.count === before + 1, 'the registries worked out again');
});
