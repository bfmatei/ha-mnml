import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, ReportCard } from '../contract/cards.ts';
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
  .label {
    padding: 8px 8px 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
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

interface Group {
  label?: string;
  word?: string;
  entries: Entry[];
}

interface Entry {
  title: string;
  details: string[];
}

const indentOf = (line: string): number => line.length - line.trimStart().length;

function groupsOf(raw: string): Group[] {
  const lines = raw.split('\n').filter((line) => line.trim() !== '');
  const levels = lines.map(indentOf).filter((indent) => indent > 0);
  const top = Math.min(...levels);
  const groups: Group[] = [];
  for (const line of lines) {
    const indent = indentOf(line);
    if (indent === 0) {
      const label = line.trim().replace(/:$/, '');
      groups.push({ label, word: label.split(' ').at(-1), entries: [] });
      continue;
    }
    const group = groups.at(-1) ?? groups[groups.push({ entries: [] }) - 1];
    if (indent <= top) {
      group?.entries.push({ title: line.trim(), details: [] });
    } else {
      group?.entries.at(-1)?.details.push(line.trim());
    }
  }
  return groups.filter((group) => group.entries.length > 0);
}

function entry({ title, details }: Entry): TemplateResult {
  return html`<div class="entry">
    ${icon(ENTRY_ICON)}
    <div class="what">
      <span class="title">${title}</span>${details.map(
        (line) => html`<span class="detail">${line}</span>`,
      )}
    </div>
  </div>`;
}

function group({ label, word, entries }: Group, colors: Record<string, Color>): TemplateResult {
  const color = word === undefined ? undefined : colors[word];
  return html`<div class="group" style=${styleMap(colorStyle(color ?? 'red'))}>
    ${label === undefined ? nothing : html`<span class="label">${label}</span>`}${entries.map(entry)}
  </div>`;
}

const SCHEMA = schema<ReportCard>({
  type: true,
  entity: true,
  title: true,
  icon: true,
  colors: true,
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
    const groups = typeof raw === 'string' ? groupsOf(raw) : [];
    const count = groups.reduce((sum, each) => sum + each.entries.length, 0);
    if (count === 0) {
      return undefined;
    }
    return section(
      html`<div class="card">
        <div class="entries">${groups.map((each) => group(each, config.colors ?? {}))}</div>
      </div>`,
      config.title ?? DEFAULT_TITLE,
      config.icon ?? DEFAULT_ICON,
      { text: String(count), label: `${count} ${count === 1 ? 'entry' : 'entries'}` },
    );
  }
}
