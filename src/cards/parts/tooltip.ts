import { LitElement, css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { state } from 'lit/decorators.js';
import { PartType, directive } from 'lit/directive.js';
import type { DirectiveResult, ElementPart, PartInfo } from 'lit/directive.js';

const DELAY = 400;
const HOLD = 500;
const GAP = 8;
const EDGE = 8;

export class MnmlTooltip extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      inset: auto;
      margin: 0;
      border: 0;
      padding: 7px 10px;
      width: max-content;
      max-width: min(280px, calc(100vw - 16px));
      box-sizing: border-box;
      overflow: visible;
      background: var(--mnml-overlay-background-color, var(--card-background-color, #fff));
      -webkit-backdrop-filter: var(--mnml-card-backdrop-filter, none);
      backdrop-filter: var(--mnml-card-backdrop-filter, none);
      color: var(--primary-text-color, #000);
      border-radius: 10px;
      box-shadow:
        0 0 0 1px var(--mnml-card-edge-color, rgb(127 127 127 / 0.22)),
        0 8px 24px rgb(0 0 0 / 0.25);
      font:
        500 12px/1.35 system-ui,
        sans-serif;
      pointer-events: none;
      animation: tip-in 120ms ease-out;
    }
    .first {
      display: block;
      font-weight: 600;
    }
    .rest {
      display: block;
      color: var(--secondary-text-color, inherit);
      white-space: pre-line;
      font-variant-numeric: tabular-nums;
    }
    @keyframes tip-in {
      from {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
    @media (forced-colors: active) {
      :host {
        border: 1px solid CanvasText;
      }
    }
  `;

  @state() private text = '';

  shown = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.popover = 'manual';
    this.setAttribute('role', 'tooltip');
  }

  async open(text: string, anchor: DOMRect): Promise<void> {
    this.text = text;
    if (typeof this.showPopover === 'function' && !this.shown) {
      this.showPopover();
    }
    this.shown = true;
    await this.updateComplete;
    const box = this.getBoundingClientRect();
    const above = anchor.top - box.height - GAP;
    const top = above >= EDGE ? above : anchor.bottom + GAP;
    const centred = anchor.left + anchor.width / 2 - box.width / 2;
    const left = Math.min(Math.max(centred, EDGE), window.innerWidth - box.width - EDGE);
    this.style.top = `${Math.round(top)}px`;
    this.style.left = `${Math.round(Math.max(left, EDGE))}px`;
  }

  close(): void {
    if (typeof this.hidePopover === 'function' && this.shown) {
      this.hidePopover();
    }
    this.shown = false;
  }

  protected override render(): TemplateResult {
    const at = this.text.indexOf('\n');
    return at === -1
      ? html`<span class="first">${this.text}</span>`
      : html`<span class="first">${this.text.slice(0, at)}</span
          ><span class="rest">${this.text.slice(at + 1)}</span>`;
  }
}

function isTouch(event: Event): boolean {
  return Reflect.get(event, 'pointerType') === 'touch';
}

function movedOff(element: Element, event: Event): boolean {
  if (!(event instanceof MouseEvent)) {
    return false;
  }
  const box = element.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

function focusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}

interface Tips {
  tip: (text: string | undefined) => DirectiveResult;
  tipOf: (element: Element | null | undefined) => string | undefined;
}

export function createTips(): Tips {
  const texts = new WeakMap<Element, string>();
  const wired = new WeakSet<Element>();
  let current: Element | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let bubble: MnmlTooltip | undefined;
  let listening = false;
  let holding: { element: Element; timer: ReturnType<typeof setTimeout> } | undefined;
  let swallow: Element | undefined;
  let touched = false;
  const hide = (): void => {
    clearTimeout(timer);
    timer = undefined;
    current = undefined;
    bubble?.close();
  };
  const show = (element: Element): void => {
    const text = texts.get(element);
    if (text === undefined || !element.isConnected) {
      return;
    }
    if (bubble === undefined || !bubble.isConnected) {
      const made = document.createElement('mnml-tooltip');
      if (!(made instanceof MnmlTooltip)) {
        return;
      }
      bubble = made;
      document.body.append(bubble);
    }
    current = element;
    void bubble.open(text, element.getBoundingClientRect());
  };
  const letGo = (element: Element): void => {
    if (holding?.element === element) {
      clearTimeout(holding.timer);
      holding = undefined;
    }
  };
  const hold = (element: Element): void => {
    clearTimeout(holding?.timer);
    holding = {
      element,
      timer: setTimeout(() => {
        holding = undefined;
        if (texts.has(element) && element.isConnected) {
          swallow = element;
          touched = true;
          show(element);
        }
      }, HOLD),
    };
  };
  const later = (element: Element, delay: number): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      show(element);
    }, delay);
  };
  const listen = (): void => {
    if (listening) {
      return;
    }
    listening = true;
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener(
      'pointerdown',
      () => {
        swallow = undefined;
        if (touched) {
          touched = false;
          hide();
        }
      },
      { capture: true },
    );
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hide();
      }
    });
    window.addEventListener('pagehide', hide);
  };
  const wire = (element: Element): void => {
    if (wired.has(element)) {
      return;
    }
    wired.add(element);
    listen();
    element.addEventListener('pointerenter', (event) => {
      if (isTouch(event)) {
        return;
      }
      later(element, bubble?.shown === true ? 0 : DELAY);
    });
    element.addEventListener('pointerleave', (event) => {
      if (!isTouch(event)) {
        hide();
      }
    });
    element.addEventListener('pointerdown', (event) => {
      hide();
      if (isTouch(event)) {
        hold(element);
      }
    });
    element.addEventListener('pointermove', (event) => {
      if (movedOff(element, event)) {
        letGo(element);
      }
    });
    element.addEventListener('pointerup', () => {
      letGo(element);
    });
    element.addEventListener('pointercancel', () => {
      letGo(element);
    });
    element.addEventListener('contextmenu', (event) => {
      if (holding?.element === element || swallow === element) {
        event.preventDefault();
      }
    });
    element.addEventListener(
      'click',
      (event) => {
        if (swallow === element) {
          swallow = undefined;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true },
    );
    element.addEventListener('focusin', () => {
      if (focusVisible(element)) {
        later(element, 0);
      }
    });
    element.addEventListener('focusout', hide);
  };
  class Tip extends AsyncDirective {
    private element: Element | undefined;

    constructor(info: PartInfo) {
      super(info);
      if (info.type !== PartType.ELEMENT) {
        throw new Error('tip belongs on an element');
      }
    }

    render(_text: string | undefined): typeof nothing {
      return nothing;
    }

    override update(part: ElementPart, [text]: [string | undefined]): typeof nothing {
      const element = part.element;
      this.element = element;
      if (text === undefined || text === '') {
        texts.delete(element);
        if (current === element) {
          hide();
        }
      } else {
        texts.set(element, text);
        wire(element);
        if (current === element) {
          show(element);
        }
      }
      return nothing;
    }

    protected override disconnected(): void {
      if (this.element !== undefined && current === this.element) {
        hide();
      }
    }
  }
  return {
    tip: directive(Tip),
    tipOf: (element) =>
      element === null || element === undefined ? undefined : texts.get(element),
  };
}

export const { tip, tipOf } = createTips();
