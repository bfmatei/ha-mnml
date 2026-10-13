import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlRowMenu } from './row-menu.ts';
import type { MenuItem } from './row-menu.ts';

define('mnml-row-menu', MnmlRowMenu);

async function menuOf(label: string, items: readonly MenuItem[]): Promise<MnmlRowMenu> {
  const made = document.createElement('mnml-row-menu');
  assert.ok(made instanceof MnmlRowMenu);
  made.label = label;
  made.items = items;
  await mounted(made);
  return made;
}

const labelled = (menu: MnmlRowMenu, label: string): HTMLButtonElement | undefined =>
  [...(menu.shadowRoot?.querySelectorAll('button') ?? [])].find(
    (button) => button.getAttribute('aria-label') === label,
  );

test('a row menu opens on its button, runs an item and closes', async () => {
  const runs: string[] = [];
  const menu = await menuOf('Living Sonos', [
    { label: 'Move up', icon: 'mdi:arrow-up', disabled: true, run: () => runs.push('up') },
    { label: 'Delete', icon: 'mdi:delete-outline', run: () => runs.push('delete') },
  ]);
  assert.equal(labelled(menu, 'Delete'), undefined);
  labelled(menu, 'More for Living Sonos')?.click();
  await menu.updateComplete;
  assert.equal(labelled(menu, 'Move up')?.disabled, true);
  assert.equal(labelled(menu, 'Delete')?.getAttribute('role'), 'menuitem');
  assert.equal(menu.shadowRoot?.querySelector('.row-menu-list')?.getAttribute('role'), 'menu');
  labelled(menu, 'Delete')?.click();
  await menu.updateComplete;
  assert.deepEqual(runs, ['delete']);
  assert.equal(labelled(menu, 'Delete'), undefined);
});

test('a row menu closes on a tap outside it, and stays open on a tap inside it', async () => {
  const menu = await menuOf('Living Sonos', [
    { label: 'Delete', icon: 'mdi:delete-outline', run: () => undefined },
  ]);
  labelled(menu, 'More for Living Sonos')?.click();
  await menu.updateComplete;
  labelled(menu, 'Delete')?.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true }),
  );
  await menu.updateComplete;
  assert.ok(labelled(menu, 'Delete'));
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await menu.updateComplete;
  assert.equal(labelled(menu, 'Delete'), undefined);
});

test('a row menu closes on Escape', async () => {
  const menu = await menuOf('Living Sonos', [
    { label: 'Delete', icon: 'mdi:delete-outline', run: () => undefined },
  ]);
  labelled(menu, 'More for Living Sonos')?.click();
  await menu.updateComplete;
  labelled(menu, 'Delete')?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  );
  await menu.updateComplete;
  assert.equal(labelled(menu, 'Delete'), undefined);
});

test('a new label renames the button', async () => {
  const menu = await menuOf('Toggle 1', []);
  menu.label = 'Toggle: light.a';
  await menu.updateComplete;
  assert.ok(labelled(menu, 'More for Toggle: light.a'));
  assert.equal(labelled(menu, 'More for Toggle: light.a')?.title, 'More for Toggle: light.a');
});

test("Escape closes an open row menu and goes no further, so Home Assistant's dialog stays open", async () => {
  const menu = await menuOf('Living Sonos', [
    { label: 'Delete', icon: 'mdi:delete-outline', run: () => undefined },
  ]);
  let reached = 0;
  const count = (): void => {
    reached += 1;
  };
  document.body.addEventListener('keydown', count);
  labelled(menu, 'More for Living Sonos')?.click();
  await menu.updateComplete;
  labelled(menu, 'Delete')?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  );
  await menu.updateComplete;
  assert.equal(reached, 0, 'the open menu kept the key');
  labelled(menu, 'More for Living Sonos')?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  );
  assert.equal(reached, 1, 'a closed menu lets it through');
  document.body.removeEventListener('keydown', count);
});

test('the list of a row menu is a popover, so that no pane crops it', async () => {
  const menu = await menuOf('Living Sonos', [
    { label: 'Delete', icon: 'mdi:delete-outline', run: () => undefined },
  ]);
  assert.equal(menu.shadowRoot?.querySelector('.row-menu-list')?.getAttribute('popover'), 'manual');
});

test('a row menu stays open while the page scrolls under it, following its button', async () => {
  const menu = await menuOf('Living Sonos', [
    { label: 'Delete', icon: 'mdi:delete-outline', run: () => undefined },
  ]);
  labelled(menu, 'More for Living Sonos')?.click();
  await menu.updateComplete;
  document.body.dispatchEvent(new Event('scroll', { bubbles: true }));
  await menu.updateComplete;
  assert.ok(labelled(menu, 'Delete'));
});

test('the button says it opens a menu, and whether it is open', async () => {
  const menu = await menuOf('Living Sonos', [
    { label: 'Delete', icon: 'mdi:delete-outline', run: () => undefined },
  ]);
  const button = labelled(menu, 'More for Living Sonos');
  assert.equal(button?.getAttribute('aria-haspopup'), 'menu');
  assert.equal(button?.getAttribute('aria-expanded'), 'false');
  button?.click();
  await menu.updateComplete;
  assert.equal(button?.getAttribute('aria-expanded'), 'true');
});

function drawnLikeAnOpenPopover(menu: MnmlRowMenu): void {
  const list = menu.shadowRoot?.querySelector('.row-menu-list');
  assert.ok(list instanceof HTMLElement);
  list.style.display = 'flex';
}

test('an open menu takes the focus, the arrow keys walk its items, and Escape gives it back', async () => {
  const menu = await menuOf('Living Sonos', [
    { label: 'Move up', icon: 'mdi:arrow-up', disabled: true, run: () => undefined },
    { label: 'Copy', icon: 'mdi:content-copy', run: () => undefined },
    { label: 'Delete', icon: 'mdi:delete-outline', run: () => undefined },
  ]);
  drawnLikeAnOpenPopover(menu);
  const button = labelled(menu, 'More for Living Sonos');
  button?.click();
  await menu.updateComplete;
  await menu.updateComplete;
  const focused = (): string | null | undefined =>
    menu.shadowRoot?.activeElement?.getAttribute('aria-label');
  assert.equal(focused(), 'Copy', 'the first item that can be used');
  const press = (key: string): void => {
    menu.shadowRoot?.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
    );
  };
  press('ArrowDown');
  assert.equal(focused(), 'Delete');
  press('ArrowDown');
  assert.equal(focused(), 'Copy');
  press('ArrowUp');
  assert.equal(focused(), 'Delete');
  press('Escape');
  await menu.updateComplete;
  assert.equal(labelled(menu, 'Delete'), undefined);
  assert.equal(focused(), 'More for Living Sonos');
});
