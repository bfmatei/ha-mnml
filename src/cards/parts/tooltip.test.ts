import assert from 'node:assert/strict';

import { html, nothing, render } from 'lit';
import { afterEach, beforeEach, test, vi } from 'vitest';

import { MnmlTooltip, createTips } from './tooltip.ts';

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
  render(html`<button ${tips.tip(text)}>Go</button>`, host);
  const button = host.querySelector('button');
  assert.ok(button);
  return button;
}

function pointer(type: string, pointerType: string): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

let tips = createTips();

beforeEach(() => {
  tips = createTips();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

test('a tooltip keeps its text on the element, and none for an empty one', () => {
  assert.equal(tips.tipOf(paint('Batteries')), 'Batteries');
  assert.equal(tips.tipOf(paint(undefined)), undefined);
  assert.equal(tips.tipOf(paint('')), undefined);
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
  render(html`<button ${tips.tip(undefined)}>Go</button>`, host);
  button.dispatchEvent(new Event('pointerenter'));
  await vi.advanceTimersByTimeAsync(450);
  assert.equal(bubble()?.shown, false);
});

test('a tooltip whose element a redraw takes away closes with it', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const draw = (alarm: boolean): void => {
    render(
      html`${alarm ? html`<button ${tips.tip('Doors: open')}>Doors</button>` : nothing}`,
      host,
    );
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

interface Pressable {
  button: HTMLElement;
  acted: () => number;
}

function pressable(text: string): Pressable {
  const host = document.createElement('div');
  document.body.append(host);
  let acted = 0;
  const act = (): void => {
    acted += 1;
  };
  render(
    html`<div class="tile" @click=${act}><button ${tips.tip(text)} @click=${act}>Go</button></div>`,
    host,
  );
  const button = host.querySelector('button');
  assert.ok(button);
  button.getBoundingClientRect = () => new DOMRect(0, 0, 40, 40);
  return { button, acted: () => acted };
}

function touch(type: string, x = 20, y = 20): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  return event;
}

test('a touch held 500 ms opens the tooltip, the press does not act, and the next touch elsewhere closes it', async () => {
  const { button, acted } = pressable('Low batteries\nWindow: 14 %');
  button.dispatchEvent(touch('pointerdown'));
  await vi.advanceTimersByTimeAsync(499);
  assert.equal(bubble()?.shown ?? false, false, 'not before 500 ms');
  await vi.advanceTimersByTimeAsync(1);
  assert.ok(bubble()?.shown, 'open once held');
  assert.equal(bubble()?.shadowRoot?.querySelector('.first')?.textContent, 'Low batteries');
  const menu = touch('contextmenu');
  button.dispatchEvent(menu);
  assert.ok(menu.defaultPrevented, "the browser's own long-press menu does not open over it");
  button.dispatchEvent(touch('pointerup'));
  button.dispatchEvent(touch('pointerleave'));
  button.click();
  assert.equal(acted(), 0, 'neither the button nor the tile around it acts');
  assert.ok(bubble()?.shown, 'lifting the finger leaves it open');
  button.click();
  assert.equal(acted(), 2, 'a key press after it acts');
  document.body.dispatchEvent(touch('pointerdown', 300, 300));
  assert.equal(bubble()?.shown, false, 'the next touch elsewhere closes it');
  button.dispatchEvent(touch('pointerdown'));
  button.dispatchEvent(touch('pointerup'));
  button.click();
  assert.equal(acted(), 4, 'and a tap after it acts again');
});

test('a short touch acts as before and opens no tooltip', async () => {
  const { button, acted } = pressable('Alarm');
  button.dispatchEvent(touch('pointerdown'));
  await vi.advanceTimersByTimeAsync(200);
  button.dispatchEvent(touch('pointerup'));
  button.click();
  await vi.advanceTimersByTimeAsync(600);
  assert.equal(bubble(), null);
  assert.equal(acted(), 2, 'the button and the tile it is in');
});

test('a touch that moves off the element, or that the browser takes for a scroll, opens nothing', async () => {
  const { button } = pressable('Alarm');
  button.dispatchEvent(touch('pointerdown'));
  button.dispatchEvent(touch('pointermove', 30, 30));
  await vi.advanceTimersByTimeAsync(100);
  button.dispatchEvent(touch('pointermove', 120, 20));
  await vi.advanceTimersByTimeAsync(600);
  assert.equal(bubble(), null, 'moved off');
  button.dispatchEvent(touch('pointerdown'));
  button.dispatchEvent(touch('pointercancel'));
  await vi.advanceTimersByTimeAsync(600);
  assert.equal(bubble(), null, 'scrolled');
});
