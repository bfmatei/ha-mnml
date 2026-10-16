import { html, render } from 'lit';
import type { TemplateResult } from 'lit';

import { icon } from '../../ha/templates.ts';
import type { Host } from '../base.ts';

import { tip } from './tooltip.ts';

const OVERLAY_TIMEOUT = 3000;

interface DismissOptions {
  scroll?: true;
  live?: true;
  trigger?: HTMLElement;
  keys?(event: KeyboardEvent): void;
  closed(refocus: boolean): void;
}

export function dismissable(
  node: HTMLElement,
  host: Host,
  options: DismissOptions,
): (refocus?: boolean) => void {
  const release = options.live ? () => {} : host.hold();
  let open = true;
  const close = (refocus = false): void => {
    if (!open) {
      return;
    }
    open = false;
    unregister();
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', outside, true);
    node.remove();
    options.closed(refocus);
    release();
  };
  const unregister = host.register(() => {
    close();
  });
  const outside = (event: Event): void => {
    const path = event.composedPath();
    if (
      !path.includes(node) &&
      (options.trigger === undefined || !path.includes(options.trigger))
    ) {
      close();
    }
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    options.keys?.(event);
  };
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', onKey, true);
  if (options.scroll) {
    window.addEventListener('scroll', outside, true);
  }
  return close;
}

export interface Overlay {
  overlay: HTMLElement;
  close: (refocus?: boolean) => void;
  schedule: () => void;
}

export function openOverlay(
  surface: HTMLElement,
  host: Host,
  className: string,
  content: (controls: Pick<Overlay, 'close' | 'schedule'>) => TemplateResult,
  { closed }: { closed?: () => void } = {},
): Overlay {
  const root = surface.getRootNode();
  const focusedIn = (): Element | null => (root instanceof ShadowRoot ? root.activeElement : null);
  const opener = focusedIn();
  const overlay = document.createElement('div');
  overlay.className = className;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const close = dismissable(overlay, host, {
    closed: (refocus) => {
      clearTimeout(timer);
      closed?.();
      if (refocus && opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    },
  });
  const holdsFocus = (): boolean => {
    const active = focusedIn();
    return active !== null && overlay.contains(active);
  };
  const schedule = (): void => {
    clearTimeout(timer);
    if (overlay.isConnected && !holdsFocus()) {
      timer = setTimeout(close, OVERLAY_TIMEOUT);
    }
  };
  render(content({ close, schedule }), overlay);
  overlay.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  overlay.addEventListener('focusin', schedule);
  overlay.addEventListener('focusout', () => setTimeout(schedule, 0));
  surface.append(overlay);
  schedule();
  return { overlay, close, schedule };
}

export function closeButton(label: string, close: (refocus?: boolean) => void): TemplateResult {
  return html`<button
    type="button"
    class="control"
    aria-label=${label}
    ${tip(label)}
    @click=${() => {
      close(true);
    }}
  >
    ${icon('mdi:close')}
  </button>`;
}
