import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { fakeStore } from '../test/hass.ts';
import { created, define, mounted, text } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlTemplateGallery } from './gallery.ts';
import { MnmlTemplateCardEditor } from './template-card.ts';

vi.mock('../templates/families.ts', () => import('../test/families.ts'));

define('ha-form', class extends HTMLElement {});
define('mnml-template-gallery', MnmlTemplateGallery);
define('mnml-template-card-editor', MnmlTemplateCardEditor);

test('when the families cannot be fetched, the gallery keeps the common templates and says what failed', async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const editor = created('mnml-template-card-editor', MnmlTemplateCardEditor);
    editor.setConfig({ type: 'custom:mnml-template-card', template: '' });
    editor.hass = { ...fakeStore().hass, areas: { hall: { area_id: 'hall', name: 'Hall' } } };
    const root = await mounted(editor);
    await until(() => /could not be loaded/.test(text(root)), 'the failure');
    const gallery = root.querySelector('mnml-template-gallery')?.shadowRoot;
    assert.ok(gallery?.querySelector('[aria-label="Use Section heading"]'));
    assert.match(text(root), /the shipped templates could not be loaded/);
  } finally {
    quiet.mockRestore();
  }
});
