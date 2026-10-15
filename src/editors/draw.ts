import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';

import type { MdiIcon } from '../contract/entities.ts';
import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon, quietly } from '../ha/templates.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';
import { editorWordsFor } from '../words/panel/editors.ts';

import { copyPart, pasted } from './clipboard.ts';
import { IN_PLACE, REDRAW } from './drawing.ts';
import type { Drawing } from './drawing.ts';
import { labelOf, place, switchVariant, variantOf } from './form.ts';
import type { ChoiceForm, Field, PlainForm, Form } from './form.ts';
import { formData, fromForm, isSimple, labelFor, schemaOf } from './ha-form-data.ts';
import { haForm } from './ha-form.ts';
import { iconFor } from './icons.ts';
import { sectionPanel } from './panel.ts';
import type { PopupChoice } from './popup-names.ts';
import { rowMenu } from './row-menu.ts';
import { nameOf, summarize } from './summary.ts';

export interface Lens {
  get(): Record<string, Value>;
  set(next: Record<string, Value>, drawing: Drawing): void;
}

export interface Context {
  readonly hass: HomeAssistant | undefined;
  readonly popups: readonly PopupChoice[];
  readonly open: Map<string, boolean>;
  redraw(): void;
}

export const wordsOf = (context: Pick<Context, 'hass'>): EditorWords =>
  editorWordsFor(context.hass?.locale.language);

export function adder(
  label: string,
  iconName: MdiIcon,
  run: () => void,
  shown = label,
): TemplateResult {
  return html`<button
    type="button"
    class="control adder"
    aria-label=${label}
    title=${label}
    @click=${quietly(run)}
  >
    ${icon(iconName)}<span>${shown}</span>
  </button>`;
}

interface FormChoices {
  readonly helper?: (name: string) => string | undefined;
  readonly read?: typeof fromForm;
}

export function formOf(
  form: PlainForm,
  keys: readonly string[],
  lens: Lens,
  context: Context,
  choices: FormChoices = {},
): TemplateResult {
  const { help } = form;
  const { helper = help === undefined ? undefined : (name) => help[name], read = fromForm } =
    choices;
  return haForm({
    hass: context.hass,
    data: formData(form, keys, lens.get()),
    schema: schemaOf(form, keys, context.popups),
    computeLabel: (item) => labelFor(form, item.name, wordsOf(context)),
    computeHelper: helper === undefined ? undefined : (item) => helper(item.name),
    changed: (data) => {
      lens.set(read(form, keys, data, lens.get()), IN_PLACE);
    },
  });
}

function childLens(form: PlainForm, lens: Lens, key: string): Lens {
  return {
    get: (): Record<string, Value> => {
      const inner = lens.get()[key];
      return isMapping(inner) ? inner : {};
    },
    set: (next, drawing): void => {
      lens.set(place(form, lens.get(), key, next), drawing);
    },
  };
}

const listOf = (lens: Lens, key: string): Value[] => {
  const inner = lens.get()[key];
  return Array.isArray(inner) ? inner : [];
};

function reindex(
  open: Map<string, boolean>,
  base: string,
  moved: (index: number) => number | undefined,
): void {
  const pattern = new RegExp(`^${base.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[(\\d+)\\](.*)$`);
  const next = new Map<string, boolean>();
  for (const [key, state] of open) {
    const found = pattern.exec(key);
    if (found === null) {
      next.set(key, state);
      continue;
    }
    const to = moved(Number(found[1]));
    if (to !== undefined) {
      next.set(`${base}[${to}]${found[2] ?? ''}`, state);
    }
  }
  open.clear();
  for (const [key, state] of next) {
    open.set(key, state);
  }
}

function newPart(of: Form, when: string | undefined): Record<string, Value> {
  if (of.kind === 'tagged') {
    return { type: when ?? '' };
  }
  if (of.kind === 'marked' && when !== undefined) {
    return switchVariant(of, {}, when);
  }
  return {};
}

function partsForm(
  form: PlainForm,
  key: string,
  of: Form,
  lens: Lens,
  context: Context,
  path: string,
): TemplateResult {
  const base = `${path}.${key}`;
  const items = listOf(lens, key);
  const write = (next: Value[]): void => {
    lens.set(place(form, lens.get(), key, next), REDRAW);
  };
  const named = (id: string): string => nameOf(context.hass, id);
  const words = wordsOf(context);
  const move = (index: number, to: number): void => {
    const next = [...listOf(lens, key)];
    const [taken] = next.splice(index, 1);
    if (taken === undefined || to < 0 || to > next.length) {
      return;
    }
    next.splice(to, 0, taken);
    reindex(context.open, base, (old) => (old === index ? to : old === to ? index : old));
    write(next);
  };
  const row = (item: Value, index: number): TemplateResult => {
    const at = `${base}[${index}]`;
    const label = labelOf(of, item, index, named);
    const itemLens: Lens = {
      get: (): Record<string, Value> => {
        const inner = listOf(lens, key)[index];
        return isMapping(inner) ? inner : {};
      },
      set: (next, drawing): void => {
        lens.set(
          place(
            form,
            lens.get(),
            key,
            listOf(lens, key).map((old, position) => (position === index ? next : old)),
          ),
          drawing,
        );
      },
    };
    return html`<div class="part">
      <div class="part-head">
        <button
          type="button"
          class="part-title"
          aria-label=${label}
          aria-expanded=${String(context.open.get(at) === true)}
          title=${label}
          @click=${quietly(() => {
            context.open.set(at, context.open.get(at) !== true);
            context.redraw();
          })}
        >
          ${label}
        </button>
        ${rowMenu(words.moreFor(label), [
          {
            label: words.moveUp,
            icon: 'mdi:arrow-up',
            disabled: index === 0 ? true : undefined,
            run: (): void => {
              move(index, index - 1);
            },
          },
          {
            label: words.moveDown,
            icon: 'mdi:arrow-down',
            disabled: index === items.length - 1 ? true : undefined,
            run: (): void => {
              move(index, index + 1);
            },
          },
          {
            label: words.copy,
            icon: 'mdi:content-copy',
            run: (): void => {
              copyPart(of.id, listOf(lens, key)[index] ?? item);
              context.redraw();
            },
          },
          {
            label: words.delete,
            icon: 'mdi:delete-outline',
            run: (): void => {
              reindex(context.open, base, (old) =>
                old === index ? undefined : old > index ? old - 1 : old,
              );
              write(listOf(lens, key).filter((_, position) => position !== index));
            },
          },
        ])}
      </div>
      ${
        context.open.get(at) === true
          ? html`<div class="part-body">${objectForm(of, itemLens, context, at, false)}</div>`
          : nothing
      }
    </div>`;
  };
  const added = (when: string | undefined): void => {
    const next = [...listOf(lens, key), newPart(of, when)];
    context.open.set(`${base}[${next.length - 1}]`, true);
    write(next);
  };
  const add = words.add(of.label);
  const chosen = (event: Event): void => {
    const box = event.currentTarget;
    const value = box instanceof HTMLSelectElement ? box.value : '';
    const variant = of.variants?.find((each) => (each.when ?? '') === value);
    if (variant !== undefined) {
      added(variant.when);
    }
  };
  const copied = pasted(of.id);
  return html`<div class="parts">
    ${items.map(row)}
    <div class="adding">
      ${
        of.kind === 'plain'
          ? adder(add, 'mdi:plus', () => {
              added(undefined);
            })
          : html`<select aria-label=${add} .value=${live('')} @change=${chosen}>
              <option value="">${add}</option>
              ${of.variants.map(
                (variant) =>
                  html`<option value=${variant.when ?? ''}>${variant.form.label}</option>`,
              )}
            </select>`
      }
      ${
        copied === undefined
          ? nothing
          : adder(words.paste(of.label), 'mdi:content-paste', () => {
              write([...listOf(lens, key), copied]);
            })
      }
    </div>
  </div>`;
}

function wordsForm(
  form: PlainForm,
  key: string,
  spec: Field,
  lens: Lens,
  context: Context,
): TemplateResult {
  const inner = lens.get()[key];
  const changed = (next: Record<string, string>, drawing: Drawing): void => {
    lens.set(place(form, lens.get(), key, next), drawing);
  };
  return html`<mnml-words
    .words=${isMapping(inner) ? inner : {}}
    .options=${spec.options}
    .labels=${wordsOf(context).words}
    .changed=${changed}
  ></mnml-words>`;
}

function complexForm(
  form: PlainForm,
  key: string,
  spec: Field,
  lens: Lens,
  context: Context,
  path: string,
  titled: boolean,
): TemplateResult[] {
  const heading = titled
    ? [html`<div class="heading">${labelFor(form, key, wordsOf(context))}</div>`]
    : [];
  if (spec.kind === 'words') {
    return [...heading, wordsForm(form, key, spec, lens, context)];
  }
  if (spec.of === undefined) {
    return [];
  }
  if (spec.kind === 'parts') {
    return [...heading, partsForm(form, key, spec.of, lens, context, path)];
  }
  return [
    ...heading,
    objectForm(spec.of, childLens(form, lens, key), context, `${path}.${key}`, false),
  ];
}

export function keysForm(
  form: PlainForm,
  keys: readonly string[],
  lens: Lens,
  context: Context,
  path: string,
  titled = true,
): TemplateResult[] {
  const drawn: TemplateResult[] = [];
  let simple: string[] = [];
  const flush = (): void => {
    if (simple.length > 0) {
      drawn.push(formOf(form, simple, lens, context));
      simple = [];
    }
  };
  for (const key of keys) {
    const spec = form.fields[key];
    if (spec === undefined) {
      continue;
    }
    if (isSimple(spec)) {
      simple.push(key);
    } else {
      flush();
      drawn.push(...complexForm(form, key, spec, lens, context, path, titled));
    }
  }
  flush();
  return drawn;
}

function kindsForm(form: ChoiceForm, lens: Lens): TemplateResult {
  const current = variantOf(form, lens.get());
  return html`<div class="kinds">
    ${form.variants.map(
      (variant) =>
        html`<button
          type="button"
          class="control"
          aria-label=${variant.form.label}
          title=${variant.form.label}
          aria-pressed=${String(variant.form === current)}
          @click=${quietly(() => {
            lens.set(switchVariant(form, lens.get(), variant.when), REDRAW);
          })}
        >
          ${variant.form.label}
        </button>`,
    )}
  </div>`;
}

function drawnKeys(form: Form, chosen: PlainForm, keys: readonly string[]): string[] {
  if (form.kind !== 'marked') {
    return [...keys];
  }
  const marker = form.variants.find((variant) => variant.form === chosen)?.when;
  return keys.filter((key) => key !== marker || chosen.fields[key]?.kind !== 'flag');
}

export function objectForm(
  form: Form,
  lens: Lens,
  context: Context,
  path: string,
  sectioned: boolean,
): TemplateResult {
  const kinds = form.kind === 'plain' ? nothing : kindsForm(form, lens);
  const chosen = variantOf(form, lens.get());
  if (!sectioned) {
    const keys = drawnKeys(form, chosen, Object.keys(chosen.fields));
    return html`<div class="object">${kinds}${keysForm(chosen, keys, lens, context, path)}</div>`;
  }
  const keyOf = (title: string): string => `${path}#${title}`;
  return html`<div class="object">
    ${kinds}${repeat(
      chosen.sections,
      (section) => keyOf(section.title),
      (section, index) => {
        const keys = drawnKeys(form, chosen, section.keys);
        return sectionPanel(context, keyOf(section.title), index === 0, {
          icon: section.icon ?? iconFor(section.title),
          title: section.title,
          summary: summarize(chosen, keys, lens.get(), context.hass, wordsOf(context)),
          body: () => keysForm(chosen, keys, lens, context, path),
        });
      },
    )}
  </div>`;
}
