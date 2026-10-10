export function scrollable(node: unknown): node is HTMLElement {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  const overflow = getComputedStyle(node).overflowY;
  return (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight;
}

export function scrollableAncestors(from: Node): HTMLElement[] {
  const found: HTMLElement[] = [];
  let node: Node | null = from;
  while (node !== null) {
    const parent: Node | null = node instanceof ShadowRoot ? node.host : (node.parentNode ?? null);
    if (scrollable(parent)) {
      found.push(parent);
    }
    node = parent;
  }
  return found;
}
