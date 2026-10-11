import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';

import type { Value } from '../contract/templates.ts';
import type { FormItem } from '../editors/form.ts';
import { haForm } from '../editors/ha-form.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';

interface Simple {
  hass: HomeAssistant | undefined;
  schema: readonly FormItem[];
  data: Record<string, Value>;
  labels?: Readonly<Record<string, string>>;
  helpers?: Readonly<Record<string, string>>;
  changed: (data: Record<string, Value>) => void;
}

export const simpleForm = (options: Simple): TemplateResult =>
  haForm({
    hass: options.hass,
    data: options.data,
    schema: options.schema,
    computeLabel: (item) => options.labels?.[item.name] ?? item.name,
    computeHelper: (item) => options.helpers?.[item.name],
    changed: options.changed,
  });

export const select = (
  options: readonly (string | { value: string; label: string })[],
  multiple = false,
): Value => ({
  select: {
    mode: 'dropdown',
    multiple,
    options: options.map((option) => (typeof option === 'string' ? option : { ...option })),
  },
});

interface Pick {
  label: string;
  options: readonly (string | { value: string; label: string })[];
  value: string;
  help?: string;
  changed: (value: string) => void;
}

export const pick = (options: Pick): TemplateResult => html`<label class="pick">
  <span class="pick-label">${options.label}</span>
  <select
    .value=${live(options.value)}
    @change=${(event: Event) => {
      const value = field(event.target, 'value');
      options.changed(typeof value === 'string' ? value : '');
    }}
  >
    ${options.options.map((option) => {
      const entry = typeof option === 'string' ? { value: option, label: option } : option;
      return html`<option value=${entry.value} ?selected=${entry.value === options.value}>
        ${entry.label}
      </option>`;
    })}
  </select>
  ${options.help === undefined ? '' : html`<span class="muted">${options.help}</span>`}
</label>`;
