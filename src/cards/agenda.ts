import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { AgendaCard, AgendaSource } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { SEPARATOR } from '../ha/format.ts';
import { isUnavailable, stateOf } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { nameOf } from '../ha/names.ts';
import { UNAVAILABLE } from '../ha/rules.ts';
import { colorStyle, icon, quietly } from '../ha/templates.ts';

import { MnmlCard, requireList, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { SECTION_STYLE, section } from './parts/section.ts';
import { AGENDA_SOURCE } from './schemas.ts';
import { BASE_STYLE, CONTROL_STYLE, HEADING_STYLE } from './styles.ts';

const WINDOW_WEEKS = 13;

const SEARCH_WINDOWS = 4;

const WEEK_MS = 7 * 24 * 3600 * 1000;

const AGENDA_STYLE = css`
  .agenda {
    padding: 6px 8px;
  }
  .week {
    display: flex;
    align-items: flex-end;
    height: 28px;
    padding: 0 8px 4px;
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .release {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    column-gap: 10px;
    align-items: center;
    min-height: 40px;
    padding: 2px 8px;
  }
  .release > ha-icon {
    --mdc-icon-size: 20px;
    color: var(--secondary-text-color);
  }
  .what {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .name,
  .detail {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail {
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .day {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--secondary-text-color);
  }
  .note {
    padding: 8px;
    font-size: 13px;
    color: var(--secondary-text-color);
  }
  .note.colored {
    color: var(--m-color);
  }
  .more {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 6px 0 2px;
  }
  .more .control {
    padding: 0 12px;
  }
`;

const EPISODE_ICON: MdiIcon = 'mdi:television-classic';

const MOVIE_ICON: MdiIcon = 'mdi:movie-open-outline';

const EPISODE = /^(.+) - S(\d+)E(\d+) - (.*)$/;

const KINDS = new Set(['episodes', 'movies']);

type Kind = AgendaSource['kind'];

interface CalendarEvent {
  summary: string;
  start: { dateTime?: string; date?: string };
}

interface Release {
  at: Date;
  kind: Kind;
  name: string;
  title?: string;
  season?: number;
  episode?: number;
}

interface Row {
  at: Date;
  kind: Kind;
  name: string;
  detail?: string;
}

interface Chunk {
  rows: Row[];
  failed: string[];
}

interface Week {
  start: Date;
  rows: Row[];
}

interface Plan {
  weeks: Week[];
  failed: Set<string>;
  missing?: number;
}

function isEvent(value: unknown): value is CalendarEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('summary' in value) || typeof value.summary !== 'string' || !('start' in value)) {
    return false;
  }
  const { start } = value;
  return (
    typeof start === 'object' &&
    start !== null &&
    (('dateTime' in start && typeof start.dateTime === 'string') ||
      ('date' in start && typeof start.date === 'string'))
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function mondayOf(date: Date): Date {
  return addDays(startOfDay(date), -((date.getDay() + 6) % 7));
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOf(event: CalendarEvent): Date | undefined {
  if (event.start.dateTime !== undefined) {
    const when = new Date(event.start.dateTime);
    return Number.isNaN(when.getTime()) ? undefined : when;
  }
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.start.date ?? '');
  return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : undefined;
}

function release(event: CalendarEvent, at: Date, kind: Kind): Release {
  const match = kind === 'episodes' ? EPISODE.exec(event.summary) : null;
  if (match === null) {
    return { at, kind, name: event.summary };
  }
  const [, name = event.summary, season = '0', episode = '0', title = ''] = match;
  return { at, kind, name, title, season: Number(season), episode: Number(episode) };
}

function code(season: number, episode: number): string {
  return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
}

function span(first: Release, last: Release): string {
  const from = code(first.season ?? 0, first.episode ?? 0);
  const to = code(last.season ?? 0, last.episode ?? 0);
  return first.season === last.season ? `${from}-${to.slice(to.indexOf('E'))}` : `${from}-${to}`;
}

function fold(releases: Release[]): Row[] {
  const sorted = [...releases].sort(
    (a, b) =>
      a.at.getTime() - b.at.getTime() ||
      a.name.localeCompare(b.name) ||
      (a.season ?? 0) - (b.season ?? 0) ||
      (a.episode ?? 0) - (b.episode ?? 0),
  );
  const rows: Row[] = [];
  let group: Release[] = [];
  const flush = (): void => {
    const [first] = group;
    const last = group.at(-1);
    if (first === undefined || last === undefined) {
      return;
    }
    if (first.season === undefined) {
      rows.push({ at: first.at, kind: first.kind, name: first.name });
    } else if (group.length === 1) {
      const head = code(first.season, first.episode ?? 0);
      rows.push({
        at: first.at,
        kind: first.kind,
        name: first.name,
        detail: first.title ? `${head}${SEPARATOR}${first.title}` : head,
      });
    } else {
      rows.push({
        at: first.at,
        kind: first.kind,
        name: first.name,
        detail: `${span(first, last)}${SEPARATOR}${group.length} episodes`,
      });
    }
    group = [];
  };
  for (const entry of sorted) {
    const [previous] = group;
    const together =
      previous !== undefined &&
      entry.season !== undefined &&
      previous.season !== undefined &&
      previous.name === entry.name &&
      dayKey(previous.at) === dayKey(entry.at);
    if (!together) {
      flush();
    }
    group.push(entry);
  }
  flush();
  return rows.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function shortDate(language: string, date: Date): string {
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(date);
}

function longDate(language: string, date: Date): string {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function weeksOf(rows: Row[]): Week[] {
  const weeks: Week[] = [];
  for (const row of rows) {
    const start = mondayOf(row.at);
    const last = weeks.at(-1);
    if (last?.start.getTime() === start.getTime()) {
      last.rows.push(row);
    } else {
      weeks.push({ start, rows: [row] });
    }
  }
  return weeks;
}

function dayLabel(language: string, date: Date): string {
  return `${new Intl.DateTimeFormat(language, { weekday: 'short' }).format(date)} ${date.getDate()}`;
}

function weekLabel(language: string, week: Date, thisWeek: Date): string {
  const weeks = Math.round((week.getTime() - thisWeek.getTime()) / WEEK_MS);
  if (weeks === 0) {
    return 'This week';
  }
  if (weeks === 1) {
    return 'Next week';
  }
  return `Week of ${shortDate(language, week)}`;
}

function note(text: string, warning?: true): TemplateResult {
  const color = warning ? UNAVAILABLE : undefined;
  return html`<div
    class=${classMap({ note: true, colored: color !== undefined })}
    style=${styleMap(colorStyle(color))}
  >
    ${text}
  </div>`;
}

function releaseRow(language: string, row: Row): TemplateResult {
  return html`<div class="release">
    ${icon(row.kind === 'episodes' ? EPISODE_ICON : MOVIE_ICON)}
    <div class="what">
      <div class="name">${row.name}</div>
      ${row.detail === undefined ? nothing : html`<div class="detail">${row.detail}</div>`}
    </div>
    <div class="day">${dayLabel(language, row.at)}</div>
  </div>`;
}

const SCHEMA = schema<AgendaCard>(
  { type: true, title: true, icon: true, sources: true },
  { sources: AGENDA_SOURCE },
);

export class MnmlAgendaCard extends MnmlCard<AgendaCard> {
  static override styles = [BASE_STYLE, HEADING_STYLE, SECTION_STYLE, CONTROL_STYLE, AGENDA_STYLE];

  @state() private shown = 1;
  @state() private horizon = SEARCH_WINDOWS - 1;
  private key = '';
  private token = 0;
  private readonly loaded = new Map<number, Chunk>();
  private readonly loading = new Set<number>();

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: AgendaCard): void {
    requireList('sources', config.sources);
    for (const source of config.sources) {
      requireString('sources entity', source.entity);
      if (!KINDS.has(source.kind)) {
        throw new Error('sources kind must be episodes or movies');
      }
    }
  }

  private range(today: Date, window: number): [Date, Date] {
    const monday = mondayOf(today);
    const start = window === 0 ? today : addDays(monday, 7 * WINDOW_WEEKS * window);
    return [start, addDays(monday, 7 * WINDOW_WEEKS * (window + 1))];
  }

  private windowOf(today: Date, week: Date): number {
    const weeks = Math.round((week.getTime() - mondayOf(today).getTime()) / WEEK_MS);
    return Math.floor(weeks / WINDOW_WEEKS);
  }

  private sync(hass: HomeAssistant, config: AgendaCard, today: Date): void {
    const states = config.sources.map((source) => {
      const stateObj = stateOf(hass, source.entity);
      return `${source.entity}=${stateObj?.state ?? ''}@${stateObj?.last_changed ?? ''}`;
    });
    const key = [dayKey(today), ...states].join('|');
    if (key !== this.key) {
      this.key = key;
      this.token += 1;
      this.loaded.clear();
      this.loading.clear();
    }
  }

  private load(hass: HomeAssistant, config: AgendaCard, today: Date, window: number): void {
    if (this.loading.has(window)) {
      return;
    }
    const token = this.token;
    const [start, end] = this.range(today, window);
    const query = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    const live = config.sources.filter((source) => {
      const stateObj = stateOf(hass, source.entity);
      return stateObj !== undefined && !isUnavailable(stateObj);
    });
    this.loading.add(window);
    const answers = live.map((source) =>
      hass.callApi('GET', `calendars/${source.entity}?${query}`).then(
        (result) => ({ source, events: Array.isArray(result) ? result.filter(isEvent) : [] }),
        () => ({ source, events: undefined }),
      ),
    );
    void Promise.all(answers).then((results) => {
      if (token !== this.token) {
        return;
      }
      const releases: Release[] = [];
      const failed: string[] = [];
      for (const { source, events } of results) {
        if (events === undefined) {
          failed.push(nameOf(hass, source.entity, { label: 'device' }));
          continue;
        }
        for (const event of events) {
          const when = startOf(event);
          if (when !== undefined && when >= start && when < end) {
            releases.push(release(event, when, source.kind));
          }
        }
      }
      this.loading.delete(window);
      this.loaded.set(window, { rows: fold(releases), failed });
      const { missing } = this.plan();
      if (releases.length === 0 && failed.length === 0 && missing !== undefined) {
        this.load(hass, config, today, missing);
        return;
      }
      this.refresh();
    });
  }

  private plan(): Plan {
    const weeks: Week[] = [];
    const failed = new Set<string>();
    for (let window = 0; window <= this.horizon && weeks.length < this.shown; window += 1) {
      const chunk = this.loaded.get(window);
      if (chunk === undefined) {
        return { weeks, failed, missing: window };
      }
      for (const name of chunk.failed) {
        failed.add(name);
      }
      weeks.push(...weeksOf(chunk.rows));
    }
    return { weeks, failed };
  }

  private more(enough: boolean, today: Date, last: Week | undefined): TemplateResult {
    const next = (): void => {
      if (enough && last !== undefined) {
        this.shown += 1;
        this.horizon = Math.max(this.horizon, this.windowOf(today, last.start) + SEARCH_WINDOWS);
      } else {
        this.horizon += SEARCH_WINDOWS;
      }
    };
    const back = (): void => {
      this.shown = 1;
      this.horizon = SEARCH_WINDOWS - 1;
    };
    return html`<div class="more">
      <button
        type="button"
        class="control primary"
        aria-label="Next"
        title="Next"
        @click=${quietly(next)}
      >
        ${icon('mdi:chevron-down')}Next
      </button>
      ${
        this.shown > 1 || this.horizon > SEARCH_WINDOWS - 1
          ? html`<button
              type="button"
              class="control"
              aria-label="Back to now"
              title="Back to now"
              @click=${quietly(back)}
            >
              ${icon('mdi:chevron-up')}Back to now
            </button>`
          : nothing
      }
    </div>`;
  }

  protected draw(hass: HomeAssistant, config: AgendaCard): TemplateResult {
    const today = startOfDay(new Date());
    const language = hass.locale.language;
    this.sync(hass, config, today);
    const { weeks, failed, missing } = this.plan();
    if (missing !== undefined) {
      this.load(hass, config, today, missing);
    }
    const unavailable = config.sources.filter((source) => {
      const stateObj = stateOf(hass, source.entity);
      return stateObj === undefined || isUnavailable(stateObj);
    });
    const notes = [
      ...unavailable.map((source) =>
        note(`${nameOf(hass, source.entity, { label: 'device' })} unavailable`, true),
      ),
      ...[...failed].map((name) => note(`Couldn't read ${name}`, true)),
    ];
    const visible = weeks.slice(0, this.shown);
    const thisWeek = mondayOf(today);
    const listed = visible.map(
      (week) =>
        html`<div class="week">${weekLabel(language, week.start, thisWeek)}</div>
          ${week.rows.map((row) => releaseRow(language, row))}`,
    );
    const enough = visible.length >= this.shown;
    const [, end] = this.range(today, this.horizon);
    const tail =
      missing !== undefined
        ? note('Loading')
        : enough
          ? nothing
          : note(`Nothing until ${longDate(language, addDays(end, -1))}`);
    const card = html`<div class="card agenda">
      ${notes}${listed}${tail}${this.more(enough, today, visible.at(-1))}
    </div>`;
    return section(card, config.title, config.icon);
  }
}
