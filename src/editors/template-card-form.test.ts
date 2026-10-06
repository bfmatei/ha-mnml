import assert from 'node:assert/strict';

import { test } from 'vitest';

import { MnmlTemplateCardEditor } from './template-card.ts';

test("without Home Assistant's form, the template card's editor refuses, so Home Assistant opens YAML", () => {
  customElements.define('mnml-template-card-editor', MnmlTemplateCardEditor);
  const editor = document.createElement('mnml-template-card-editor');
  assert.ok(editor instanceof MnmlTemplateCardEditor);
  assert.throws(() => {
    editor.setConfig({ type: 'custom:mnml-template-card', template: 'section-heading' });
  }, /Home Assistant's form is not loaded/);
});
