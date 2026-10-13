import { reduced } from '../../ha/motion.ts';
import { scrollableAncestors } from '../../ha/scroll.ts';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Place {
  left: number;
  width: number;
  edge: number;
  up: boolean;
  maxHeight: number;
  from: Box;
}

interface Unfolded {
  place: Place;
  anchor: Element;
}

interface Following {
  start: () => void;
  stop: () => void;
}

const MARGIN = 8;
const SETTLE_FRAMES = 6;
const SETTLE_MAX = 1500;
const UNFOLD_MIN = 420;

export function placed(from: Box, dialog: number): Place {
  const width = Math.min(dialog, innerWidth - 2 * MARGIN);
  const right = from.left + from.width;
  const start = innerWidth - right < from.left ? right - width : from.left;
  const left = Math.min(Math.max(start, MARGIN), innerWidth - width - MARGIN);
  const top = Math.max(from.top, MARGIN);
  const bottom = Math.min(from.top + from.height, innerHeight - MARGIN);
  const below = innerHeight - top - MARGIN;
  const above = bottom - MARGIN;
  return below < UNFOLD_MIN && above > below
    ? { left, width, edge: innerHeight - bottom, up: true, maxHeight: above, from }
    : { left, width, edge: top, up: false, maxHeight: below, from };
}

export function folded(place: Place, radius: string): string {
  const left = Math.max(0, place.from.left - place.left);
  const right = Math.max(0, place.width - left - place.from.width);
  const tall = `calc(100% - ${place.from.height}px)`;
  return place.up
    ? `inset(${tall} ${right}px 0px ${left}px round ${radius})`
    : `inset(0px ${right}px ${tall} ${left}px round ${radius})`;
}

const atLeast0 = (value: number): number => Math.max(0, value);

export function foldTo(box: DOMRectReadOnly, to: DOMRectReadOnly, radius: string): string {
  return `inset(${atLeast0(to.top - box.top)}px ${atLeast0(box.right - to.right)}px ${atLeast0(box.bottom - to.bottom)}px ${atLeast0(to.left - box.left)}px round ${radius})`;
}

export function unfolded(view: Partial<Unfolded> | undefined): view is Unfolded {
  return view?.place !== undefined && view.anchor?.isConnected === true;
}

export function settled(element: Element): Promise<void> {
  const start = performance.now();
  return new Promise((resolve) => {
    let last = '';
    let still = 0;
    const tick = (): void => {
      const box = element.getBoundingClientRect();
      const now = `${box.left} ${box.top} ${box.width} ${box.height}`;
      still = now === last ? still + 1 : 0;
      last = now;
      if (still >= SETTLE_FRAMES || performance.now() - start > SETTLE_MAX) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

export async function reveal(from: Element): Promise<void> {
  const page = scrollableAncestors(from)[0] ?? document.scrollingElement;
  if (page === null || page === undefined) {
    return;
  }
  const top = from.getBoundingClientRect().top;
  const short = UNFOLD_MIN - (innerHeight - top - MARGIN);
  const wanted = top < MARGIN ? top - MARGIN : Math.min(Math.max(short, 0), top - MARGIN);
  const room = page.scrollHeight - page.clientHeight - page.scrollTop;
  const delta = wanted < 0 ? Math.max(wanted, -page.scrollTop) : Math.min(wanted, room);
  if (delta === 0) {
    return;
  }
  page.scrollBy({ top: delta, behavior: reduced() ? 'instant' : 'smooth' });
  await settled(from);
}

export function following(
  read: () => Partial<Unfolded> | undefined,
  dialog: () => number,
  moved: (place: Place) => void,
): Following {
  let frame: number | undefined;
  const tick = (): void => {
    frame = undefined;
    const now = read();
    if (!unfolded(now)) {
      return;
    }
    const next = placed(now.anchor.getBoundingClientRect(), dialog());
    const was = now.place;
    if (
      next.left !== was.left ||
      next.width !== was.width ||
      next.edge !== was.edge ||
      next.up !== was.up ||
      next.maxHeight !== was.maxHeight
    ) {
      moved(next);
    }
    frame = requestAnimationFrame(tick);
  };
  return {
    start: () => {
      frame ??= requestAnimationFrame(tick);
    },
    stop: () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
      }
    },
  };
}
