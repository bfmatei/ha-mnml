import { reduced } from '../../ha/motion.ts';
import { scrollable } from '../../ha/scroll.ts';

interface Drag {
  id: number;
  y0: number;
  t0: number;
  dy: number;
  active: boolean;
}

interface Swipe {
  start: (event: PointerEvent) => void;
  move: (event: PointerEvent) => void;
  end: (event: PointerEvent) => void;
  cancel: (event: PointerEvent) => void;
  reset: () => void;
}

const SWIPE_ZONE = 88;
const SWIPE_START = 10;
const SWIPE_CLOSE = 80;
const SWIPE_FLICK = 0.6;
const SWIPE_OUT = 200;

export function swipeToClose(
  panelOf: () => HTMLElement | null | undefined,
  leaving: () => boolean,
  dismiss: (gone: Promise<unknown>) => void,
): Swipe {
  let swipe: Drag | undefined;
  return {
    start: (event) => {
      const panel = panelOf();
      if (
        panel === null ||
        panel === undefined ||
        leaving() ||
        event.pointerType === 'mouse' ||
        !event.isPrimary ||
        event.clientY - panel.getBoundingClientRect().top > SWIPE_ZONE ||
        event.composedPath().some((node) => scrollable(node) && node.scrollTop > 0)
      ) {
        return;
      }
      swipe = {
        id: event.pointerId,
        y0: event.clientY,
        t0: event.timeStamp,
        dy: 0,
        active: false,
      };
    },
    move: (event) => {
      const drag = swipe;
      const panel = panelOf();
      if (
        drag === undefined ||
        drag.id !== event.pointerId ||
        panel === null ||
        panel === undefined
      ) {
        return;
      }
      const dy = event.clientY - drag.y0;
      if (!drag.active) {
        if (dy < -SWIPE_START) {
          swipe = undefined;
        } else if (dy > SWIPE_START) {
          drag.active = true;
          panel.setPointerCapture(event.pointerId);
        }
      }
      if (drag.active) {
        drag.dy = Math.max(0, dy);
        panel.style.transform = `translateY(${drag.dy}px)`;
      }
    },
    end: (event) => {
      const drag = swipe;
      const panel = panelOf();
      swipe = undefined;
      if (
        drag === undefined ||
        !drag.active ||
        drag.id !== event.pointerId ||
        panel === null ||
        panel === undefined
      ) {
        return;
      }
      const speed = drag.dy / Math.max(1, event.timeStamp - drag.t0);
      if (drag.dy > SWIPE_CLOSE || (speed > SWIPE_FLICK && drag.dy > SWIPE_START * 2)) {
        dismiss(
          reduced()
            ? Promise.resolve()
            : panel.animate(
                [
                  { transform: `translateY(${drag.dy}px)` },
                  { transform: `translateY(${innerHeight}px)` },
                ],
                { duration: SWIPE_OUT, easing: 'ease-in', fill: 'forwards' },
              ).finished,
        );
        return;
      }
      panel.style.removeProperty('transform');
      if (!reduced()) {
        panel.animate([{ transform: `translateY(${drag.dy}px)` }, { transform: 'none' }], {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
        });
      }
    },
    cancel: (event) => {
      const panel = panelOf();
      if (swipe?.id === event.pointerId && swipe.active && panel !== null && panel !== undefined) {
        panel.style.removeProperty('transform');
      }
      swipe = undefined;
    },
    reset: () => {
      swipe = undefined;
    },
  };
}
