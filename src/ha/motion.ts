export function reduced(): boolean {
  return typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function narrow(query: string): boolean {
  return typeof matchMedia === 'function' && matchMedia(query).matches;
}

export function leave(node: HTMLElement, keyframes: Keyframe[], duration: number): Promise<void> {
  return node
    .animate(keyframes, { duration, easing: 'ease-in', fill: 'forwards' })
    .finished.then(() => undefined);
}
