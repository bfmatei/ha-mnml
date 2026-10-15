import { css, html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { live } from 'lit/directives/live.js';

import { rowMenu } from '../editors/row-menu.ts';
import { field } from '../ha/field.ts';
import { SEPARATOR } from '../ha/format.ts';
import { icon } from '../ha/templates.ts';
import { familyTitle } from '../templates/family-titles.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';

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

const FILTERS: readonly Filter[] = ['all', 'shipped', 'customised', 'own', 'conflict'];

const LIBRARY_STYLE = css`
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding-block: 0;
    padding-inline: 0 8px;
    color: var(--secondary-text-color);
    font-size: 13px;
    cursor: pointer;
  }
  .switch input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--primary-color);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .search {
    box-sizing: border-box;
    width: 100%;
    height: 44px;
    padding: 0 14px;
    border-radius: 22px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 15px;
  }
  .offer {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px;
    border: 1px solid var(--primary-color);
    border-radius: 12px;
  }
  .offer > ha-icon {
    color: var(--primary-color);
  }
  .offer > span {
    flex: 1;
    min-width: 200px;
  }
  .library-open:hover .library-name {
    color: var(--primary-color);
  }
  .status-customised .library-icon {
    color: var(--primary-color);
  }
  .status-conflict .library-icon {
    color: var(--warning-color, var(--error-color));
  }
  .library-name {
    font-size: 15px;
    font-weight: 500;
  }
  .library-status {
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .status-conflict .library-status {
    color: var(--warning-color, var(--error-color));
  }
`;

export class MnmlLibrary extends LitElement {
  static override styles = [PANEL_STYLE, LIBRARY_STYLE];

  @property({ attribute: false }) rows: readonly Row[] = [];
  @property({ attribute: false }) offer: Offer | undefined;
  @property({ attribute: false }) actions: LibraryActions | undefined;
  @property({ attribute: false }) words: PanelWords = PANEL_EN;
  @state() private text = '';
  @state() private filter: Filter = 'all';
  @state() private everything = remembered();

  private matching(): Row[] {
    const words = this.text.toLowerCase().split(/\s+/).filter(Boolean);
    return this.rows.filter(
      (row) =>
        (this.filter === 'all' || row.status === this.filter) &&
        words.every((word) =>
          `${row.title} ${row.name} ${row.description} ${row.family === undefined ? '' : `${row.family} ${familyTitle(row.family)}`}`
            .toLowerCase()
            .includes(word),
        ),
    );
  }

  private listed(row: Row): boolean {
    return this.everything || row.role === 'tile' || row.status !== 'shipped';
  }

  private visible(): Row[] {
    return this.matching().filter((row) => this.listed(row));
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
    const said = this.words.library;
    return rows.length === 0
      ? html`<p class="muted">
          ${said.onlyParts}
          <button
            type="button"
            class="action"
            @click=${() => {
              this.show(true);
            }}
          >
            ${said.showThem}
          </button>
        </p>`
      : html`<p class="muted">${said.hidden(hidden)}</p>`;
  }

  private drawRow(row: Row, actions: LibraryActions): TemplateResult {
    const status = describe(row, this.words);
    const said = this.words.library;
    const family = row.family === undefined ? undefined : familyTitle(row.family);
    return html`<div class=${`library-row status-${row.status}`}>
      <button
        type="button"
        class="library-open"
        aria-label=${said.edit(row.title)}
        title=${said.edit(row.title)}
        @click=${() => {
          actions.open(row.name);
        }}
      >
        <ha-icon class="library-icon" .icon=${row.icon}></ha-icon>
        <div class="library-words">
          <div class="library-title">
            <span class="library-name">${row.title}</span>
          </div>
          <div class="library-description">${row.description}</div>
          <div class="library-status">
            <code class="code-name">${row.name}</code>${[
              family === undefined || family === row.title ? '' : family,
              status,
            ]
              .filter((part) => part !== '')
              .map((part) => `${SEPARATOR}${part}`)}
          </div>
        </div>
      </button>
      ${rowMenu(said.more(row.title), [
        {
          label: said.editIt,
          icon: 'mdi:pencil-outline',
          run: () => {
            actions.open(row.name);
          },
        },
        {
          label: said.duplicate,
          icon: 'mdi:content-copy',
          run: () => {
            actions.duplicate(row);
          },
        },
        {
          label: said.history,
          icon: 'mdi:history',
          run: () => {
            actions.history(row);
          },
        },
        {
          label: said.export,
          icon: 'mdi:export-variant',
          run: () => {
            actions.exportAll([row.name]);
          },
        },
        {
          label: said.rename,
          icon: 'mdi:rename-outline',
          disabled: row.status === 'own' ? undefined : true,
          run: () => {
            actions.rename(row);
          },
        },
        {
          label: row.status === 'own' ? said.delete : said.reset,
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
    const said = this.words.library;
    return html`<div class="library">
      <div class="library-head">
        <h1>${said.heading}</h1>
        <div class="library-tools">
          <button
            type="button"
            class="action primary"
            aria-label=${said.newTemplate}
            title=${said.newTemplate}
            @click=${() => actions?.create()}
          >
            ${icon('mdi:plus')}<span>${said.new}</span>
          </button>
          <button
            type="button"
            class="action"
            aria-label=${said.importTemplates}
            title=${said.importTemplates}
            @click=${() => actions?.importFile()}
          >
            ${icon('mdi:import')}<span>${said.import}</span>
          </button>
          <button
            type="button"
            class="action"
            aria-label=${said.exportShown}
            title=${said.exportShown}
            @click=${() => actions?.exportAll(this.visible().map((row) => row.name))}
          >
            ${icon('mdi:export-variant')}<span>${said.export}</span>
          </button>
        </div>
      </div>
      ${
        offer !== undefined && offer.templates > 0
          ? html`<div class="offer">
              ${icon('mdi:import')}<span>${said.offer(offer.dashboards, offer.templates)}</span>
              <button
                type="button"
                class="action primary"
                aria-label=${said.importThem}
                title=${said.importThem}
                @click=${() => actions?.importDashboards()}
              >
                ${said.importThem}
              </button>
            </div>`
          : ''
      }
      <input
        class="search"
        type="search"
        placeholder=${said.search}
        aria-label=${said.search}
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
            aria-label=${said.parts}
            .checked=${live(this.everything)}
            @change=${(event: Event) => {
              this.show(field(event.target, 'checked') === true);
            }}
          />
          <span>${said.parts}</span>
        </label>
        ${FILTERS.map((filter) => {
          const label = said.filters[filter];
          const listed = this.rows.filter((row) => this.listed(row));
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
                ? html`<p class="muted">${said.noMatch}</p>`
                : ''
              : rows.map((row) => this.drawRow(row, actions))
        }
      </div>
      ${this.drawHidden(rows)}
    </div>`;
  }
}
