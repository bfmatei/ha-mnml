import assert from 'node:assert/strict';

import { html } from 'lit';
import { afterEach, test, vi } from 'vitest';

import type { PopupsCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { PREBUILD_EVENT, closePopup, navigate, offerOrigin } from '../ha/navigation.ts';
import { fakeConnection, fakeHass } from '../test/hass.ts';
import type { FakeState } from '../test/hass.ts';
import { configure, define, mounted, styled, updated } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlGlancesCard } from './glances.ts';
import { MnmlCardNote } from './parts/card-element.ts';
import { announce, withdraw } from './parts/popup-registry.ts';
import { MnmlPopupsCard, SHEET } from './popups.ts';

class Probe extends HTMLElement {
  config: unknown;
  hass: HomeAssistant | undefined;
  setConfig(config: unknown): void {
    this.config = config;
  }
}

define('mnml-popups-card', MnmlPopupsCard);
define('mnml-glances-card', MnmlGlancesCard);
define('mnml-card-note', MnmlCardNote);
define('mnml-probe-card', Probe);

const finishing: (() => void)[] = [];
function animate(): Pick<Animation, 'cancel'> & { finished: Promise<undefined> } {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  finishing.push(() => {
    resolve(undefined);
  });
  return { finished: promise, cancel: () => undefined };
}
Reflect.set(HTMLElement.prototype, 'animate', animate);

function allowMotion(): () => void {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  return () => {
    for (const finish of finishing.splice(0)) {
      finish();
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  finishing.length = 0;
});

function frozen(): void {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
}

async function later(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

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

function setHash(hash: string): void {
  history.replaceState(null, '', `${location.pathname}${hash}`);
}

function fireRoute(name: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function hassOf(states: Readonly<Record<string, FakeState>>): HomeAssistant {
  return fakeHass({ states });
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

async function routed(hash: string): Promise<void> {
  setHash(hash);
  fireRoute('location-changed');
  await updated(document);
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
  await routed('#bathroom');
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

test('the scroller ends 5px short of the panel edge and keeps 6px clear of its content, so its scrollbar sits between the cards and the edge and never over a card', async () => {
  const { shadow } = await mount('');
  await routed('#bathroom');
  const body = slotsOf(shadow)[1];
  assert.ok(body);
  const scroller = getComputedStyle(body);
  assert.equal(scroller.marginInlineEnd, 'calc(5px - var(--mnml-popup-gap, 8px))');
  assert.equal(scroller.paddingInlineEnd, '6px');
  assert.equal(scroller.getPropertyValue('scrollbar-width'), 'thin');
});

test('the body says there is more to scroll to until it has been scrolled to the end', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  await routed('#bathroom');
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
  const { shadow } = await mount('#bathroom');
  await updated(document);
  assert.equal(mountedCards(shadow), 2);
  await routed('#bathroom-lights');
  assert.equal(shadow.querySelector('dialog')?.open, true, 'the new pop-up is open');
  assert.equal(mountedCards(shadow), 1, 'with only its own card');
  assert.equal(built.length, 3, 'two then one, never both at once');
});

test('a pop-up whose cards are built after another has opened does not take its place', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  const helpers = window.loadCardHelpers;
  assert.ok(helpers);
  const slow = Promise.withResolvers<undefined>();
  window.loadCardHelpers = async () => {
    await slow.promise;
    return helpers();
  };
  setHash('#bathroom');
  fireRoute('location-changed');
  window.loadCardHelpers = helpers;
  await routed('#bathroom-lights');
  await until(() => mountedCards(shadow) === 1, 'the second pop-up');
  slow.resolve(undefined);
  await until(() => built.length === 3, 'the first pop-up built');
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog')?.getAttribute('aria-label'), 'Lights');
  assert.equal(mountedCards(shadow), 1, 'the late cards are not drawn');
});

test('it tears everything down when the hash clears', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  await routed('#bathroom');
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
  await updated(document);
  assert.equal(built.length, 2, 'built before the hash changed');
  assert.equal(shadow.querySelector('dialog'), null, 'but nothing is shown yet');
  await routed('#bathroom');
  assert.equal(built.length, 2, 'opening reused the prepared cards rather than rebuilding');
  assert.equal(mountedCards(shadow), 2, 'and mounted them');
});

test('two prebuild requests for one hash build it once', async () => {
  const { router } = await mount('');
  router.hass = hassOf({});
  fireRoute(PREBUILD_EVENT, { hash: '#bathroom' });
  fireRoute(PREBUILD_EVENT, { hash: '#bathroom' });
  await updated(document);
  assert.equal(built.length, 2, 'the second request joins the first build');
});

test('opening while a prebuild is in flight waits for it rather than building again', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({});
  fireRoute(PREBUILD_EVENT, { hash: '#bathroom' });
  await routed('#bathroom');
  assert.equal(built.length, 2, 'one build served both');
  assert.equal(mountedCards(shadow), 2);
});

test('a child with a visibility rule is hidden while the rule fails, and shown once it holds', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({ 'climate.a': { entity_id: 'climate.a', state: 'off', attributes: {} } });
  await routed('#bathroom-ac');
  const [head, body] = slotsOf(shadow);
  assert.equal(cardsIn(head)[0]?.hidden, false, 'a card without a rule is shown');
  assert.equal(cardsIn(body)[0]?.hidden, true, 'the ruled card is hidden while the unit is off');
  router.hass = hassOf({ 'climate.a': { entity_id: 'climate.a', state: 'cool', attributes: {} } });
  assert.equal(cardsIn(body)[0]?.hidden, false, 'and shown as soon as the state allows');
});

async function withoutHelpers(run: () => Promise<void>): Promise<void> {
  const helpers = window.loadCardHelpers;
  Reflect.deleteProperty(window, 'loadCardHelpers');
  try {
    await run();
  } finally {
    window.loadCardHelpers = helpers;
  }
}

test("an MNML card in a pop-up is drawn by its own class, given Home Assistant's state and judged by its visibility, without Home Assistant's helpers", async () => {
  await withoutHelpers(async () => {
    const { router, shadow } = await mount('');
    router.setConfig({
      ...CONFIG,
      popups: [
        {
          hash: '#desk',
          cards: [
            { type: 'custom:mnml-probe-card', name: 'Desk' },
            {
              type: 'custom:mnml-probe-card',
              name: 'Lamp',
              visibility: [{ condition: 'state', entity: 'light.a', state: 'on' }],
            },
          ],
        },
      ],
    });
    const hass = hassOf({ 'light.a': { entity_id: 'light.a', state: 'off', attributes: {} } });
    router.hass = hass;
    await routed('#desk');
    const [head, body] = slotsOf(shadow);
    const [first] = cardsIn(head);
    const [second] = cardsIn(body);
    assert.ok(first instanceof Probe, first?.localName ?? 'nothing is drawn');
    assert.ok(second instanceof Probe, second?.localName ?? 'nothing is drawn');
    assert.deepEqual(first.config, { type: 'custom:mnml-probe-card', name: 'Desk' });
    assert.equal(second.hass, hass);
    assert.equal(second.hidden, true);
  });
  assert.equal(built.length, 0);
});

test("without Home Assistant's helpers, a Home Assistant card in a pop-up is a note that says how to see it, and the MNML cards beside it are drawn", async () => {
  await withoutHelpers(async () => {
    const { router, shadow } = await mount('');
    router.setConfig({
      ...CONFIG,
      popups: [{ hash: '#desk', cards: [{ type: 'custom:mnml-probe-card' }, { type: 'map' }] }],
    });
    router.hass = hassOf({});
    await routed('#desk');
    const [head, body] = slotsOf(shadow);
    assert.ok(cardsIn(head)[0] instanceof Probe);
    const note = cardsIn(body)[0];
    assert.ok(note instanceof MnmlCardNote, note?.localName ?? 'nothing is drawn');
    assert.match(note.message, /map card shows here once a dashboard has been opened/);
  });
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
  await updated(document);
  const shadow = await mounted(made);
  const dialog = shadow.querySelector('dialog');
  assert.ok(dialog, 'the pop-up in the URL opens as soon as the card is in the page');
  assert.equal(dialog.open, true);
});

test('a prebuild for an unknown hash is ignored', async () => {
  await mount('');
  fireRoute(PREBUILD_EVENT, { hash: '#nothing' });
  fireRoute(PREBUILD_EVENT, {});
  await updated(document);
  assert.equal(built.length, 0);
});

test('disconnecting closes it and drops its listeners', async () => {
  const { router, shadow } = await mount('#bathroom');
  await updated(document);
  assert.ok(shadow.querySelector('dialog'));
  router.remove();
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null);
  await routed('#bathroom');
  assert.equal(shadow.querySelector('dialog'), null, 'no longer routing');
});

test('it stops the page behind from scrolling, and gives it back', async () => {
  const page = scrollable();
  document.body.append(page);
  const { shadow } = await mount('', page);
  await routed('#bathroom');
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
  await routed('#bathroom');
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
  const { shadow } = await mount('#bathroom');
  await updated(document);
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
  await updated(document);
  assert.ok(shadow.querySelector('dialog'));
  setHash('');
  fireRoute('location-changed');
  await router.updateComplete;
  const leaving = shadow.querySelector('dialog');
  assert.ok(leaving, 'still in the tree while it animates');
  assert.ok(leaving.classList.contains('leaving'), 'and marked so it takes no input');
  finish();
  await updated(document);
  assert.equal(shadow.querySelector('dialog'), null, 'gone once the animation finished');
});

test('a pop-up opened from another keeps the panel, and swaps what is in it once the old has slid out', async () => {
  const finish = allowMotion();
  const { shadow } = await mount('#bathroom');
  await updated(document);
  finish();
  const panel = shadow.querySelector('.panel');
  assert.ok(panel);
  assert.equal(mountedCards(shadow), 2);
  setHash('#bathroom-lights');
  fireRoute('location-changed');
  await updated(document);
  assert.equal(mountedCards(shadow), 2, 'the old content is still there while it slides out');
  finish();
  await updated(document);
  assert.equal(shadow.querySelector('.panel'), panel, 'in the same panel');
  assert.equal(mountedCards(shadow), 1, 'now with only the new pop-up own card');
});

async function slides(direction: 'ltr' | 'rtl'): Promise<string[]> {
  const shifts: string[] = [];
  Reflect.set(
    HTMLElement.prototype,
    'animate',
    function recorded(keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
      for (const frame of Array.isArray(keyframes) ? keyframes : []) {
        const shift = frame['transform'];
        if (typeof shift === 'string' && shift.startsWith('translateX')) {
          shifts.push(shift);
        }
      }
      return animate();
    },
  );
  document.documentElement.setAttribute('dir', direction);
  try {
    const finish = allowMotion();
    await mount('#bathroom');
    await updated(document);
    finish();
    shifts.length = 0;
    setHash('#bathroom-lights');
    fireRoute('location-changed');
    await updated(document);
    finish();
    await updated(document);
    return [...new Set(shifts)];
  } finally {
    Reflect.set(HTMLElement.prototype, 'animate', animate);
    document.documentElement.removeAttribute('dir');
  }
}

test('the next pop-up slides in from the end of the line, which is the left one read right to left', async () => {
  assert.deepEqual(await slides('ltr'), ['translateX(-20px)', 'translateX(20px)']);
  assert.deepEqual(await slides('rtl'), ['translateX(20px)', 'translateX(-20px)']);
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
  await updated(document);
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
  await updated(document);
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
  await updated(document);
  setHash('');
  fireRoute('location-changed');
  await router.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null, 'no animation to wait for');
});

test('a child follows a state rule, a list of states, and a list of states to avoid', async () => {
  const { router, shadow } = await mount('');
  router.hass = hassOf({ 'light.a': { entity_id: 'light.a', state: 'off', attributes: {} } });
  await routed('#bedroom');
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

test('a visibility rule that lacks what Home Assistant requires of its kind is an error that names where it is', () => {
  const made = router();
  assert.throws(() => {
    made.setConfig(ruled([{ condition: 'state', entity: 'light.a' }]));
  }, /popups\[0\]\.cards\[1\]\.visibility\[0\]: a state condition needs state or state_not/);
  assert.throws(() => {
    made.setConfig(ruled([{ condition: 'or', conditions: [{ condition: 'screen' }] }]));
  }, /popups\[0\]\.cards\[1\]\.visibility\[0\]\.conditions\[0\]: a screen condition needs/);
  assert.throws(() => {
    made.setConfig(ruled({ condition: 'screen', media_query: '(min-width: 0px)' }));
  }, /popups\[0\]\.cards\[1\]\.visibility: must be a list/);
});

const EDITOR_CONDITIONS: Record<string, unknown>[] = [
  { condition: 'numeric_state', entity: 'sensor.a', above: 1, below: 'number.b' },
  { condition: 'state', entity: 'climate.a', attribute: 'hvac_action', state: 'heating' },
  { condition: 'state', state_not: 'off' },
  { condition: 'screen', media_query: '(min-width: 1024px)' },
  { condition: 'user', users: ['u-1'] },
  { condition: 'and', conditions: [{ condition: 'state', entity: 'light.a', state: 'on' }] },
  { condition: 'or', conditions: [{ condition: 'user', users: ['u-1'] }] },
  { condition: 'not', conditions: [{ condition: 'screen', media_query: '(min-width: 0px)' }] },
  { condition: 'template', value_template: '{{ true }}' },
  { condition: 'sun', after: 'sunset' },
  { condition: 'zone', entity_id: 'person.a', zone: 'zone.home' },
  { condition: 'device', device_id: 'd-1', domain: 'light', type: 'is_on' },
  { condition: 'light.is_on', target: { entity_id: 'light.a' } },
  { condition: 'state', entity_id: ['light.a'], state: 'on', for: { minutes: 5 } },
  { condition: 'time', after: '08:00', before: '20:00', weekdays: ['mon'] },
  { condition: 'location', locations: ['home'] },
  { condition: 'view_columns', min: 2 },
  { condition: 'numeric_state', entity: '' },
  { condition: 'state', entity: '', state: '' },
  { condition: 'screen', media_query: '' },
  { condition: 'user', users: [] },
  { condition: 'and', conditions: [] },
  { condition: 'not' },
];

test("every condition Home Assistant's editor writes is accepted on a card in a pop-up", () => {
  const made = router();
  for (const condition of EDITOR_CONDITIONS) {
    assert.doesNotThrow(() => {
      made.setConfig(ruled([condition]));
    }, JSON.stringify(condition));
  }
});

const states = (level: string, action: string, light: string): HomeAssistant =>
  fakeHass({
    states: {
      'sensor.level': { state: level },
      'climate.a': { state: 'heat', attributes: { hvac_action: action } },
      'light.a': { state: light },
    },
    user: { id: 'u-1', is_admin: false },
  });

test('a child is judged by numeric_state, an attribute, its user and and, or and not, its own entity standing in for one a condition leaves out', async () => {
  const { router, shadow } = await mount('');
  const on = { condition: 'state', entity: 'light.a', state: 'on' };
  router.setConfig({
    ...CONFIG,
    popups: [
      {
        hash: '#ruled',
        cards: [
          { type: 'map' },
          {
            type: 'map',
            entity: 'sensor.level',
            visibility: [{ condition: 'numeric_state', above: 40 }],
          },
          {
            type: 'map',
            visibility: [
              {
                condition: 'state',
                entity: 'climate.a',
                attribute: 'hvac_action',
                state: 'heating',
              },
            ],
          },
          { type: 'map', visibility: [{ condition: 'user', users: ['u-2'] }] },
          { type: 'map', visibility: [{ condition: 'not', conditions: [on] }] },
          {
            type: 'map',
            visibility: [{ condition: 'or', conditions: [on, { ...on, state: 'off' }] }],
          },
        ],
      },
    ],
  });
  router.hass = states('30', 'idle', 'off');
  await routed('#ruled');
  const [, body] = slotsOf(shadow);
  assert.deepEqual(
    cardsIn(body).map((card) => card.hidden),
    [true, true, true, false, false],
  );
  router.hass = states('45', 'heating', 'on');
  assert.deepEqual(
    cardsIn(body).map((card) => card.hidden),
    [false, false, true, true, false],
  );
});

test('a child whose condition only the server can judge is hidden until subscribe_condition answers, and the subscription ends with the pop-up', async () => {
  const sent: { message: unknown; answer: (event: unknown) => void; closed: boolean }[] = [];
  const connection = fakeConnection({
    subscribeMessage: (answer, message) => {
      const entry = { message, answer, closed: false };
      sent.push(entry);
      return Promise.resolve(() => {
        entry.closed = true;
        return Promise.resolve();
      });
    },
  });
  const sun = { condition: 'sun', after: 'sunset' };
  const { router, shadow } = await mount('');
  router.setConfig({
    ...CONFIG,
    popups: [{ hash: '#dusk', cards: [{ type: 'map' }, { type: 'map', visibility: [sun] }] }],
  });
  router.hass = fakeHass({ connection });
  await routed('#dusk');
  const [, body] = slotsOf(shadow);
  assert.equal(cardsIn(body)[0]?.hidden, true, 'hidden until the server answers');
  assert.deepEqual(
    sent.map((entry) => entry.message),
    [{ type: 'subscribe_condition', condition: sun }],
  );
  sent[0]?.answer({ result: true });
  assert.equal(cardsIn(body)[0]?.hidden, false, 'shown as soon as it answers yes');
  setHash('');
  fireRoute('location-changed');
  await updated(document);
  assert.equal(sent[0]?.closed, true);
});

const IDLE: PopupsCard = { ...CONFIG, idle_close: 30 };

async function idling(config: PopupsCard = IDLE): Promise<MnmlPopupsCard> {
  frozen();
  current?.remove();
  setHash('#bathroom');
  const made = router();
  made.setConfig(config);
  document.body.append(made);
  current = made;
  made.hass = fakeHass({ user: { id: 'u-1', is_admin: false } });
  await mounted(made);
  await later(0);
  return made;
}

test('an open pop-up closes after idle_close seconds without input, and any input starts the count again', async () => {
  await idling();
  await later(20_000);
  window.dispatchEvent(new Event('pointerdown'));
  await later(20_000);
  assert.equal(location.hash, '#bathroom', 'a touch twenty seconds in keeps it open');
  document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  await later(29_000);
  assert.equal(location.hash, '#bathroom', 'and so does a key');
  await later(1_000);
  assert.equal(location.hash, '', 'thirty seconds of nothing closes it');
  await later(60_000);
  assert.equal(vi.getTimerCount(), 0, 'and nothing waits while no pop-up is open');
});

const changed = (user: string): HomeAssistant =>
  fakeHass({
    states: { 'light.a': { state: user, context: { id: user, user_id: user, parent_id: null } } },
    user: { id: 'u-1', is_admin: false },
  });

test('a state change the reader caused counts as input, and one somebody else caused does not', async () => {
  const made = await idling();
  await later(20_000);
  made.hass = changed('u-1');
  await later(20_000);
  assert.equal(location.hash, '#bathroom');
  made.hass = changed('u-2');
  await later(10_000);
  assert.equal(location.hash, '', "another user's change is not the reader's input");
});

test('without idle_close an open pop-up stays open, and idle_close is a number of seconds above zero', async () => {
  await idling(CONFIG);
  await later(3_600_000);
  assert.equal(location.hash, '#bathroom');
  const made = router();
  assert.throws(() => {
    made.setConfig({ ...CONFIG, idle_close: 0 });
  }, /idle_close must be a number of seconds above zero/);
  assert.throws(() => {
    configure(made, { ...CONFIG, idle_close: '30' });
  }, /idle_close must be a number/);
});

const DOOR = 'binary_sensor.door';

function doorHass(state: string, user = 'u-1'): HomeAssistant {
  return fakeHass({ states: { [DOOR]: { state } }, user: { id: user, is_admin: false } });
}

const ALERTING: PopupsCard = {
  ...CONFIG,
  alerts: [{ entity: DOOR, popup: '#bathroom' }],
};

async function alerting(
  config: PopupsCard,
  first: HomeAssistant,
): Promise<{ made: MnmlPopupsCard; shadow: ShadowRoot }> {
  current?.remove();
  setHash('');
  history.replaceState({ root: true }, '', location.pathname);
  const made = router();
  made.setConfig(config);
  document.body.append(made);
  current = made;
  made.hass = first;
  const shadow = await mounted(made);
  await updated(document);
  return { made, shadow };
}

const closed = (): Promise<void> => until(() => location.hash === '', 'the pop-up closed');

test('an alert opens its pop-up when its entity turns to the state, and closes it when the state clears', async () => {
  const { made, shadow } = await alerting(ALERTING, doorHass('off'));
  assert.equal(location.hash, '');
  made.hass = doorHass('on');
  await updated(document);
  assert.equal(location.hash, '#bathroom', 'on by default');
  assert.equal(shadow.querySelector('dialog')?.open, true);
  made.hass = doorHass('on');
  made.hass = doorHass('off');
  await closed();
  assert.equal(location.hash, '', 'the alert opened it, so the alert closes it');
});

test('a dashboard loaded while an alert already holds opens nothing, and an alert leaves a pop-up the reader opened', async () => {
  const { made } = await alerting(
    { ...CONFIG, alerts: [{ entity: DOOR, not: ['off'], popup: '#bathroom' }] },
    doorHass('open'),
  );
  await updated(document);
  assert.equal(location.hash, '', 'only a change opens it');
  made.hass = doorHass('off');
  made.hass = doorHass('unavailable');
  await updated(document);
  assert.equal(location.hash, '', 'an entity without a value never alerts');
  navigate('#bathroom');
  await updated(document);
  const go = vi.spyOn(history, 'go');
  made.hass = doorHass('open');
  made.hass = doorHass('off');
  await updated(document);
  assert.equal(go.mock.calls.length, 0, 'nothing goes back');
  assert.equal(location.hash, '#bathroom', 'the reader opened it, so it stays');
  go.mockRestore();
  closePopup();
  await closed();
});

test('an alert limited to kinds of screen or to users opens only for them', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone(query) }));
  const { made } = await alerting(
    {
      ...CONFIG,
      alerts: [
        { entity: DOOR, popup: '#bathroom', screens: ['tablet', 'desktop'] },
        { entity: DOOR, popup: '#bedroom', users: ['u-2'] },
      ],
    },
    doorHass('off'),
  );
  made.hass = doorHass('on');
  await updated(document);
  assert.equal(location.hash, '', 'not on a phone, and not for this user');
  made.hass = doorHass('off', 'u-2');
  made.hass = doorHass('on', 'u-2');
  await updated(document);
  assert.equal(location.hash, '#bedroom');
  closePopup();
  await closed();
});

test('an alert whose hash no pop-up has opens nothing, and tells the reader once', async () => {
  const told: unknown[] = [];
  const listen = (event: Event): void => {
    told.push((event as CustomEvent).detail);
  };
  window.addEventListener('hass-notification', listen);
  try {
    const { made } = await alerting(
      { ...CONFIG, alerts: [{ entity: DOOR, popup: '#garage' }] },
      doorHass('off'),
    );
    made.hass = doorHass('on');
    made.hass = doorHass('off');
    made.hass = doorHass('on');
    await updated(document);
    assert.equal(location.hash, '');
    assert.deepEqual(told, [{ message: 'alerts[0] opens #garage, and no pop-up has that hash' }]);
  } finally {
    window.removeEventListener('hass-notification', listen);
  }
});

test("an alert's screens are phone, tablet and desktop", () => {
  const made = router();
  assert.throws(() => {
    configure(made, {
      ...CONFIG,
      alerts: [{ entity: DOOR, popup: '#bathroom', screens: ['watch'] }],
    });
  }, /alerts\[0\]\.screens must be a list of phone, tablet, desktop/);
});

test('the width is a size in pixels', () => {
  const made = router();
  const { width: _width, ...rest } = CONFIG;
  assert.throws(() => {
    configure(made, rest);
  }, /width/);
  assert.throws(() => {
    configure(made, { ...CONFIG, width: '560' });
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
  await updated(document);
  const shadow = await mounted(made);
  assert.equal(shadow.querySelector('dialog'), null, 'nothing to open yet');
  const owner = {};
  announce(owner, [{ hash: '#late', cards: [{ type: 'custom:mnml-header-card', name: 'Late' }] }]);
  await updated(document);
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

test('an announced pop-up with a condition that lacks what its kind needs still opens and draws its cards', async () => {
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
  ]);
  await updated(document);
  const shadow = await mounted(made);
  assert.equal(shadow.querySelector('dialog')?.open, true);
  assert.equal(mountedCards(shadow), 2);
  withdraw(owner);
  made.remove();
});

test('routing from one pop-up to another keeps the dialog, so its backdrop does not flicker', async () => {
  const finish = allowMotion();
  const { router, shadow } = await mount('#bathroom');
  await updated(document);
  const first = shadow.querySelector('dialog');
  assert.ok(first);
  await routed('#bathroom-lights');
  finish();
  await updated(document);
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
  await updated(document);
  assert.equal(shadow.querySelector('dialog'), null, 'and it still goes when the hash clears');
});

test('the dialog draws no focus ring of its own, since it fills the whole viewport', () => {
  const root = styled(MnmlPopupsCard.styles, html`<dialog open tabindex="-1"></dialog>`);
  const dialog = root.querySelector('dialog');
  assert.ok(dialog);
  dialog.focus();
  assert.equal(root.activeElement, dialog);
  assert.equal(getComputedStyle(dialog).outline, 'none');
});

const settledLayout = (): Promise<void> => later(300);

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
  await updated(document);
  return shadow;
}

const phone = (query: string): boolean => query === SHEET || query.includes('1024px');
const desktop = (): boolean => false;
const stillDesktop = (query: string): boolean => query.includes('reduce');

async function classes(config: PopupsCard, width: (query: string) => boolean): Promise<string[]> {
  return [...((await openedAs(config, width)).querySelector('dialog')?.classList ?? [])];
}

test('a pop-up opens as a sheet on a phone and as a dialog elsewhere, unless open says otherwise', async () => {
  assert.ok((await classes(CONFIG, phone)).includes('sheet'));
  assert.ok((await classes(CONFIG, desktop)).includes('dialog'));
  assert.ok((await classes({ ...CONFIG, open: { phone: 'dialog' } }, phone)).includes('dialog'));
});

test("a pop-up set to unfold takes the place of its tile at the dialog's width, growing down from it, and is a dialog without one", async () => {
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(100, 200, 600, 64);
  const config: PopupsCard = { ...CONFIG, open: { desktop: 'unfold' } };
  const shadow = await openedAs(config, desktop, tile);
  assert.ok(shadow.querySelector('dialog')?.classList.contains('unfold'));
  const panel = shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel?.style.left, '100px', 'where the tile starts');
  assert.equal(panel?.style.width, '560px', "the dialog's width, not the tile's 600 px");
  assert.equal(panel?.style.top, '200px', 'from the top of the tile');
  tile.remove();
  closePopup();
  const without = await openedAs({ ...config, popups: [...(config.popups ?? [])] }, desktop);
  assert.ok(without.querySelector('dialog')?.classList.contains('dialog'));
});

test("a pop-up unfolding from a tile narrower than the dialog takes the dialog's width, growing from the tile's edge nearer the window's", async () => {
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(innerWidth - 400, 200, 300, 64);
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  const panel = shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel?.style.width, '560px', "the dialog's width");
  assert.equal(
    panel?.style.left,
    `${innerWidth - 100 - 560}px`,
    "level with the tile's right edge",
  );
  assert.equal(panel?.style.top, '200px', 'from the top of the tile');
  tile.remove();
});

test('a pop-up unfolding from a tile near the bottom grows up from the bottom of the tile', async () => {
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(100, innerHeight - 120, 600, 64);
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  const panel = shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel?.style.left, '100px');
  assert.equal(panel?.style.top, '');
  assert.equal(panel?.style.bottom, '56px', 'level with the bottom of the tile');
  tile.remove();
});

test('a pop-up unfolding from a tile too low on the page scrolls the page until the tile has room below it', async () => {
  frozen();
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
  await settledLayout();
  assert.ok(shadow.querySelector('.panel'));
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
    configure(router(), { ...CONFIG, open: { tablet: 'drawer' } });
  }, /open.tablet must be one of sheet, dialog, unfold/);
});

test('a page that loads with a pop-up in its address unfolds it from its tile once the tile is drawn', async () => {
  frozen();
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
  await later(50);
  offerOrigin('#bathroom', tile);
  await settledLayout();
  await made.updateComplete;
  assert.ok(shadow.querySelector('dialog')?.classList.contains('unfold'));
  assert.equal(shadow.querySelector<HTMLElement>('.panel')?.style.top, '180px');
  tile.remove();
});

test('a pop-up in the address that a template announces after the page loads still unfolds from its tile', async () => {
  frozen();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  current?.remove();
  setHash('#announced-later');
  const made = router();
  made.setConfig({ type: 'custom:mnml-popups-card', width: '560px', open: { desktop: 'unfold' } });
  document.body.append(made);
  current = made;
  const shadow = await mounted(made);
  await updated(document);
  const owner = {};
  announce(owner, [
    { hash: '#announced-later', cards: [{ type: 'custom:mnml-header-card', name: 'Later' }] },
  ]);
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(400, 180, 300, 64);
  await later(50);
  offerOrigin('#announced-later', tile);
  await settledLayout();
  await made.updateComplete;
  assert.ok(shadow.querySelector('dialog')?.classList.contains('unfold'));
  withdraw(owner);
  tile.remove();
});

test('a pop-up in the address waits until its tile stops moving while the page lays out, then unfolds from where it settled', async () => {
  frozen();
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
  await later(40);
  assert.equal(shadow.querySelector('.panel'), null, 'nothing opens while the tile may still move');
  top = 240;
  await later(60);
  assert.equal(shadow.querySelector('.panel'), null, 'nor until it has kept still');
  await later(400);
  await updated(document);
  assert.equal(shadow.querySelector<HTMLElement>('.panel')?.style.top, '240px');
  tile.remove();
});

test('an unfolded pop-up follows its tile when the page lays out again, as on a resize', async () => {
  frozen();
  const tile = document.createElement('div');
  document.body.append(tile);
  let box = new DOMRect(100, 200, 600, 64);
  tile.getBoundingClientRect = () => box;
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  const panel = (): HTMLElement | null => shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel()?.style.left, '100px');
  await settledLayout();
  assert.equal(vi.getTimerCount(), 0, 'no frame runs while the tile keeps still');
  box = new DOMRect(120, 260, 620, 64);
  window.dispatchEvent(new Event('resize'));
  await settledLayout();
  await current?.updateComplete;
  assert.equal(panel()?.style.left, '120px');
  assert.equal(panel()?.style.top, '260px');
  assert.equal(panel()?.style.width, '560px');
  closePopup();
  tile.remove();
});

test('an unfolded pop-up stops following its tile once it closes, and stays put while it folds back', async () => {
  frozen();
  const tile = document.createElement('div');
  document.body.append(tile);
  let box = new DOMRect(100, 200, 600, 64);
  tile.getBoundingClientRect = () => box;
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  const panel = (): HTMLElement | null => shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel()?.style.left, '100px');
  setHash('');
  fireRoute('location-changed');
  await current?.updateComplete;
  assert.ok(shadow.querySelector('dialog.leaving'), 'it is closing');
  box = new DOMRect(120, 260, 420, 64);
  await later(100);
  await current?.updateComplete;
  assert.equal(panel()?.style.left, '100px', 'and stays put while it closes');
  assert.equal(vi.getTimerCount(), 0, 'with no frame waiting');
  tile.remove();
});

test('an unfolded pop-up taken off the page leaves no frame waiting', async () => {
  frozen();
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(400, 200, 360, 64);
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, stillDesktop, tile);
  assert.ok(shadow.querySelector('dialog.unfold'));
  assert.equal(vi.getTimerCount(), 1, 'it follows its tile');
  current?.remove();
  assert.equal(vi.getTimerCount(), 0);
  tile.remove();
});

test('an unfolded pop-up that has closed lets go of its tile: a resize after it wakes nothing', async () => {
  frozen();
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(400, 200, 360, 64);
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, stillDesktop, tile);
  assert.ok(shadow.querySelector('dialog.unfold'));
  await settledLayout();
  assert.equal(vi.getTimerCount(), 0, 'at rest while its tile keeps still');
  setHash('');
  fireRoute('location-changed');
  await current?.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null, 'closed');
  window.dispatchEvent(new Event('resize'));
  assert.equal(vi.getTimerCount(), 0);
  tile.remove();
});

test('a pop-up opened from inside an unfolded one stays in its place, and keeps following the first tile', async () => {
  frozen();
  const tile = document.createElement('div');
  document.body.append(tile);
  let box = new DOMRect(100, 200, 600, 64);
  tile.getBoundingClientRect = () => box;
  const shadow = await openedAs({ ...CONFIG, open: { desktop: 'unfold' } }, desktop, tile);
  const panel = (): HTMLElement | null => shadow.querySelector<HTMLElement>('.panel');
  const row = document.createElement('div');
  document.body.append(row);
  row.getBoundingClientRect = () => new DOMRect(108, 330, 344, 56);
  navigate('#bathroom-lights', row);
  fireRoute('location-changed');
  await settledLayout();
  await current?.updateComplete;
  assert.equal(location.hash, '#bathroom-lights');
  assert.equal(panel()?.style.left, '100px', 'not where the row is');
  assert.equal(panel()?.style.top, '200px');
  assert.equal(panel()?.style.width, '560px');
  box = new DOMRect(120, 260, 420, 64);
  window.dispatchEvent(new Event('resize'));
  await settledLayout();
  await current?.updateComplete;
  assert.equal(panel()?.style.left, '120px', 'it follows the tile, not the row');
  closePopup();
  row.remove();
  tile.remove();
});

test("a glance's well unfolds its pop-up from the well, at the dialog's width, and not from the whole strip", async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  current?.remove();
  setHash('');
  const made = router();
  made.setConfig({ ...CONFIG, open: { desktop: 'unfold' } });
  document.body.append(made);
  current = made;
  const shadow = await mounted(made);
  const strip = document.createElement('mnml-glances-card');
  assert.ok(strip instanceof MnmlGlancesCard);
  strip.setConfig({
    type: 'custom:mnml-glances-card',
    items: [{ entity: 'light.a', popup: '#bathroom' }],
  });
  strip.hass = fakeHass({ states: { 'light.a': { state: 'on' } } });
  const wells = await mounted(strip);
  const well = wells.querySelector<HTMLElement>('.glance');
  assert.ok(well);
  strip.getBoundingClientRect = () => new DOMRect(8, 20, 1008, 28);
  well.getBoundingClientRect = () => new DOMRect(900, 20, 60, 28);
  well.click();
  await updated(document);
  assert.ok(shadow.querySelector('dialog')?.classList.contains('unfold'));
  const panel = shadow.querySelector<HTMLElement>('.panel');
  assert.equal(panel?.style.width, '560px', "the dialog's width, not the strip's");
  assert.equal(panel?.style.left, `${900 + 60 - 560}px`, "level with the well's nearer edge");
  assert.equal(panel?.style.top, '20px', 'from the top of the well');
  closePopup();
  strip.remove();
});

test('a pop-up in the address that is closed while it waits for its tile does not open after all', async () => {
  frozen();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  current?.remove();
  setHash('#bathroom');
  const made = router();
  made.setConfig({ ...CONFIG, open: { desktop: 'unfold' } });
  document.body.append(made);
  current = made;
  const shadow = await mounted(made);
  await later(50);
  setHash('');
  fireRoute('hashchange');
  const tile = document.createElement('div');
  document.body.append(tile);
  tile.getBoundingClientRect = () => new DOMRect(400, 180, 300, 64);
  offerOrigin('#bathroom', tile);
  await settledLayout();
  await made.updateComplete;
  assert.equal(shadow.querySelector('dialog'), null);
  tile.remove();
});

test('the dialog is named by its header, by the name it is given or that of its entity', async () => {
  const { router, shadow } = await mount('');
  router.setConfig({
    ...CONFIG,
    popups: [
      ...(CONFIG.popups ?? []),
      { hash: '#kitchen', cards: [{ type: 'custom:mnml-header-card', entity: 'light.kitchen' }] },
    ],
  });
  router.hass = hassOf({
    'light.kitchen': { state: 'on', attributes: { friendly_name: 'Kitchen' } },
  });
  await routed('#bathroom');
  assert.equal(shadow.querySelector('dialog')?.getAttribute('aria-label'), 'Bathroom');
  await routed('#kitchen');
  assert.equal(shadow.querySelector('dialog')?.getAttribute('aria-label'), 'Kitchen');
});
