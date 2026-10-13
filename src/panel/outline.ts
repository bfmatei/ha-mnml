import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { DESCRIPTIONS } from '../editors/cards.ts';
import { rowMenu } from '../editors/row-menu.ts';
import { labelOf, variantOf } from '../editors/shape.ts';
import type { Field, PlainShape, Shape } from '../editors/shape.ts';
import { icon } from '../ha/templates.ts';
import type { Change } from '../templates/changes.ts';

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
  if (set) {
    return `when ${slots.join(' or ')} is set`;
  }
  return `when ${slots.join(' and ')} ${slots.length === 1 ? 'is' : 'are'} not set`;
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

export function startersOf(group: Group): Starter[] {
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

function partKey(path: Path): string {
  const last = path.findLastIndex((segment) => segment.startsWith('#'));
  return last === -1 ? (path[0] ?? '') : key(path.slice(0, last + 1));
}

export function changedParts(changes: readonly Change[]): Set<string> {
  const keys = new Set<string>();
  for (const change of changes) {
    if (change.op === 'insert') {
      const id =
        isMapping(change.value) && typeof change.value['id'] === 'string'
          ? change.value['id']
          : undefined;
      keys.add(id === undefined ? partKey(change.path) : key([...change.path, `#${id}`]));
    } else if (change.op === 'move') {
      keys.add(key([...change.path, `#${change.id}`]));
    } else if (change.op === 'remove') {
      keys.add(partKey(change.path.slice(0, -1)));
    } else {
      keys.add(partKey(change.path));
    }
  }
  return keys;
}

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

export function singlesOf(root: Part | Group): Set<string> {
  const found = new Set<string>();
  const walk = (part: Part): void => {
    for (const group of part.groups) {
      if (!group.list) {
        for (const only of group.parts) {
          found.add(key(only.path));
        }
      }
      for (const inner of group.parts) {
        walk(inner);
      }
    }
  };
  if ('groups' in root) {
    found.add(key(root.path));
    walk(root);
  } else {
    for (const part of root.parts) {
      walk(part);
    }
  }
  return found;
}

export function chainTo(root: Part | Group, where: string): Part[] {
  const walk = (part: Part, above: Part[]): Part[] | undefined => {
    const here = [...above, part];
    if (key(part.path) === where) {
      return here;
    }
    for (const group of part.groups) {
      for (const inner of group.parts) {
        const found = walk(inner, here);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  };
  for (const part of 'groups' in root ? [root] : root.parts) {
    const found = walk(part, []);
    if (found !== undefined) {
      return found;
    }
  }
  return [];
}

export const OUTLINE_STYLE = css`
  .outline-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-left: 12px;
  }
  .outline > .outline-part > .outline-group {
    margin-left: 0;
  }
  .outline-heading {
    color: var(--secondary-text-color);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 4px 2px;
  }
  .outline-row {
    display: flex;
    align-items: center;
    border-radius: 8px;
  }
  .outline-row.selected {
    background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
  }
  .outline-row.selected .outline-label {
    color: var(--primary-color);
  }
  .outline-name {
    all: unset;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 4px;
    cursor: pointer;
    flex-wrap: wrap;
  }
  .outline-name ha-icon {
    color: var(--secondary-text-color);
    --mdc-icon-size: 18px;
  }
  .outline-label {
    font-size: 14px;
  }
  .outline-add {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 4px;
  }
  .add-label {
    color: var(--secondary-text-color);
    font-size: 13px;
  }
`;
