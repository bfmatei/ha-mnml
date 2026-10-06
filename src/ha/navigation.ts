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

export function navigate(hash: PopupHash): void {
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
