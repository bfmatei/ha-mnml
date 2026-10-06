import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { fakeStore } from '../test/fake-hass.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlTemplateCardEditor } from './template-card.ts';

vi.mock('../templates/families.ts', async () => {
  const { familyNames, readFamily } = await import('../templates/shipped.ts');
  const owner = Object.fromEntries(
    familyNames()
      .filter((family) => family !== 'common')
      .flatMap((family) => Object.keys(readFamily(family)).map((name) => [name, family])),
  );
  return {
    COMMON_FAMILY: 'common',
    COMMON: readFamily('common'),
    OWNER: owner,
    SHAPES: {},
    loadFamily: (family: string): Promise<never> =>
      Promise.reject(new Error(`mnml-cards-${family}.json: 404 Not Found`)),
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

test('when the families cannot be fetched, the gallery keeps the common templates and says what failed', async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const editor = document.createElement('mnml-template-card-editor');
    assert.ok(editor instanceof MnmlTemplateCardEditor);
    editor.setConfig({ type: 'custom:mnml-template-card', template: '' });
    editor.hass = {
      ...fakeStore().hass,
      states: {},
      areas: { hall: { area_id: 'hall', name: 'Hall' } },
      devices: {},
      entities: {},
    } as never;
    const root = await mounted(editor);
    await settle();
    assert.ok(root.querySelector('[aria-label="Use section-heading"]'));
    assert.match(text(root), /the shipped templates could not be loaded/);
  } finally {
    quiet.mockRestore();
  }
});
