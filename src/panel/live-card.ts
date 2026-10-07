import { LitElement, css, html } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';

import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';

export class MnmlLiveCard extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property({ attribute: false }) config: object | undefined;
  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @query('.card') private box: HTMLElement | null | undefined;
  private card: ChildCard | undefined;
  private drawn = '';
  private drawing = 0;

  protected override render(): TemplateResult {
    return html`<div class="card"></div>`;
  }

  protected override updated(changed: PropertyValues<this>): void {
    const key = JSON.stringify(this.config ?? null);
    if (changed.has('config') && key !== this.drawn) {
      this.drawn = key;
      void this.draw();
    } else if (changed.has('hass') && this.card !== undefined && this.hass !== undefined) {
      this.card.hass = this.hass;
    }
  }

  private async draw(): Promise<void> {
    this.drawing += 1;
    const mine = this.drawing;
    const config = this.config;
    const load = window.loadCardHelpers;
    if (config === undefined || load === undefined) {
      this.card = undefined;
      this.box?.replaceChildren();
      return;
    }
    const helpers = await load();
    if (mine !== this.drawing) {
      return;
    }
    const card = helpers.createCardElement(config);
    card.preview = true;
    if (this.hass !== undefined) {
      card.hass = this.hass;
    }
    this.card = card;
    this.box?.replaceChildren(card);
  }
}
