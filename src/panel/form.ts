import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';

import type { Value } from '../contract/templates.ts';
import type { FormItem } from '../editors/ha-form-data.ts';
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

interface Choice {
  value: string;
  label: string;
  group?: string | undefined;
}

interface Pick {
  label: string;
  options: readonly (string | Choice)[];
  value: string;
  help?: string;
  changed: (value: string) => void;
}

export function pick(options: Pick): TemplateResult {
  const entries = options.options.map((option): Choice =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
  const drawn = (entry: Choice): TemplateResult =>
    html`<option value=${entry.value} ?selected=${entry.value === options.value}>
      ${entry.label}
    </option>`;
  const groups = [...new Set(entries.map((entry) => entry.group))];
  return html`<label class="pick">
    <span class="pick-label">${options.label}</span>
    <select
      .value=${live(options.value)}
      @change=${(event: Event) => {
        const value = field(event.target, 'value');
        options.changed(typeof value === 'string' ? value : '');
      }}
    >
      ${groups.map((group) => {
        const members = entries.filter((entry) => entry.group === group).map(drawn);
        return group === undefined ? members : html`<optgroup label=${group}>${members}</optgroup>`;
      })}
    </select>
    ${options.help === undefined ? '' : html`<span class="muted">${options.help}</span>`}
  </label>`;
}
