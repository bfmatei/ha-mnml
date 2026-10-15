import assert from 'node:assert/strict';

import { ReactiveElement, adoptStyles, render } from 'lit';
import type { CSSResult, LitElement, TemplateResult } from 'lit';
import { afterEach } from 'vitest';

import type { HomeAssistant } from '../ha/hass.ts';

import { fakeHass } from './hass.ts';
import { until } from './until.ts';

if (!Reflect.has(Element.prototype, 'scrollIntoView')) {
  Element.prototype.scrollIntoView = (): void => undefined;
}

HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
  if (!this.isConnected) {
    throw new DOMException("Failed to execute 'showModal': the element is not in a Document");
  }
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
  this.open = false;
};

export function define(tag: string, made: CustomElementConstructor): void {
  if (customElements.get(tag) === undefined) {
    customElements.define(tag, made);
  }
}

export function created<T extends HTMLElement>(tag: string, made: new () => T): T {
  const element = document.createElement(tag);
  assert.ok(element instanceof made, `${tag} is a ${made.name}`);
  return element;
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

interface Configurable {
  setConfig(config: unknown): void;
}

interface Card extends LitElement, Configurable {
  hass: HomeAssistant | undefined;
}

export function configure(card: Configurable, config: unknown): void {
  card.setConfig(config);
}

export async function paint(
  card: Card,
  config: unknown,
  hass: HomeAssistant = fakeHass(),
): Promise<ShadowRoot> {
  configure(card, config);
  card.hass = hass;
  return mounted(card);
}

export function everything(root: ParentNode): Element[] {
  const all: Element[] = [];
  for (const element of root.querySelectorAll('*')) {
    all.push(element);
    if (element.shadowRoot !== null) {
      all.push(...everything(element.shadowRoot));
    }
  }
  return all;
}

export async function updated(root: ParentNode, quiet = (): boolean => true): Promise<void> {
  await until(async () => {
    const all = root instanceof ShadowRoot ? [root.host, ...everything(root)] : everything(root);
    const waiting = all.filter(
      (element): element is ReactiveElement =>
        element instanceof ReactiveElement && element.isUpdatePending,
    );
    await Promise.all(waiting.map((element) => element.updateComplete));
    return waiting.length === 0 && quiet();
  }, 'every element drawn');
}

export function press(root: ParentNode | null | undefined, label: string): void {
  const button = [...(root?.querySelectorAll('button') ?? [])].find(
    (each) => each.getAttribute('aria-label') === label || text(each) === label,
  );
  assert.ok(button, `there is a button ${label}`);
  button.click();
}

export function countCalls(target: object, method: string): { readonly count: number } {
  const original: unknown = Reflect.get(target, method);
  assert.ok(typeof original === 'function', `${method} is a method`);
  const counter = { count: 0 };
  Reflect.set(target, method, (...args: unknown[]): unknown => {
    counter.count += 1;
    return Reflect.apply(original, target, args);
  });
  return counter;
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
