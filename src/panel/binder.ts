import { css, html, LitElement, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import type { Kind, SlotSpec } from '../contract/templates.ts';
import type { Field } from '../editors/form.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import { panelWordsFor } from '../words/panel/words.ts';

import { pick } from './form.ts';
import { slotChoices, slotKinds } from './inspector.ts';
import { PANEL_STYLE } from './style.ts';

type FieldKind = Field['kind'];

const FITS: Partial<Record<FieldKind, readonly Kind[]>> = {
  text: ['text', 'number', 'icon', 'entity'],
  words: ['text', 'number'],
  summary: ['text', 'number'],
  choice: ['text'],
  popup: ['text'],
  service: ['text'],
  color: ['text'],
  texts: ['texts', 'text'],
  number: ['number'],
  share: ['number'],
  flag: ['flag'],
  icon: ['icon', 'text'],
  entity: ['entity'],
  entities: ['entities', 'entity'],
};

export function fittingSlots(
  slots: Readonly<Record<string, SlotSpec>> | undefined,
  field: FieldKind,
): string[] {
  const fits = FITS[field];
  return slotKinds(slots)
    .filter((slot) => fits === undefined || fits.includes(slot.kind))
    .map((slot) => slot.path);
}

interface Free {
  value: string;
  label: string;
  kind: FieldKind;
}

const BINDER_STYLE = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .action {
    align-self: flex-start;
  }
`;

export class MnmlBinder extends LitElement {
  static override styles = [PANEL_STYLE, BINDER_STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) fields: readonly Free[] = [];
  @property({ attribute: false }) slots: Readonly<Record<string, SlotSpec>> | undefined;
  @property({ attribute: false }) bind: (field: string, slot: string) => void = () => {};
  @state() private chosenField = '';
  @state() private chosenSlot = '';

  protected override render(): TemplateResult | typeof nothing {
    const field = this.fields.find((each) => each.value === this.chosenField) ?? this.fields[0];
    const slots = field === undefined ? [] : fittingSlots(this.slots, field.kind);
    const slot = slots.includes(this.chosenSlot) ? this.chosenSlot : (slots[0] ?? '');
    if (field === undefined) {
      return nothing;
    }
    const said = panelWordsFor(this.hass?.locale.language);
    return html`${pick({
        label: said.binder.setting,
        options: this.fields.map(({ value, label }) => ({ value, label })),
        value: field.value,
        changed: (value) => {
          this.chosenField = value;
        },
      })}
      ${pick({
        label: said.binder.linkTo,
        options: slotChoices(this.slots, slots, said.slots.basics),
        value: slot,
        ...(slots.length === 0 ? { help: said.binder.noFit } : {}),
        changed: (value) => {
          this.chosenSlot = value;
        },
      })}
      <button
        type="button"
        class="action"
        aria-label=${said.binder.linkIt}
        title=${said.binder.linkIt}
        ?disabled=${slot === ''}
        @click=${() => {
          if (slot !== '') {
            this.bind(field.value, slot);
          }
        }}
      >
        ${icon('mdi:link-variant')}<span>${said.binder.link}</span>
      </button>`;
  }
}
