import assert from 'node:assert/strict';

import { afterEach, test, vi } from 'vitest';

import type { PopupsCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { PREBUILD_EVENT } from '../ha/navigation.ts';
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
  return { finished: promise } as unknown as Animation;
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

test('the styles turn a pop-up into a sheet at the width the script measures', () => {
  const css = MnmlPopupsCard.styles.map((style) => style.cssText).join('\n');
  assert.ok(css.includes(`@media ${SHEET}`));
});
