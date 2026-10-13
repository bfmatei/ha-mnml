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

test('the follower moves the panel each frame its tile moves, and stops once the view is not unfolded', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const anchor = document.createElement('div');
  document.body.append(anchor);
  let box = tile(400, 200, 360, 64);
  anchor.getBoundingClientRect = () => box;
  let view: { place: Place; anchor: Element } | undefined = { place: placed(box, DIALOG), anchor };
  const moves: Place[] = [];
  const follower = following(
    () => view,
    () => DIALOG,
    (place) => {
      moves.push(place);
      if (view !== undefined) {
        view = { ...view, place };
      }
    },
  );
  follower.start();
  follower.start();
  await vi.advanceTimersByTimeAsync(50);
  assert.equal(moves.length, 0, 'a tile that keeps still moves nothing');
  assert.equal(vi.getTimerCount(), 1, 'and one start is one loop');
  box = tile(120, 260, 420, 64);
  await vi.advanceTimersByTimeAsync(20);
  assert.deepEqual(moves.map(where), [[120, 560, 260, false, 532]]);
  view = undefined;
  await vi.advanceTimersByTimeAsync(20);
  assert.equal(vi.getTimerCount(), 0, 'the loop ends with the view');
  view = { place: placed(box, DIALOG), anchor };
  follower.start();
  follower.stop();
  assert.equal(vi.getTimerCount(), 0, 'and stop cancels the next frame');
  anchor.remove();
});

test('the follower stops once its tile leaves the page, and moves the panel no more', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const anchor = document.createElement('div');
  document.body.append(anchor);
  let box = tile(400, 200, 360, 64);
  anchor.getBoundingClientRect = () => box;
  const view = { place: placed(box, DIALOG), anchor };
  const moves: Place[] = [];
  const follower = following(
    () => view,
    () => DIALOG,
    (place) => {
      moves.push(place);
    },
  );
  follower.start();
  await vi.advanceTimersByTimeAsync(50);
  assert.equal(vi.getTimerCount(), 1, 'it follows while the tile is in the page');
  anchor.remove();
  box = tile(120, 260, 420, 64);
  await vi.advanceTimersByTimeAsync(50);
  assert.deepEqual(moves, [], 'a tile out of the page is not followed');
  assert.equal(vi.getTimerCount(), 0, 'and the loop ends');
});
