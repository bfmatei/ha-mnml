import { html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { isTemplate } from '../contract/templates.ts';
import type { Template, Templates } from '../contract/templates.ts';
import { loadHaForm } from '../editors/ha-form.ts';
import { MnmlRowMenu } from '../editors/row-menu.ts';
import { MnmlWords } from '../editors/words.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { onShared, sharedTemplates } from '../store/store.ts';
import { applyChanges, isChange } from '../templates/changes.ts';
import { OWNER } from '../templates/families.ts';

import { MnmlBuilder, storedAs } from './builder.ts';
import type { BuilderHost, Entry } from './builder.ts';
import { draftOf, rowsOf, usesOf } from './data.ts';
import type { Dashboard, Draft, Kept, Row } from './data.ts';
import { ask, askName, confirmIt } from './dialog.ts';
import { MnmlBinder } from './inspector.ts';
import { MnmlLibrary } from './library.ts';
import type { LibraryActions } from './library.ts';
import { loadLovelace } from './lovelace.ts';
import { MnmlPreview } from './preview.ts';
import { PAGE_STYLE, PANEL_STYLE } from './style.ts';
import {
  dashboardTemplates,
  entryFor,
  exportText,
  notKept,
  planImport,
  renameEverywhere,
  renamedTemplate,
  settleImport,
  templatesIn,
} from './transfer.ts';
import type { Choice, Incoming } from './transfer.ts';
import { MnmlYaml } from './yaml.ts';

interface Route {
  prefix?: string;
  path?: string;
}

const BASE = '/mnml';
const NAME = /^\/templates\/([a-z0-9][a-z0-9_-]{0,63})$/;
const NOTHING_KEPT: Kept = { own: {}, changes: {} };
const NEW_TEMPLATE: Template = {
  description: '',
  slots: { title: { kind: 'text', required: true, label: 'Title' } },
  card: { type: 'custom:mnml-heading-card', title: '[[title]]', icon: 'mdi:star-outline' },
  example: { title: 'New' },
};
const FATES: Record<Incoming['fate'], string> = {
  changes: 'comes in as changes to the shipped template',
  own: 'comes in as a template of the home',
  replaces: 'replaces the template of the same name',
  same: 'is the same as the one MNML keeps, so it is left out',
};

const message = (error: unknown): string => {
  const text = field(error, 'message');
  return typeof text === 'string' ? text : error instanceof Error ? error.message : String(error);
};

const nameIn = (path: string): string | undefined => NAME.exec(path)?.[1];

function download(name: string, text: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }));
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 1000);
}

function versionText(version: unknown): string {
  const updated = field(version, 'updated');
  const changes = field(version, 'changes');
  const when =
    typeof updated === 'string' ? new Date(updated).toLocaleString() : 'an earlier version';
  const what =
    field(version, 'kind') === 'own'
      ? 'the whole template'
      : `${Array.isArray(changes) ? changes.length : 0} changes to the shipped one`;
  return `${when}: ${what}`;
}

function entryOfVersion(version: unknown): Entry | undefined {
  const template = field(version, 'template');
  const changes = field(version, 'changes');
  if (field(version, 'kind') === 'own' && isTemplate(template)) {
    return { kind: 'own', template };
  }
  return field(version, 'kind') === 'changes' && Array.isArray(changes) && changes.every(isChange)
    ? { kind: 'changes', changes }
    : undefined;
}

export class MnmlPanel extends LitElement {
  static override styles = [PAGE_STYLE, PANEL_STYLE];

  @property({ attribute: false }) narrow = false;
  @state() private kept: Kept | undefined;
  @state() private shipped: Templates | undefined;
  @state() private dashboards: Dashboard[] = [];
  @state() private failure: string | undefined;
  @state() private path = location.pathname.startsWith(BASE)
    ? location.pathname.slice(BASE.length)
    : '';
  @state() private opened: Draft | undefined;
  @query('mnml-builder') private builder: MnmlBuilder | null | undefined;
  private current: HomeAssistant | undefined;
  private started = false;
  private unlisten: (() => void) | undefined;
  private readonly fresh = new Map<string, Draft>();

  set hass(hass: HomeAssistant) {
    this.current = hass;
    if (this.builder !== null && this.builder !== undefined) {
      this.builder.hass = hass;
    }
    if (!this.started) {
      this.started = true;
      void this.start();
    }
  }

  get hass(): HomeAssistant | undefined {
    return this.current;
  }

  set route(route: Route) {
    const path = route.path ?? '';
    if (path === this.path) {
      return;
    }
    if (!this.mayLeave(path)) {
      history.pushState(null, '', `${BASE}${this.path}`);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
      return;
    }
    this.path = path;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.unlisten = onShared(this.read);
    this.read();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unlisten?.();
    this.unlisten = undefined;
  }

  private readonly read = (): void => {
    const hass = this.current;
    if (hass === undefined) {
      return;
    }
    const shared = sharedTemplates(hass.connection);
    if (shared.status === 'ready') {
      this.kept = { own: shared.own, changes: shared.changes };
      this.failure = undefined;
    } else if (shared.status === 'failed') {
      this.failure = shared.error;
    }
  };

  private readonly libraryActions: LibraryActions = {
    open: (name) => {
      this.go(`${BASE}/templates/${name}`);
    },
    create: () => {
      this.attempt(() => this.create());
    },
    duplicate: (row) => {
      this.attempt(() => this.duplicate(row.name, this.resolved()[row.name]));
    },
    history: (row) => {
      this.attempt(() => this.history(row));
    },
    exportAll: (names) => {
      this.exportAll(names, this.resolved());
    },
    importFile: () => {
      this.attempt(() => this.importFile());
    },
    remove: (row) => {
      this.attempt(() => this.removeTemplate(row));
    },
    rename: (row) => {
      this.attempt(() => this.rename(row));
    },
    importDashboards: () => {
      this.attempt(() => this.importDashboards());
    },
  };

  private readonly builderHost: BuilderHost = {
    templates: () => this.resolved(),
    areas: () =>
      Object.values(this.current?.areas ?? {})
        .map((area) => ({ value: area.area_id, label: area.name }))
        .toSorted((a, b) => a.label.localeCompare(b.label)),
    save: (name, entry) => this.save(name, entry),
    leave: () => {
      this.go(BASE, true);
    },
    history: (name) => this.chooseVersion(name),
    duplicate: (name, template) => {
      this.attempt(() => this.duplicate(name, template));
    },
    exportOne: (name, template) => {
      this.exportAll([name], { [name]: template });
    },
  };

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has('path') && !changed.has('kept') && !changed.has('shipped')) {
      return;
    }
    const name = nameIn(this.path);
    const before = this.opened;
    if (name === undefined || this.kept === undefined || this.shipped === undefined) {
      this.opened = undefined;
    } else if (before?.name !== name) {
      this.opened = this.fresh.get(name) ?? draftOf(name, this.shipped, this.kept);
    }
    if (before !== undefined && before !== this.opened) {
      this.fresh.delete(before.name);
    }
  }

  private mayLeave(path: string): boolean {
    const builder = this.builder;
    return (
      builder === null ||
      builder === undefined ||
      path === `/templates/${builder.name}` ||
      !builder.dirty() ||
      window.confirm('Leave without saving your changes?')
    );
  }

  private go(path: string, checked = false): boolean {
    const next = path.slice(BASE.length);
    if (!checked && !this.mayLeave(next)) {
      return false;
    }
    this.path = next;
    history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
    return true;
  }

  private attempt(run: () => Promise<void>): void {
    run().catch(async (error: unknown) => {
      await confirmIt(this.renderRoot, 'That did not work', message(error), 'OK');
    });
  }

  private async start(): Promise<void> {
    await loadLovelace();
    await loadHaForm();
    this.read();
    await SHIPPED_TEMPLATES.need(Object.keys(OWNER));
    this.shipped = SHIPPED_TEMPLATES.templates();
    await this.readDashboards();
  }

  private async readDashboards(): Promise<void> {
    const hass = this.current;
    if (hass === undefined) {
      return;
    }
    let listed: unknown = [];
    try {
      listed = await hass.connection.sendMessagePromise({ type: 'lovelace/dashboards/list' });
    } catch {
      listed = [];
    }
    const boards: { path: string | null; title: string; storage: boolean }[] = [
      { path: null, title: 'Overview', storage: true },
      ...(Array.isArray(listed) ? listed : []).flatMap((item) => {
        const path = field(item, 'url_path');
        const title = field(item, 'title');
        return typeof path === 'string'
          ? [
              {
                path,
                title: typeof title === 'string' ? title : path,
                storage: field(item, 'mode') !== 'yaml',
              },
            ]
          : [];
      }),
    ];
    this.dashboards = await Promise.all(
      boards.map(async (board) => {
        let config: unknown;
        try {
          config = await hass.connection.sendMessagePromise({
            type: 'lovelace/config',
            url_path: board.path,
          });
        } catch {
          config = undefined;
        }
        return { path: board.path, title: board.title, storage: board.storage, config };
      }),
    );
  }

  private resolved(): Templates {
    const shipped = this.shipped ?? {};
    const kept = this.kept ?? NOTHING_KEPT;
    const changed = Object.fromEntries(
      Object.entries(kept.changes).flatMap(([name, changes]) => {
        const base = shipped[name];
        return base === undefined ? [] : [[name, applyChanges(base, changes).template]];
      }),
    );
    return { ...shipped, ...changed, ...kept.own };
  }

  private taken(): Set<string> {
    return new Set([...Object.keys(this.resolved()), ...this.fresh.keys()]);
  }

  private async call(message: { type: string } & Record<string, unknown>): Promise<unknown> {
    const hass = this.current;
    if (hass === undefined) {
      throw new Error('Home Assistant is not connected');
    }
    return hass.connection.sendMessagePromise(message);
  }

  private async save(name: string, entry: Entry | undefined): Promise<void> {
    if (!storedAs(entry, this.kept ?? NOTHING_KEPT, name)) {
      await this.call(
        entry === undefined
          ? { type: 'mnml/templates/delete', name }
          : { type: 'mnml/templates/save', name, entry },
      );
    }
    this.fresh.delete(name);
  }

  private rows(): Row[] {
    return rowsOf(this.shipped ?? {}, OWNER, this.kept ?? NOTHING_KEPT, usesOf(this.dashboards));
  }

  private drawLibrary(): TemplateResult {
    const { templates, from } = dashboardTemplates(this.dashboards);
    const waiting = notKept(
      templates,
      this.kept ?? NOTHING_KEPT,
      this.resolved(),
      this.shipped ?? {},
    );
    const boards = new Set(Object.keys(waiting).flatMap((name) => from[name] ?? []));
    return html`<mnml-library
      .rows=${this.rows()}
      .offer=${{ templates: Object.keys(waiting).length, dashboards: boards.size }}
      .actions=${this.libraryActions}
    ></mnml-library>`;
  }

  private drawContent(): TemplateResult {
    if (this.failure !== undefined) {
      return html`<div class="problem">
        ${icon('mdi:alert-circle-outline')}<span>${this.failure}</span>
      </div>`;
    }
    if (this.kept === undefined || this.shipped === undefined) {
      return html`<p class="muted loading">Reading the templates...</p>`;
    }
    const name = nameIn(this.path);
    if (name === undefined) {
      return this.drawLibrary();
    }
    if (this.opened === undefined) {
      return html`<div class="library">
        <p>No template is named ${name}.</p>
        <button
          type="button"
          class="action"
          @click=${() => {
            this.go(BASE);
          }}
        >
          Back to the library
        </button>
      </div>`;
    }
    return html`<mnml-builder
      .host=${this.builderHost}
      .draft=${this.opened}
      .hass=${this.current}
      .narrow=${this.narrow}
    ></mnml-builder>`;
  }

  protected override render(): TemplateResult {
    let content: TemplateResult;
    try {
      content = this.drawContent();
    } catch (error) {
      content = html`<div class="problem">
        ${icon('mdi:alert-circle-outline')}<span
          >The panel could not draw this: ${message(error)}</span
        >
      </div>`;
    }
    return html`<div class="body">
      <div class="toolbar">
        <ha-menu-button .hass=${this.current} .narrow=${this.narrow}></ha-menu-button>
        <span class="toolbar-title">MNML</span>
      </div>
      ${content}
    </div>`;
  }

  private async create(): Promise<void> {
    const name = await askName(this.renderRoot, 'A new template', '', this.taken());
    if (name !== undefined) {
      this.fresh.set(name, {
        name,
        template: structuredClone(NEW_TEMPLATE),
        shipped: undefined,
        conflicts: [],
        fresh: true,
      });
      if (!this.go(`${BASE}/templates/${name}`)) {
        this.fresh.delete(name);
      }
    }
  }

  private async duplicate(of: string, template: Template | undefined): Promise<void> {
    const name = await askName(this.renderRoot, `A copy of ${of}`, `${of}-copy`, this.taken());
    if (name === undefined || template === undefined) {
      return;
    }
    this.fresh.set(name, {
      name,
      template: structuredClone(template),
      shipped: undefined,
      conflicts: [],
      fresh: true,
    });
    if (!this.go(`${BASE}/templates/${name}`)) {
      this.fresh.delete(name);
    }
  }

  private async chooseVersion(name: string): Promise<Entry | undefined> {
    const title = `The history of ${name}`;
    let versions: unknown[];
    try {
      const list = field(await this.call({ type: 'mnml/templates/history', name }), 'history');
      versions = Array.isArray(list) ? list : [];
    } catch (error) {
      await confirmIt(this.renderRoot, title, `It could not be read: ${message(error)}`, 'OK');
      return undefined;
    }
    if (versions.length === 0) {
      await confirmIt(this.renderRoot, title, 'There is no earlier version.', 'OK');
      return undefined;
    }
    let chosen = -1;
    const restore = await ask(
      this.renderRoot,
      title,
      html`<div class="history">
        ${versions.map(
          (version, index) =>
            html`<label class="history-row"
              ><input
                type="radio"
                name="version"
                @change=${() => {
                  chosen = index;
                }}
              /><span>${versionText(version)}</span></label
            >`,
        )}
      </div>`,
      [{ label: 'Restore', value: true, primary: true }],
      () => (chosen === -1 ? 'Choose a version first.' : undefined),
    );
    return restore === true ? entryOfVersion(versions[chosen]) : undefined;
  }

  private async history(row: Row): Promise<void> {
    const entry = await this.chooseVersion(row.name);
    if (entry !== undefined) {
      await this.save(row.name, entry);
    }
  }

  private exportAll(names: readonly string[], templates: Templates): void {
    download(
      names.length === 1 ? `${names[0] ?? 'template'}.yaml` : 'mnml-templates.yaml',
      exportText(names, templates),
    );
  }

  private async importFrom(
    found: Record<string, Template>,
    from: Record<string, readonly string[]> = {},
    differ: readonly string[] = [],
  ): Promise<void> {
    const shipped = this.shipped ?? {};
    const plan = planImport(found, shipped, this.kept ?? NOTHING_KEPT, this.resolved(), from);
    const choices: Record<string, Choice> = {};
    const go = await ask(
      this.renderRoot,
      'Import',
      html`<div class="import-plan">
          ${plan.map(
            (incoming) =>
              html`<div class="import-row">
                <code>${incoming.name}</code><span class="muted">${FATES[incoming.fate]}</span>
                ${
                  incoming.from.length > 0
                    ? html`<span class="muted">from ${incoming.from.join(', ')}</span>`
                    : nothing
                }
                ${
                  differ.includes(incoming.name)
                    ? html`<span class="muted"
                        >the dashboards hold different versions of it; this is the one from
                        ${incoming.from[0] ?? 'the first'}</span
                      >`
                    : nothing
                }
                ${
                  incoming.clash
                    ? html`<select
                        class="word"
                        aria-label=${`What to do with ${incoming.name}`}
                        @change=${(event: Event) => {
                          const value = field(event.target, 'value');
                          choices[incoming.name] =
                            value === 'both' ? 'both' : value === 'skip' ? 'skip' : 'replace';
                        }}
                      >
                        <option value="replace">Replace the one MNML keeps</option>
                        <option value="both">Keep both, this one under a new name</option>
                        <option value="skip">Skip it</option>
                      </select>`
                    : nothing
                }
              </div>`,
          )}
        </div>
        <p class="muted">Nothing on the dashboards is written.</p>`,
      [{ label: 'Import', value: true, primary: true }],
    );
    if (go !== true) {
      return;
    }
    await Promise.all(
      settleImport(plan, choices, this.taken()).map((incoming) =>
        this.save(incoming.name, entryFor(incoming, shipped)),
      ),
    );
  }

  private async importFile(): Promise<void> {
    let text = '';
    let found: Record<string, Template> = {};
    const go = await ask(
      this.renderRoot,
      'Import templates',
      html`<input
          type="file"
          accept=".yaml,.yml,text/yaml"
          aria-label="A file of templates"
          @change=${async (event: Event) => {
            const files = field(event.target, 'files');
            const file = files instanceof FileList ? files[0] : undefined;
            const area = event.target instanceof Element ? event.target.nextElementSibling : null;
            text = (await file?.text()) ?? text;
            if (area instanceof HTMLTextAreaElement) {
              area.value = text;
            }
          }}
        /><textarea
          class="yaml-text"
          placeholder="Paste templates, or choose a file"
          aria-label="Templates in YAML"
          @input=${(event: Event) => {
            const value = field(event.target, 'value');
            text = typeof value === 'string' ? value : '';
          }}
        ></textarea>`,
      [{ label: 'Next', value: true, primary: true }],
      () => {
        try {
          found = templatesIn(text);
          return Object.keys(found).length === 0 ? 'The text holds no template.' : undefined;
        } catch (error) {
          return message(error);
        }
      },
    );
    if (go === true) {
      await this.importFrom(found);
    }
  }

  private async importDashboards(): Promise<void> {
    const { templates, from, differ } = dashboardTemplates(this.dashboards);
    await this.importFrom(
      notKept(templates, this.kept ?? NOTHING_KEPT, this.resolved(), this.shipped ?? {}),
      from,
      differ,
    );
  }

  private async removeTemplate(row: Row): Promise<void> {
    const use =
      row.use.cards === 0
        ? 'No dashboard uses it.'
        : `It is on ${row.use.cards} ${row.use.cards === 1 ? 'card' : 'cards'}, on ${row.use.dashboards.join(', ')}.`;
    const sure =
      row.status === 'own'
        ? await confirmIt(
            this.renderRoot,
            `Delete ${row.name}?`,
            `${use} Its history keeps it.`,
            'Delete',
          )
        : await confirmIt(
            this.renderRoot,
            `Reset ${row.name} to shipped?`,
            `${use} Your changes go; its history keeps them.`,
            'Reset',
          );
    if (sure) {
      await this.call({ type: 'mnml/templates/delete', name: row.name });
    }
  }

  private async rename(row: Row): Promise<void> {
    const template = this.kept?.own[row.name];
    if (template === undefined) {
      return;
    }
    const name = await askName(this.renderRoot, `Rename ${row.name}`, row.name, this.taken());
    if (name === undefined || name === row.name) {
      return;
    }
    await this.save(name, { kind: 'own', template });
    await Promise.all(
      Object.entries(this.kept?.own ?? {}).flatMap(([other, inner]) => {
        const next = other === row.name ? undefined : renamedTemplate(inner, row.name, name);
        return next === undefined ? [] : [this.save(other, { kind: 'own', template: next })];
      }),
    );
    const { written, byHand, failed } = await renameEverywhere(
      (message) => this.call(message),
      this.dashboards,
      row.name,
      name,
    );
    if (failed.length === 0) {
      await this.call({ type: 'mnml/templates/delete', name: row.name });
    }
    await this.readDashboards();
    const told = [
      written.length === 0
        ? 'No dashboard stored in the UI used it.'
        : `Updated the cards on ${written.join(', ')}.`,
      ...(byHand.length === 0
        ? []
        : [
            `These dashboards are YAML files; change ${row.name} to ${name} in them by hand: ${byHand.join(', ')}.`,
          ]),
      ...(failed.length === 0
        ? []
        : [
            `These could not be saved, so ${row.name} stays beside ${name} until they are changed by hand: ${failed.join('; ')}.`,
          ]),
    ];
    await confirmIt(this.renderRoot, `${row.name} is now ${name}`, told.join(' '), 'OK');
  }
}

const ELEMENTS = {
  'mnml-panel': MnmlPanel,
  'mnml-builder': MnmlBuilder,
  'mnml-library': MnmlLibrary,
  'mnml-preview': MnmlPreview,
  'mnml-yaml': MnmlYaml,
  'mnml-binder': MnmlBinder,
  'mnml-row-menu': MnmlRowMenu,
  'mnml-words': MnmlWords,
};

for (const [tag, element] of Object.entries(ELEMENTS)) {
  if (customElements.get(tag) === undefined) {
    customElements.define(tag, element);
  }
}
