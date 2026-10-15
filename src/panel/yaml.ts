import { LitElement, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { parseDocument } from 'yaml';

import { isStorable } from '../contract/templates.ts';
import type { Value, WrittenTemplate } from '../contract/templates.ts';
import { toYaml } from '../contract/yaml.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { toValue } from '../templates/expand.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

import { messageOf } from './message.ts';
import { PANEL_STYLE } from './style.ts';

export function readYaml(text: string, words: PanelWords = PANEL_EN): Value {
  const document = parseDocument(text);
  const [problem] = document.errors;
  if (problem !== undefined) {
    const line = problem.linePos?.[0];
    throw new Error(
      line === undefined ? problem.message : words.yaml.line(line.line, problem.message),
    );
  }
  const tag = document.warnings.find((warning) => warning.code === 'TAG_RESOLVE_FAILED');
  if (tag !== undefined) {
    const name = /!\S+/.exec(tag.message)?.[0] ?? words.yaml.aTag;
    throw new Error(words.yaml.tag(name));
  }
  return toValue(document.toJS());
}

export function readTemplate(
  text: string,
  shipped = false,
  words: PanelWords = PANEL_EN,
): WrittenTemplate {
  const value = readYaml(text, words);
  if (!isStorable(value, shipped)) {
    throw new Error(words.yaml.notTemplate);
  }
  return value;
}

export class MnmlYaml extends LitElement {
  static override styles = PANEL_STYLE;

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) template: WrittenTemplate | undefined;
  @property({ attribute: false }) apply: ((template: WrittenTemplate) => void) | undefined;
  @state() private text = '';
  @state() private problem: string | undefined;

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('template') && this.template !== undefined) {
      this.text = toYaml(this.template);
      this.problem = undefined;
    }
  }

  private words(): PanelWords {
    return panelWordsFor(this.hass?.locale.language);
  }

  protected override render(): TemplateResult {
    const said = this.words().yaml;
    const editor =
      customElements.get('ha-code-editor') === undefined
        ? html`<textarea
            class="yaml-text"
            spellcheck="false"
            aria-label=${said.label}
            .value=${this.text}
            @input=${(event: Event) => {
              const value = field(event.target, 'value');
              this.edited(typeof value === 'string' ? value : '');
            }}
          ></textarea>`
        : html`<ha-code-editor
            mode="yaml"
            aria-label=${said.label}
            .hass=${this.hass}
            .value=${this.text}
            .error=${this.problem !== undefined}
            autocomplete-entities
            @value-changed=${(event: Event) => {
              const value = field(field(event, 'detail'), 'value');
              this.edited(typeof value === 'string' ? value : '');
            }}
          ></ha-code-editor>`;
    return html`<div class="yaml">
      <p class="muted">${said.about}</p>
      ${editor}
      ${this.problem === undefined ? nothing : html`<p class="problem-line">${this.problem}</p>`}
      <button type="button" class="action" @click=${this.applyText}>${said.apply}</button>
    </div>`;
  }

  private edited(text: string): void {
    this.text = text;
    this.check(text);
  }

  private check(text: string): WrittenTemplate | undefined {
    try {
      const read = readTemplate(text, Array.isArray(this.template?.card), this.words());
      this.problem = undefined;
      return read;
    } catch (error) {
      this.problem = messageOf(error);
      return undefined;
    }
  }

  private readonly applyText = (): void => {
    const read = this.check(this.text);
    if (read !== undefined) {
      this.apply?.(read);
    }
  };
}
