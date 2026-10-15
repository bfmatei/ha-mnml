import { html } from 'lit';
import type { TemplateResult } from 'lit';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';

import type { FormItem } from './ha-form-data.ts';

const WAIT = 5000;

interface FormOptions {
  readonly hass: HomeAssistant | undefined;
  readonly data: Record<string, Value>;
  readonly schema: readonly FormItem[];
  readonly computeLabel: (item: FormItem) => string;
  readonly computeHelper?: (item: FormItem) => string | undefined;
  readonly changed: (data: Record<string, Value>) => void;
}

const settle = (wanted: string): Promise<unknown> =>
  Promise.race([
    customElements.whenDefined(wanted),
    new Promise((resolve) => {
      setTimeout(resolve, WAIT);
    }),
  ]);

export type FormFailure = keyof EditorWords['forms'];

export function formMissing(): FormFailure | undefined {
  if (customElements.get('ha-form') !== undefined) {
    return undefined;
  }
  return window.loadCardHelpers === undefined ? 'unopened' : 'failed';
}

async function load(): Promise<FormFailure | undefined> {
  try {
    const helpers = await window.loadCardHelpers?.();
    if (helpers !== undefined) {
      helpers.createCardElement({ type: 'entities', entities: [] });
      await settle('hui-entities-card');
      const made = customElements.get('hui-entities-card');
      const open = field(made, 'getConfigElement');
      if (typeof open === 'function') {
        await open.call(made);
      }
      await settle('ha-form');
    }
  } catch {}
  return formMissing();
}

let loading: Promise<FormFailure | undefined> | undefined;

export async function loadHaForm(): Promise<FormFailure | undefined> {
  if (customElements.get('ha-form') !== undefined) {
    return undefined;
  }
  loading ??= load();
  const missing = await loading;
  loading = undefined;
  return missing;
}

export function haForm(options: FormOptions): TemplateResult {
  const changed = (event: Event): void => {
    const data = field(field(event, 'detail'), 'value');
    if (isMapping(data)) {
      options.changed(data);
    }
  };
  return html`<ha-form
    .hass=${options.hass}
    .data=${options.data}
    .schema=${options.schema}
    .computeLabel=${options.computeLabel}
    .computeHelper=${options.computeHelper}
    @value-changed=${changed}
  ></ha-form>`;
}
