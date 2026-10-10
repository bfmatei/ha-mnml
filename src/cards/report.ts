import { css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import type { ReportCard } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { colorStyle, icon } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { SECTION_STYLE, section } from './parts/section.ts';
import { BASE_STYLE, HEADING_STYLE } from './styles.ts';

const REPORT_STYLE = css`
  .entries {
    display: flex;
    flex-direction: column;
    padding: 6px 8px;
  }
  .entry {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    column-gap: 10px;
    padding: 8px;
  }
  .entry > ha-icon {
    --mdc-icon-size: 20px;
    color: var(--m-color);
  }
  .what {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .title {
    overflow-wrap: anywhere;
  }
  .detail {
    font-size: 12px;
    line-height: 1.4;
    color: var(--secondary-text-color);
    overflow-wrap: anywhere;
  }
`;

const DEFAULT_TITLE = 'Report';

const DEFAULT_ICON: MdiIcon = 'mdi:text-box-outline';

const ENTRY_ICON: MdiIcon = 'mdi:alert-circle-outline';

interface Entry {
  title: string;
  details: string[];
}

const indentOf = (line: string): number => line.length - line.trimStart().length;

function entriesOf(raw: string): Entry[] {
  const lines = raw.split('\n').filter((line) => line.trim() !== '');
  const levels = lines.map(indentOf).filter((indent) => indent > 0);
  const top = Math.min(...levels);
  const entries: Entry[] = [];
  for (const line of lines) {
    const indent = indentOf(line);
    if (indent === 0) {
      continue;
    }
    if (indent <= top) {
      entries.push({ title: line.trim(), details: [] });
    } else {
      entries.at(-1)?.details.push(line.trim());
    }
  }
  return entries;
}

function entry({ title, details }: Entry): TemplateResult {
  return html`<div class="entry" style=${styleMap(colorStyle('red'))}>
    ${icon(ENTRY_ICON)}
    <div class="what">
      <span class="title">${title}</span>${details.map(
        (line) => html`<span class="detail">${line}</span>`,
      )}
    </div>
  </div>`;
}

const SCHEMA = schema<ReportCard>({
  type: true,
  entity: true,
  title: true,
  icon: true,
});

export class MnmlReportCard extends MnmlCard<ReportCard> {
  static override styles = [BASE_STYLE, HEADING_STYLE, SECTION_STYLE, REPORT_STYLE];

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: ReportCard): void {
    requireString('entity', config.entity);
  }

  protected draw(hass: HomeAssistant, config: ReportCard): TemplateResult | undefined {
    const raw = stateOf(hass, config.entity)?.attributes['details'];
    const entries = typeof raw === 'string' ? entriesOf(raw) : [];
    if (entries.length === 0) {
      return undefined;
    }
    const count = entries.length;
    return section(
      html`<div class="card"><div class="entries">${entries.map(entry)}</div></div>`,
      config.title ?? DEFAULT_TITLE,
      config.icon ?? DEFAULT_ICON,
      { text: String(count), label: `${count} ${count === 1 ? 'entry' : 'entries'}` },
    );
  }
}
