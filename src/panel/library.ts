import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { live } from 'lit/directives/live.js';

import { rowMenu } from '../editors/row-menu.ts';
import { field } from '../ha/field.ts';
import { icon } from '../ha/templates.ts';

import { describe } from './data.ts';
import type { Row, Status } from './data.ts';
import { PANEL_STYLE } from './style.ts';

export interface LibraryActions {
  open: (name: string) => void;
  create: () => void;
  duplicate: (row: Row) => void;
  history: (row: Row) => void;
  exportAll: (names: readonly string[]) => void;
  importFile: () => void;
  remove: (row: Row) => void;
  rename: (row: Row) => void;
  importDashboards: () => void;
}

export interface Offer {
  templates: number;
  dashboards: number;
}

type Filter = 'all' | Status;

const EVERYTHING = 'mnml-library-everything';

function remembered(): boolean {
  try {
    return localStorage.getItem(EVERYTHING) === 'yes';
  } catch {
    return false;
  }
}

const FILTERS: readonly { filter: Filter; label: string }[] = [
  { filter: 'all', label: 'All' },
  { filter: 'shipped', label: 'Shipped' },
  { filter: 'customised', label: 'Customised' },
  { filter: 'own', label: 'Yours' },
  { filter: 'conflict', label: 'Conflicts' },
];

const STATUS_ICON = {
  shipped: 'mdi:package-variant-closed',
  customised: 'mdi:pencil-circle-outline',
  own: 'mdi:account-circle-outline',
  conflict: 'mdi:alert-circle-outline',
} as const;

const offerText = (offer: Offer): string =>
  `${offer.dashboards === 1 ? 'A dashboard holds' : `${offer.dashboards} dashboards hold`} ${offer.templates} ${offer.templates === 1 ? 'template' : 'templates'} under mnml_templates: that MNML does not keep. The cards do not read them there.`;

export class MnmlLibrary extends LitElement {
  static override styles = PANEL_STYLE;

  @property({ attribute: false }) rows: readonly Row[] = [];
  @property({ attribute: false }) offer: Offer | undefined;
  @property({ attribute: false }) actions: LibraryActions | undefined;
  @state() private text = '';
  @state() private filter: Filter = 'all';
  @state() private everything = remembered();

  private matching(): Row[] {
    const words = this.text.toLowerCase().split(/\s+/).filter(Boolean);
    return this.rows.filter(
      (row) =>
        (this.filter === 'all' || row.status === this.filter) &&
        words.every((word) =>
          `${row.name} ${row.description} ${row.family ?? ''}`.toLowerCase().includes(word),
        ),
    );
  }

  private visible(): Row[] {
    return this.matching().filter((row) => this.everything || row.role === 'tile');
  }

  private show(everything: boolean): void {
    this.everything = everything;
    try {
      localStorage.setItem(EVERYTHING, everything ? 'yes' : 'no');
    } catch {}
  }

  private drawHidden(rows: readonly Row[]): TemplateResult | string {
    if (this.everything) {
      return '';
    }
    const hidden = this.matching().length - rows.length;
    if (hidden === 0) {
      return '';
    }
    return rows.length === 0
      ? html`<p class="muted">
          Only pop-ups and parts match.
          <button
            type="button"
            class="action"
            @click=${() => {
              this.show(true);
            }}
          >
            Show them
          </button>
        </p>`
      : html`<p class="muted">and ${hidden} pop-ups and parts</p>`;
  }

  private drawRow(row: Row, actions: LibraryActions): TemplateResult {
    const status = describe(row);
    return html`<div class=${`library-row status-${row.status}`}>
      <button
        type="button"
        class="library-open"
        aria-label=${`Edit ${row.name}`}
        title=${`Edit ${row.name}`}
        @click=${() => {
          actions.open(row.name);
        }}
      >
        <ha-icon class="library-icon" .icon=${STATUS_ICON[row.status]}></ha-icon>
        <div class="library-words">
          <div class="library-title">
            <span class="library-name">${row.name}</span>
            ${row.family === undefined ? '' : html`<span class="badge">${row.family}</span>`}
          </div>
          <div class="library-description">${row.description}</div>
          ${status === '' ? '' : html`<div class="library-status">${status}</div>`}
        </div>
      </button>
      ${rowMenu(row.name, [
        {
          label: 'Edit',
          icon: 'mdi:pencil-outline',
          run: () => {
            actions.open(row.name);
          },
        },
        {
          label: 'Duplicate',
          icon: 'mdi:content-copy',
          run: () => {
            actions.duplicate(row);
          },
        },
        {
          label: 'History',
          icon: 'mdi:history',
          run: () => {
            actions.history(row);
          },
        },
        {
          label: 'Export',
          icon: 'mdi:export-variant',
          run: () => {
            actions.exportAll([row.name]);
          },
        },
        {
          label: 'Rename',
          icon: 'mdi:rename-outline',
          disabled: row.status === 'own' ? undefined : true,
          run: () => {
            actions.rename(row);
          },
        },
        {
          label: row.status === 'own' ? 'Delete' : 'Reset to shipped',
          icon: 'mdi:delete-outline',
          disabled: row.status === 'shipped' ? true : undefined,
          run: () => {
            actions.remove(row);
          },
        },
      ])}
    </div>`;
  }

  protected override render(): TemplateResult {
    const actions = this.actions;
    const rows = this.visible();
    const offer = this.offer;
    return html`<div class="library">
      <div class="library-head">
        <h1>Templates</h1>
        <div class="library-tools">
          <button
            type="button"
            class="action primary"
            aria-label="New template"
            title="New template"
            @click=${() => actions?.create()}
          >
            ${icon('mdi:plus')}<span>New</span>
          </button>
          <button
            type="button"
            class="action"
            aria-label="Import templates"
            title="Import templates"
            @click=${() => actions?.importFile()}
          >
            ${icon('mdi:import')}<span>Import</span>
          </button>
          <button
            type="button"
            class="action"
            aria-label="Export the templates shown"
            title="Export the templates shown"
            @click=${() => actions?.exportAll(this.visible().map((row) => row.name))}
          >
            ${icon('mdi:export-variant')}<span>Export</span>
          </button>
        </div>
      </div>
      ${
        offer !== undefined && offer.templates > 0
          ? html`<div class="offer">
              ${icon('mdi:import')}<span>${offerText(offer)}</span>
              <button
                type="button"
                class="action primary"
                aria-label="Import them"
                title="Import them"
                @click=${() => actions?.importDashboards()}
              >
                Import them
              </button>
            </div>`
          : ''
      }
      <input
        class="search"
        type="search"
        placeholder="Search templates"
        aria-label="Search templates"
        .value=${this.text}
        @input=${(event: Event) => {
          const value = field(event.target, 'value');
          this.text = typeof value === 'string' ? value : '';
        }}
      />
      <div class="chips">
        <label class="switch">
          <input
            type="checkbox"
            aria-label="Pop-ups and parts"
            .checked=${live(this.everything)}
            @change=${(event: Event) => {
              this.show(field(event.target, 'checked') === true);
            }}
          />
          <span>Pop-ups and parts</span>
        </label>
        ${FILTERS.map(({ filter, label }) => {
          const listed = this.rows.filter((row) => this.everything || row.role === 'tile');
          const count =
            filter === 'all' ? listed.length : listed.filter((row) => row.status === filter).length;
          return count === 0 && filter !== 'all'
            ? ''
            : html`<button
                type="button"
                class=${classMap({ chip: true, active: filter === this.filter })}
                aria-label=${label}
                title=${label}
                aria-pressed=${filter === this.filter}
                @click=${() => {
                  this.filter = filter;
                }}
              >
                ${label} ${count}
              </button>`;
        })}
      </div>
      <div class="library-list">
        ${
          actions === undefined
            ? ''
            : rows.length === 0
              ? this.matching().length === 0
                ? html`<p class="muted">No template matches.</p>`
                : ''
              : rows.map((row) => this.drawRow(row, actions))
        }
      </div>
      ${this.drawHidden(rows)}
    </div>`;
  }
}
