import assert from 'node:assert/strict';

import { test, vi } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { fakeHass, fakeStore } from '../test/hass.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlStrategyEditor } from './editor.ts';

define('mnml-strategy-editor', MnmlStrategyEditor);

function hass(): HomeAssistant {
  const store = fakeStore();
  store.kept = {};
  const states = {
    ...HOME.states,
    'person.jane': { attributes: { friendly_name: 'Jane' } },
    'person.bob': { attributes: { friendly_name: 'Bob' } },
  };
  return fakeHass({ ...HOME, states, connection: store.hass.connection });
}

async function editor(
  config: Record<string, unknown>,
): Promise<{ element: MnmlStrategyEditor; root: ShadowRoot; sent: Record<string, unknown>[] }> {
  const element = new MnmlStrategyEditor();
  const sent: Record<string, unknown>[] = [];
  element.addEventListener('config-changed', (event) => {
    const detail: unknown = Reflect.get(event, 'detail');
    sent.push(Reflect.get(detail ?? {}, 'config'));
  });
  element.setConfig({ type: 'custom:mnml', ...config });
  element.hass = hass();
  const root = await mounted(element);
  await vi.waitFor(() => {
    assert.ok(root.querySelector('section'));
  });
  return { element, root, sent };
}

function labelled<T extends HTMLElement>(root: ShadowRoot, label: string): T {
  const found = [...root.querySelectorAll<T>('input, button, select')].find(
    (each) => each.getAttribute('aria-label') === label,
  );
  assert.ok(found, label);
  return found;
}

function section(root: ShadowRoot, title: string): string {
  const found = [...root.querySelectorAll('section')].find(
    (each) => text(each.querySelector('h3')) === title,
  );
  return text(found);
}

async function pick(element: MnmlStrategyEditor, control: HTMLInputElement): Promise<void> {
  control.click();
  await element.updateComplete;
}

test('a strategy that chooses nothing says what MNML finds in each part', async () => {
  const { root } = await editor({});
  assert.equal(labelled<HTMLInputElement>(root, 'Choose the rooms').checked, false);
  assert.match(section(root, 'Rooms'), /MNML finds them: Kitchen, Living/);
  assert.match(section(root, 'People'), /MNML finds them: Jane, Bob/);
  assert.equal(labelled<HTMLInputElement>(root, 'Show the Glances strip').checked, false);
  assert.equal(labelled<HTMLSelectElement>(root, 'On a tablet').value, 'unfold');
});

test('choosing the rooms starts from what MNML finds, then each change is sent whole', async () => {
  const { element, root, sent } = await editor({ title: 'Our flat' });
  await pick(element, labelled(root, 'Choose the rooms'));
  assert.deepEqual(sent.at(-1), {
    type: 'custom:mnml',
    title: 'Our flat',
    rooms: [{ area: 'kitchen' }, { area: 'living' }],
  });
  await pick(element, labelled(root, 'Show Hallway'));
  assert.deepEqual(sent.at(-1)?.['rooms'], [
    { area: 'kitchen' },
    { area: 'living' },
    { area: 'hallway' },
  ]);
  labelled<HTMLButtonElement>(root, 'Move Hallway up').click();
  await element.updateComplete;
  assert.deepEqual(sent.at(-1)?.['rooms'], [
    { area: 'kitchen' },
    { area: 'hallway' },
    { area: 'living' },
  ]);
  await pick(element, labelled(root, 'Show Kitchen'));
  assert.deepEqual(sent.at(-1)?.['rooms'], [{ area: 'hallway' }, { area: 'living' }]);
  await pick(element, labelled(root, 'Choose the rooms'));
  assert.deepEqual(sent.at(-1), { type: 'custom:mnml', title: 'Our flat' });
});

test('a chosen room keeps its slots, and a spelled one stays listed', async () => {
  const spelled = { slots: { name: 'Attic', key: 'attic' }, spelled: true };
  const { element, root, sent } = await editor({
    rooms: [{ area: 'living', slots: { name: 'Lounge' } }, spelled],
  });
  assert.match(section(root, 'Rooms'), /Living.*Attic, spelled in YAML.*Kitchen/);
  labelled<HTMLButtonElement>(root, 'Move Attic, spelled in YAML up').click();
  await element.updateComplete;
  assert.deepEqual(sent.at(-1)?.['rooms'], [
    spelled,
    { area: 'living', slots: { name: 'Lounge' } },
  ]);
});

test('the system cards, the Glances strip and how pop-ups open are chosen too', async () => {
  const { element, root, sent } = await editor({});
  await pick(element, labelled(root, 'Choose the system cards'));
  await pick(element, labelled(root, 'Show AdGuard Home'));
  assert.deepEqual(sent.at(-1)?.['system'], [{ template: 'adguard' }]);
  await pick(element, labelled(root, 'Show the Glances strip'));
  assert.deepEqual(sent.at(-1)?.['glances'], {});
  const phone = labelled<HTMLSelectElement>(root, 'On a phone');
  phone.value = 'dialog';
  phone.dispatchEvent(new Event('change'));
  await element.updateComplete;
  assert.deepEqual(sent.at(-1)?.['open'], {
    tablet: 'unfold',
    desktop: 'unfold',
    phone: 'dialog',
  });
  const tablet = labelled<HTMLSelectElement>(root, 'On a tablet');
  tablet.value = '';
  tablet.dispatchEvent(new Event('change'));
  await element.updateComplete;
  assert.deepEqual(sent.at(-1)?.['open'], { desktop: 'unfold', phone: 'dialog' });
  await pick(element, labelled(root, 'Show the Glances strip'));
  assert.equal(Object.hasOwn(sent.at(-1) ?? {}, 'glances'), false);
});

test('the tiles are drawn as squares once the box is ticked, and as rows once it is not', async () => {
  const { element, root, sent } = await editor({});
  const squares = labelled<HTMLInputElement>(root, 'Draw the tiles as squares');
  assert.equal(squares.checked, false);
  await pick(element, squares);
  assert.equal(sent.at(-1)?.['squares'], true);
  await pick(element, labelled(root, 'Draw the tiles as squares'));
  assert.equal(Object.hasOwn(sent.at(-1) ?? {}, 'squares'), false);
});
