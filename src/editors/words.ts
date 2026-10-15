import { LitElement, css, html } from 'lit';
import type { CSSResultGroup, PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import { sameValue } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { icon, quietly } from '../ha/templates.ts';
import { EDITORS_EN } from '../words/panel/editors-en.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';

import { IN_PLACE, REDRAW } from './drawing.ts';
import type { Drawing } from './drawing.ts';

type Pair = readonly [string, string];

const WORDS_STYLE = css`
  .words {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 6px;
    align-items: center;
  }
  input,
  select {
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

const clashes = (pairs: readonly Pair[], position: number): boolean =>
  pairs.some(([other], at) => at !== position && other === pairs[position]?.[0]);

const stated = (pairs: readonly Pair[]): Pair[] => pairs.filter(([state]) => state !== '');

export class MnmlWords extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, CONTROL_STYLE, WORDS_STYLE];

  @property({ attribute: false }) words: Readonly<Record<string, Value>> = {};
  @property({ attribute: false }) options: readonly string[] | undefined;
  @property({ attribute: false }) labels: EditorWords['words'] = EDITORS_EN.words;
  @property({ attribute: false }) changed: (
    next: Record<string, string>,
    drawing: Drawing,
  ) => void = () => undefined;
  @state() private shown: readonly Pair[] | undefined;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('words') &&
      this.shown !== undefined &&
      !sameValue(pairsOf(this.words), stated(this.shown))
    ) {
      this.shown = undefined;
    }
  }

  protected override render(): TemplateResult {
    const pairs = this.visible();
    const colours = this.options !== undefined;
    const labels = this.labels;
    const named = (state: string): string =>
      state === '' ? (colours ? labels.aWord : labels.aState) : state;
    const add = colours ? labels.addColour : labels.addWord;
    return html`<div class="words">
      ${pairs.map((pair, index) => {
        const [state] = pair;
        const remove = (colours ? labels.removeColour : labels.removeWord)(named(state));
        return html`<input
            class="word"
            aria-label=${colours ? labels.word : labels.state}
            aria-invalid=${String(clashes(pairs, index))}
            .value=${live(state)}
            @input=${(event: Event) => {
              this.edited(index, 0, event);
            }}
          />${this.second(pair, index, named(state))}<button
            type="button"
            class="control"
            aria-label=${remove}
            title=${remove}
            @click=${quietly(() => {
              this.settle(
                this.visible().filter((_, position) => position !== index),
                REDRAW,
              );
            })}
          >
            ${icon('mdi:close')}
          </button>`;
      })}
      <button
        type="button"
        class="control adder"
        aria-label=${add}
        title=${add}
        ?disabled=${pairs.some(([state]) => state === '')}
        @click=${quietly(() => {
          this.shown = [...this.visible(), ['', this.options?.[0] ?? '']];
        })}
      >
        ${icon('mdi:plus')}<span>${add}</span>
      </button>
    </div>`;
  }

  private second([, word]: Pair, index: number, state: string): TemplateResult {
    const changed = (event: Event): void => {
      this.edited(index, 1, event);
    };
    if (this.options === undefined) {
      return html`<input
        class="word"
        aria-label=${this.labels.wordFor(state)}
        .value=${live(word)}
        @input=${changed}
      />`;
    }
    return html`<select aria-label=${this.labels.colourFor(state)} @change=${changed}>
      ${this.options.map(
        (option) => html`<option value=${option} ?selected=${option === word}>${option}</option>`,
      )}
    </select>`;
  }

  private visible(): readonly Pair[] {
    return this.shown ?? pairsOf(this.words);
  }

  private edited(index: number, side: 0 | 1, event: Event): void {
    const box = event.currentTarget;
    const typed =
      box instanceof HTMLInputElement || box instanceof HTMLSelectElement ? box.value : '';
    const next = this.visible().map(([state, word], position): Pair => {
      if (position !== index) {
        return [state, word];
      }
      return side === 0 ? [typed, word] : [state, typed];
    });
    this.settle(next, IN_PLACE);
  }

  private settle(next: readonly Pair[], drawing: Drawing): void {
    this.shown = next;
    if (next.some((_, position) => clashes(next, position))) {
      return;
    }
    const written = stated(next);
    if (!sameValue(written, pairsOf(this.words))) {
      this.changed(Object.fromEntries(written), drawing);
    }
  }
}
