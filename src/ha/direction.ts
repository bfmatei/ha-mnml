export function rightToLeft(element: Element): boolean {
  let node: Element | undefined = element;
  while (node !== undefined) {
    const marked = node.closest('[dir]');
    if (marked !== null) {
      return marked.getAttribute('dir')?.toLowerCase() === 'rtl';
    }
    const root = node.getRootNode();
    node = root instanceof ShadowRoot ? root.host : undefined;
  }
  return false;
}
