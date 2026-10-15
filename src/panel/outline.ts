import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import { isMapping, plainKey } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { DESCRIPTIONS, descriptionsFor } from '../editors/cards.ts';
import { labelOf, variantOf } from '../editors/form.ts';
import type { Field, PlainForm, Form } from '../editors/form.ts';
import { rowMenu } from '../editors/row-menu.ts';
import { icon } from '../ha/templates.ts';
import type { Change } from '../templates/changes.ts';
import { editorWordsFor } from '../words/panel/editors.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

import type { Path } from './tree.ts';

export interface Wording {
  forms: Readonly<Record<string, Form>>;
  said: PanelWords['outline'];
}

export const ENGLISH: Wording = { forms: DESCRIPTIONS, said: PANEL_EN.outline };

export function wordingFor(language: string | undefined): Wording {
  return {
    forms: descriptionsFor(editorWordsFor(language)),
    said: panelWordsFor(language).outline,
  };
}

type PartKind = 'card' | 'part' | 'fragment';

export interface Part {
  path: Path;
  value: Record<string, Value>;
  form: Form | undefined;
  kind: PartKind;
  label: string;
  badges: string[];
  groups: Group[];
}

export interface Group {
  key: string;
  label: string;
  path: Path;
  of: Form | undefined;
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
  titleOf: (template: string) => string;
  wording: Wording;
}

function variantFor(form: Form | undefined, value: Record<string, Value>): PlainForm | undefined {
  if (form === undefined) {
    return undefined;
  }
  try {
    return variantOf(form, value);
  } catch {
    return undefined;
  }
}

function fieldOf(
  form: Form | undefined,
  value: Record<string, Value>,
  key: string,
): Field | undefined {
  return variantFor(form, value)?.fields[plainKey(key)];
}

function slotsIn(rule: Value): string[] {
  return (Array.isArray(rule) ? rule : [rule]).map((each) =>
    typeof each === 'string' ? each : JSON.stringify(each),
  );
}

export function badgesOf(
  value: Record<string, Value>,
  said: PanelWords['outline'] = PANEL_EN.outline,
): string[] {
  const shownIf = value['if'];
  const shownUnless = value['unless'];
  const each = value['each'];
  return [
    ...(shownIf === undefined ? [] : [said.shownIf(slotsIn(shownIf))]),
    ...(shownUnless === undefined ? [] : [said.shownUnless(slotsIn(shownUnless))]),
    ...(each === undefined ? [] : [said.each(slotsIn(each))]),
  ];
}

const groupLabel = (key: string, said: PanelWords['outline']): string => {
  const plain = plainKey(key);
  return plain === 'cards' || plain === 'popups' ? said.groups[plain] : plain;
};

export function outlinePart(
  value: Record<string, Value>,
  path: Path,
  given: Form | undefined,
  index: number,
  wording: Wording = ENGLISH,
): Part {
  const { forms, said } = wording;
  const type = value['type'];
  const known = typeof type === 'string' ? forms[type] : undefined;
  const template = value['template'];
  const fragment = typeof template === 'string';
  const form = fragment ? undefined : (known ?? given);
  const kind: PartKind = fragment ? 'fragment' : known !== undefined ? 'card' : 'part';
  const fallback =
    typeof type === 'string'
      ? type.replace(/^custom:/, '')
      : typeof value['hash'] === 'string'
        ? value['hash']
        : said.part(index + 1);
  const label = fragment
    ? template
    : form === undefined || variantFor(form, value) === undefined
      ? fallback
      : kind === 'card'
        ? form.label
        : labelOf(form, value, index);
  const groups: Group[] = [];
  for (const [key, inner] of Object.entries(value)) {
    const field = fieldOf(form, value, key);
    const list = Array.isArray(inner) && inner.some(isMapping);
    if (field?.kind === 'parts' || (list && (key === 'cards' || plainKey(key) === 'popups'))) {
      groups.push(groupOf(Array.isArray(inner) ? inner : [], [...path, key], key, field, wording));
    } else if (field?.kind === 'part' && isMapping(inner)) {
      groups.push({
        key,
        label: field.label ?? groupLabel(key, said),
        path: [...path, key],
        of: field.of,
        cards: false,
        list: false,
        parts: [outlinePart(inner, [...path, key], field.of, 0, wording)],
      });
    }
  }
  return { path, value, form, kind, label, badges: badgesOf(value, said), groups };
}

export function groupOf(
  items: readonly Value[],
  path: Path,
  key: string,
  field?: Field,
  wording: Wording = ENGLISH,
): Group {
  const of = field?.kind === 'parts' ? field.of : undefined;
  return {
    key,
    label: field?.label ?? groupLabel(key, wording.said),
    path,
    of,
    cards: of === undefined,
    list: true,
    parts: items.flatMap((item, index) => {
      if (!isMapping(item)) {
        return [];
      }
      const id = typeof item['id'] === 'string' ? item['id'] : String(index);
      return [outlinePart(item, [...path, `#${id}`], of, index, wording)];
    }),
  };
}

export function startersOf(group: Group, wording: Wording = ENGLISH): Starter[] {
  const of = group.of;
  if (of === undefined) {
    const cards: Starter[] = Object.entries(wording.forms)
      .filter(([, form]) => form.kind === 'plain' || form.kind === 'tagged')
      .map(([type, form]) => ({ label: form.label, value: { type } }));
    return [...cards, { label: wording.said.fragment, value: { template: '', slots: {} } }];
  }
  if (of.kind === 'tagged') {
    return of.variants.map((variant) => ({
      label: variant.form.label,
      value: { type: variant.when ?? '' },
    }));
  }
  if (of.kind === 'marked') {
    return of.variants.map((variant) => ({
      label: variant.form.label,
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
  const said = actions.wording.said;
  const used = part.value['template'];
  const label =
    part.kind === 'fragment' && typeof used === 'string' ? actions.titleOf(used) : part.label;
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
        aria-label=${label}
        title=${label}
        @click=${() => {
          actions.select(part.path);
        }}
      >
        ${icon(KIND_ICONS[part.kind])}<span class="outline-label">${label}</span>
        ${part.badges.map((badge) => html`<span class="badge">${badge}</span>`)}
        ${actions.changed.has(here) ? html`<span class="badge changed">${said.changed}</span>` : nothing}
        ${actions.conflicted.has(here) ? html`<span class="badge conflict">${said.conflict}</span>` : nothing}
      </button>
      ${rowMenu(said.more(label), [
        {
          label: said.duplicate,
          icon: 'mdi:content-copy',
          run: () => {
            actions.duplicate(part);
          },
        },
        {
          label: said.moveUp,
          icon: 'mdi:arrow-up',
          disabled: index === 0 ? true : undefined,
          run: () => {
            actions.move(group, index, index - 1);
          },
        },
        {
          label: said.moveDown,
          icon: 'mdi:arrow-down',
          disabled: index === group.parts.length - 1 ? true : undefined,
          run: () => {
            actions.move(group, index, index + 1);
          },
        },
        {
          label: said.delete,
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
            <span class="add-label">${actions.wording.said.addTo(group.label.toLowerCase())}</span>
            ${rowMenu(
              actions.wording.said.addTo(group.label),
              startersOf(group, actions.wording).map((starter) => ({
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
    margin-inline-start: 12px;
  }
  .outline > .outline-part > .outline-group {
    margin-inline-start: 0;
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
    padding-inline-start: 4px;
  }
  .add-label {
    color: var(--secondary-text-color);
    font-size: 13px;
  }
`;
