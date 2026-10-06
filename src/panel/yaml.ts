import { LitElement, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { parseDocument } from 'yaml';

import { isTemplate } from '../contract/templates.ts';
import type { Template, Value } from '../contract/templates.ts';
import { toYaml } from '../contract/yaml.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { toValue } from '../templates/expand.ts';

import { PANEL_STYLE } from './style.ts';

export function readYaml(text: string): Value {
  const document = parseDocument(text);
  const [problem] = document.errors;
  if (problem !== undefined) {
    const line = problem.linePos?.[0];
    throw new Error(line === undefined ? problem.message : `line ${line.line}: ${problem.message}`);
  }
  const tag = document.warnings.find((warning) => warning.code === 'TAG_RESOLVE_FAILED');
  if (tag !== undefined) {
    const name = /!\S+/.exec(tag.message)?.[0] ?? 'a tag';
    throw new Error(`${name} is a YAML tag, and a template takes none`);
  }
  return toValue(document.toJS());
}

export function readTemplate(text: string): Template {
  const value = readYaml(text);
  if (!isTemplate(value)) {
    throw new Error('a template is a mapping with a card');
  }
  return value;
}

export class MnmlYaml extends LitElement {
  static override styles = PANEL_STYLE;

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) template: Template | undefined;
  @property({ attribute: false }) apply: ((template: Template) => void) | undefined;
  @state() private text = '';
  @state() private problem: string | undefined;

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('template') && this.template !== undefined) {
      this.text = toYaml(this.template);
      this.problem = undefined;
    }
  }

  protected override render(): TemplateResult {
    const editor =
      customElements.get('ha-code-editor') === undefined
        ? html`<textarea
            class="yaml-text"
            spellcheck="false"
            aria-label="The template in YAML"
            .value=${this.text}
            @input=${(event: Event) => {
              const value = field(event.target, 'value');
              this.edited(typeof value === 'string' ? value : '');
            }}
          ></textarea>`
        : html`<ha-code-editor
            mode="yaml"
            aria-label="The template in YAML"
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
      <p class="muted">
        The whole template. Apply sends it back to the other tabs; Save stores it.
      </p>
      ${editor}
      ${this.problem === undefined ? nothing : html`<p class="problem-line">${this.problem}</p>`}
      <button type="button" class="action" @click=${this.applyText}>Apply</button>
    </div>`;
  }

  private edited(text: string): void {
    this.text = text;
    this.check(text);
  }

  private check(text: string): Template | undefined {
    try {
      const read = readTemplate(text);
      this.problem = undefined;
      return read;
    } catch (error) {
      this.problem = error instanceof Error ? error.message : String(error);
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
