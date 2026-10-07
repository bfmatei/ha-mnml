import { html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { dashboardOf } from '../builder/dashboard.ts';
import { defaultPlan, planFrom } from '../builder/plan.ts';
import { readRecipe, recipeOf, recipeText, renamedRecipe } from '../builder/recipe.ts';
import type { Plan, Recipe } from '../contract/builder.ts';
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
import type { Registries } from '../templates/discover.ts';
import { OWNER } from '../templates/families.ts';
import { rolesOf } from '../templates/roles.ts';

import { MnmlBuilder, storedAs } from './builder.ts';
import type { BuilderHost, Entry } from './builder.ts';
import {
  addressFor,
  boardsOf,
  builtOf,
  forgetDashboard,
  makeDashboard,
  rebuildDashboard,
  undoDashboard,
} from './building.ts';
import type { Board, Built } from './building.ts';
import { MnmlDashboards } from './dashboards.ts';
import type { DashboardActions, DashboardRow } from './dashboards.ts';
import { draftOf, rowsOf, usesOf } from './data.ts';
import type { Dashboard, Draft, Kept, Row } from './data.ts';
import { ask, askName, confirmIt } from './dialog.ts';
import type { Choice as Option } from './dialog.ts';
import { MnmlBinder } from './inspector.ts';
import { MnmlLibrary } from './library.ts';
import type { LibraryActions } from './library.ts';
import { MnmlLiveCard } from './live-card.ts';
import { loadLovelace } from './lovelace.ts';
import { MnmlPlanEditor } from './plan-editor.ts';
import type { PlanHost } from './plan-editor.ts';
import { MnmlPreview } from './preview.ts';
import { previewOf, settled, summary } from './share.ts';
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
const BOARD = /^(?:|\/dashboards|\/dashboards\/(new|[a-z0-9]+(?:-[a-z0-9]+)+))$/;
const LIBRARY = '/templates';
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
  @state() private built: Built[] | undefined;
  @state() private builtFailure: string | undefined;
  @state() private boards: Board[] = [];
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
      this.go(`${BASE}${LIBRARY}`, true);
    },
    history: (name) => this.chooseVersion(name),
    duplicate: (name, template) => {
      this.attempt(() => this.duplicate(name, template));
    },
    exportOne: (name, template) => {
      this.exportAll([name], { [name]: template });
    },
  };

  private readonly send = (message: { type: string } & Record<string, unknown>): Promise<unknown> =>
    this.call(message);

  private readonly dashboardActions: DashboardActions = {
    quickStart: () => {
      this.attempt(() => this.quickStart());
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
      this.attempt(() => this.undo(built));
    },
    forget: (built) => {
      this.attempt(() => this.forget(built));
    },
    share: (built) => {
      this.attempt(() => this.share(built));
    },
    fromTemplate: () => {
      this.attempt(() => this.fromTemplate());
    },
  };

  private readonly planHost: PlanHost = {
    save: (plan, address) => this.build(plan, address),
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
      this.newPlan = defaultPlan(this.registries(), this.resolved());
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
    await this.readBuilt();
  }

  private async readBuilt(): Promise<void> {
    try {
      this.built = builtOf(await this.call({ type: 'mnml/dashboards/list' }));
      this.builtFailure = undefined;
    } catch (error) {
      this.built = undefined;
      this.builtFailure = message(error);
    }
  }

  private async refresh(): Promise<void> {
    await this.readDashboards();
    await this.readBuilt();
  }

  private registries(): Registries {
    const hass = this.current;
    return {
      areas: hass?.areas ?? {},
      devices: hass?.devices ?? {},
      entities: hass?.entities ?? {},
      states: hass?.states ?? {},
    };
  }

  private addresses(): Set<string> {
    return new Set([
      ...this.boards.map((board) => board.url_path),
      ...(this.built ?? []).map((built) => built.url_path),
      ...Object.keys(this.current?.panels ?? {}),
    ]);
  }

  private boardOf(built: Built): Board | undefined {
    return this.boards.find((board) => board.url_path === built.url_path);
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
      all: { ...shipped, ...changed, ...kept.own },
    };
    return this.known.all;
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
    return rowsOf(
      this.shipped ?? {},
      OWNER,
      this.kept ?? NOTHING_KEPT,
      usesOf(this.dashboards),
      rolesOf(this.resolved()),
    );
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
    if (at === undefined) {
      const rows: DashboardRow[] = built.map((each) => ({
        built: each,
        board: this.boardOf(each),
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
          >The panel could not draw this: ${message(error)}</span
        >
      </div>`;
    }
    return html`<div class="body">
      <div class="toolbar">
        <ha-menu-button .hass=${this.current} .narrow=${this.narrow}></ha-menu-button>
        <span class="toolbar-title">MNML</span>
      </div>
      ${this.drawTabs()} ${content}
    </div>`;
  }

  private async offerOpen(plan: Plan, address: string, done: string): Promise<void> {
    const open = await ask(
      this.renderRoot,
      done,
      html`<p>${plan.title} is at /${address}, in the sidebar.</p>`,
      [{ label: 'Open it', value: true, primary: true }],
    );
    if (open === true) {
      goTo(`/${address}`);
    }
  }

  private async quickStart(): Promise<void> {
    const registries = this.registries();
    const templates = this.resolved();
    const plan = defaultPlan(registries, templates);
    const address = addressFor(plan.title, this.addresses());
    const sure = await confirmIt(
      this.renderRoot,
      'Quick start',
      `MNML makes ${plan.title} at /${address}: ${summary(plan)}. Edit changes any of it later.`,
      'Make it',
    );
    if (!sure) {
      return;
    }
    try {
      await makeDashboard(this.send, address, plan, dashboardOf(plan, registries, templates));
    } finally {
      await this.refresh();
    }
    await this.offerOpen(plan, address, `${plan.title} is ready`);
  }

  private async build(plan: Plan, address: string): Promise<void> {
    const at = BOARD.exec(this.path)?.[1];
    const built = this.built?.find((each) => each.url_path === at);
    const config = dashboardOf(plan, this.registries(), this.resolved());
    if (
      built !== undefined &&
      !(await confirmIt(
        this.renderRoot,
        `Rebuild ${built.plan.title}?`,
        'MNML replaces its cards, with any change made to them by hand. Undo brings back the version this replaces.',
        'Rebuild',
      ))
    ) {
      return;
    }
    try {
      await (built === undefined
        ? makeDashboard(this.send, address, plan, config)
        : rebuildDashboard(this.send, built, this.boardOf(built), plan, config));
    } finally {
      await this.refresh();
    }
    this.go(BASE, true);
    await this.offerOpen(
      plan,
      built?.url_path ?? address,
      built === undefined ? `${plan.title} is ready` : `${plan.title} is rebuilt`,
    );
  }

  private async undo(built: Built): Promise<void> {
    const board = this.boardOf(built);
    const previous = built.previous;
    if (board === undefined || previous === undefined) {
      return;
    }
    const sure = await confirmIt(
      this.renderRoot,
      `Undo the last rebuild of ${built.plan.title}?`,
      `Its cards, title and icon go back to how they were before it: ${previous.plan.title}, with ${summary(previous.plan)}.`,
      'Undo',
    );
    if (!sure) {
      return;
    }
    try {
      await undoDashboard(this.send, built, board);
    } finally {
      await this.refresh();
    }
  }

  private async share(built: Built): Promise<void> {
    const text = recipeText(recipeOf(built.plan, this.resolved(), this.shipped ?? {}));
    const choices: Option<'copy' | 'download'>[] = [
      { label: 'Copy', value: 'copy' },
      { label: 'Download', value: 'download', primary: true },
    ];
    const choice = await ask(
      this.renderRoot,
      `Share ${built.plan.title}`,
      html`<p class="muted">
          Its layout, its sections' looks and every template of yours it uses. No area, person or
          entity of this home is in it; a template's example goes with it as it is.
        </p>
        <textarea
          class="yaml-text"
          readonly
          aria-label="The dashboard template"
          .value=${text}
        ></textarea>`,
      choices,
    );
    if (choice === 'copy') {
      await navigator.clipboard.writeText(text);
    } else if (choice === 'download') {
      download(`${built.url_path}.yaml`, text);
    }
  }

  private async fromTemplate(): Promise<void> {
    const shipped = this.shipped ?? {};
    let text = '';
    let recipe: Recipe | undefined;
    const read = await ask(
      this.renderRoot,
      'A dashboard from a template',
      html`<input
          type="file"
          accept=".yaml,.yml,text/yaml"
          aria-label="A dashboard template file"
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
          placeholder="Paste a dashboard template, or choose a file"
          aria-label="A dashboard template in YAML"
          @input=${(event: Event) => {
            const value = field(event.target, 'value');
            text = typeof value === 'string' ? value : '';
          }}
        ></textarea>`,
      [{ label: 'Next', value: true, primary: true }],
      () => {
        try {
          recipe = readRecipe(text, shipped);
          return undefined;
        } catch (error) {
          return message(error);
        }
      },
    );
    if (read !== true || recipe === undefined) {
      return;
    }
    const incoming = planImport(
      recipe.templates,
      shipped,
      this.kept ?? NOTHING_KEPT,
      this.resolved(),
    );
    const choices: Record<string, Choice> = {};
    const looked = planFrom(recipe, this.registries(), { ...this.resolved(), ...recipe.templates });
    const open = await ask(
      this.renderRoot,
      recipe.title,
      html`<p>${previewOf(recipe, looked)}</p>
        ${
          incoming.length === 0
            ? nothing
            : html`<p class="muted">It brings these templates:</p>
                ${this.fatesOf(incoming, choices)}`
        }`,
      [{ label: 'Open in the builder', value: true, primary: true }],
    );
    if (open !== true) {
      return;
    }
    const { save, renames } = settled(incoming, choices, this.taken());
    await Promise.all(save.map((each) => this.save(each.name, entryFor(each, shipped))));
    const templates = {
      ...this.resolved(),
      ...Object.fromEntries(save.map((each) => [each.name, each.template])),
    };
    this.newPlan = planFrom(renamedRecipe(recipe, renames), this.registries(), templates);
    this.go(`${BASE}/dashboards/new`);
  }

  private async forget(built: Built): Promise<void> {
    const board = this.boardOf(built);
    const choices: Option<'forget' | 'delete'>[] = [
      ...(board === undefined ? [] : [{ label: 'Delete it too', value: 'delete' } as const]),
      { label: 'Forget', value: 'forget', primary: true },
    ];
    const choice = await ask(
      this.renderRoot,
      `Forget ${built.plan.title}?`,
      html`<p>
        MNML stops building it. The dashboard stays in Home Assistant as it is, unless it is deleted
        too.
      </p>`,
      choices,
    );
    if (choice === undefined) {
      return;
    }
    await forgetDashboard(this.send, built, board, choice === 'delete');
    await this.refresh();
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

  private fatesOf(
    plan: readonly Incoming[],
    choices: Record<string, Choice>,
    differ: readonly string[] = [],
  ): TemplateResult {
    return html`<div class="import-plan">
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
    </div>`;
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
      html`${this.fatesOf(plan, choices, differ)}
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
