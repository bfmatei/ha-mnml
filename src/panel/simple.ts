import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { live } from 'lit/directives/live.js';
import { styleMap } from 'lit/directives/style-map.js';

import { isMapping } from '../contract/templates.ts';
import type { Template, Value } from '../contract/templates.ts';
import { COLORS } from '../editors/lists.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';

import { partOf } from './outline.ts';
import type { Group, Part } from './outline.ts';
import { inserted, valueAt, withValue } from './tree.ts';
import type { Path } from './tree.ts';

type LookKey = 'name' | 'title' | 'icon' | 'color';

interface SimpleLook {
  path: Path;
  key: LookKey;
  value: string;
  original?: string;
}

export interface SimpleRow {
  path: Path;
  group: string;
  label: string;
  depth: number;
  switchable: boolean;
  on: boolean;
  condition: string | undefined;
  looks: SimpleLook[];
}

export interface KeptPart {
  value: Value | undefined;
  after: string | undefined;
}

const LOOKS: readonly LookKey[] = ['name', 'title', 'icon', 'color'];
const EDITOR_DOCS =
  'https://github.com/bfmatei/ha-mnml/blob/main/docs/editors.md#the-template-cards-editor';

const words = (label: string): string => label.replaceAll(/\[\[([^\]]+)\]\]/g, '$1');

const idOf = (item: Value): string | undefined =>
  isMapping(item) && typeof item['id'] === 'string' ? item['id'] : undefined;

function looksOf(part: Part, shipped: Template | undefined): SimpleLook[] {
  return LOOKS.flatMap((key) => {
    const value = part.value[key];
    if (typeof value !== 'string' || value.includes('[[')) {
      return [];
    }
    const path = [...part.path, key];
    const original = shipped === undefined ? undefined : valueAt(shipped, path);
    return [
      {
        path,
        key,
        value,
        ...(typeof original === 'string' && original !== value ? { original } : {}),
      },
    ];
  });
}

function listAt(template: Template | undefined, path: Path): Value[] {
  const found = template === undefined ? undefined : valueAt(template, path);
  return Array.isArray(found) ? found : [];
}

function merged(present: readonly string[], shipped: readonly string[]): string[] {
  const order = [...present];
  for (const [index, id] of shipped.entries()) {
    if (order.includes(id)) {
      continue;
    }
    const before = shipped
      .slice(0, index)
      .toReversed()
      .find((earlier) => order.includes(earlier));
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, id);
  }
  return order;
}

function rowOf(
  part: Part,
  group: string,
  depth: number,
  switchable: boolean,
  shipped: Template | undefined,
): SimpleRow {
  return {
    path: part.path,
    group,
    label: words(part.label),
    depth,
    switchable,
    on: true,
    condition: part.badges.length === 0 ? undefined : part.badges.join(' and '),
    looks: looksOf(part, shipped),
  };
}

type Kept = ReadonlyMap<string, KeptPart>;

const keyOf = (path: Path): string => path.join('/');

function groupsOf(part: Part, shipped: Template | undefined, kept: Kept): Group[] {
  const groups = [...part.groups];
  const has = (path: Path): boolean => groups.some((group) => keyOf(group.path) === keyOf(path));
  const original = shipped === undefined ? undefined : valueAt(shipped, part.path);
  if (isMapping(original)) {
    for (const group of partOf(original, part.path, part.shape, 0).groups) {
      if (group.list && !has(group.path)) {
        groups.push({ ...group, parts: [] });
      }
    }
  }
  for (const where of kept.keys()) {
    const path = where.split('/');
    const list = path.slice(0, -1);
    const key = list.at(-1);
    if (key !== undefined && keyOf(list.slice(0, -1)) === keyOf(part.path) && !has(list)) {
      groups.push({
        key,
        label: key.endsWith('?') ? key.slice(0, -1) : key,
        path: list,
        of: undefined,
        cards: true,
        list: true,
        parts: [],
      });
    }
  }
  return groups;
}

function walk(
  part: Part,
  shipped: Template | undefined,
  kept: Kept,
  group: string,
  depth: number,
  switchable: boolean,
  out: SimpleRow[],
): void {
  out.push(rowOf(part, group, depth, switchable, shipped));
  for (const inner of groupsOf(part, shipped, kept)) {
    if (!inner.list) {
      for (const each of inner.parts) {
        walk(each, shipped, kept, inner.label, depth + 1, false, out);
      }
      continue;
    }
    const present = new Map(inner.parts.map((each) => [each.path.at(-1) ?? '', each]));
    const original = listAt(shipped, inner.path);
    const ids = original.flatMap((item) => {
      const id = idOf(item);
      return id === undefined ? [] : [`#${id}`];
    });
    const order = merged([...present.keys()], ids);
    for (const [where, entry] of kept) {
      const path = where.split('/');
      const segment = path.at(-1) ?? '';
      if (keyOf(path.slice(0, -1)) !== keyOf(inner.path) || order.includes(segment)) {
        continue;
      }
      const after = entry.after === undefined ? -1 : order.indexOf(`#${entry.after}`);
      order.splice(after === -1 ? order.length : after + 1, 0, segment);
    }
    for (const segment of order) {
      const here = present.get(segment);
      if (here !== undefined) {
        walk(here, shipped, kept, inner.label, depth + 1, true, out);
        continue;
      }
      const item =
        kept.get(keyOf([...inner.path, segment]))?.value ??
        original.find((each) => `#${idOf(each) ?? ''}` === segment);
      if (isMapping(item)) {
        const gone = partOf(item, [...inner.path, segment], inner.of, 0);
        out.push({ ...rowOf(gone, inner.label, depth + 1, true, shipped), on: false, looks: [] });
      }
    }
  }
}

export function simpleOf(
  template: Template,
  shipped: Template | undefined,
  kept: Kept = new Map(),
): SimpleRow[] {
  const card = template.card;
  const rows: SimpleRow[] = [];
  walk(
    partOf(isMapping(card) ? card : {}, ['card'], undefined, 0),
    shipped,
    kept,
    'Card',
    0,
    false,
    rows,
  );
  return rows;
}

export function switchedOff(template: Template, path: Path): Template {
  return withValue(template, path, undefined);
}

export function switchedOn(
  template: Template,
  shipped: Template | undefined,
  path: Path,
  kept: KeptPart | undefined,
): Template {
  const listPath = path.slice(0, -1);
  const segment = path.at(-1) ?? '';
  const value = kept?.value ?? (shipped === undefined ? undefined : valueAt(shipped, path));
  if (value === undefined) {
    return template;
  }
  const list = listAt(template, listPath);
  const ids = list.map((item) => idOf(item));
  let after = kept?.after !== undefined && ids.includes(kept.after) ? kept.after : undefined;
  if (after === undefined && shipped !== undefined) {
    const original = listAt(shipped, listPath).map((item) => idOf(item));
    const index = original.indexOf(segment.slice(1));
    after = original
      .slice(0, Math.max(index, 0))
      .toReversed()
      .find((earlier) => earlier !== undefined && ids.includes(earlier));
  }
  return withValue(
    template,
    listPath,
    inserted(list, value, after === undefined ? -1 : ids.indexOf(after)),
  );
}

export function keptPart(template: Template, path: Path): KeptPart {
  const list = listAt(template, path.slice(0, -1));
  const index = list.findIndex((item) => `#${idOf(item) ?? ''}` === path.at(-1));
  const before = index > 0 ? list[index - 1] : undefined;
  return { value: valueAt(template, path), after: before === undefined ? undefined : idOf(before) };
}

export interface SimpleActions {
  toggle: (row: SimpleRow, on: boolean) => void;
  look: (look: SimpleLook, value: string) => void;
}

const changed = (event: Event): string => {
  const value = field(event.target, 'value');
  return typeof value === 'string' ? value : '';
};

function drawLook(
  look: SimpleLook,
  of: string,
  actions: SimpleActions,
  hass: HomeAssistant | undefined,
): TemplateResult {
  const where = look.path.join('/');
  const label = `${of}: ${look.key === 'color' ? 'colour' : look.key === 'icon' ? 'icon' : look.key}`;
  if (look.key === 'color') {
    const options = [
      ...new Set([look.value, ...(look.original === undefined ? [] : [look.original]), ...COLORS]),
    ];
    return html`<select
      class="area-picker"
      aria-label=${label}
      data-path=${where}
      .value=${live(look.value)}
      @change=${(event: Event) => {
        actions.look(look, changed(event));
      }}
    >
      ${options.map(
        (option) =>
          html`<option value=${option} ?selected=${option === look.value}>${option}</option>`,
      )}
    </select>`;
  }
  if (look.key === 'icon' && customElements.get('ha-icon-picker') !== undefined) {
    return html`<ha-icon-picker
      class="simple-picker"
      aria-label=${label}
      data-path=${where}
      .hass=${hass}
      .value=${live(look.value)}
      @value-changed=${(event: Event) => {
        const value = field(field(event, 'detail'), 'value');
        actions.look(look, typeof value === 'string' ? value : '');
      }}
    ></ha-icon-picker>`;
  }
  return html`<span class="simple-look">
    ${look.key === 'icon' && look.value.startsWith('mdi:') ? html`<ha-icon .icon=${look.value}></ha-icon>` : nothing}
    <input
      class="fact-input"
      aria-label=${label}
      data-path=${where}
      .value=${live(look.value)}
      @change=${(event: Event) => {
        actions.look(look, changed(event).trim());
      }}
    />
  </span>`;
}

export function drawSimple(
  rows: readonly SimpleRow[],
  actions: SimpleActions,
  hass?: HomeAssistant,
): TemplateResult {
  return html`<div class="simple">
    <p class="muted">
      What changes here changes this template everywhere it is used. A card's own entities and names
      are set in
      <a href=${EDITOR_DOCS} target="_blank" rel="noreferrer">its editor</a>.
    </p>
    ${rows.map(
      (row, index) => html`${
          row.depth > 0 && row.group !== rows[index - 1]?.group
            ? html`<div class="simple-group" style=${styleMap({ '--depth': String(row.depth) })}>
                ${row.group}
              </div>`
            : nothing
        }
        <div
          class=${classMap({ 'simple-row': true, off: !row.on })}
          style=${styleMap({ '--depth': String(row.depth) })}
        >
          ${
            row.switchable
              ? html`<input
                  type="checkbox"
                  aria-label=${`Show ${row.label}`}
                  data-path=${row.path.join('/')}
                  .checked=${live(row.on)}
                  @change=${(event: Event) => {
                    actions.toggle(row, field(event.target, 'checked') === true);
                  }}
                />`
              : html`<span class="simple-spacer"></span>`
          }
          <span class="simple-words">
            <span>${row.label}</span>
            ${row.condition === undefined ? nothing : html`<span class="muted">${row.condition}</span>`}
          </span>
          ${row.on ? row.looks.map((look) => drawLook(look, row.label, actions, hass)) : nothing}
        </div>`,
    )}
  </div>`;
}
