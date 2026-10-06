import type { TemplateResult } from 'lit';

import type { Value } from '../contract/templates.ts';
import type { FormItem } from '../editors/form.ts';
import { haForm } from '../editors/ha-form.ts';
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
