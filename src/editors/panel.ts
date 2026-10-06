import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type { MdiIcon } from '../contract/entities.ts';
import { field } from '../ha/field.ts';
import { quietly } from '../ha/templates.ts';

interface Folds {
  readonly open: Map<string, boolean>;
  redraw(): void;
}

export interface PanelOptions {
  readonly icon: MdiIcon;
  readonly title: string;
  readonly summary: string;
  readonly body: () => TemplateResult | readonly TemplateResult[];
}

const expanded = (event: Event): boolean | undefined =>
  event.target === event.currentTarget
    ? field(field(event, 'detail'), 'expanded') === true
    : undefined;

function native(
  options: PanelOptions,
  open: boolean,
  drawn: boolean,
  chosen: (open: boolean) => void,
): TemplateResult {
  const opening = (event: Event): void => {
    if (expanded(event) === true && !drawn) {
      chosen(open);
    }
  };
  const changed = (event: Event): void => {
    const now = expanded(event);
    if (now !== undefined) {
      chosen(now);
    }
  };
  return html`<ha-expansion-panel
    .header=${options.title}
    .secondary=${options.summary}
    .outlined=${true}
    .expanded=${open}
    @expanded-will-change=${opening}
    @expanded-changed=${changed}
  >
    <ha-icon slot="leading-icon" .icon=${options.icon}></ha-icon>
    ${open || drawn ? html`<div class="panel-body">${options.body()}</div>` : nothing}
  </ha-expansion-panel>`;
}

function lookAlike(
  options: PanelOptions,
  open: boolean,
  chosen: (open: boolean) => void,
): TemplateResult {
  return html`<div class="panel">
    <button
      type="button"
      class="panel-head"
      aria-label=${options.title}
      title=${options.title}
      aria-expanded=${String(open)}
      @click=${quietly(() => {
        chosen(!open);
      })}
    >
      <ha-icon class="panel-icon" .icon=${options.icon}></ha-icon>
      <span class="panel-words">
        <span class="panel-title">${options.title}</span>
        <span class="panel-summary">${options.summary}</span>
      </span>
      <ha-icon
        class="panel-chevron"
        .icon=${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}
      ></ha-icon>
    </button>
    ${open ? html`<div class="panel-body">${options.body()}</div>` : nothing}
  </div>`;
}

export function sectionPanel(
  folds: Folds,
  key: string,
  first: boolean,
  options: PanelOptions,
): TemplateResult {
  const open = folds.open.get(key) ?? first;
  const chosen = (next: boolean): void => {
    folds.open.set(key, next);
    folds.redraw();
  };
  return customElements.get('ha-expansion-panel') === undefined
    ? lookAlike(options, open, chosen)
    : native(options, open, folds.open.has(key), chosen);
}
