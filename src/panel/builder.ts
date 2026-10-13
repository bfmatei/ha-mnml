import { css, html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { BASE_STYLE, CONTROL_STYLE } from '../cards/styles.ts';
import { isMapping } from '../contract/templates.ts';
import type { Template, Templates, Value, WrittenTemplate } from '../contract/templates.ts';
import { objectForm } from '../editors/draw.ts';
import type { Context } from '../editors/draw.ts';
import { rowMenu } from '../editors/row-menu.ts';
import { slotsShape } from '../editors/slots.ts';
import { EDITOR_STYLE } from '../editors/style.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { registriesOf } from '../ha/registries.ts';
import { icon } from '../ha/templates.ts';
import { applyChanges, changesOf } from '../templates/changes.ts';
import type { Change } from '../templates/changes.ts';
import { discover } from '../templates/discover.ts';

import {
  automateField,
  dataFields,
  fixField,
  resolvedEntity,
  setLiteral,
  setPreview,
} from './binding.ts';
import { problemOf } from './check.ts';
import { CONFLICTS_STYLE, drawConflicts } from './conflicts.ts';
import { entryOf, readableOf, roundTrips } from './data.ts';
import type { Clash, Draft, Entry } from './data.ts';
import { detachedOf, withDetached } from './detached.ts';
import { drawInspector, INSPECTOR_STYLE, withCondition } from './inspector.ts';
import { messageOf } from './message.ts';
import {
  OUTLINE_STYLE,
  chainTo,
  changedParts,
  drawOutline,
  groupOf,
  partOf,
  singlesOf,
} from './outline.ts';
import type { Group, OutlineActions, Part, Starter } from './outline.ts';
import { keepPicks, picksOf } from './picks.ts';
import { richestArea, tryDraft } from './preview.ts';
import type { Area, Trial, TrialOn } from './preview.ts';
import { keptPart, simpleOf, switchedOff, switchedOn } from './simple.ts';
import type { KeptPart, SimpleActions } from './simple.ts';
import { drawSlots, SLOTS_STYLE } from './slots-tab.ts';
import { drawStagePanel, groupOfPart, STAGE_STYLE, titleOf } from './stage-panel.ts';
import { drawStarters, STARTERS_STYLE } from './starters.ts';
import { PANEL_STYLE } from './style.ts';
import { adoptIds, inserted, listAt, movedTo, uniqueId, valueAt, withValue } from './tree.ts';
import type { Path } from './tree.ts';

export interface BuilderHost {
  templates: () => Templates;
  areas: () => readonly Area[];
  save: (name: string, entry: Entry | undefined) => Promise<void>;
  leave: () => void;
  history: (name: string) => Promise<Entry | undefined>;
  duplicate: (name: string, template: WrittenTemplate) => void;
  exportOne: (name: string, template: WrittenTemplate) => void;
  open: (name: string) => void;
}

type Tab = 'design' | 'card' | 'popups' | 'slots' | 'yaml';
type Pane = 'outline' | 'preview' | 'inspector';

const TABS: readonly { tab: Tab; label: string }[] = [
  { tab: 'design', label: 'Design' },
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

function idFor(starter: Starter): string {
  const type = starter.value['type'];
  const template = starter.value['template'];
  if (typeof type === 'string' && type !== '') {
    return type.replace(/^custom:mnml-/, '').replace(/-card$/, '');
  }
  return typeof template === 'string' && template !== '' ? template : 'part';
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

const EMPTY: WrittenTemplate = { card: {} };

const PREVIEW_DELAY = 300;
const FED = 'ha-form, mnml-preview, mnml-binder, mnml-yaml';

const BUILDER_STYLE = css`
  .builder {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .builder-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--divider-color);
  }
  .builder-title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .builder-title h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 400;
    font-family: var(--ha-font-family-code, monospace);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .builder-title .muted {
    font-size: 12px;
  }
  .panes {
    padding-top: 0;
  }
  .work {
    display: grid;
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr) minmax(300px, 380px);
    flex: 1;
    min-height: 0;
  }
  .pane {
    overflow: auto;
    padding: 12px;
    box-sizing: border-box;
    max-height: calc(100vh - 170px);
  }
  .outline-pane {
    border-right: 1px solid var(--divider-color);
  }
  .inspector-pane {
    border-left: 1px solid var(--divider-color);
  }
  .work.narrow {
    display: block;
  }
  .work.narrow .pane {
    display: none;
    max-height: none;
    border: none;
  }
  .work.narrow.show-outline .outline-pane,
  .work.narrow.show-preview .preview-pane,
  .work.narrow.show-inspector .inspector-pane {
    display: block;
  }
  .design {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: start;
  }
  .design.narrow {
    grid-template-columns: minmax(0, 1fr);
  }
  .design-stage {
    min-width: 0;
    padding: 16px;
  }
  .design-panel {
    box-sizing: border-box;
    border-left: 1px solid var(--divider-color);
    padding: 16px;
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow: auto;
  }
  .design.narrow .design-panel {
    position: static;
    max-height: none;
    border-left: none;
    border-top: 1px solid var(--divider-color);
  }
  .tab.more {
    margin-left: auto;
    color: var(--secondary-text-color);
  }
  .example {
    padding: 0 16px 16px;
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .example h2 {
    margin: 8px 0 0;
    font-size: 18px;
    font-weight: 500;
  }
  .example p {
    margin: 0;
  }
  @media (max-width: 600px) {
    .builder-head {
      padding: 6px 8px;
    }
    .pane {
      padding: 12px 8px;
    }
  }
`;

export class MnmlBuilder extends LitElement {
  static override styles = [
    BASE_STYLE,
    CONTROL_STYLE,
    EDITOR_STYLE,
    PANEL_STYLE,
    BUILDER_STYLE,
    CONFLICTS_STYLE,
    OUTLINE_STYLE,
    INSPECTOR_STYLE,
    STARTERS_STYLE,
    STAGE_STYLE,
    SLOTS_STYLE,
  ];

  @property({ attribute: false }) host: BuilderHost | undefined;
  @property({ attribute: false }) draft: Draft | undefined;
  @property({ attribute: false }) narrow = false;
  @state() private template: WrittenTemplate = EMPTY;
  @state() private shown: WrittenTemplate = EMPTY;
  @state() private tab: Tab = 'design';
  @state() private view = 'card';
  @state() private advanced = false;
  @state() private chosen = false;
  @state() private pane: Pane = 'outline';
  @state() private selected = 'card';
  @state() private area: string | undefined;
  @state() private problem: string | undefined;
  @state() private saving = false;
  private saved: WrittenTemplate = EMPTY;
  private chose = false;
  private picked = new Set<string>();
  private start = '';
  private undos: WrittenTemplate[] = [];
  private redos: WrittenTemplate[] = [];
  private unsaved = false;
  private clashes: readonly Clash[] = [];
  private readonly open = new Map<string, boolean>();
  private readonly kept = new Map<string, KeptPart>();
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private trial: (() => Trial) | undefined;
  private changes: Change[] | undefined;
  private current: HomeAssistant | undefined;
  private read: { of: WrittenTemplate; as: Template } | undefined;

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
      this.tab = 'design';
      this.view = 'card';
      this.kept.clear();
      this.pane = 'outline';
      this.selected = '';
      this.area = undefined;
      this.chose = false;
      this.chosen = false;
      this.picked = new Set(picksOf(draft.name));
      this.open.clear();
    }
    if (
      !this.chose &&
      this.tab === 'design' &&
      this.hass !== undefined &&
      this.host !== undefined
    ) {
      this.chose = true;
      if (this.area === undefined) {
        this.area = richestArea(
          this.host.templates(),
          this.name,
          this.readable(),
          this.host.areas(),
          this.hass,
        );
      }
    }
    if (changed.has('template')) {
      this.changes =
        draft?.shipped === undefined ? undefined : changesOf(draft.shipped, this.readable());
    }
    if (
      changed.has('shown') ||
      changed.has('area') ||
      changed.has('draft') ||
      (changed.has('tab') && (this.tab === 'design' || changed.get('tab') === 'design'))
    ) {
      const shown = this.shown;
      const area = this.area;
      const marking = this.tab === 'design' ? this.marking(shown) : undefined;
      this.trial = () =>
        tryDraft(
          this.host?.templates() ?? {},
          this.name,
          shown,
          this.onTrial(shown, area),
          this.hass,
          marking,
        );
    }
  }

  private onTrial(template: WrittenTemplate, area: string | undefined): TrialOn {
    const example = template.example ?? {};
    if (area === undefined) {
      return { slots: example };
    }
    return {
      area,
      slots: Object.fromEntries(
        [...this.picked].flatMap((slot) =>
          example[slot] === undefined ? [] : [[slot, example[slot]]],
        ),
      ),
    };
  }

  private previewValues(): Record<string, Value> {
    const on = this.onTrial(this.template, this.area);
    const hass = this.hass;
    const found =
      this.area === undefined || hass === undefined
        ? {}
        : discover(this.readable(), this.area, registriesOf(hass));
    return { ...found, ...on.slots };
  }

  private readable(): Template {
    if (this.read?.of !== this.template) {
      this.read = { of: this.template, as: readableOf(this.name, this.template) };
    }
    return this.read.as;
  }

  private marking(template: WrittenTemplate): { singles: Set<string> } {
    const card = template.card;
    const singles = singlesOf(partOf(isMapping(card) ? card : {}, ['card'], undefined, 0));
    for (const only of singlesOf(groupOf(template.popups ?? [], ['popups'], 'popups'))) {
      singles.add(only);
    }
    return { singles };
  }

  private edit(next: WrittenTemplate, redraw: boolean): void {
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

  private replace(next: WrittenTemplate): void {
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
    const template = this.template;
    const problem = problemOf(host.templates(), this.name, template);
    if (problem !== undefined) {
      this.problem = problem;
      return;
    }
    const entry = entryOf(this.name, template, this.draft?.shipped);
    if (!roundTrips(this.name, entry, template, this.draft?.shipped)) {
      this.problem =
        'This draft cannot be kept as changes to the shipped template: check that no two parts of a list share an id.';
      return;
    }
    this.saving = true;
    try {
      await host.save(this.name, entry);
      if (this.template === template) {
        this.undos = [];
        this.redos = [];
      }
      this.saved = template;
      this.start = JSON.stringify(template);
      this.unsaved = false;
      this.clashes = [];
      this.problem = undefined;
    } catch (error) {
      this.problem = `Not saved: ${messageOf(error)}`;
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
    const open = this.advanced || this.tab !== 'design';
    return html`<div class="tabs" role="tablist">
      ${(open ? TABS : TABS.slice(0, 1)).map(
        ({ tab, label }) =>
          html`<button
            type="button"
            class=${classMap({ tab: true, active: tab === this.tab })}
            role="tab"
            aria-selected=${tab === this.tab}
            @click=${() => {
              this.tab = tab;
              this.selected = tab === 'popups' || tab === 'design' ? '' : 'card';
            }}
          >
            ${label}
          </button>`,
      )}
      ${
        this.tab === 'design'
          ? html`<button
              type="button"
              class=${classMap({ tab: true, more: true })}
              aria-expanded=${open}
              @click=${() => {
                this.advanced = !this.advanced;
              }}
            >
              ${open ? 'Fewer tools' : 'More tools'}
            </button>`
          : nothing
      }
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

  private sheet(): boolean {
    const card = this.template.card;
    return isMapping(card) && card['type'] === undefined && typeof card['hash'] === 'string';
  }

  private root(): Part | Group {
    if (this.tab === 'popups' || (this.tab === 'design' && this.view !== 'card' && !this.sheet())) {
      return groupOf(this.template.popups ?? [], ['popups'], 'popups');
    }
    const card = this.template.card;
    return partOf(isMapping(card) ? card : {}, ['card'], undefined, 0);
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
        const list = listAt(this.template, group.path);
        const id = uniqueId(list, idFor(starter));
        this.selected = keyOf([...group.path, `#${id}`]);
        this.replace(withValue(this.template, group.path, [...list, { id, ...starter.value }]));
      },
      duplicate: (part): void => {
        const listPath = part.path.slice(0, -1);
        const list = listAt(this.template, listPath);
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
          withValue(
            this.template,
            group.path,
            movedTo(listAt(this.template, group.path), from, to),
          ),
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

  private readonly redraw = (): void => {
    this.requestUpdate();
  };

  private drawPreview(): TemplateResult {
    return html`<mnml-preview
      .hass=${this.hass}
      .trial=${this.trial}
      .areas=${this.host?.areas() ?? []}
      .area=${this.area}
      .choose=${(area: string | undefined) => {
        this.area = area;
      }}
    ></mnml-preview>`;
  }

  private simpleActions(): SimpleActions {
    const shipped = this.draft?.shipped;
    return {
      toggle: (row, on): void => {
        const where = row.path.join('/');
        if (on) {
          const back = switchedOn(this.template, shipped, row.path, this.kept.get(where));
          this.kept.delete(where);
          this.replace(back);
          return;
        }
        this.kept.set(where, keptPart(this.template, row.path));
        this.replace(switchedOff(this.template, row.path));
      },
      look: (look, value): void => {
        if (value === '') {
          this.requestUpdate();
          return;
        }
        this.replace(withValue(this.template, look.path, value));
      },
    };
  }

  private inspector(part: Part | undefined): TemplateResult {
    return drawInspector(part, {
      hass: this.hass,
      open: this.open,
      template: this.readable(),
      templates: this.host?.templates() ?? {},
      value: (path): Record<string, Value> => {
        const found = valueAt(this.template, path);
        return isMapping(found) ? found : {};
      },
      update: (path, next, redraw): void => {
        this.edit(withValue(this.template, path, next), redraw);
      },
      redraw: this.redraw,
    });
  }

  private act(root: Part | Group, action: 'remove' | 'earlier' | 'later'): void {
    const chain = chainTo(root, this.selected);
    const part = chain.at(-1);
    if (part === undefined) {
      return;
    }
    const outline = this.outlineActions();
    if (action === 'remove') {
      outline.remove(part);
      return;
    }
    const place = groupOfPart(chain);
    if (place !== undefined) {
      const to = place.index + (action === 'earlier' ? -1 : 1);
      if (to >= 0 && to < place.group.parts.length) {
        outline.move(place.group, place.index, to);
      }
    }
  }

  private reorder(root: Part | Group, from: string, to: string): void {
    const place = groupOfPart(chainTo(root, from));
    const index = place?.group.parts.findIndex((part) => keyOf(part.path) === to);
    if (place !== undefined && index !== undefined && index !== -1) {
      this.selected = from;
      this.outlineActions().move(place.group, place.index, index);
    }
  }

  private drawDesignTab(): TemplateResult {
    if (this.draft?.blank === true && !this.chosen) {
      return drawStarters(this.name, this.hass, (template) => {
        this.chosen = true;
        if (template !== undefined) {
          this.replace(template);
        }
      });
    }
    const root = this.root();
    const chain = chainTo(root, this.selected);
    const outline = this.outlineActions();
    const simple = this.simpleActions();
    const values = this.previewValues();
    const part = chain.at(-1);
    return html`<div class=${classMap({ design: true, narrow: this.narrow })}>
      <div class="design-stage">
        <mnml-preview
          .hass=${this.hass}
          .trial=${this.trial}
          .areas=${this.host?.areas() ?? []}
          .area=${this.area}
          .staged=${true}
          .selected=${this.selected}
          .view=${this.view}
          .said=${part === undefined ? '' : `Selected: ${titleOf(part)}`}
          .pick=${(key: string) => {
            this.selected = key;
          }}
          .act=${(action: 'remove' | 'earlier' | 'later') => {
            this.act(root, action);
          }}
          .reorder=${(from: string, to: string) => {
            this.reorder(root, from, to);
          }}
          .show=${(view: string) => {
            this.view = view;
            this.selected = '';
          }}
          .choose=${(area: string | undefined) => {
            this.area = area;
          }}
        ></mnml-preview>
      </div>
      <aside class="design-panel">
        ${drawStagePanel(
          {
            root,
            selected: this.selected,
            template: this.readable(),
            templates: this.host?.templates() ?? {},
            values,
            data:
              part === undefined
                ? []
                : dataFields(part, this.readable(), this.host?.templates() ?? {}),
            detachable:
              part?.kind === 'fragment' &&
              detachedOf(this.template, chain, this.host?.templates() ?? {}) !== undefined,
            chain,
            rows: simpleOf(this.template, this.draft?.shipped, this.kept),
            hass: this.hass,
            advanced: chain.length === 0 ? nothing : this.inspector(chain.at(-1)),
          },
          {
            ...simple,
            select: (key): void => {
              this.selected = key;
            },
            duplicate: outline.duplicate,
            remove: outline.remove,
            move: outline.move,
            add: outline.add,
            open: (name): void => {
              this.host?.open(name);
            },
            detach: (): void => {
              const next = withDetached(this.template, chain, this.host?.templates() ?? {});
              if (next !== undefined) {
                this.replace(next);
              }
            },
            pick: (data, entity): void => {
              if (data.slot === undefined) {
                this.replace(setLiteral(this.template, data, entity));
                return;
              }
              this.picked.add(data.slot.split('.')[0] ?? data.slot);
              void keepPicks(this.name, this.picked);
              this.replace(setPreview(this.template, data.slot, entity));
            },
            fix: (data): void => {
              this.replace(fixField(this.template, data, resolvedEntity(values, data)));
            },
            automate: (data): void => {
              const entity = resolvedEntity(values, data);
              if (entity !== undefined) {
                this.replace(automateField(this.template, data, entity, this.hass));
              }
            },
            condition: (target, show, slots): void => {
              const found = valueAt(this.template, target.path);
              this.replace(
                withValue(
                  this.template,
                  target.path,
                  withCondition(isMapping(found) ? found : {}, show, slots),
                ),
              );
            },
          },
        )}
      </aside>
    </div>`;
  }

  private drawWork(): TemplateResult {
    const hass = this.hass;
    if (this.tab === 'design') {
      return this.drawDesignTab();
    }
    if (this.tab === 'slots') {
      const context: Context = { hass, hashes: [], open: this.open, redraw: this.redraw };
      return html`${drawSlots(() => this.template, {
          name: this.name,
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
            slotsShape(this.readable().slots ?? {}, this.name, 'Example'),
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
        .apply=${(template: WrittenTemplate) => {
          this.replace(adoptIds(template, this.draft?.shipped));
        }}
      ></mnml-yaml>`;
    }
    const root = this.root();
    return html`<div
      class=${classMap({ work: true, narrow: this.narrow, [`show-${this.pane}`]: this.narrow })}
    >
      <div class="pane outline-pane">${drawOutline(root, this.outlineActions())}</div>
      <div class="pane preview-pane">${this.drawPreview()}</div>
      <div class="pane inspector-pane">${this.inspector(this.selectedPart(root))}</div>
    </div>`;
  }

  protected override render(): TemplateResult {
    let work: TemplateResult;
    try {
      work = this.drawWork();
    } catch (error) {
      work = html`<div class="problem">
        ${icon('mdi:alert-circle-outline')}<span
          >The panel could not draw this: ${messageOf(error)}</span
        >
      </div>`;
    }
    return html`<div class="builder">
      ${this.drawHead()} ${drawConflicts(this.clashes)}
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
