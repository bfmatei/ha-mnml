import { LitElement, nothing } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import { announced, onAnnounce } from '../cards/parts/popup-registry.ts';
import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import { isMapping, sameValue, sameWritten } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { toValue } from '../templates/expand.ts';

import { DESCRIPTIONS, descriptionsFor } from './cards.ts';
import { objectForm, wordsOf } from './draw.ts';
import type { Context, Lens } from './draw.ts';
import { UnsupportedConfig, checkValue, cleanValue } from './form.ts';
import type { Form } from './form.ts';
import { formMissing } from './ha-form.ts';
import { popupChoices } from './popup-names.ts';
import { EDITOR_STYLE } from './style.ts';

const POPUPS = 'custom:mnml-popups-card';

interface Listed {
  readonly hash: string;
  readonly cards?: unknown;
}

export function popupsOf(lovelace: unknown): Listed[] {
  const found: Listed[] = [];
  const walk = (value: unknown, inPopups: boolean): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, inPopups);
      }
    } else if (isMapping(value)) {
      const here = inPopups || value['type'] === POPUPS;
      const hash = value['hash'];
      if (here && typeof hash === 'string' && !found.some((popup) => popup.hash === hash)) {
        found.push({ hash, cards: value['cards'] });
      }
      for (const [key, item] of Object.entries(value)) {
        walk(item, here && key !== 'cards');
      }
    }
  };
  const config =
    isMapping(lovelace) && isMapping(lovelace['config']) ? lovelace['config'] : lovelace;
  walk(config, false);
  return found;
}

export class MnmlCardEditor extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, CONTROL_STYLE, EDITOR_STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @state() private config: Record<string, Value> = {};
  @state() private form: Form | undefined;
  private type = '';
  @state() private popups: readonly Listed[] = [];
  private listed: readonly Listed[] = [];
  private stopAnnounced: (() => void) | undefined;
  private readonly open = new Map<string, boolean>();

  override connectedCallback(): void {
    super.connectedCallback();
    this.stopAnnounced ??= onAnnounce(this.gather);
    this.gather();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopAnnounced?.();
    this.stopAnnounced = undefined;
  }

  set lovelace(lovelace: unknown) {
    this.listed = popupsOf(lovelace);
    this.gather();
  }

  private readonly gather = (): void => {
    const popups = [...this.listed, ...announced()].filter(
      (popup, index, all) => all.findIndex((other) => other.hash === popup.hash) === index,
    );
    if (!sameValue(popups, this.popups)) {
      this.popups = popups;
    }
  };

  setConfig(config: unknown): void {
    const missing = formMissing();
    if (missing !== undefined) {
      throw new UnsupportedConfig(wordsOf(this).forms[missing]);
    }
    const type = isMapping(config) ? config['type'] : undefined;
    const form = typeof type === 'string' ? DESCRIPTIONS[type] : undefined;
    if (form === undefined) {
      throw new UnsupportedConfig(
        `${typeof type === 'string' ? type : 'a card without a type'} has no visual editor`,
      );
    }
    checkValue(form, config);
    const value = toValue(config);
    if (!isMapping(value)) {
      throw new UnsupportedConfig('the card is not a mapping');
    }
    if (form === this.form && sameWritten(value, this.config)) {
      return;
    }
    this.form = form;
    this.type = typeof type === 'string' ? type : '';
    this.config = value;
  }

  protected override render(): TemplateResult | typeof nothing {
    const form = this.form;
    if (form === undefined) {
      return nothing;
    }
    const drawn = descriptionsFor(wordsOf(this))[this.type] ?? form;
    const context: Context = {
      hass: this.hass,
      popups: popupChoices(this.popups, this.hass),
      open: this.open,
      redraw: (): void => {
        this.requestUpdate();
      },
    };
    const lens: Lens = {
      get: (): Record<string, Value> => this.config,
      set: (next): void => {
        this.config = cleanValue(form, next, this.config);
        this.dispatchEvent(
          new CustomEvent('config-changed', {
            detail: { config: this.config },
            bubbles: true,
            composed: true,
          }),
        );
      },
    };
    return objectForm(drawn, lens, context, '', true);
  }
}
