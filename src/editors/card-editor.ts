import { LitElement, nothing } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { toValue } from '../templates/expand.ts';

import { DESCRIPTIONS } from './cards.ts';
import { objectForm } from './draw.ts';
import type { Context, Slot } from './draw.ts';
import { Unsupported, checkValue, cleanValue } from './shape.ts';
import type { Shape } from './shape.ts';
import { EDITOR_STYLE } from './style.ts';

const POPUPS = 'custom:mnml-popups-card';

export function hashesOf(lovelace: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown, inPopups: boolean): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, inPopups);
      }
    } else if (isMapping(value)) {
      const here = inPopups || value['type'] === POPUPS;
      const hash = value['hash'];
      if (here && typeof hash === 'string' && !found.includes(hash)) {
        found.push(hash);
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
  @state() private shape: Shape | undefined;
  @state() private hashes: readonly string[] = [];
  private readonly open = new Map<string, boolean>();

  set lovelace(lovelace: unknown) {
    const hashes = hashesOf(lovelace);
    if (JSON.stringify(hashes) !== JSON.stringify(this.hashes)) {
      this.hashes = hashes;
    }
  }

  setConfig(config: unknown): void {
    if (customElements.get('ha-form') === undefined) {
      throw new Unsupported("Home Assistant's form is not loaded");
    }
    const type = isMapping(config) ? config['type'] : undefined;
    const shape = typeof type === 'string' ? DESCRIPTIONS[type] : undefined;
    if (shape === undefined) {
      throw new Unsupported(
        `${typeof type === 'string' ? type : 'a card without a type'} has no visual editor`,
      );
    }
    checkValue(shape, config);
    const value = toValue(config);
    if (!isMapping(value)) {
      throw new Unsupported('the card is not a mapping');
    }
    if (shape === this.shape && JSON.stringify(value) === JSON.stringify(this.config)) {
      return;
    }
    this.shape = shape;
    this.config = value;
  }

  protected override render(): TemplateResult | typeof nothing {
    const shape = this.shape;
    if (shape === undefined) {
      return nothing;
    }
    const context: Context = {
      hass: this.hass,
      hashes: this.hashes,
      open: this.open,
      redraw: (): void => {
        this.requestUpdate();
      },
    };
    const slot: Slot = {
      get: (): Record<string, Value> => this.config,
      set: (next): void => {
        this.config = cleanValue(shape, next);
        this.dispatchEvent(
          new CustomEvent('config-changed', {
            detail: { config: this.config },
            bubbles: true,
            composed: true,
          }),
        );
      },
    };
    return objectForm(shape, slot, context, '', true);
  }
}
