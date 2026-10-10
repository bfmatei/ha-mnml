import assert from 'node:assert/strict';

import { afterEach, test, vi } from 'vitest';

import type { PopupsCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { PREBUILD_EVENT, closePopup, navigate, offerOrigin } from '../ha/navigation.ts';
import { define, mounted } from '../test/render.ts';

import { announce, withdraw } from './parts/popup-registry.ts';
import { MnmlPopupsCard, SHEET } from './popups.ts';

define('mnml-popups-card', MnmlPopupsCard);

HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
  if (!this.isConnected) {
    throw new DOMException("Failed to execute 'showModal': the element is not in a Document");
  }
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
  this.open = false;
};

const finishing: (() => void)[] = [];
HTMLElement.prototype.animate = function animate(): Animation {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  finishing.push(() => {
    resolve(undefined);
  });
  return { finished: promise, cancel: () => undefined } as unknown as Animation;
};

function allowMotion(): () => void {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  return () => {
    for (const finish of finishing.splice(0)) {
      finish();
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  finishing.length = 0;
});

const CONFIG: PopupsCard = {
  type: 'custom:mnml-popups-card',
  width: '560px',
  popups: [
    {
      hash: '#bathroom',
      cards: [{ type: 'custom:mnml-header-card', name: 'Bathroom' }, { type: 'map' }],
    },
    { hash: '#bathroom-lights', cards: [{ type: 'custom:mnml-header-card', name: 'Lights' }] },
    {
      hash: '#bathroom-ac',
      cards: [
        { type: 'custom:mnml-header-card', name: 'AC' },
        {
          type: 'custom:mnml-select-card',
          entity: 'climate.a',
          visibility: [{ condition: 'state', entity: 'climate.a', state_not: 'off' }],
        },
      ],
    },
    {
      hash: '#bedroom',
      cards: [
        { type: 'custom:mnml-header-card', name: 'Bedroom' },
        { type: 'map', visibility: [{ condition: 'state', entity: 'light.a', state: 'on' }] },
        {
          type: 'map',
          visibility: [{ condition: 'state', entity: 'light.a', state: ['on', 'idle'] }],
        },
        {
          type: 'map',
          visibility: [
            { condition: 'state', entity: 'light.a', state_not: ['off', 'unavailable'] },
          ],
        },
      ],
    },
  ],
};

let built: Record<string, unknown>[] = [];
let given: unknown[] = [];

window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement(config: object): ChildCard {
      built.push(config as Record<string, unknown>);
      const node = document.createElement('div');
      Object.defineProperty(node, 'hass', {
        set(value: unknown) {
          given.push(value);
        },
        configurable: true,
      });
      return node;
    },
  });

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function setHash(hash: string): void {
  history.replaceState(null, '', `${location.pathname}${hash}`);
}

function fireRoute(name: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function hassOf(states: Record<string, unknown>): HomeAssistant {
  return { states } as unknown as HomeAssistant;
}

function sized(node: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(node, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(node, 'clientHeight', { value: clientHeight, configurable: true });
}

function scrollable(): HTMLElement {
  const node = document.createElement('div');
  node.style.overflowY = 'auto';
  sized(node, 1000, 500);
  return node;
}

function router(): MnmlPopupsCard {
  const made = document.createElement('mnml-popups-card');
  assert.ok(made instanceof MnmlPopupsCard);
  return made;
}

let current: MnmlPopupsCard | undefined;

async function mount(
  hash: string,
  parent: HTMLElement = document.body,
): Promise<{ router: MnmlPopupsCard; shadow: ShadowRoot }> {
  current?.remove();
  built = [];
  given = [];
  setHash(hash);
  const made = router();
  made.setConfig(CONFIG);
  parent.append(made);
  current = made;
  return { router: made, shadow: await mounted(made) };
}

async function routed(to: MnmlPopupsCard, hash: string): Promise<void> {
  setHash(hash);
  fireRoute('location-changed');
  await settle();
  await to.updateComplete;
}

const slotsOf = (shadow: ShadowRoot): Element[] => [
  ...(shadow.querySelector('dialog')?.children[0]?.children ?? []),
];
const cardsIn = (slot: Element | undefined): HTMLElement[] =>
  [...(slot?.children ?? [])].filter((node) => node instanceof HTMLElement);
const mountedCards = (shadow: ShadowRoot): number =>
  slotsOf(shadow).reduce((total, slot) => total + slot.children.length, 0);

test('one router serves every pop-up and shows none by default', async () => {
  const { shadow } = await mount('');
  assert.equal(shadow.querySelector('dialog'), null);
  assert.equal(built.length, 0, 'nothing is built until a hash matches');
});

test('it takes no space in the view', async () => {
  assert.equal((await mount('')).router.getCardSize(), 0);
});

test('it opens the pop-up whose hash is current, and only that one', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  await routed(router, '#bathroom');
  assert.equal(shadow.querySelector('dialog')?.open, true);
  assert.deepEqual(
    built.map((config) => config['type']),
    ['custom:mnml-header-card', 'map'],
  );
  assert.equal(mountedCards(shadow), 2);
  const [head, body] = slotsOf(shadow);
  assert.equal(head?.className, 'head');
  assert.equal(head?.children.length, 1, 'the header sits outside the scrolling area');
  assert.equal(body?.className, 'body');
  assert.equal(body?.children.length, 1, 'and everything else inside it');
});

test('the body says there is more to scroll to until it has been scrolled to the end', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  await routed(router, '#bathroom');
  const body = slotsOf(shadow)[1];
  const panel = shadow.querySelector<HTMLElement>('.panel');
  assert.ok(body instanceof HTMLElement && panel);
  assert.ok(!panel.classList.contains('more'), 'content that fits has nothing below');
  sized(body, 1000, 500);
  body.dispatchEvent(new Event('scroll'));
  await router.updateComplete;
  assert.ok(panel.classList.contains('more'));
  body.scrollTop = 500;
  body.dispatchEvent(new Event('scroll'));
  await router.updateComplete;
  assert.ok(!panel.classList.contains('more'), 'at the end there is nothing below');
});

test('routing from one pop-up to another leaves only the new one mounted', async () => {
  const { router, shadow } = await mount('#bathroom');
  await settle();
  assert.equal(mountedCards(shadow), 2);
  await routed(router, '#bathroom-lights');
  assert.equal(shadow.querySelector('dialog')?.open, true, 'the new pop-up is open');
  assert.equal(mountedCards(shadow), 1, 'with only its own card');
  assert.equal(built.length, 3, 'two then one, never both at once');
});

test('it tears everything down when the hash clears', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  await routed(router, '#bathroom');
  const before = given.length;
  setHash('');
  fireRoute('location-changed');
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null);
  router.hass = hassOf({});
  assert.equal(given.length, before, 'hass no longer reaches the old children');
});

test('a prebuild request builds ahead, and opening reuses it', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  fireRoute(PREBUILD_EVENT, { hash: '#bathroom' });
  await settle();
  assert.equal(built.length, 2, 'built before the hash changed');
  assert.equal(shadow.querySelector('dialog'), null, 'but nothing is shown yet');
  await routed(router, '#bathroom');
  assert.equal(built.length, 2, 'opening reused the prepared cards rather than rebuilding');
  assert.equal(mountedCards(shadow), 2, 'and mounted them');
});

test('two prebuild requests for one hash build it once', async () => {
  const { router } = await mount('');
  router.hass = hassOf({});
  fireRoute(PREBUILD_EVENT, { hash: '#bathroom' });
  fireRoute(PREBUILD_EVENT, { hash: '#bathroom' });
  await settle();
  assert.equal(built.length, 2, 'the second request joins the first build');
});

test('opening while a prebuild is in flight waits for it rather than building again', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  fireRoute(PREBUILD_EVENT, { hash: '#bathroom' });
  await routed(router, '#bathroom');
  assert.equal(built.length, 2, 'one build served both');
  assert.equal(mountedCards(shadow), 2);
});

test('a child with a visibility rule is hidden while the rule fails, and shown once it holds', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({ 'climate.a': { entity_id: 'climate.a', state: 'off', attributes: {} } });
  await routed(router, '#bathroom-ac');
  const [head, body] = slotsOf(shadow);
  assert.equal(cardsIn(head)[0]?.hidden, false, 'a card without a rule is shown');
  assert.equal(cardsIn(body)[0]?.hidden, true, 'the ruled card is hidden while the unit is off');
  router.hass = hassOf({ 'climate.a': { entity_id: 'climate.a', state: 'cool', attributes: {} } });
  assert.equal(cardsIn(body)[0]?.hidden, false, 'and shown as soon as the state allows');
});

test('a hash that is already current when the card is configured opens once it is in the page', async () => {
  current?.remove();
  setHash('#bathroom');
  const made = router();
  made.setConfig(CONFIG);
  assert.equal(
    made.shadowRoot?.querySelector('dialog') ?? null,
    null,
    'nothing opens before HA inserts the card',
  );
  document.body.append(made);
  current = made;
  await settle();
  const shadow = await mounted(made);
  const dialog = shadow.querySelector('dialog');
  assert.ok(dialog, 'the pop-up in the URL opens as soon as the card is in the page');
  assert.equal(dialog.open, true);
});

test('a prebuild for an unknown hash is ignored', async () => {
  await mount('');
  fireRoute(PREBUILD_EVENT, { hash: '#nothing' });
  fireRoute(PREBUILD_EVENT, {});
  await settle();
  assert.equal(built.length, 0);
});

test('disconnecting closes it and drops its listeners', async () => {
  const { router, shadow } = await mount('#bathroom');
  await settle();
  assert.ok(shadow.querySelector('dialog'));
  router.remove();
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null);
  await routed(router, '#bathroom');
  assert.equal(shadow.querySelector('dialog'), null, 'no longer routing');
});

test('it stops the page behind from scrolling, and gives it back', async () => {
  const page = scrollable();
  document.body.append(page);
  const { router, shadow } = await mount('', page);
  await routed(router, '#bathroom');
  assert.ok(shadow.querySelector('dialog'));
  assert.equal(page.style.overflow, 'hidden', 'the scrolling ancestor is locked while open');
  setHash('');
  fireRoute('location-changed');
  assert.equal(page.style.overflow, '', 'and restored on close');
  page.remove();
});

test('disconnecting gives the page back too', async () => {
  const page = scrollable();
  document.body.append(page);
  const { router } = await mount('', page);
  await routed(router, '#bathroom');
  assert.equal(page.style.overflow, 'hidden');
  router.remove();
  assert.equal(page.style.overflow, '', 'a card torn down mid-pop-up does not leave it locked');
  page.remove();
});

async function opened(): Promise<{
  dialog: HTMLDialogElement;
  head: HTMLElement;
  body: HTMLElement;
}> {
  const { router, shadow } = await mount('#bathroom');
  await settle();
  await router.updateComplete;
  const dialog = shadow.querySelector('dialog');
  const head = shadow.querySelector<HTMLElement>('.head');
  const body = shadow.querySelector<HTMLElement>('.body');
  assert.ok(dialog);
  assert.ok(head);
  assert.ok(body);
  body.style.overflowY = 'auto';
  return { dialog, head, body };
}

function drag(target: Element): boolean {
  const event = new TouchEvent('touchmove', { bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

test('a drag inside content that cannot scroll is cancelled, not passed to the page', async () => {
  const { body } = await opened();
  sized(body, 400, 400);
  assert.equal(drag(body), true);
});

test('a drag inside a scroller of its own is left alone, however deeply it is nested', async () => {
  const { body } = await opened();
  sized(body, 400, 400);
  const card = cardsIn(body)[0];
  assert.ok(card);
  const menu = scrollable();
  card.attachShadow({ mode: 'open' }).append(menu);
  assert.equal(
    drag(menu),
    false,
    'a menu in a card shadow root scrolls itself even when the pop-up does not scroll',
  );
});

test('a drag inside content that can scroll is left alone', async () => {
  const { body } = await opened();
  sized(body, 1000, 400);
  assert.equal(drag(body), false);
  const child = cardsIn(body)[0];
  assert.ok(child);
  assert.equal(drag(child), false, 'including a drag that starts on a card inside it');
});

test('a drag on the header or the backdrop is always cancelled', async () => {
  const { dialog, head, body } = await opened();
  sized(body, 1000, 400);
  assert.equal(drag(head), true, 'the fixed header does not scroll the page');
  assert.equal(drag(dialog), true, 'nor does the backdrop');
});

test('with motion allowed, the dialog goes only once it has animated out', async () => {
  const finish = allowMotion();
  const { router, shadow } = await mount('#bathroom');
  await settle();
  assert.ok(shadow.querySelector('dialog'));
  setHash('');
  fireRoute('location-changed');
  await router.updateComplete;
  const leaving = shadow.querySelector('dialog');
  assert.ok(leaving, 'still in the tree while it animates');
  assert.ok(leaving.classList.contains('leaving'), 'and marked so it takes no input');
  finish();
  await settle();
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null, 'gone once the animation finished');
});

test('a pop-up opened from another keeps the panel, and swaps what is in it once the old has slid out', async () => {
  const finish = allowMotion();
  const { router, shadow } = await mount('#bathroom');
  await settle();
  finish();
  const panel = shadow.querySelector('.panel');
  assert.ok(panel);
  assert.equal(mountedCards(shadow), 2);
  setHash('#bathroom-lights');
  fireRoute('location-changed');
  await settle();
  assert.equal(mountedCards(shadow), 2, 'the old content is still there while it slides out');
  finish();
  await settle();
  await router.updateComplete;
  assert.equal(shadow.querySelector('.panel'), panel, 'in the same panel');
  assert.equal(mountedCards(shadow), 1, 'now with only the new pop-up own card');
});

function touch(panel: HTMLElement, type: string, y: number, time: number): void {
  const event = new MouseEvent(type, { bubbles: true, composed: true, clientY: y });
  Object.defineProperties(event, {
    pointerType: { value: 'touch' },
    pointerId: { value: 1 },
    isPrimary: { value: true },
    timeStamp: { value: time },
  });
  panel.dispatchEvent(event);
}

async function swipable(): Promise<{
  router: MnmlPopupsCard;
  shadow: ShadowRoot;
  panel: HTMLElement;
  finish: () => void;
}> {
  const finish = allowMotion();
  const { router, shadow } = await mount('#bathroom');
  await settle();
  const panel = shadow.querySelector<HTMLElement>('.panel');
  assert.ok(panel);
  panel.setPointerCapture = () => undefined;
  panel.getBoundingClientRect = () => new DOMRect(0, 0, 400, 500);
  return { router, shadow, panel, finish };
}

test('a swipe down from the top of the pop-up closes it, after it has slid out', async () => {
  const { router, shadow, panel, finish } = await swipable();
  touch(panel, 'pointerdown', 20, 0);
  touch(panel, 'pointermove', 60, 40);
  touch(panel, 'pointermove', 150, 90);
  assert.equal(panel.style.transform, 'translateY(130px)', 'the panel follows the finger');
  touch(panel, 'pointerup', 150, 100);
  assert.equal(location.hash, '', 'the address is clear at once');
  await router.updateComplete;
  assert.ok(shadow.querySelector('dialog')?.classList.contains('leaving'));
  finish();
  await settle();
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null, 'gone once it has slid out');
});

test('a short, slow swipe springs back and leaves the pop-up open', async () => {
  const { router, shadow, panel, finish } = await swipable();
  touch(panel, 'pointerdown', 20, 0);
  touch(panel, 'pointermove', 40, 400);
  touch(panel, 'pointermove', 70, 800);
  touch(panel, 'pointerup', 70, 1000);
  await router.updateComplete;
  finish();
  assert.equal(location.hash, '#bathroom');
  assert.equal(panel.style.transform, '', 'back in place');
  assert.ok(shadow.querySelector('dialog')?.open);
});

test('a drag that starts low in the pop-up, or with a mouse, or upward, does not swipe', async () => {
  const { panel } = await swipable();
  touch(panel, 'pointerdown', 300, 0);
  touch(panel, 'pointermove', 400, 50);
  assert.equal(panel.style.transform, '', 'below the top');
  touch(panel, 'pointerup', 400, 60);
  touch(panel, 'pointerdown', 20, 100);
  touch(panel, 'pointermove', -30, 150);
  touch(panel, 'pointermove', 100, 200);
  assert.equal(panel.style.transform, '', 'up first');
  touch(panel, 'pointerup', 100, 210);
  const mouse = new MouseEvent('pointerdown', { bubbles: true, composed: true, clientY: 20 });
  Object.defineProperties(mouse, {
    pointerType: { value: 'mouse' },
    pointerId: { value: 2 },
    isPrimary: { value: true },
  });
  panel.dispatchEvent(mouse);
  touch(panel, 'pointermove', 200, 300);
  assert.equal(panel.style.transform, '', 'a mouse never swipes');
});

test('with motion reduced, it goes at once', async () => {
  const { router, shadow } = await mount('#bathroom');
  await settle();
  setHash('');
  fireRoute('location-changed');
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null, 'no animation to wait for');
});

test('a child follows a state rule, a list of states, and a list of states to avoid', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({ 'light.a': { entity_id: 'light.a', state: 'off', attributes: {} } });
  await routed(router, '#bedroom');
  const [, body] = slotsOf(shadow);
  assert.deepEqual(
    cardsIn(body).map((card) => card.hidden),
    [true, true, true],
  );
  router.hass = hassOf({ 'light.a': { entity_id: 'light.a', state: 'on', attributes: {} } });
  assert.deepEqual(
    cardsIn(body).map((card) => card.hidden),
    [false, false, false],
  );
});

const ruled = (visibility: unknown): PopupsCard =>
  ({
    ...CONFIG,
    popups: [{ hash: '#a', cards: [{ type: 'map' }, { type: 'map', visibility }] }],
  }) as PopupsCard;

test('a visibility rule the pop-up cannot judge is an error that names where it is', () => {
  const made = router();
  assert.throws(() => {
    made.setConfig(ruled([{ condition: 'numeric_state', entity: 'sensor.a', above: 1 }]));
  }, /popups\[0\]\.cards\[1\]\.visibility\[0\]/);
  assert.throws(() => {
    made.setConfig(ruled([{ condition: 'state', entity: 'light.a' }]));
  }, /popups\[0\]\.cards\[1\]\.visibility\[0\]/);
});

test('the width is a size in pixels', () => {
  const made = router();
  const { width: _width, ...rest } = CONFIG;
  assert.throws(() => {
    made.setConfig(rest as PopupsCard);
  }, /width/);
  assert.throws(() => {
    made.setConfig({ ...CONFIG, width: '560' } as unknown as PopupsCard);
  }, /width/);
  assert.doesNotThrow(() => {
    made.setConfig(CONFIG);
  });
});

test('a pop-up announced after the page loaded on its hash opens', async () => {
  current?.remove();
  setHash('#late');
  const made = router();
  made.setConfig({ type: 'custom:mnml-popups-card', width: '560px' });
  document.body.append(made);
  current = made;
  made.hass = hassOf({});
  await settle();
  const shadow = await mounted(made);
  assert.equal(shadow.querySelector('dialog'), null, 'nothing to open yet');
  const owner = {};
  announce(owner, [{ hash: '#late', cards: [{ type: 'custom:mnml-header-card', name: 'Late' }] }]);
  await settle();
  await made.updateComplete;
  assert.equal(shadow.querySelector('dialog')?.open, true);
  withdraw(owner);
  made.remove();
});

test('the popups card works with announced pop-ups alone', () => {
  const made = router();
  assert.doesNotThrow(() => {
    made.setConfig({ type: 'custom:mnml-popups-card', width: '560px' });
  });
});

test('an announced pop-up with a condition the shell cannot judge still opens and draws its cards', async () => {
  current?.remove();
  setHash('#odd');
  const made = router();
  made.setConfig({ type: 'custom:mnml-popups-card', width: '560px' });
  document.body.append(made);
  current = made;
  made.hass = hassOf({});
  const owner = {};
  announce(owner, [
    {
      hash: '#odd',
      cards: [
        { type: 'custom:mnml-header-card', name: 'Odd' },
        { type: 'map', visibility: [{ condition: 'screen' }] },
      ],
    },
  ] as never);
  await settle();
  const shadow = await mounted(made);
  assert.equal(shadow.querySelector('dialog')?.open, true);
  assert.equal(mountedCards(shadow), 2);
  withdraw(owner);
  made.remove();
});

test('routing from one pop-up to another keeps the dialog, so its backdrop does not flicker', async () => {
  const finish = allowMotion();
  const { router, shadow } = await mount('#bathroom');
  await settle();
  const first = shadow.querySelector('dialog');
  assert.ok(first);
  await routed(router, '#bathroom-lights');
  finish();
  await settle();
  await router.updateComplete;
  const dialogs = shadow.querySelectorAll('dialog');
  assert.equal(dialogs.length, 1, 'one dialog, never one leaving under one arriving');
  assert.equal(dialogs[0], first, 'the same dialog, its backdrop untouched');
  assert.equal(first.open, true);
  assert.equal(first.classList.contains('leaving'), false);
  assert.equal(mountedCards(shadow), 1, 'with only the new pop-up inside');
  setHash('');
  fireRoute('location-changed');
  await router.updateComplete;
  finish();
  await settle();
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null, 'and it still goes when the hash clears');
});

test('the dialog draws no focus ring of its own, since it fills the whole viewport', () => {
  const css = MnmlPopupsCard.styles.map((style) => style.cssText).join('\n');
  assert.match(css, /dialog:focus(?:-visible)?\s*\{[^}]*outline:\s*none/);
});

const settledLayout = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 300);
  });

async function openedAs(
  config: PopupsCard,
  widthQuery: (query: string) => boolean,
  from?: Element,
): Promise<ShadowRoot> {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: widthQuery(query) }));
  current?.remove();
  setHash('');
  const made = router();
  made.setConfig(config);
  document.body.append(made);
  current = made;
  const shadow = await mounted(made);
  if (from === undefined) {
    setHash('#bathroom');
  } else {
    navigate('#bathroom', from);
  }
  fireRoute('location-changed');
  await settle();
  await made.updateComplete;
  await settle();
  return shadow;
}

const phone = (query: string): boolean => query === SHEET || query.includes('1024px');
const desktop = (): boolean => false;

async function classes(config: PopupsCard, width: (query: string) => boolean): Promise<string[]> {
  return [...((await openedAs(config, width)).querySelector('dialog')?.classList ?? [])];
}

test('a pop-up opens as a sheet on a phone and as a dialog elsewhere, unless open says otherwise', async () => {
  assert.ok((await classes(CONFIG, phone)).includes('sheet'));
  assert.ok((await classes(CONFIG, desktop)).includes('dialog'));
  assert.ok((await classes({ ...CONFIG, open: { phone: 'dialog' } }, phone)).includes('dialog'));
});

test('a pop-up set to unfold takes the place of its tile, growing down from it, and is a dialog without one', async () => {
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(400, 200, 360, 64);
  const config: PopupsCard = { ...CONFIG, open: { desktop: 'unfold' } };
  const shadow = await openedAs(config, desktop, tile);
  assert.ok(shadow.querySelector('dialog')?.classList.contains('unfold'));
  const panel = shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel?.style.left, '400px', 'where the tile starts');
  assert.equal(panel?.style.width, '360px', 'as wide as the tile');
  assert.equal(panel?.style.top, '200px', 'from the top of the tile');
  tile.remove();
  closePopup();
  const without = await openedAs({ ...config, popups: [...(config.popups ?? [])] }, desktop);
  assert.ok(without.querySelector('dialog')?.classList.contains('dialog'));
});

test('a pop-up unfolding from a tile near the bottom grows up from the bottom of the tile', async () => {
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(400, innerHeight - 120, 360, 64);
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  const panel = shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel?.style.left, '400px');
  assert.equal(panel?.style.top, '');
  assert.equal(panel?.style.bottom, '56px', 'level with the bottom of the tile');
  tile.remove();
});

test('a pop-up unfolding from a tile too low on the page scrolls the page until the tile has room below it', async () => {
  const page = scrollable();
  const tile = document.createElement('div');
  page.append(tile);
  document.body.append(page);
  const scrolled: ScrollToOptions[] = [];
  page.scrollBy = (options?: ScrollToOptions | number) => {
    if (typeof options === 'object') {
      scrolled.push(options);
      const top = 400 - (options.top ?? 0);
      tile.getBoundingClientRect = () => new DOMRect(400, top, 360, 64);
    }
  };
  tile.getBoundingClientRect = () => new DOMRect(400, 400, 360, 64);
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  await vi.waitFor(() => {
    assert.ok(shadow.querySelector('.panel'));
  });
  assert.equal(scrolled.length, 1);
  assert.equal(
    scrolled[0]?.top,
    420 - (innerHeight - 400 - 8),
    'by what the panel lacks below the tile',
  );
  assert.equal(
    shadow.querySelector<HTMLElement>('.panel')?.style.bottom,
    '',
    'so it grows down, not up',
  );
  page.remove();
});

test('a pop-up unfolding from a tile with room below it does not scroll the page', async () => {
  const page = scrollable();
  const tile = document.createElement('div');
  page.append(tile);
  document.body.append(page);
  const scrolled: unknown[] = [];
  page.scrollBy = (options?: ScrollToOptions | number) => {
    scrolled.push(options);
  };
  tile.getBoundingClientRect = () => new DOMRect(400, 100, 360, 64);
  await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  assert.equal(scrolled.length, 0);
  page.remove();
});

test('an opening that is not sheet, dialog or unfold is refused', () => {
  assert.throws(() => {
    router().setConfig({ ...CONFIG, open: { tablet: 'drawer' as never } });
  }, /open.tablet must be one of sheet, dialog, unfold/);
});

test('a page that loads with a pop-up in its address unfolds it from its tile once the tile is drawn', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  current?.remove();
  setHash('#bathroom');
  const made = router();
  made.setConfig({ ...CONFIG, open: { desktop: 'unfold' } });
  document.body.append(made);
  current = made;
  const shadow = await mounted(made);
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(400, 180, 300, 64);
  await new Promise((resolve) => setTimeout(resolve, 50));
  offerOrigin('#bathroom', tile);
  await settledLayout();
  await made.updateComplete;
  assert.ok(shadow.querySelector('dialog')?.classList.contains('unfold'));
  assert.equal(shadow.querySelector<HTMLElement>('.panel')?.style.top, '180px');
  tile.remove();
});

test('a pop-up in the address that a template announces after the page loads still unfolds from its tile', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  current?.remove();
  setHash('#announced-later');
  const made = router();
  made.setConfig({ type: 'custom:mnml-popups-card', width: '560px', open: { desktop: 'unfold' } });
  document.body.append(made);
  current = made;
  const shadow = await mounted(made);
  await settle();
  const owner = {};
  announce(owner, [
    { hash: '#announced-later', cards: [{ type: 'custom:mnml-header-card', name: 'Later' }] },
  ]);
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(400, 180, 300, 64);
  await new Promise((resolve) => setTimeout(resolve, 50));
  offerOrigin('#announced-later', tile);
  await settledLayout();
  await made.updateComplete;
  assert.ok(shadow.querySelector('dialog')?.classList.contains('unfold'));
  withdraw(owner);
  tile.remove();
});

test('a pop-up in the address waits until its tile stops moving while the page lays out, then unfolds from where it settled', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  current?.remove();
  setHash('#bathroom');
  const made = router();
  made.setConfig({ ...CONFIG, open: { desktop: 'unfold' } });
  document.body.append(made);
  current = made;
  const shadow = await mounted(made);
  const tile = document.createElement('div');
  document.body.append(tile);
  let top = 120;
  tile.getBoundingClientRect = () => new DOMRect(400, top, 360, 64);
  offerOrigin('#bathroom', tile);
  await new Promise((resolve) => setTimeout(resolve, 40));
  top = 240;
  await new Promise((resolve) => setTimeout(resolve, 400));
  await made.updateComplete;
  await settle();
  assert.equal(shadow.querySelector<HTMLElement>('.panel')?.style.top, '240px');
  tile.remove();
});

test('an unfolded pop-up follows its tile when the page lays out again, as on a resize', async () => {
  const tile = document.createElement('div');
  document.body.append(tile);
  let box = new DOMRect(400, 200, 360, 64);
  tile.getBoundingClientRect = () => box;
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  const panel = (): HTMLElement | null => shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel()?.style.left, '400px');
  box = new DOMRect(120, 260, 420, 64);
  await settledLayout();
  await current?.updateComplete;
  assert.equal(panel()?.style.left, '120px');
  assert.equal(panel()?.style.top, '260px');
  assert.equal(panel()?.style.width, '420px');
  closePopup();
  tile.remove();
});

test('a pop-up opened from inside an unfolded one stays in its place, and keeps following the first tile', async () => {
  const tile = document.createElement('div');
  document.body.append(tile);
  let box = new DOMRect(400, 200, 360, 64);
  tile.getBoundingClientRect = () => box;
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  const panel = (): HTMLElement | null => shadow.querySelector<HTMLElement>('.panel');
  const row = document.createElement('div');
  document.body.append(row);
  row.getBoundingClientRect = () => new DOMRect(408, 330, 344, 56);
  navigate('#bathroom-lights', row);
  fireRoute('location-changed');
  await settledLayout();
  await current?.updateComplete;
  assert.equal(location.hash, '#bathroom-lights');
  assert.equal(panel()?.style.left, '400px', 'not where the row is');
  assert.equal(panel()?.style.top, '200px');
  assert.equal(panel()?.style.width, '360px');
  box = new DOMRect(120, 260, 420, 64);
  await settledLayout();
  await current?.updateComplete;
  assert.equal(panel()?.style.left, '120px', 'it follows the tile, not the row');
  closePopup();
  row.remove();
  tile.remove();
});
