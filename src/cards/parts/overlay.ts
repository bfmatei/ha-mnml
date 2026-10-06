import type { Host } from '../base.ts';

interface DismissOptions {
  scroll?: true;
  keys?(event: KeyboardEvent): void;
  closed(refocus: boolean): void;
}

export function dismissable(
  node: HTMLElement,
  host: Host,
  options: DismissOptions,
): (refocus?: boolean) => void {
  const release = host.hold();
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
    if (!event.composedPath().includes(node)) {
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
