import assert from 'node:assert/strict';

import { afterEach, test, vi } from 'vitest';

import { EDITORS_EN } from '../words/panel/editors-en.ts';

import { formMissing, loadHaForm } from './ha-form.ts';

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'loadCardHelpers');
});

test("a page that has not loaded Home Assistant's dashboards says to open one, and asks only once", async () => {
  const first = await loadHaForm();
  assert.equal(first, 'unopened');
  assert.match(
    EDITORS_EN.forms.unopened,
    /none has been opened in this tab: open one, then come back/,
  );
  assert.equal(await loadHaForm(), first);
  assert.equal(formMissing(), first);
});

test('a dashboard page whose trick brings no form says to reload, and that MNML may need an update', async () => {
  vi.useFakeTimers();
  let made = 0;
  window.loadCardHelpers = () =>
    Promise.resolve({
      createCardElement(): HTMLElement {
        made += 1;
        return document.createElement('div');
      },
    });
  const loading = loadHaForm();
  await vi.advanceTimersByTimeAsync(20_000);
  assert.equal(await loading, 'failed');
  assert.match(EDITORS_EN.forms.failed, /did not load: reload the page; if it stays/);
  assert.equal(made, 1);
});

test('once the form is on the page, nothing is loaded and nothing is said', async () => {
  customElements.define('ha-form', class extends HTMLElement {});
  assert.equal(await loadHaForm(), undefined);
  assert.equal(formMissing(), undefined);
});
