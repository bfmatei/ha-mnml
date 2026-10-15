import { LitElement, css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { ChildCard } from '../../ha/card-helpers.ts';
import { field } from '../../ha/field.ts';

const CUSTOM = 'custom:';
const MNML = `${CUSTOM}mnml-`;

export class MnmlCardNote extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .note {
      padding: 12px 16px;
      border: 1px dashed var(--divider-color);
      border-radius: 12px;
      color: var(--secondary-text-color);
      font-size: 14px;
    }
    .failed {
      color: var(--error-color);
    }
  `;

  @property({ attribute: false }) message = '';
  @property({ attribute: false }) failed = false;

  protected override render(): TemplateResult {
    return html`<div class=${classMap({ note: true, failed: this.failed })}>${this.message}</div>`;
  }
}

function noted(message: string, failed: boolean): ChildCard {
  const note = new MnmlCardNote();
  note.message = message;
  note.failed = failed;
  return note;
}

function drawn(tag: string, made: CustomElementConstructor, config: object): ChildCard {
  const card: ChildCard = new made();
  const set = field(card, 'setConfig');
  try {
    if (typeof set === 'function') {
      Reflect.apply(set, card, [config]);
    }
  } catch (error) {
    return noted(`${tag}: ${error instanceof Error ? error.message : String(error)}`, true);
  }
  return card;
}

export async function cardOf(config: object): Promise<ChildCard> {
  const type = field(config, 'type');
  const kind = typeof type === 'string' ? type : '';
  if (kind === '') {
    return noted('This card has no type.', true);
  }
  if (kind === 'error') {
    const error = field(config, 'error');
    return noted(typeof error === 'string' ? error : 'This card could not be drawn.', true);
  }
  const tag = kind.startsWith(MNML) ? kind.slice(CUSTOM.length) : undefined;
  const made = tag === undefined ? undefined : customElements.get(tag);
  if (tag !== undefined && made !== undefined) {
    return drawn(tag, made, config);
  }
  const helpers = await window.loadCardHelpers?.();
  if (helpers !== undefined) {
    return helpers.createCardElement(config);
  }
  return tag === undefined
    ? noted(
        `Home Assistant's ${kind} card shows here once a dashboard has been opened in this tab.`,
        false,
      )
    : noted(`${tag} is not loaded on this page.`, true);
}
