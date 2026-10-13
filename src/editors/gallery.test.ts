import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template, Templates } from '../contract/templates.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { OWNER } from '../templates/families.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlTemplateGallery } from './gallery.ts';

define('mnml-template-gallery', MnmlTemplateGallery);

type Shown = (entries: { isIntersecting: boolean; target: Element }[]) => void;

const observed: Element[] = [];
const disconnected = { count: 0 };
let shown: Shown | undefined;
Object.assign(globalThis, {
  IntersectionObserver: class {
    constructor(callback: Shown) {
      shown = callback;
    }
    observe(target: Element): void {
      observed.push(target);
    }
    unobserve(): void {}
    disconnect(): void {
      disconnected.count += 1;
    }
  },
});
const built: Record<string, unknown>[] = [];
const cards: HTMLElement[] = [];
window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement(config: object): HTMLElement {
      built.push({ ...config });
      const card = document.createElement('div');
      cards.push(card);
      return card;
    },
  });

const settle = async (rounds = 6): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  if (rounds > 1) {
    await settle(rounds - 1);
  }
};

const HASS = {
  states: {},
  areas: { hall: { area_id: 'hall', name: 'Hall' } },
  devices: {},
  entities: {},
};

const ONE: Template = {
  card: { type: 'custom:mnml-heading-card', title: 'One', icon: 'mdi:numeric-1' },
};
const TWO: Template = {
  card: { type: 'custom:mnml-heading-card', title: 'Two', icon: 'mdi:numeric-2' },
};

async function shipped(): Promise<Templates> {
  await SHIPPED_TEMPLATES.need(Object.keys(OWNER));
  return SHIPPED_TEMPLATES.templates();
}

interface Shelf {
  readonly gallery: MnmlTemplateGallery;
  readonly root: ShadowRoot;
}

async function opened(templates?: Templates, own: Templates = {}): Promise<Shelf> {
  const gallery = document.createElement('mnml-template-gallery');
  assert.ok(gallery instanceof MnmlTemplateGallery);
  gallery.hass = HASS as never;
  gallery.templates = templates ?? (await shipped());
  gallery.own = own;
  const root = await mounted(gallery);
  await settle();
  return { gallery, root };
}

const labelled = (root: ParentNode, label: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const named = (targets: readonly Element[]): (string | undefined)[] =>
  targets.map((target) => (target instanceof HTMLElement ? target.dataset['template'] : undefined));

test('the gallery lists the tiles by family, and folds the pop-ups and parts', async () => {
  const { root } = await opened();
  assert.ok(labelled(root, 'Use section-heading'));
  assert.ok(labelled(root, 'Use room'));
  assert.equal(labelled(root, 'Use light-card'), null);
  const fold = [...root.querySelectorAll('button')].find((each) =>
    /^Pop-ups and parts \(\d+\)$/.test(text(each)),
  );
  assert.ok(fold);
  fold.click();
  await settle();
  assert.ok(labelled(root, 'Use light-card'));
});

test("the home's own templates come first, under Yours", async () => {
  const { root } = await opened({ ...(await shipped()), mine: ONE }, { mine: ONE });
  assert.equal(text(root.querySelector('.heading')), 'Yours');
  assert.ok(root.querySelector('.tiles')?.querySelector('[aria-label="Use mine"]'));
});

test('a filter narrows the gallery and looks among the pop-ups and parts too', async () => {
  const { root } = await opened();
  const filter = labelled(root, 'Filter the templates');
  assert.ok(filter instanceof HTMLInputElement);
  filter.value = 'vacuum';
  filter.dispatchEvent(new Event('input'));
  await settle();
  assert.equal(labelled(root, 'Use section-heading'), null);
  assert.ok(labelled(root, 'Use vacuum-card'));
});

test('typing in the filter keeps the box being typed in', async () => {
  const { root } = await opened();
  const filter = labelled(root, 'Filter the templates');
  assert.ok(filter instanceof HTMLInputElement);
  filter.focus();
  filter.value = 'vac';
  filter.dispatchEvent(new Event('input'));
  await settle();
  assert.equal(labelled(root, 'Filter the templates'), filter);
  assert.equal(root.activeElement, filter);
  assert.equal(labelled(root, 'Use section-heading'), null);
});

test('a tile picked says which template, for the editor to write', async () => {
  const { gallery, root } = await opened();
  const picked: unknown[] = [];
  gallery.addEventListener('template-picked', (event) => {
    picked.push(event instanceof CustomEvent ? event.detail : undefined);
  });
  labelled(root, 'Use room')?.click();
  assert.deepEqual(picked, [{ template: 'room' }]);
});

test('a preview is drawn only when its tile is shown', async () => {
  built.length = 0;
  observed.length = 0;
  await opened();
  assert.equal(built.length, 0);
  const first = observed[0];
  assert.ok(first && shown);
  shown([{ isIntersecting: true, target: first }]);
  await settle();
  assert.equal(built.length, 1);
  assert.equal(built[0]?.['type'], 'custom:mnml-template-card');
  assert.equal(first.children[0], cards.at(-1), 'the preview sits in its tile');
});

test("a preview in the gallery leaves the dashboard's pop-ups alone", async () => {
  cards.length = 0;
  observed.length = 0;
  await opened();
  const first = observed[0];
  assert.ok(first && shown);
  shown([{ isIntersecting: true, target: first }]);
  await settle();
  assert.equal(Reflect.get(cards[0] ?? {}, 'preview'), true);
});

test('a preview in the gallery is inert, so no part of it takes the keyboard or a press', async () => {
  observed.length = 0;
  await opened();
  const first = observed[0];
  assert.ok(first);
  assert.ok(first.hasAttribute('inert'));
});

test('a new hass reaches the previews already drawn', async () => {
  cards.length = 0;
  observed.length = 0;
  const { gallery } = await opened();
  const first = observed[0];
  assert.ok(first && shown);
  shown([{ isIntersecting: true, target: first }]);
  await settle();
  const card = cards.at(-1);
  assert.ok(card);
  const latest = { ...HASS };
  gallery.hass = latest as never;
  await settle();
  assert.equal(Reflect.get(card, 'hass'), latest);
});

test('a preview is drawn again when its template changes, and kept while it stays the same', async () => {
  built.length = 0;
  observed.length = 0;
  const { gallery } = await opened({ one: ONE, two: TWO });
  assert.ok(shown);
  shown(observed.map((target) => ({ isIntersecting: true, target })));
  await settle();
  assert.equal(built.length, 2);
  observed.length = 0;
  gallery.templates = { one: { ...ONE, description: 'Changed.' }, two: TWO };
  await settle();
  assert.deepEqual(named(observed), ['one']);
});

test('a gallery taken off the page stops watching its tiles, and watches them again when back', async () => {
  observed.length = 0;
  const { gallery } = await opened({ one: ONE, two: TWO });
  assert.deepEqual(named(observed), ['one', 'two']);
  const before = disconnected.count;
  gallery.remove();
  assert.equal(disconnected.count, before + 1);
  observed.length = 0;
  document.body.append(gallery);
  await settle();
  assert.deepEqual(named(observed), ['one', 'two']);
});
