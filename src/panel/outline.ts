import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { DESCRIPTIONS } from '../editors/cards.ts';
import { rowMenu } from '../editors/row-menu.ts';
import { labelOf, variantOf } from '../editors/shape.ts';
import type { Field, PlainShape, Shape } from '../editors/shape.ts';
import { icon } from '../ha/templates.ts';

import type { Path } from './tree.ts';

type PartKind = 'card' | 'part' | 'fragment';

export interface Part {
  path: Path;
  value: Record<string, Value>;
  shape: Shape | undefined;
  kind: PartKind;
  label: string;
  badges: string[];
  groups: Group[];
}

export interface Group {
  key: string;
  label: string;
  path: Path;
  of: Shape | undefined;
  cards: boolean;
  list: boolean;
  parts: Part[];
}

export interface Starter {
  label: string;
  value: Record<string, Value>;
}

export interface OutlineActions {
  selected: string;
  changed: ReadonlySet<string>;
  conflicted: ReadonlySet<string>;
  select: (path: Path) => void;
  add: (group: Group, starter: Starter) => void;
  duplicate: (part: Part) => void;
  remove: (part: Part) => void;
  move: (group: Group, from: number, to: number) => void;
}

const plainKey = (key: string): string => (key.endsWith('?') ? key.slice(0, -1) : key);

function variantFor(
  shape: Shape | undefined,
  value: Record<string, Value>,
): PlainShape | undefined {
  if (shape === undefined) {
    return undefined;
  }
  try {
    return variantOf(shape, value);
  } catch {
    return undefined;
  }
}

function fieldOf(
  shape: Shape | undefined,
  value: Record<string, Value>,
  key: string,
): Field | undefined {
  return variantFor(shape, value)?.fields[plainKey(key)];
}

function slotsIn(rule: Value): string[] {
  return (Array.isArray(rule) ? rule : [rule]).map((each) =>
    typeof each === 'string' ? each : JSON.stringify(each),
  );
}

function shown(rule: Value, set: boolean): string {
  const slots = slotsIn(rule);
  const verb = slots.length === 1 ? 'is' : 'are';
  return `when ${slots.join(' and ')} ${verb} ${set ? 'set' : 'not set'}`;
}

export function badgesOf(value: Record<string, Value>): string[] {
  const shownIf = value['if'];
  const shownUnless = value['unless'];
  const each = value['each'];
  return [
    ...(shownIf === undefined ? [] : [shown(shownIf, true)]),
    ...(shownUnless === undefined ? [] : [shown(shownUnless, false)]),
    ...(each === undefined ? [] : [`one for each of ${slotsIn(each).join(' and ')}`]),
  ];
}

export function partOf(
  value: Record<string, Value>,
  path: Path,
  given: Shape | undefined,
  index: number,
): Part {
  const type = value['type'];
  const known = typeof type === 'string' ? DESCRIPTIONS[type] : undefined;
  const template = value['template'];
  const fragment = typeof template === 'string';
  const shape = fragment ? undefined : (known ?? given);
  const kind: PartKind = fragment ? 'fragment' : known !== undefined ? 'card' : 'part';
  const fallback =
    typeof type === 'string'
      ? type.replace(/^custom:/, '')
      : typeof value['hash'] === 'string'
        ? value['hash']
        : `Part ${index + 1}`;
  const label = fragment
    ? template
    : shape === undefined || variantFor(shape, value) === undefined
      ? fallback
      : kind === 'card'
        ? shape.label
        : labelOf(shape, value, index);
  const groups: Group[] = [];
  for (const [key, inner] of Object.entries(value)) {
    const field = fieldOf(shape, value, key);
    const list = Array.isArray(inner) && inner.some(isMapping);
    if (field?.kind === 'parts' || (list && (key === 'cards' || plainKey(key) === 'popups'))) {
      groups.push(groupOf(Array.isArray(inner) ? inner : [], [...path, key], key, field));
    } else if (field?.kind === 'part' && isMapping(inner)) {
      groups.push({
        key,
        label: field.label ?? plainKey(key),
        path: [...path, key],
        of: field.of,
        cards: false,
        list: false,
        parts: [partOf(inner, [...path, key], field.of, 0)],
      });
    }
  }
  return { path, value, shape, kind, label, badges: badgesOf(value), groups };
}

export function groupOf(items: readonly Value[], path: Path, key: string, field?: Field): Group {
  const of = field?.kind === 'parts' ? field.of : undefined;
  return {
    key,
    label: field?.label ?? plainKey(key),
    path,
    of,
    cards: of === undefined,
    list: true,
    parts: items.flatMap((item, index) => {
      if (!isMapping(item)) {
        return [];
      }
      const id = typeof item['id'] === 'string' ? item['id'] : String(index);
      return [partOf(item, [...path, `#${id}`], of, index)];
    }),
  };
}

function startersOf(group: Group): Starter[] {
  const of = group.of;
  if (of === undefined) {
    const cards: Starter[] = Object.entries(DESCRIPTIONS)
      .filter(([, shape]) => shape.kind === 'plain' || shape.kind === 'tagged')
      .map(([type, shape]) => ({ label: shape.label, value: { type } }));
    return [...cards, { label: 'Fragment', value: { template: '', slots: {} } }];
  }
  if (of.kind === 'tagged') {
    return of.variants.map((variant) => ({
      label: variant.shape.label,
      value: { type: variant.when ?? '' },
    }));
  }
  if (of.kind === 'marked') {
    return of.variants.map((variant) => ({
      label: variant.shape.label,
      value: variant.when === undefined ? {} : { [variant.when]: true },
    }));
  }
  return [{ label: of.label, value: {} }];
}

const key = (path: Path): string => path.join('/');

const KIND_ICONS = {
  fragment: 'mdi:puzzle-outline',
  card: 'mdi:card-outline',
  part: 'mdi:circle-small',
} as const;

function drawPart(
  part: Part,
  group: Group,
  index: number,
  actions: OutlineActions,
): TemplateResult {
  const here = key(part.path);
  return html`<div class="outline-part">
    <div
      class=${classMap({ 'outline-row': true, selected: here === actions.selected })}
      draggable="true"
      data-index=${index}
      @dragstart=${(event: DragEvent) => {
        event.dataTransfer?.setData('text/plain', `${key(group.path)}|${index}`);
      }}
      @dragover=${(event: DragEvent) => {
        event.preventDefault();
      }}
      @drop=${(event: DragEvent) => {
        event.preventDefault();
        const [from, at] = (event.dataTransfer?.getData('text/plain') ?? '').split('|');
        if (from === key(group.path) && at !== undefined) {
          actions.move(group, Number(at), index);
        }
      }}
    >
      <button
        type="button"
        class="outline-name"
        aria-label=${part.label}
        title=${part.label}
        @click=${() => {
          actions.select(part.path);
        }}
      >
        ${icon(KIND_ICONS[part.kind])}<span class="outline-label">${part.label}</span>
        ${part.badges.map((badge) => html`<span class="badge">${badge}</span>`)}
        ${actions.changed.has(here) ? html`<span class="badge changed">changed</span>` : nothing}
        ${actions.conflicted.has(here) ? html`<span class="badge conflict">conflict</span>` : nothing}
      </button>
      ${rowMenu(part.label, [
        {
          label: 'Duplicate',
          icon: 'mdi:content-copy',
          run: () => {
            actions.duplicate(part);
          },
        },
        {
          label: 'Move up',
          icon: 'mdi:arrow-up',
          disabled: index === 0 ? true : undefined,
          run: () => {
            actions.move(group, index, index - 1);
          },
        },
        {
          label: 'Move down',
          icon: 'mdi:arrow-down',
          disabled: index === group.parts.length - 1 ? true : undefined,
          run: () => {
            actions.move(group, index, index + 1);
          },
        },
        {
          label: 'Delete',
          icon: 'mdi:delete-outline',
          run: () => {
            actions.remove(part);
          },
        },
      ])}
    </div>
    ${part.groups.map((inner) => drawGroup(inner, actions))}
  </div>`;
}

function drawGroup(group: Group, actions: OutlineActions): TemplateResult {
  return html`<div class="outline-group">
    <div class="outline-heading">${group.label}</div>
    ${group.parts.map((part, index) => drawPart(part, group, index, actions))}
    ${
      group.list
        ? html`<div class="outline-add">
            <span class="add-label">Add to ${group.label.toLowerCase()}</span>
            ${rowMenu(
              `Add to ${group.label}`,
              startersOf(group).map((starter) => ({
                label: starter.label,
                icon: 'mdi:plus',
                run: () => {
                  actions.add(group, starter);
                },
              })),
            )}
          </div>`
        : nothing
    }
  </div>`;
}

export function drawOutline(root: Part | Group, actions: OutlineActions): TemplateResult {
  const top: Group = {
    key: '',
    label: '',
    path: [],
    of: undefined,
    cards: true,
    list: false,
    parts: 'groups' in root ? [root] : [],
  };
  return html`<div class="outline">
    ${'groups' in root ? drawPart(root, top, 0, actions) : drawGroup(root, actions)}
  </div>`;
}
