import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

const listening = vi.hoisted(() => ({ added: 0, removed: 0, read: 0 }));

vi.mock('../store/store.ts', () => ({
  onShared: () => {
    listening.added += 1;
    return () => {
      listening.removed += 1;
    };
  },
  sharedTemplates: () => {
    listening.read += 1;
    return { status: 'loading' };
  },
}));

vi.mock('./lovelace.ts', () => ({ loadLovelace: () => Promise.resolve() }));

vi.mock('../store/shipped.ts', () => ({
  SHIPPED_TEMPLATES: { need: () => Promise.resolve(), templates: () => ({}) },
}));

vi.mock(import('../editors/ha-form.ts'), async (original) => ({
  ...(await original()),
  loadHaForm: () => Promise.resolve(),
}));

const { MnmlPanel } = await import('./main.ts');

test('the panel listens to the store while it is on the page, and stops when it leaves', () => {
  const panel = document.createElement('mnml-panel');
  document.body.append(panel);
  assert.equal(listening.added - listening.removed, 1);
  panel.remove();
  assert.equal(listening.added - listening.removed, 0);
  document.body.append(panel);
  panel.remove();
  assert.equal(listening.added - listening.removed, 0);
  assert.equal(listening.added, 2);
});

test('a panel put back on the page reads the store again, so it shows what changed meanwhile', async () => {
  const panel = document.createElement('mnml-panel');
  assert.ok(panel instanceof MnmlPanel);
  panel.hass = { connection: { sendMessagePromise: () => Promise.resolve([]) } } as never;
  document.body.append(panel);
  await new Promise((resolve) => setTimeout(resolve, 0));
  panel.remove();
  const before = listening.read;
  document.body.append(panel);
  assert.equal(listening.read, before + 1);
  panel.remove();
});
