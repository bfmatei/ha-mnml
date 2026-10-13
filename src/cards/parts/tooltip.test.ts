import assert from 'node:assert/strict';

import { html, nothing, render } from 'lit';
import { afterEach, beforeEach, test, vi } from 'vitest';

import { MnmlTooltip, tip, tipOf } from './tooltip.ts';

if (customElements.get('mnml-tooltip') === undefined) {
  customElements.define('mnml-tooltip', MnmlTooltip);
}

function bubble(): MnmlTooltip | null {
  const found = document.body.querySelector('mnml-tooltip');
  return found instanceof MnmlTooltip ? found : null;
}

function paint(text: string | undefined): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  render(html`<button ${tip(text)}>Go</button>`, host);
  const button = host.querySelector('button');
  assert.ok(button);
  return button;
}

function pointer(type: string, pointerType: string): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  vi.useRealTimers();
  document.body.replaceChildren();
});

test('a tooltip keeps its text on the element, and none for an empty one', () => {
  assert.equal(tipOf(paint('Batteries')), 'Batteries');
  assert.equal(tipOf(paint(undefined)), undefined);
  assert.equal(tipOf(paint('')), undefined);
});

test('the tooltip opens after a pause over the element, and closes when the pointer leaves', async () => {
  const button = paint('Low batteries\nWindow: 14 %');
  button.dispatchEvent(new Event('pointerenter'));
  assert.equal(bubble(), null, 'not at once');
  await vi.advanceTimersByTimeAsync(450);
  const open = bubble();
  assert.ok(open?.shown);
  const root = open.shadowRoot;
  assert.equal(root?.querySelector('.first')?.textContent, 'Low batteries');
  assert.equal(root?.querySelector('.rest')?.textContent, 'Window: 14 %');
  button.dispatchEvent(new Event('pointerleave'));
  assert.equal(open.shown, false);
});

test('a touch opens no tooltip, and a press closes it', async () => {
  const button = paint('Alarm');
  button.dispatchEvent(pointer('pointerenter', 'touch'));
  await vi.advanceTimersByTimeAsync(600);
  assert.equal(bubble(), null);
  button.dispatchEvent(new Event('pointerenter'));
  await vi.advanceTimersByTimeAsync(450);
  assert.ok(bubble()?.shown);
  button.dispatchEvent(new Event('pointerdown'));
  assert.equal(bubble()?.shown, false);
});

test('Escape closes it, and a tooltip taken away is not shown', async () => {
  const button = paint('Alarm');
  button.dispatchEvent(new Event('pointerenter'));
  await vi.advanceTimersByTimeAsync(450);
  assert.ok(bubble()?.shown);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(bubble()?.shown, false);
  const host = button.parentElement;
  assert.ok(host);
  render(html`<button ${tip(undefined)}>Go</button>`, host);
  button.dispatchEvent(new Event('pointerenter'));
  await vi.advanceTimersByTimeAsync(450);
  assert.equal(bubble()?.shown, false);
});

test('a tooltip whose element a redraw takes away closes with it', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const draw = (alarm: boolean): void => {
    render(html`${alarm ? html`<button ${tip('Doors: open')}>Doors</button>` : nothing}`, host);
  };
  draw(true);
  const button = host.querySelector('button');
  assert.ok(button);
  button.dispatchEvent(new Event('pointerenter'));
  await vi.advanceTimersByTimeAsync(450);
  assert.ok(bubble()?.shown);
  draw(false);
  assert.equal(button.isConnected, false);
  assert.equal(bubble()?.shown, false);
});
