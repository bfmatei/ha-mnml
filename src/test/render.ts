import { adoptStyles, render } from 'lit';
import type { CSSResult, LitElement, TemplateResult } from 'lit';
import { afterEach } from 'vitest';

if (!Reflect.has(Element.prototype, 'scrollIntoView')) {
  Element.prototype.scrollIntoView = (): void => undefined;
}

export function define(tag: string, made: CustomElementConstructor): void {
  if (customElements.get(tag) === undefined) {
    customElements.define(tag, made);
  }
}

export async function mounted(element: LitElement): Promise<ShadowRoot> {
  if (!element.isConnected) {
    document.body.append(element);
  }
  await element.updateComplete;
  const root = element.shadowRoot;
  if (root === null) {
    throw new Error(`${element.localName} has no shadow root`);
  }
  return root;
}

export function text(node: Node | null | undefined): string {
  const parts: string[] = [];
  const walk = (from: Node): void => {
    if (from.nodeType === Node.TEXT_NODE) {
      parts.push(from.textContent ?? '');
      return;
    }
    if (from instanceof Element && from.localName === 'style') {
      return;
    }
    for (const child of from.childNodes) {
      walk(child);
    }
  };
  if (node !== null && node !== undefined) {
    walk(node);
  }
  return parts.join('').replaceAll(/\s+/g, ' ').trim();
}

const hosts = new Set<HTMLElement>();

afterEach(() => {
  for (const host of hosts) {
    host.remove();
  }
  hosts.clear();
});

export function styled(styles: CSSResult[], template: TemplateResult): ShadowRoot {
  const host = document.createElement('div');
  hosts.add(host);
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  adoptStyles(root, styles);
  render(template, root);
  return root;
}

export function drawn(template: TemplateResult | undefined): HTMLElement {
  const box = document.createElement('div');
  if (template !== undefined) {
    render(template, box);
  }
  return box;
}
