import { css, html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { defaultPlan } from '../builder/plan.ts';
import type { Plan } from '../contract/builder.ts';
import type { Templates, WrittenTemplate } from '../contract/templates.ts';
import { loadHaForm } from '../editors/ha-form.ts';
import { MnmlRowMenu } from '../editors/row-menu.ts';
import { MnmlWords } from '../editors/words.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { registriesOf } from '../ha/registries.ts';
import { icon } from '../ha/templates.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { onShared, sharedTemplates } from '../store/store.ts';
import { applyChanges } from '../templates/changes.ts';
import { OWNER } from '../templates/families.ts';
import { rolesOf } from '../templates/roles.ts';

import { MnmlBinder } from './binder.ts';
import { MnmlBuilder } from './builder.ts';
import type { BuilderHost } from './builder.ts';
import { addressFor, boardsOf, builtOf } from './building.ts';
import type { Board, Built } from './building.ts';
import {
  boardOf,
  buildDashboard,
  forgetBuilt,
  fromTemplate,
  quickStart,
  shareBuilt,
  undoRebuild,
} from './dashboard-actions.ts';
import type { DashboardHost } from './dashboard-actions.ts';
import { MnmlDashboards } from './dashboards.ts';
import type { DashboardActions, DashboardRow } from './dashboards.ts';
import { draftOf, rowsOf, usesOf } from './data.ts';
import type { Dashboard, Draft, Entry, Kept, PanelState, Row } from './data.ts';
import { dialogsOn } from './dialog.ts';
import {
  chooseVersion,
  duplicateTemplate,
  exportTemplates,
  importDashboards,
  importFile,
  newTemplate,
  removeTemplate,
  renameTemplate,
  restoreVersion,
  saveTemplate,
  waitingImport,
} from './library-actions.ts';
import { MnmlLibrary } from './library.ts';
import type { LibraryActions } from './library.ts';
import { MnmlLiveCard } from './live-card.ts';
import { loadLovelace } from './lovelace.ts';
import { messageOf } from './message.ts';
import { MnmlPlanEditor } from './plan-editor.ts';
import type { PlanHost } from './plan-editor.ts';
import { MnmlPreview } from './preview.ts';
import { PANEL_STYLE } from './style.ts';
import { MnmlYaml } from './yaml.ts';

interface Route {
  prefix?: string;
  path?: string;
}

const BASE = '/mnml';
const NAME = /^\/templates\/([a-z0-9][a-z0-9_-]{0,63})$/;
const BOARD = /^(?:|\/dashboards|\/dashboards\/(new|[a-z0-9]+(?:-[a-z0-9]+)+))$/;
const LIBRARY = '/templates';
const NOTHING_KEPT: Kept = { own: {}, changes: {} };

const PAGE_STYLE = css`
  :host {
    min-height: 100vh;
    background: var(--primary-background-color);
  }
  .body {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 56px;
    padding: 0 12px;
    border-bottom: 1px solid var(--divider-color);
    background: var(--app-header-background-color, var(--primary-background-color));
    color: var(--app-header-text-color, var(--primary-text-color));
  }
  .toolbar-title {
    font-size: 20px;
  }
`;

const nameIn = (path: string): string | undefined => NAME.exec(path)?.[1];

function goTo(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}

function download(name: string, text: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }));
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 1000);
}

export class MnmlPanel extends LitElement {
  static override styles = [PANEL_STYLE, PAGE_STYLE];

  @property({ attribute: false }) narrow = false;
  @state() private kept: Kept | undefined;
  private shaped: Templates = {};
  @state() private shipped: Templates | undefined;
  @state() private shippedFailure: string | undefined;
  @state() private dashboards: Dashboard[] = [];
  @state() private built: Built[] | undefined;
  @state() private builtFailure: string | undefined;
  @state() private boards: Board[] = [];
  @state() private boardsFailure: string | undefined;
  @state() private newPlan: Plan | undefined;
  @state() private failure: string | undefined;
  @state() private path = location.pathname.startsWith(BASE)
    ? location.pathname.slice(BASE.length)
    : '';
  @state() private opened: Draft | undefined;
  @query('mnml-builder') private builder: MnmlBuilder | null | undefined;
  @query('mnml-plan-editor') private planEditor: MnmlPlanEditor | null | undefined;
  private current: HomeAssistant | undefined;
  private started = false;
  private unlisten: (() => void) | undefined;
  private readonly fresh = new Map<string, Draft>();
  private known: { kept: Kept | undefined; shipped: Templates | undefined; all: Templates } = {
    kept: undefined,
    shipped: undefined,
    all: {},
  };

  set hass(hass: HomeAssistant) {
    this.current = hass;
    if (this.builder !== null && this.builder !== undefined) {
      this.builder.hass = hass;
    }
    if (this.planEditor !== null && this.planEditor !== undefined) {
      this.planEditor.hass = hass;
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
      this.kept = { own: shared.written, changes: shared.changes };
      this.shaped = shared.own;
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
      this.attempt(async () => {
        this.openFresh(await newTemplate(this.flows()));
      });
    },
    duplicate: (row) => {
      this.attempt(() => this.duplicate(row.name, this.written()[row.name]));
    },
    history: (row) => {
      this.attempt(() => restoreVersion(this.flows(), row.name));
    },
    exportAll: (names) => {
      exportTemplates(this.flows(), names, this.written());
    },
    importFile: () => {
      this.attempt(() => importFile(this.flows()));
    },
    remove: (row) => {
      this.attempt(() => removeTemplate(this.flows(), row));
    },
    rename: (row) => {
      this.attempt(() => renameTemplate(this.flows(), row));
    },
    importDashboards: () => {
      this.attempt(() => importDashboards(this.flows()));
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
      this.go(`${BASE}${LIBRARY}`, true);
    },
    history: (name) => chooseVersion(this.flows(), name),
    duplicate: (name, template) => {
      this.attempt(() => this.duplicate(name, template));
    },
    exportOne: (name, template) => {
      exportTemplates(this.flows(), [name], { [name]: template });
    },
    open: (name) => {
      this.go(`${BASE}/templates/${name}`);
    },
  };

  private readonly dashboardActions: DashboardActions = {
    quickStart: () => {
      this.attempt(() => quickStart(this.flows()));
    },
    stepByStep: () => {
      this.go(`${BASE}/dashboards/new`);
    },
    open: (built) => {
      goTo(`/${built.url_path}`);
    },
    edit: (built) => {
      this.go(`${BASE}/dashboards/${built.url_path}`);
    },
    undo: (built) => {
      this.attempt(() => undoRebuild(this.flows(), built));
    },
    forget: (built) => {
      this.attempt(() => forgetBuilt(this.flows(), built));
    },
    share: (built) => {
      this.attempt(() => shareBuilt(this.flows(), built));
    },
    fromTemplate: () => {
      this.attempt(async () => {
        const plan = await fromTemplate(this.flows());
        if (plan !== undefined) {
          this.newPlan = plan;
          this.go(`${BASE}/dashboards/new`);
        }
      });
    },
  };

  private readonly planHost: PlanHost = {
    save: (plan, address) =>
      buildDashboard(this.flows(), BOARD.exec(this.path)?.[1], plan, address),
    leave: () => {
      this.go(BASE);
    },
  };

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has('path') && !changed.has('kept') && !changed.has('shipped')) {
      return;
    }
    if (BOARD.exec(this.path)?.[1] !== 'new') {
      this.newPlan = undefined;
    } else if (this.newPlan === undefined && this.shipped !== undefined) {
      this.newPlan = defaultPlan(registriesOf(this.current), this.resolved());
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
      await dialogsOn(this.renderRoot).confirm('That did not work', messageOf(error), 'OK');
    });
  }

  private flows(): DashboardHost {
    return {
      call: (message) => this.call(message),
      dialogs: dialogsOn(this.renderRoot),
      state: () => this.state(),
      refresh: () => this.refresh(),
      save: (name, entry) => this.save(name, entry),
      download,
      go: (path) => {
        this.go(`${BASE}${path}`, true);
      },
      visit: goTo,
    };
  }

  private state(): PanelState {
    return {
      kept: this.kept ?? NOTHING_KEPT,
      shipped: this.shipped ?? {},
      shippedFailure: this.shippedFailure,
      resolved: this.resolved(),
      taken: this.taken(),
      registries: registriesOf(this.current),
      dashboards: this.dashboards,
      built: this.built,
      boards: this.boards,
      boardsFailure: this.boardsFailure,
      addresses: this.addresses(),
    };
  }

  private openFresh(draft: Draft | undefined): void {
    if (draft === undefined) {
      return;
    }
    this.fresh.set(draft.name, draft);
    if (!this.go(`${BASE}/templates/${draft.name}`)) {
      this.fresh.delete(draft.name);
    }
  }

  private async duplicate(of: string, template: WrittenTemplate | undefined): Promise<void> {
    this.openFresh(await duplicateTemplate(this.flows(), of, template));
  }

  private async start(): Promise<void> {
    await loadLovelace();
    await loadHaForm();
    this.read();
    await SHIPPED_TEMPLATES.need(Object.keys(OWNER));
    this.shippedFailure = SHIPPED_TEMPLATES.failure(Object.keys(OWNER));
    this.shipped = SHIPPED_TEMPLATES.templates();
    await this.readDashboards();
    await this.readBuilt();
  }

  private async readBuilt(): Promise<void> {
    try {
      this.built = builtOf(await this.call({ type: 'mnml/dashboards/list' }));
      this.builtFailure = undefined;
    } catch (error) {
      this.built = undefined;
      this.builtFailure = messageOf(error);
    }
  }

  private async refresh(): Promise<void> {
    await this.readDashboards();
    await this.readBuilt();
  }

  private addresses(): Set<string> {
    return new Set([
      ...this.boards.map((board) => board.url_path),
      ...(this.built ?? []).map((built) => built.url_path),
      ...Object.keys(this.current?.panels ?? {}),
    ]);
  }

  private async readDashboards(): Promise<void> {
    const hass = this.current;
    if (hass === undefined) {
      return;
    }
    let listed: unknown = [];
    try {
      listed = await hass.connection.sendMessagePromise({ type: 'lovelace/dashboards/list' });
      this.boardsFailure = undefined;
    } catch (error) {
      listed = [];
      this.boardsFailure = messageOf(error);
    }
    this.boards = boardsOf(listed);
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
    if (this.known.kept === this.kept && this.known.shipped === this.shipped) {
      return this.known.all;
    }
    const shipped = this.shipped ?? {};
    const kept = this.kept ?? NOTHING_KEPT;
    const changed = Object.fromEntries(
      Object.entries(kept.changes).flatMap(([name, changes]) => {
        const base = shipped[name];
        return base === undefined ? [] : [[name, applyChanges(base, changes).template]];
      }),
    );
    this.known = {
      kept: this.kept,
      shipped: this.shipped,
      all: { ...shipped, ...changed, ...this.shaped },
    };
    return this.known.all;
  }

  private written(): Readonly<Record<string, WrittenTemplate>> {
    return { ...this.resolved(), ...this.kept?.own };
  }

  private taken(): Set<string> {
    return new Set([...Object.keys(OWNER), ...Object.keys(this.resolved()), ...this.fresh.keys()]);
  }

  private async call(message: { type: string } & Record<string, unknown>): Promise<unknown> {
    const hass = this.current;
    if (hass === undefined) {
      throw new Error('Home Assistant is not connected');
    }
    return hass.connection.sendMessagePromise(message);
  }

  private async save(name: string, entry: Entry | undefined): Promise<void> {
    await saveTemplate((message) => this.call(message), this.kept ?? NOTHING_KEPT, name, entry);
    this.fresh.delete(name);
  }

  private rows(): Row[] {
    return rowsOf(
      this.shipped ?? {},
      OWNER,
      this.kept ?? NOTHING_KEPT,
      usesOf(this.dashboards),
      rolesOf(this.resolved()),
    );
  }

  private drawLibrary(): TemplateResult {
    const { templates: waiting, from } = waitingImport(this.state());
    const boards = new Set(Object.keys(waiting).flatMap((name) => from[name] ?? []));
    return html`<mnml-library
      .rows=${this.rows()}
      .offer=${{ templates: Object.keys(waiting).length, dashboards: boards.size }}
      .actions=${this.libraryActions}
    ></mnml-library>`;
  }

  private drawBoards(at: string | undefined): TemplateResult {
    const built = this.built;
    if (this.builtFailure !== undefined) {
      return html`<div class="problem">
        ${icon('mdi:alert-circle-outline')}<span
          >MNML cannot read the dashboards it built: ${this.builtFailure}</span
        >
      </div>`;
    }
    if (built === undefined) {
      return html`<p class="muted loading">Reading the dashboards...</p>`;
    }
    if (at === undefined && this.boardsFailure !== undefined) {
      return html`<div class="problem">
        ${icon('mdi:alert-circle-outline')}<span
          >MNML cannot read Home Assistant's dashboards: ${this.boardsFailure}</span
        >
      </div>`;
    }
    if (at === undefined) {
      const rows: DashboardRow[] = built.map((each) => ({
        built: each,
        board: boardOf(this.boards, each),
      }));
      return html`<mnml-dashboards
        .rows=${rows}
        .actions=${this.dashboardActions}
      ></mnml-dashboards>`;
    }
    const kept = built.find((each) => each.url_path === at);
    const plan = at === 'new' ? this.newPlan : kept?.plan;
    if (plan === undefined) {
      return html`<div class="library">
        <p>MNML did not build a dashboard at /${at}.</p>
        <button
          type="button"
          class="action"
          @click=${() => {
            this.go(BASE);
          }}
        >
          Back to the dashboards
        </button>
      </div>`;
    }
    return html`<mnml-plan-editor
      .hass=${this.current}
      .templates=${this.resolved()}
      .plan=${plan}
      .address=${kept?.url_path ?? addressFor(plan.title, this.addresses())}
      .fresh=${kept === undefined}
      .taken=${this.addresses()}
      .host=${this.planHost}
    ></mnml-plan-editor>`;
  }

  private drawTabs(): TemplateResult | typeof nothing {
    const boards = this.path === '' || this.path === '/dashboards';
    if (!boards && this.path !== LIBRARY) {
      return nothing;
    }
    const tab = (label: string, path: string, active: boolean): TemplateResult =>
      html`<button
        type="button"
        class=${active ? 'tab active' : 'tab'}
        @click=${() => {
          this.go(`${BASE}${path}`);
        }}
      >
        ${label}
      </button>`;
    return html`<div class="tabs">
      ${tab('Dashboards', '', boards)} ${tab('Templates', LIBRARY, !boards)}
    </div>`;
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
    const board = BOARD.exec(this.path);
    if (board !== null) {
      return this.drawBoards(board[1]);
    }
    if (this.path === LIBRARY) {
      return this.drawLibrary();
    }
    const name = nameIn(this.path);
    if (name === undefined) {
      return this.drawBoards(undefined);
    }
    if (this.opened === undefined) {
      return html`<div class="library">
        <p>No template is named ${name}.</p>
        <button
          type="button"
          class="action"
          @click=${() => {
            this.go(`${BASE}${LIBRARY}`);
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
          >The panel could not draw this: ${messageOf(error)}</span
        >
      </div>`;
    }
    return html`<div class="body">
      <div class="toolbar">
        <ha-menu-button .hass=${this.current} .narrow=${this.narrow}></ha-menu-button>
        <span class="toolbar-title">MNML</span>
      </div>
      ${this.drawTabs()}
      ${
        this.shippedFailure === undefined
          ? nothing
          : html`<div class="problem">
              ${icon('mdi:alert-circle-outline')}<span>${this.shippedFailure}</span>
            </div>`
      }
      ${content}
    </div>`;
  }
}

const ELEMENTS = {
  'mnml-panel': MnmlPanel,
  'mnml-builder': MnmlBuilder,
  'mnml-dashboards': MnmlDashboards,
  'mnml-plan-editor': MnmlPlanEditor,
  'mnml-live-card': MnmlLiveCard,
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
