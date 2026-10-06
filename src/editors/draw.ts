import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';

import type { MdiIcon } from '../contract/entities.ts';
import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon, quietly } from '../ha/templates.ts';

import { copyPart, pasted } from './clipboard.ts';
import { formData, fromForm, isSimple, labelFor, schemaOf } from './form.ts';
import { haForm } from './ha-form.ts';
import { iconFor } from './icons.ts';
import { sectionPanel } from './panel.ts';
import { rowMenu } from './row-menu.ts';
import { labelOf, place, switchVariant, variantOf } from './shape.ts';
import type { ChoiceShape, Field, PlainShape, Shape } from './shape.ts';
import { nameOf, summarize } from './summary.ts';

export interface Slot {
  get(): Record<string, Value>;
  set(next: Record<string, Value>, redraw: boolean): void;
}

export interface Context {
  readonly hass: HomeAssistant | undefined;
  readonly hashes: readonly string[];
  readonly open: Map<string, boolean>;
  redraw(): void;
}

const articled = (label: string): string =>
  `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()}`;

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

function formOf(
  shape: PlainShape,
  keys: readonly string[],
  slot: Slot,
  context: Context,
): TemplateResult {
  return haForm({
    hass: context.hass,
    data: formData(shape, keys, slot.get()),
    schema: schemaOf(shape, keys, context.hashes),
    computeLabel: (item) => labelFor(shape, item.name),
    changed: (data) => {
      slot.set(fromForm(shape, keys, data, slot.get()), false);
    },
  });
}

function childSlot(shape: PlainShape, slot: Slot, key: string): Slot {
  return {
    get: (): Record<string, Value> => {
      const inner = slot.get()[key];
      return isMapping(inner) ? inner : {};
    },
    set: (next, redraw): void => {
      slot.set(place(shape, slot.get(), key, next), redraw);
    },
  };
}

const listOf = (slot: Slot, key: string): Value[] => {
  const inner = slot.get()[key];
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

function newPart(of: Shape, when: string | undefined): Record<string, Value> {
  if (of.kind === 'tagged') {
    return { type: when ?? '' };
  }
  if (of.kind === 'marked' && when !== undefined) {
    return switchVariant(of, {}, when);
  }
  return {};
}

function partsForm(
  shape: PlainShape,
  key: string,
  of: Shape,
  slot: Slot,
  context: Context,
  path: string,
): TemplateResult {
  const base = `${path}.${key}`;
  const items = listOf(slot, key);
  const write = (next: Value[]): void => {
    slot.set(place(shape, slot.get(), key, next), true);
  };
  const named = (id: string): string => nameOf(context.hass, id);
  const move = (index: number, to: number): void => {
    const next = [...listOf(slot, key)];
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
    const itemSlot: Slot = {
      get: (): Record<string, Value> => {
        const inner = listOf(slot, key)[index];
        return isMapping(inner) ? inner : {};
      },
      set: (next, redraw): void => {
        slot.set(
          place(
            shape,
            slot.get(),
            key,
            listOf(slot, key).map((old, position) => (position === index ? next : old)),
          ),
          redraw,
        );
      },
    };
    return html`<div class="part">
      <div class="part-head">
        <button
          type="button"
          class="part-title"
          aria-label=${label}
          title=${label}
          @click=${quietly(() => {
            context.open.set(at, context.open.get(at) !== true);
            context.redraw();
          })}
        >
          ${label}
        </button>
        ${rowMenu(label, [
          {
            label: 'Move up',
            icon: 'mdi:arrow-up',
            disabled: index === 0 ? true : undefined,
            run: (): void => {
              move(index, index - 1);
            },
          },
          {
            label: 'Move down',
            icon: 'mdi:arrow-down',
            disabled: index === items.length - 1 ? true : undefined,
            run: (): void => {
              move(index, index + 1);
            },
          },
          {
            label: 'Copy',
            icon: 'mdi:content-copy',
            run: (): void => {
              copyPart(of.id, listOf(slot, key)[index] ?? item);
              context.redraw();
            },
          },
          {
            label: 'Delete',
            icon: 'mdi:delete-outline',
            run: (): void => {
              reindex(context.open, base, (old) =>
                old === index ? undefined : old > index ? old - 1 : old,
              );
              write(listOf(slot, key).filter((_, position) => position !== index));
            },
          },
        ])}
      </div>
      ${
        context.open.get(at) === true
          ? html`<div class="part-body">${objectForm(of, itemSlot, context, at, false)}</div>`
          : nothing
      }
    </div>`;
  };
  const added = (when: string | undefined): void => {
    const next = [...listOf(slot, key), newPart(of, when)];
    context.open.set(`${base}[${next.length - 1}]`, true);
    write(next);
  };
  const add = `Add ${articled(of.label)}`;
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
                  html`<option value=${variant.when ?? ''}>${variant.shape.label}</option>`,
              )}
            </select>`
      }
      ${
        copied === undefined
          ? nothing
          : adder(`Paste ${articled(of.label)}`, 'mdi:content-paste', () => {
              write([...listOf(slot, key), copied]);
            })
      }
    </div>
  </div>`;
}

function wordsForm(shape: PlainShape, key: string, slot: Slot): TemplateResult {
  const inner = slot.get()[key];
  const changed = (next: Record<string, string>, redraw: boolean): void => {
    slot.set(place(shape, slot.get(), key, next), redraw);
  };
  return html`<mnml-words
    .words=${isMapping(inner) ? inner : {}}
    .changed=${changed}
  ></mnml-words>`;
}

function complexForm(
  shape: PlainShape,
  key: string,
  spec: Field,
  slot: Slot,
  context: Context,
  path: string,
  titled: boolean,
): TemplateResult[] {
  const heading = titled
    ? [html`<div class="heading">${spec.label ?? labelFor(shape, key)}</div>`]
    : [];
  if (spec.kind === 'words') {
    return [...heading, wordsForm(shape, key, slot)];
  }
  if (spec.of === undefined) {
    return [];
  }
  if (spec.kind === 'parts') {
    return [...heading, partsForm(shape, key, spec.of, slot, context, path)];
  }
  return [
    ...heading,
    objectForm(spec.of, childSlot(shape, slot, key), context, `${path}.${key}`, false),
  ];
}

export function keysForm(
  shape: PlainShape,
  keys: readonly string[],
  slot: Slot,
  context: Context,
  path: string,
  titled = true,
): TemplateResult[] {
  const drawn: TemplateResult[] = [];
  let simple: string[] = [];
  const flush = (): void => {
    if (simple.length > 0) {
      drawn.push(formOf(shape, simple, slot, context));
      simple = [];
    }
  };
  for (const key of keys) {
    const spec = shape.fields[key];
    if (spec === undefined) {
      continue;
    }
    if (isSimple(spec)) {
      simple.push(key);
    } else {
      flush();
      drawn.push(...complexForm(shape, key, spec, slot, context, path, titled));
    }
  }
  flush();
  return drawn;
}

function kindsForm(shape: ChoiceShape, slot: Slot): TemplateResult {
  const current = variantOf(shape, slot.get());
  return html`<div class="kinds">
    ${shape.variants.map(
      (variant) => html`<button
        type="button"
        class="control"
        aria-label=${variant.shape.label}
        title=${variant.shape.label}
        aria-pressed=${String(variant.shape === current)}
        @click=${quietly(() => {
          slot.set(switchVariant(shape, slot.get(), variant.when), true);
        })}
      >
        ${variant.shape.label}
      </button>`,
    )}
  </div>`;
}

export function objectForm(
  shape: Shape,
  slot: Slot,
  context: Context,
  path: string,
  sectioned: boolean,
): TemplateResult {
  const kinds = shape.kind === 'plain' ? nothing : kindsForm(shape, slot);
  const chosen = variantOf(shape, slot.get());
  if (!sectioned) {
    return html`<div class="object">
      ${kinds}${keysForm(chosen, Object.keys(chosen.fields), slot, context, path)}
    </div>`;
  }
  const keyOf = (title: string): string => `${path}#${title}`;
  return html`<div class="object">
    ${kinds}${repeat(
      chosen.sections,
      (section) => keyOf(section.title),
      (section, index) =>
        sectionPanel(context, keyOf(section.title), index === 0, {
          icon: iconFor(section.title),
          title: section.title,
          summary: summarize(chosen, section.keys, slot.get(), context.hass),
          body: () => keysForm(chosen, section.keys, slot, context, path),
        }),
    )}
  </div>`;
}
