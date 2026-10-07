import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import { readTemplates } from '../templates/shipped.ts';
import { text } from '../test/render.ts';

vi.mock('../store/store.ts', () => ({
  onShared: () => () => undefined,
  sharedTemplates: () => ({ status: 'ready', own: {}, changes: {} }),
}));

vi.mock('./lovelace.ts', () => ({ loadLovelace: () => Promise.resolve() }));

vi.mock('../store/shipped.ts', () => ({
  SHIPPED_TEMPLATES: { need: () => Promise.resolve(), templates: () => readTemplates() },
}));

vi.mock(import('../editors/ha-form.ts'), async (original) => ({
  ...(await original()),
  loadHaForm: () => Promise.resolve(),
}));

const { MnmlPanel } = await import('./main.ts');

function hassWith(list: () => Promise<unknown>): object {
  return {
    ...HOME,
    locale: { language: 'en' },
    connection: {
      sendMessagePromise: (message: { type: string }) =>
        message.type === 'mnml/dashboards/list'
          ? list()
          : message.type === 'lovelace/dashboards/list'
            ? Promise.resolve([])
            : Promise.resolve({ views: [] }),
    },
  };
}

async function settled(
  panel: HTMLElement & { updateComplete: Promise<boolean> },
  rounds = 5,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await panel.updateComplete;
  if (rounds > 1) {
    await settled(panel, rounds - 1);
  }
}

test('a store that cannot be read says so on the Dashboards tab, rather than offering to build', async () => {
  const panel = new MnmlPanel();
  panel.hass = hassWith(() =>
    Promise.reject({ code: 'not_loaded', message: 'not loaded' }),
  ) as never;
  panel.route = { path: '/dashboards' };
  document.body.append(panel);
  await settled(panel);
  const page = text(panel.shadowRoot);
  assert.match(page, /MNML cannot read the dashboards it built: not loaded/);
  assert.equal(panel.shadowRoot?.querySelector('mnml-dashboards'), null);
  panel.remove();
});

test("the builder page follows Home Assistant's states, as the panel is given them", async () => {
  const panel = new MnmlPanel();
  panel.hass = hassWith(() => Promise.resolve({ dashboards: {} })) as never;
  panel.route = { path: '/dashboards/new' };
  document.body.append(panel);
  await settled(panel);
  const editor = panel.shadowRoot?.querySelector('mnml-plan-editor');
  assert.ok(editor);
  const next = hassWith(() => Promise.resolve({ dashboards: {} }));
  panel.hass = next as never;
  assert.equal(Reflect.get(editor, 'hass'), next);
  panel.remove();
});
