import { html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import { isMapping } from '../contract/templates.ts';
import type { Template, Templates, Value } from '../contract/templates.ts';
import { objectForm } from '../editors/draw.ts';
import type { Context } from '../editors/draw.ts';
import { rowMenu } from '../editors/row-menu.ts';
import { slotsShape } from '../editors/slots.ts';
import { EDITOR_STYLE } from '../editors/style.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import { applyChanges, changesOf, nodeHash } from '../templates/changes.ts';
import type { Change } from '../templates/changes.ts';
import { toValue } from '../templates/expand.ts';

import { problemOf } from './check.ts';
import type { Clash, Draft, Kept } from './data.ts';
import { drawInspector } from './inspector.ts';
import { drawOutline, groupOf, partOf } from './outline.ts';
import type { Group, OutlineActions, Part, Starter } from './outline.ts';
import { trialOf, tryDraft } from './preview.ts';
import type { Area, Trial } from './preview.ts';
import { drawSlots } from './slots-tab.ts';
import { PANEL_STYLE } from './style.ts';
import { adoptIds, inserted, moved, uniqueId, valueAt, withValue } from './tree.ts';
import type { Path } from './tree.ts';

export type Entry =
  | { kind: 'own'; template: Template; changes?: never }
  | { kind: 'changes'; template?: never; changes: Change[] };

export interface BuilderHost {
  templates: () => Templates;
  areas: () => readonly Area[];
  save: (name: string, entry: Entry | undefined) => Promise<void>;
  leave: () => void;
  history: (name: string) => Promise<Entry | undefined>;
  duplicate: (name: string, template: Template) => void;
  exportOne: (name: string, template: Template) => void;
}

type Tab = 'card' | 'popups' | 'slots' | 'yaml';
type Pane = 'outline' | 'preview' | 'inspector';

const TABS: readonly { tab: Tab; label: string }[] = [
  { tab: 'card', label: 'Card' },
  { tab: 'popups', label: 'Pop-ups' },
  { tab: 'slots', label: 'Slots' },
  { tab: 'yaml', label: 'YAML' },
];

const PANES: readonly { pane: Pane; label: string }[] = [
  { pane: 'outline', label: 'Outline' },
  { pane: 'preview', label: 'Preview' },
  { pane: 'inspector', label: 'Inspector' },
];

const keyOf = (path: Path): string => path.join('/');

function partKey(path: Path): string {
  const last = path.findLastIndex((segment) => segment.startsWith('#'));
  return last === -1 ? (path[0] ?? '') : keyOf(path.slice(0, last + 1));
}

export function changedParts(changes: readonly Change[]): Set<string> {
  const keys = new Set<string>();
  for (const change of changes) {
    if (change.op === 'insert') {
      const id =
        isMapping(change.value) && typeof change.value['id'] === 'string'
          ? change.value['id']
          : undefined;
      keys.add(id === undefined ? partKey(change.path) : keyOf([...change.path, `#${id}`]));
    } else if (change.op === 'move') {
      keys.add(keyOf([...change.path, `#${change.id}`]));
    } else if (change.op === 'remove') {
      keys.add(partKey(change.path.slice(0, -1)));
    } else {
      keys.add(partKey(change.path));
    }
  }
  return keys;
}

export function roundTrips(
  entry: Entry | undefined,
  draft: Template,
  shipped: Template | undefined,
): boolean {
  if (shipped === undefined || entry?.kind === 'own') {
    return true;
  }
  const kept = entry === undefined ? shipped : applyChanges(shipped, entry.changes).template;
  return nodeHash(toValue(kept)) === nodeHash(toValue(draft));
}

export function storedAs(entry: Entry | undefined, kept: Kept, name: string): boolean {
  const own = kept.own[name];
  const changes = kept.changes[name];
  if (entry === undefined) {
    return own === undefined && changes === undefined;
  }
  return entry.kind === 'own'
    ? own !== undefined && nodeHash(toValue(own)) === nodeHash(toValue(entry.template))
    : changes !== undefined && nodeHash(toValue(changes)) === nodeHash(toValue(entry.changes));
}

export function entryOf(draft: Template, shipped: Template | undefined): Entry | undefined {
  if (shipped === undefined) {
    return { kind: 'own', template: draft };
  }
  const changes = changesOf(shipped, draft);
  return changes.length === 0 ? undefined : { kind: 'changes', changes };
}

function idFor(starter: Starter): string {
  const type = starter.value['type'];
  const template = starter.value['template'];
  if (typeof type === 'string' && type !== '') {
    return type.replace(/^custom:mnml-/, '').replace(/-card$/, '');
  }
  return typeof template === 'string' && template !== '' ? template : 'part';
}

function describeClash(clash: Clash): string {
  const where = clash.change.path.join(' / ') || 'the template';
  const what =
    clash.change.op === 'set'
      ? `${clash.change.key} at ${where}`
      : `${clash.change.op} at ${where}`;
  if (clash.reason === 'gone') {
    return `${what}: this part is gone from the shipped template, so the change is left out`;
  }
  return clash.reason === 'taken'
    ? `${what}: the shipped template has a part of this id now, so yours is left out`
    : `${what}: the shipped template changed here since; your change still applies`;
}

function findPart(root: Part, key: string): Part | undefined {
  if (keyOf(root.path) === key) {
    return root;
  }
  for (const group of root.groups) {
    for (const inner of group.parts) {
      const found = findPart(inner, key);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

const EMPTY: Template = { card: {} };
const PREVIEW_DELAY = 300;
const FED = 'ha-form, mnml-preview, mnml-binder, mnml-yaml';

export class MnmlBuilder extends LitElement {
  static override styles = [BASE_STYLE, CONTROL_STYLE, EDITOR_STYLE, PANEL_STYLE];

  @property({ attribute: false }) host: BuilderHost | undefined;
  @property({ attribute: false }) draft: Draft | undefined;
  @property({ attribute: false }) narrow = false;
  @state() private template: Template = EMPTY;
  @state() private shown: Template = EMPTY;
  @state() private tab: Tab = 'card';
  @state() private pane: Pane = 'outline';
  @state() private selected = 'card';
  @state() private area: string | undefined;
  @state() private problem: string | undefined;
  @state() private saving = false;
  private saved: Template = EMPTY;
  private start = '';
  private undos: Template[] = [];
  private redos: Template[] = [];
  private unsaved = false;
  private clashes: readonly Clash[] = [];
  private readonly open = new Map<string, boolean>();
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private trial: (() => Trial) | undefined;
  private changes: Change[] | undefined;
  private current: HomeAssistant | undefined;

  get hass(): HomeAssistant | undefined {
    return this.current;
  }

  set hass(hass: HomeAssistant | undefined) {
    const first = this.current === undefined;
    this.current = hass;
    if (first || this.renderRoot === undefined) {
      this.requestUpdate();
      return;
    }
    for (const element of this.renderRoot.querySelectorAll(FED)) {
      Reflect.set(element, 'hass', hass);
    }
  }

  get name(): string {
    return this.draft?.name ?? '';
  }

  dirty(): boolean {
    return this.unsaved || this.clashes.length > 0 || JSON.stringify(this.template) !== this.start;
  }

  readonly guard = (event: BeforeUnloadEvent): void => {
    if (this.dirty()) {
      event.preventDefault();
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('beforeunload', this.guard);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('beforeunload', this.guard);
    clearTimeout(this.previewTimer);
  }

  protected override willUpdate(changed: PropertyValues): void {
    const draft = this.draft;
    if (changed.has('draft') && draft !== undefined) {
      this.unsaved = draft.fresh === true;
      this.clashes = draft.conflicts;
      this.saved = adoptIds(draft.template, draft.shipped);
      this.start = JSON.stringify(this.saved);
      this.template = this.saved;
      this.shown = this.saved;
      this.undos = [];
      this.redos = [];
      this.problem = undefined;
      this.tab = 'card';
      this.pane = 'outline';
      this.selected = 'card';
      this.area = undefined;
      this.open.clear();
    }
    if (changed.has('template')) {
      this.changes =
        draft?.shipped === undefined ? undefined : changesOf(draft.shipped, this.template);
    }
    if (changed.has('shown') || changed.has('area') || changed.has('draft')) {
      const shown = this.shown;
      const area = this.area;
      this.trial = () =>
        tryDraft(this.host?.templates() ?? {}, this.name, shown, trialOf(shown, area), this.hass);
    }
  }

  private edit(next: Template, redraw: boolean): void {
    if (JSON.stringify(next) === JSON.stringify(this.template)) {
      return;
    }
    this.undos.push(this.template);
    this.redos = [];
    this.template = next;
    this.problem = undefined;
    clearTimeout(this.previewTimer);
    if (redraw) {
      this.shown = next;
    } else {
      this.previewTimer = setTimeout(() => {
        this.shown = this.template;
      }, PREVIEW_DELAY);
    }
  }

  private replace(next: Template): void {
    this.edit(next, true);
  }

  private undo(): void {
    const last = this.undos.pop();
    if (last !== undefined) {
      this.redos.push(this.template);
      this.template = last;
      this.shown = last;
    }
  }

  private redo(): void {
    const next = this.redos.pop();
    if (next !== undefined) {
      this.undos.push(this.template);
      this.template = next;
      this.shown = next;
    }
  }

  private async save(): Promise<void> {
    const host = this.host;
    if (host === undefined) {
      return;
    }
    const problem = problemOf(host.templates(), this.name, this.template);
    if (problem !== undefined) {
      this.problem = problem;
      return;
    }
    const entry = entryOf(this.template, this.draft?.shipped);
    if (!roundTrips(entry, this.template, this.draft?.shipped)) {
      this.problem =
        'This draft cannot be kept as changes to the shipped template: check that no two parts of a list share an id.';
      return;
    }
    this.saving = true;
    try {
      await host.save(this.name, entry);
      this.undos = [];
      this.redos = [];
      this.saved = this.template;
      this.start = JSON.stringify(this.template);
      this.unsaved = false;
      this.clashes = [];
      this.problem = undefined;
    } catch (error) {
      this.problem = `Not saved: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      this.saving = false;
    }
  }

  leave(): void {
    if (!this.dirty() || window.confirm('Leave without saving your changes?')) {
      this.host?.leave();
    }
  }

  private discardable(): boolean {
    return (
      (this.draft?.fresh === true && this.unsaved) || JSON.stringify(this.template) !== this.start
    );
  }

  private discard(): void {
    if (this.draft?.fresh === true && this.unsaved) {
      this.host?.leave();
      return;
    }
    this.replace(this.saved);
  }

  private async restore(): Promise<void> {
    const entry = await this.host?.history(this.name);
    const shipped = this.draft?.shipped;
    if (entry?.kind === 'own') {
      this.replace(adoptIds(entry.template, shipped));
    } else if (entry?.kind === 'changes' && shipped !== undefined) {
      this.replace(adoptIds(applyChanges(shipped, entry.changes).template, shipped));
    }
  }

  private drawHead(): TemplateResult {
    const count = this.changes?.length;
    const shipped = this.draft?.shipped;
    const dirty = this.dirty();
    return html`<div class="builder-head">
      <button
        type="button"
        class="icon-button"
        aria-label="Back to the library"
        title="Back to the library"
        @click=${() => {
          this.leave();
        }}
      >
        ${icon('mdi:arrow-left')}
      </button>
      <div class="builder-title">
        <h1>${this.name}</h1>
        <span class="muted"
          >${
            count === undefined
              ? 'your template'
              : count === 0
                ? 'as shipped'
                : `${count} ${count === 1 ? 'change' : 'changes'} to the shipped template`
          }</span
        >
      </div>
      <button
        type="button"
        class="icon-button"
        aria-label="Undo"
        title="Undo"
        ?disabled=${this.undos.length === 0}
        @click=${() => {
          this.undo();
        }}
      >
        ${icon('mdi:undo')}
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label="Redo"
        title="Redo"
        ?disabled=${this.redos.length === 0}
        @click=${() => {
          this.redo();
        }}
      >
        ${icon('mdi:redo')}
      </button>
      ${rowMenu(this.name, [
        {
          label: 'Discard the changes',
          icon: 'mdi:close-circle-outline',
          disabled: this.discardable() ? undefined : true,
          run: () => {
            this.discard();
          },
        },
        ...(shipped === undefined
          ? []
          : [
              {
                label: 'Reset to shipped',
                icon: 'mdi:restore' as const,
                disabled: count === 0 ? (true as const) : undefined,
                run: () => {
                  this.replace(adoptIds(shipped, shipped));
                },
              },
            ]),
        {
          label: 'History',
          icon: 'mdi:history',
          run: () => {
            void this.restore();
          },
        },
        {
          label: 'Duplicate',
          icon: 'mdi:content-copy',
          run: () => {
            this.host?.duplicate(this.name, this.template);
          },
        },
        {
          label: 'Export',
          icon: 'mdi:export-variant',
          run: () => {
            this.host?.exportOne(this.name, this.template);
          },
        },
      ])}
      <button
        type="button"
        class="action primary"
        aria-label="Save"
        title="Save"
        ?disabled=${this.saving || !dirty}
        @click=${() => {
          void this.save();
        }}
      >
        ${this.saving ? 'Saving...' : 'Save'}
      </button>
    </div>`;
  }

  private drawTabs(): TemplateResult {
    return html`<div class="tabs" role="tablist">
      ${TABS.map(
        ({ tab, label }) =>
          html`<button
            type="button"
            class=${classMap({ tab: true, active: tab === this.tab })}
            role="tab"
            aria-selected=${tab === this.tab}
            @click=${() => {
              this.tab = tab;
              this.selected = tab === 'popups' ? '' : 'card';
            }}
          >
            ${label}
          </button>`,
      )}
    </div>`;
  }

  private drawPanes(): TemplateResult {
    return html`<div class="tabs panes">
      ${PANES.map(
        ({ pane, label }) =>
          html`<button
            type="button"
            class=${classMap({ tab: true, active: pane === this.pane })}
            aria-pressed=${pane === this.pane}
            @click=${() => {
              this.pane = pane;
            }}
          >
            ${label}
          </button>`,
      )}
    </div>`;
  }

  private root(): Part | Group {
    if (this.tab === 'popups') {
      return groupOf(this.template.popups ?? [], ['popups'], 'popups');
    }
    const card = this.template.card;
    return partOf(isMapping(card) ? card : {}, ['card'], undefined, 0);
  }

  private listAt(path: Path): Value[] {
    const found =
      path.length === 1 && path[0] === 'popups'
        ? (this.template.popups ?? [])
        : valueAt(this.template, path);
    return Array.isArray(found) ? found : [];
  }

  private outlineActions(): OutlineActions {
    return {
      selected: this.selected,
      changed: this.changes === undefined ? new Set() : changedParts(this.changes),
      conflicted: changedParts(this.clashes.map((clash) => clash.change)),
      select: (path): void => {
        this.selected = keyOf(path);
        if (this.narrow) {
          this.pane = 'inspector';
        }
      },
      add: (group, starter): void => {
        const list = this.listAt(group.path);
        const id = uniqueId(list, idFor(starter));
        this.selected = keyOf([...group.path, `#${id}`]);
        this.replace(withValue(this.template, group.path, [...list, { id, ...starter.value }]));
      },
      duplicate: (part): void => {
        const listPath = part.path.slice(0, -1);
        const list = this.listAt(listPath);
        const index = list.findIndex(
          (item) =>
            isMapping(item) &&
            `#${typeof item['id'] === 'string' ? item['id'] : ''}` === part.path.at(-1),
        );
        const own = part.value['id'];
        const id = uniqueId(list, typeof own === 'string' ? own : 'part');
        this.replace(
          withValue(
            this.template,
            listPath,
            inserted(list, { ...structuredClone(part.value), id }, index),
          ),
        );
      },
      remove: (part): void => {
        if (keyOf(part.path) === this.selected) {
          this.selected = '';
        }
        this.replace(withValue(this.template, part.path, undefined));
      },
      move: (group, from, to): void => {
        this.replace(
          withValue(this.template, group.path, moved(this.listAt(group.path), from, to)),
        );
      },
    };
  }

  private selectedPart(root: Part | Group): Part | undefined {
    for (const part of 'groups' in root ? [root] : root.parts) {
      const found = findPart(part, this.selected);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  private drawConflicts(): TemplateResult | typeof nothing {
    if (this.clashes.length === 0) {
      return nothing;
    }
    return html`<div class="conflicts">
      <strong>A release changed this template under your changes</strong>
      <ul>
        ${this.clashes.map((clash) => html`<li>${describeClash(clash)}</li>`)}
      </ul>
      <p class="muted">Saving keeps the changes that still apply.</p>
    </div>`;
  }

  private readonly redraw = (): void => {
    this.requestUpdate();
  };

  private drawWork(): TemplateResult {
    const hass = this.hass;
    if (this.tab === 'slots') {
      const context: Context = { hass, hashes: [], open: this.open, redraw: this.redraw };
      return html`${drawSlots(() => this.template, {
          hass,
          open: this.open,
          areas: this.host?.areas() ?? [],
          shipped: this.draft?.shipped,
          update: (next, redraw): void => {
            this.edit(next, redraw);
          },
          redraw: this.redraw,
        })}
        <div class="example">
          <h2>Example values</h2>
          <p class="muted">They fill the slots for the preview, and for the check on save.</p>
          ${objectForm(
            slotsShape(this.template.slots ?? {}, this.name, 'Example'),
            {
              get: (): Record<string, Value> => this.template.example ?? {},
              set: (next, redraw): void => {
                this.edit({ ...this.template, example: next }, redraw);
              },
            },
            context,
            'example',
            false,
          )}
        </div>`;
    }
    if (this.tab === 'yaml') {
      return html`<mnml-yaml
        .hass=${hass}
        .template=${this.template}
        .apply=${(template: Template) => {
          this.replace(adoptIds(template, this.draft?.shipped));
        }}
      ></mnml-yaml>`;
    }
    const root = this.root();
    return html`<div
      class=${classMap({ work: true, narrow: this.narrow, [`show-${this.pane}`]: this.narrow })}
    >
      <div class="pane outline-pane">${drawOutline(root, this.outlineActions())}</div>
      <div class="pane preview-pane">
        <mnml-preview
          .hass=${hass}
          .trial=${this.trial}
          .areas=${this.host?.areas() ?? []}
          .area=${this.area}
          .choose=${(area: string | undefined) => {
            this.area = area;
          }}
        ></mnml-preview>
      </div>
      <div class="pane inspector-pane">
        ${drawInspector(this.selectedPart(root), {
          hass,
          open: this.open,
          template: this.template,
          templates: this.host?.templates() ?? {},
          value: (path): Record<string, Value> => {
            const found = valueAt(this.template, path);
            return isMapping(found) ? found : {};
          },
          update: (path, next, redraw): void => {
            this.edit(withValue(this.template, path, next), redraw);
          },
          redraw: this.redraw,
        })}
      </div>
    </div>`;
  }

  protected override render(): TemplateResult {
    let work: TemplateResult;
    try {
      work = this.drawWork();
    } catch (error) {
      work = html`<div class="problem">
        ${icon('mdi:alert-circle-outline')}<span
          >The panel could not draw this:
          ${error instanceof Error ? error.message : String(error)}</span
        >
      </div>`;
    }
    return html`<div class="builder">
      ${this.drawHead()} ${this.drawConflicts()}
      ${
        this.problem === undefined
          ? nothing
          : html`<div class="problem">
              ${icon('mdi:alert-circle-outline')}<span>${this.problem}</span>
            </div>`
      }
      ${this.drawTabs()}
      ${this.narrow && (this.tab === 'card' || this.tab === 'popups') ? this.drawPanes() : nothing}
      ${work}
    </div>`;
  }
}
