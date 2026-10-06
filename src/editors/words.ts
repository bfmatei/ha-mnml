import { LitElement, css, html } from 'lit';
import type { CSSResultGroup, PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import type { Value } from '../contract/templates.ts';
import { icon, quietly } from '../ha/templates.ts';

type Pair = readonly [string, string];

const WORDS_STYLE = css`
  .words {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 6px;
    align-items: center;
  }
  input {
    font: inherit;
    font-size: 13px;
    color: var(--primary-text-color);
    background: var(--m-pill);
    border: 0;
    border-radius: 10px;
    padding: 8px 10px;
    min-width: 0;
  }
  input[aria-invalid='true'] {
    box-shadow: inset 0 0 0 1px var(--error-color);
  }
  .adder {
    color: var(--primary-color);
    gap: 8px;
    padding: 0 12px;
    font-weight: 500;
    justify-self: start;
  }
`;

const pairsOf = (words: Readonly<Record<string, Value>>): Pair[] =>
  Object.entries(words).map(([state, word]) => [state, typeof word === 'string' ? word : '']);

const same = (a: readonly Pair[], b: readonly Pair[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const clashes = (pairs: readonly Pair[], position: number): boolean =>
  pairs.some(([other], at) => at !== position && other === pairs[position]?.[0]);

const named = (state: string): string => (state === '' ? 'a state' : state);

export class MnmlWords extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, CONTROL_STYLE, WORDS_STYLE];

  @property({ attribute: false }) words: Readonly<Record<string, Value>> = {};
  @property({ attribute: false }) changed: (next: Record<string, string>, redraw: boolean) => void =
    () => undefined;
  @state() private shown: readonly Pair[] | undefined;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('words') &&
      this.shown !== undefined &&
      !same(pairsOf(this.words), this.shown)
    ) {
      this.shown = undefined;
    }
  }

  protected override render(): TemplateResult {
    const pairs = this.shown ?? pairsOf(this.words);
    const add = 'Add a word';
    return html`<div class="words">
      ${pairs.map(
        ([state, word], index) => html`<input
            class="word"
            aria-label="State"
            aria-invalid=${String(clashes(pairs, index))}
            .value=${live(state)}
            @input=${(event: Event) => {
              this.edited(index, 0, event);
            }}
          /><input
            class="word"
            aria-label=${`Word for ${named(state)}`}
            .value=${live(word)}
            @input=${(event: Event) => {
              this.edited(index, 1, event);
            }}
          /><button
            type="button"
            class="control"
            aria-label=${`Remove the word for ${named(state)}`}
            title=${`Remove the word for ${named(state)}`}
            @click=${quietly(() => {
              this.write(
                pairsOf(this.words).filter((_, position) => position !== index),
                true,
              );
            })}
          >
            ${icon('mdi:close')}
          </button>`,
      )}
      <button
        type="button"
        class="control adder"
        aria-label=${add}
        title=${add}
        ?disabled=${pairs.some(([state]) => state === '')}
        @click=${quietly(() => {
          this.write([...pairsOf(this.words), ['', '']], true);
        })}
      >
        ${icon('mdi:plus')}<span>${add}</span>
      </button>
    </div>`;
  }

  private edited(index: number, side: 0 | 1, event: Event): void {
    const box = event.currentTarget;
    const typed = box instanceof HTMLInputElement ? box.value : '';
    const visible = (this.shown ?? pairsOf(this.words)).map(([state, word], position): Pair => {
      if (position !== index) {
        return [state, word];
      }
      return side === 0 ? [typed, word] : [state, typed];
    });
    if (visible.some((_, position) => clashes(visible, position))) {
      this.shown = visible;
      return;
    }
    this.write(visible, false);
  }

  private write(next: readonly Pair[], redraw: boolean): void {
    this.shown = next;
    this.changed(Object.fromEntries(next), redraw);
  }
}
