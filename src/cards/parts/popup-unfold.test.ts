import assert from 'node:assert/strict';

import { afterEach, beforeEach, test, vi } from 'vitest';

import { foldTo, folded, following, placed, unfolded } from './popup-unfold.ts';
import type { Place } from './popup-unfold.ts';

beforeEach(() => {
  vi.stubGlobal('innerWidth', 1000);
  vi.stubGlobal('innerHeight', 800);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tile = (left: number, top: number, width: number, height: number): DOMRect =>
  new DOMRect(left, top, width, height);

const where = (place: Place): unknown[] => [
  place.left,
  place.width,
  place.edge,
  place.up,
  place.maxHeight,
];

const DIALOG = 560;

test("a tile wider than the dialog grows the panel down from its top, at its left edge and the dialog's width, never its own", () => {
  const from = tile(100, 200, 600, 64);
  const place = placed(from, DIALOG);
  assert.deepEqual(where(place), [100, 560, 200, false, 592]);
  assert.equal(place.from, from, 'and keeps the tile it came from');
});

test("an origin as wide as the page still unfolds at the dialog's width, from its edge nearer the window's", () => {
  assert.deepEqual(where(placed(tile(8, 20, 984, 28), DIALOG)), [8, 560, 20, false, 772]);
  assert.deepEqual(where(placed(tile(16, 20, 980, 28), DIALOG)), [432, 560, 20, false, 772]);
});

test("a glance's well unfolds the panel at the dialog's width from the well itself, at its edge nearer the window's", () => {
  assert.deepEqual(where(placed(tile(900, 20, 60, 28), DIALOG)), [400, 560, 20, false, 772]);
  assert.deepEqual(where(placed(tile(40, 20, 60, 28), DIALOG)), [40, 560, 20, false, 772]);
});

test('a tile near the bottom grows the panel up from its bottom, as high as the room above it', () => {
  assert.deepEqual(where(placed(tile(100, 680, 600, 64), DIALOG)), [100, 560, 56, true, 736]);
});

test('a tile with less than 420 px below it, but no more room above, still grows the panel down', () => {
  vi.stubGlobal('innerHeight', 500);
  assert.deepEqual(where(placed(tile(100, 100, 600, 64), DIALOG)), [100, 560, 100, false, 392]);
});

test('a tile cut off at the top grows the panel down from the top margin', () => {
  assert.deepEqual(where(placed(tile(100, -30, 600, 64), DIALOG)), [100, 560, 8, false, 784]);
});

test('a tile cut off at the bottom grows the panel up from the bottom margin', () => {
  assert.deepEqual(where(placed(tile(100, 760, 600, 64), DIALOG)), [100, 560, 8, true, 784]);
});

test('a tile near the left edge keeps the panel 8 px in from it', () => {
  assert.deepEqual(where(placed(tile(2, 200, 600, 64), DIALOG)), [8, 560, 200, false, 592]);
});

test('a tile past the right edge moves the panel left until it fits', () => {
  assert.deepEqual(where(placed(tile(500, 200, 600, 64), DIALOG)), [432, 560, 200, false, 592]);
});

test("a tile narrower than the dialog unfolds at the dialog's width, from its left edge while that is nearer the window's", () => {
  assert.deepEqual(where(placed(tile(100, 200, 200, 64), DIALOG)), [100, 560, 200, false, 592]);
});

test("a narrow tile nearer the window's right edge grows the panel leftward from its own right edge", () => {
  assert.deepEqual(where(placed(tile(700, 200, 200, 64), DIALOG)), [340, 560, 200, false, 592]);
  assert.deepEqual(
    where(placed(tile(700, 680, 200, 64), DIALOG)),
    [340, 560, 56, true, 736],
    'and still grows up from its bottom near the bottom',
  );
});

test('a narrow tile at either edge of the window keeps the panel 8 px in from it', () => {
  assert.deepEqual(where(placed(tile(0, 200, 200, 64), DIALOG)), [8, 560, 200, false, 592]);
  assert.deepEqual(where(placed(tile(800, 200, 200, 64), DIALOG)), [432, 560, 200, false, 592]);
});

test('a narrow screen gives the panel no more than its width', () => {
  vi.stubGlobal('innerWidth', 300);
  assert.deepEqual(where(placed(tile(40, 200, 200, 64), DIALOG)), [8, 284, 200, false, 592]);
});

test('folded clips the panel to the tile: at its top when it grows down, at its bottom when it grows up', () => {
  assert.equal(
    folded(placed(tile(100, 200, 600, 64), DIALOG), '18px'),
    'inset(0px 0px calc(100% - 64px) 0px round 18px)',
  );
  assert.equal(
    folded(placed(tile(100, 680, 600, 64), DIALOG), '18px'),
    'inset(calc(100% - 64px) 0px 0px 0px round 18px)',
  );
});

test('folded clips the sides off a panel wider than its tile, on the side it grew to, or moved off it', () => {
  assert.equal(
    folded(placed(tile(100, 200, 200, 64), DIALOG), '14px'),
    'inset(0px 360px calc(100% - 64px) 0px round 14px)',
  );
  assert.equal(
    folded(placed(tile(700, 200, 200, 64), DIALOG), '14px'),
    'inset(0px 0px calc(100% - 64px) 360px round 14px)',
  );
  assert.equal(
    folded(placed(tile(500, 200, 600, 64), DIALOG), '14px'),
    'inset(0px 0px calc(100% - 64px) 68px round 14px)',
  );
});

test('folding back clips the panel to where its tile is now, never past its own edges', () => {
  assert.equal(
    foldTo(tile(400, 200, 360, 500), tile(400, 200, 360, 64), '18px'),
    'inset(0px 0px 436px 0px round 18px)',
  );
  assert.equal(
    foldTo(tile(400, 200, 360, 500), tile(300, 150, 600, 64), '18px'),
    'inset(0px 0px 486px 0px round 18px)',
  );
});

test('a view is unfolded while it has a place and its tile is in the page', () => {
  const anchor = document.createElement('div');
  const place = placed(tile(400, 200, 360, 64), DIALOG);
  assert.equal(unfolded(undefined), false);
  assert.equal(unfolded({ place: undefined, anchor }), false, 'a dialog has no place');
  assert.equal(unfolded({ place, anchor }), false, 'a tile out of the page is no anchor');
  document.body.append(anchor);
  assert.equal(unfolded({ place, anchor }), true);
  assert.equal(unfolded({ place, anchor: undefined }), false);
  anchor.remove();
});

const FRAME = 16;

interface Followed {
  anchor: HTMLElement;
  moves: Place[];
  move: (box: DOMRect) => void;
  view: () => { place: Place; anchor: Element } | undefined;
  close: () => void;
}

function followed(parent: Node = document.body): Followed {
  const anchor = document.createElement('div');
  parent.appendChild(anchor);
  let box = tile(400, 200, 360, 64);
  anchor.getBoundingClientRect = () => box;
  let view: { place: Place; anchor: Element } | undefined = { place: placed(box, DIALOG), anchor };
  const moves: Place[] = [];
  return {
    anchor,
    moves,
    move: (next) => {
      box = next;
    },
    view: () => view,
    close: () => {
      view = undefined;
    },
  };
}

function follow(on: Followed): ReturnType<typeof following> {
  return following(
    on.view,
    () => DIALOG,
    (place) => {
      on.moves.push(place);
      const now = on.view();
      if (now !== undefined) {
        Object.assign(now, { place });
      }
    },
  );
}

test('the follower runs no frame while its tile keeps still, and wakes when the window resizes', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const on = followed();
  const follower = follow(on);
  follower.start();
  follower.start();
  assert.equal(vi.getTimerCount(), 1, 'one start is one loop');
  await vi.advanceTimersByTimeAsync(FRAME * 10);
  assert.equal(on.moves.length, 0, 'a tile that keeps still moves nothing');
  assert.equal(vi.getTimerCount(), 0, 'and once it has kept still, no frame runs');
  await vi.advanceTimersByTimeAsync(5000);
  assert.equal(vi.getTimerCount(), 0, 'however long the pop-up stays open');
  on.move(tile(120, 260, 420, 64));
  window.dispatchEvent(new Event('resize'));
  await vi.advanceTimersByTimeAsync(FRAME * 10);
  assert.deepEqual(on.moves.map(where), [[120, 560, 260, false, 532]]);
  assert.equal(vi.getTimerCount(), 0, 'and it rests again');
  follower.stop();
  on.anchor.remove();
});

test('a scroll of the page, or of a scroller in a shadow root around the tile, wakes the follower', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const scroller = document.createElement('div');
  root.append(scroller);
  const on = followed(scroller);
  const follower = follow(on);
  follower.start();
  await vi.advanceTimersByTimeAsync(FRAME * 10);
  on.move(tile(400, 120, 360, 64));
  scroller.dispatchEvent(new Event('scroll'));
  await vi.advanceTimersByTimeAsync(FRAME * 10);
  assert.deepEqual(
    on.moves.map(where),
    [[200, 560, 120, false, 672]],
    'a scroller in a shadow root',
  );
  on.move(tile(400, 80, 360, 64));
  document.dispatchEvent(new Event('scroll'));
  await vi.advanceTimersByTimeAsync(FRAME * 10);
  assert.equal(on.moves.length, 2, 'the page');
  follower.stop();
  host.remove();
});

test('a change of size of the tile or of anything around it wakes the follower, and stop lets go of it', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const observers: { wake: () => void; watched: Element[]; done: boolean }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly made: { wake: () => void; watched: Element[]; done: boolean };
      constructor(wake: () => void) {
        this.made = { wake, watched: [], done: false };
        observers.push(this.made);
      }
      observe(element: Element): void {
        this.made.watched.push(element);
      }
      disconnect(): void {
        this.made.done = true;
      }
    },
  );
  const host = document.createElement('section');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const on = followed(root);
  const follower = follow(on);
  follower.start();
  await vi.advanceTimersByTimeAsync(FRAME * 10);
  assert.equal(observers.length, 1, 'one observer');
  const [observer] = observers;
  assert.ok(observer);
  assert.deepEqual(observer.watched, [on.anchor, host, document.body, document.documentElement]);
  on.move(tile(400, 300, 360, 64));
  observer.wake();
  await vi.advanceTimersByTimeAsync(FRAME * 10);
  assert.deepEqual(on.moves.map(where), [[200, 560, 300, false, 492]]);
  follower.stop();
  assert.equal(observer.done, true);
  host.remove();
});

test('the follower lets go once the view is not unfolded, and stop cancels the next frame', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const on = followed();
  const follower = follow(on);
  follower.start();
  await vi.advanceTimersByTimeAsync(FRAME * 10);
  on.close();
  on.move(tile(120, 260, 420, 64));
  window.dispatchEvent(new Event('resize'));
  await vi.advanceTimersByTimeAsync(FRAME * 2);
  assert.deepEqual(on.moves, [], 'a closed view is not followed');
  window.dispatchEvent(new Event('resize'));
  assert.equal(vi.getTimerCount(), 0, 'and nothing wakes it any more');
  follower.start();
  follower.stop();
  assert.equal(vi.getTimerCount(), 0);
  on.anchor.remove();
});

test('the follower stops once its tile leaves the page, and moves the panel no more', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const on = followed();
  const follower = follow(on);
  follower.start();
  await vi.advanceTimersByTimeAsync(FRAME * 2);
  assert.equal(vi.getTimerCount(), 1, 'it follows while the tile settles');
  on.anchor.remove();
  on.move(tile(120, 260, 420, 64));
  await vi.advanceTimersByTimeAsync(FRAME * 2);
  assert.deepEqual(on.moves, [], 'a tile out of the page is not followed');
  assert.equal(vi.getTimerCount(), 0, 'and the loop ends');
  window.dispatchEvent(new Event('resize'));
  assert.equal(vi.getTimerCount(), 0, 'for good');
});
