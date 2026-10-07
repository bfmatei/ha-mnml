import { html, LitElement, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

import type { MdiIcon } from '../contract/entities.ts';
import { icon } from '../ha/templates.ts';

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

function when(updated: string | undefined): string {
  return updated === undefined ? '' : ` on ${new Date(updated).toLocaleString()}`;
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

export class MnmlDashboards extends LitElement {
  static override styles = PANEL_STYLE;

  @property({ attribute: false }) rows: readonly DashboardRow[] = [];
  @property({ attribute: false }) actions: DashboardActions | undefined;

  private drawStart(actions: DashboardActions | undefined): TemplateResult {
    return html`<div class="start">
      ${icon('mdi:view-dashboard-edit-outline')}
      <div class="start-words">
        <h2>Build your dashboard</h2>
        <p>
          MNML makes a dashboard from your home: a tile for each room it finds something in, one for
          each person, and the system cards it finds the entities of. Start at once, or choose what
          goes in step by step. Either way, Edit changes it later.
        </p>
      </div>
      <div class="start-actions">
        <button type="button" class="action primary" @click=${() => actions?.quickStart()}>
          ${icon('mdi:flash-outline')}<span>Quick start</span>
        </button>
        <button type="button" class="action" @click=${() => actions?.stepByStep()}>
          ${icon('mdi:format-list-checks')}<span>Step by step</span>
        </button>
        <button type="button" class="action" @click=${() => actions?.fromTemplate()}>
          ${icon('mdi:file-import-outline')}<span>From a template</span>
        </button>
      </div>
    </div>`;
  }

  private drawRow(row: DashboardRow, actions: DashboardActions | undefined): TemplateResult {
    const { built, board } = row;
    const title = board?.title ?? built.plan.title;
    return html`<div class="library-row">
      <button
        type="button"
        class="library-open"
        aria-label=${`Edit ${title}`}
        title=${`Edit ${title}`}
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
                ? 'No longer in Home Assistant: Edit makes it again.'
                : `Built${when(built.updated)}.`
            }</span
          >
        </span>
      </button>
      <span class="row-actions">
        ${board === undefined ? nothing : button('mdi:open-in-new', `Open ${title}`, () => actions?.open(built))}
        ${
          built.previous === undefined || board === undefined
            ? nothing
            : button('mdi:undo', `Undo the last rebuild of ${title}`, () => actions?.undo(built))
        }
        ${button('mdi:share-variant', `Share ${title}`, () => actions?.share(built))}
        ${button('mdi:delete-outline', `Forget ${title}`, () => actions?.forget(built))}
      </span>
    </div>`;
  }

  protected override render(): TemplateResult {
    const actions = this.actions;
    return html`<div class="library">
      <div class="library-head">
        <h1>Dashboards</h1>
        ${
          this.rows.length === 0
            ? nothing
            : html`<div class="library-tools">
                <button type="button" class="action" @click=${() => actions?.fromTemplate()}>
                  ${icon('mdi:file-import-outline')}<span>From a template</span>
                </button>
                <button type="button" class="action primary" @click=${() => actions?.stepByStep()}>
                  ${icon('mdi:plus')}<span>Build another</span>
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
