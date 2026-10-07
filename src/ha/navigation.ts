import type { PopupHash } from '../contract/entities.ts';

interface PopupState {
  depth: number;
}

function rootState(): { root: true } | null {
  const state: unknown = history.state;
  return typeof state === 'object' && state !== null && 'root' in state && state.root === true
    ? { root: true }
    : null;
}

function depth(): number {
  const state: unknown = history.state;
  return location.hash !== '' &&
    typeof state === 'object' &&
    state !== null &&
    'depth' in state &&
    typeof state.depth === 'number'
    ? state.depth
    : 0;
}

function locationChanged(replace: boolean): void {
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace } }));
}

export const PREBUILD_EVENT = 'mnml-prebuild';

export function prebuild(hash: PopupHash): void {
  window.dispatchEvent(new CustomEvent(PREBUILD_EVENT, { detail: { hash } }));
}

const origins = new Map<string, WeakRef<Element>>();

export function openedFrom(event: Event): Element | undefined {
  const target = event.currentTarget;
  if (!(target instanceof Element)) {
    return undefined;
  }
  const root = target.getRootNode();
  return root instanceof ShadowRoot ? root.host : target;
}

const waiting = new Map<string, ((element: Element) => void)[]>();

export function originOf(hash: string): Element | undefined {
  const element = origins.get(hash)?.deref();
  return element?.isConnected === true ? element : undefined;
}

export function offerOrigin(hash: string, element: Element): void {
  origins.set(hash, new WeakRef(element));
  const waiters = waiting.get(hash) ?? [];
  waiting.delete(hash);
  for (const resolve of waiters) {
    resolve(element);
  }
}

export function whenOrigin(hash: string, ms: number): Promise<Element | undefined> {
  const found = originOf(hash);
  if (found !== undefined) {
    return Promise.resolve(found);
  }
  return new Promise((resolve) => {
    const done = (element?: Element): void => {
      clearTimeout(timer);
      waiting.set(
        hash,
        (waiting.get(hash) ?? []).filter((each) => each !== done),
      );
      resolve(element);
    };
    const timer = setTimeout(done, ms);
    waiting.set(hash, [...(waiting.get(hash) ?? []), done]);
  });
}

export function navigate(hash: PopupHash, from?: Element): void {
  if (from !== undefined) {
    origins.set(hash, new WeakRef(from));
  }
  const state: PopupState = { depth: depth() + 1 };
  history.pushState(state, '', hash);
  locationChanged(false);
}

export function closePopup(): void {
  const opened = depth();
  if (opened > 0) {
    history.go(-opened);
    return;
  }
  history.replaceState(rootState(), '', location.href.split('#')[0]);
  locationChanged(true);
}

export function back(): void {
  if (depth() > 1) {
    history.back();
    return;
  }
  closePopup();
}
