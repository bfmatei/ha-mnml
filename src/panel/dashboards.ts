import { css, html, LitElement, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

import type { MdiIcon } from '../contract/entities.ts';
import { icon } from '../ha/templates.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';

import type { Board, Built } from './building.ts';
import { PANEL_STYLE } from './style.ts';

export interface DashboardActions {
  quickStart: () => void;
  stepByStep: () => void;
  open: (built: Built) => void;
  edit: (built: Built) => void;
  undo: (built: Built) => void;
  forget: (built: Built) => void;
  share: (built: Built) => void;
  fromTemplate: () => void;
}

export interface DashboardRow {
  built: Built;
  board: Board | undefined;
}

function button(name: MdiIcon, label: string, run: () => void): TemplateResult {
  return html`<button
    type="button"
    class="icon-button"
    aria-label=${label}
    title=${label}
    @click=${run}
  >
    ${icon(name)}
  </button>`;
}

const DASHBOARDS_STYLE = css`
  .start {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    cursor: pointer;
  }
  .start:hover {
    border-color: var(--primary-color);
  }
  .start ha-icon {
    --mdc-icon-size: 28px;
    color: var(--primary-color);
  }
  .start-words {
    flex: 1;
    min-width: 220px;
  }
  .start-words h2 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 500;
  }
  .start-words p {
    margin: 0;
    color: var(--secondary-text-color);
  }
  .start-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .board-name {
    font-weight: 500;
  }
`;

export class MnmlDashboards extends LitElement {
  static override styles = [PANEL_STYLE, DASHBOARDS_STYLE];

  @property({ attribute: false }) rows: readonly DashboardRow[] = [];
  @property({ attribute: false }) actions: DashboardActions | undefined;
  @property({ attribute: false }) words: PanelWords = PANEL_EN;

  private drawStart(actions: DashboardActions | undefined): TemplateResult {
    const said = this.words.boards;
    return html`<div class="start">
      ${icon('mdi:view-dashboard-edit-outline')}
      <div class="start-words">
        <h2>${said.build}</h2>
        <p>${said.about}</p>
      </div>
      <div class="start-actions">
        <button type="button" class="action primary" @click=${() => actions?.quickStart()}>
          ${icon('mdi:flash-outline')}<span>${said.quickStart}</span>
        </button>
        <button type="button" class="action" @click=${() => actions?.stepByStep()}>
          ${icon('mdi:format-list-checks')}<span>${said.stepByStep}</span>
        </button>
        <button type="button" class="action" @click=${() => actions?.fromTemplate()}>
          ${icon('mdi:file-import-outline')}<span>${said.fromTemplate}</span>
        </button>
      </div>
    </div>`;
  }

  private drawRow(row: DashboardRow, actions: DashboardActions | undefined): TemplateResult {
    const { built, board } = row;
    const title = board?.title ?? built.plan.title;
    const said = this.words.boards;
    return html`<div class="library-row">
      <button
        type="button"
        class="library-open"
        aria-label=${said.edit(title)}
        title=${said.edit(title)}
        @click=${() => actions?.edit(built)}
      >
        <span class="library-icon">${icon(built.plan.icon)}</span>
        <span class="library-words">
          <span class="library-title">
            <span class="board-name">${title}</span>
            <span class="muted">/${built.url_path}</span>
          </span>
          <span class="library-description"
            >${
              board === undefined
                ? said.gone
                : built.updated === undefined
                  ? said.built
                  : said.builtOn(new Date(built.updated).toLocaleString())
            }</span
          >
        </span>
      </button>
      <span class="row-actions">
        ${board === undefined ? nothing : button('mdi:open-in-new', said.open(title), () => actions?.open(built))}
        ${
          built.previous === undefined || board === undefined
            ? nothing
            : button('mdi:undo', said.undo(title), () => actions?.undo(built))
        }
        ${button('mdi:share-variant', said.share(title), () => actions?.share(built))}
        ${button('mdi:delete-outline', said.forget(title), () => actions?.forget(built))}
      </span>
    </div>`;
  }

  protected override render(): TemplateResult {
    const actions = this.actions;
    const said = this.words.boards;
    return html`<div class="library">
      <div class="library-head">
        <h1>${said.heading}</h1>
        ${
          this.rows.length === 0
            ? nothing
            : html`<div class="library-tools">
                <button type="button" class="action" @click=${() => actions?.fromTemplate()}>
                  ${icon('mdi:file-import-outline')}<span>${said.fromTemplate}</span>
                </button>
                <button type="button" class="action primary" @click=${() => actions?.stepByStep()}>
                  ${icon('mdi:plus')}<span>${said.another}</span>
                </button>
              </div>`
        }
      </div>
      ${
        this.rows.length === 0
          ? this.drawStart(actions)
          : html`<div class="library-list">
              ${this.rows.map((row) => this.drawRow(row, actions))}
            </div>`
      }
    </div>`;
  }
}
