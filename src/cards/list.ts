import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, ListCard, ListRow, ListSummary } from '../contract/cards.ts';
import { DASH, formatState, unavailableValue } from '../ha/format.ts';
import { callService, hasValue, isUnavailable, numericState, run, stateOf } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { nameOf } from '../ha/names.ts';
import { UNAVAILABLE, matches, shown } from '../ha/rules.ts';
import { colorStyle, icon, quietly, relativeTime, stateIcon } from '../ha/templates.ts';

import { MnmlCard, requireList, requireString } from './base.ts';
import type { Host } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { SECTION_STYLE, section } from './parts/section.ts';
import type { Fold, HeadingState } from './parts/section.ts';
import { LIST_ROW } from './schemas.ts';
import { BASE_STYLE, HEADING_STYLE } from './styles.ts';

const VALUE_SHARE = 50;

const LIST_STYLE = css`
  .list {
    padding: 6px 8px;
    container-type: inline-size;
  }
  .grid {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    column-gap: 10px;
    align-items: center;
    padding: 0 8px;
  }
  .grid.bars {
    grid-template-columns: 20px minmax(0, 1fr) 72px auto;
  }
  .grid.resets {
    grid-template-columns: 20px minmax(0, 1fr) auto 28px;
  }
  .grid.bars.resets {
    grid-template-columns: 20px minmax(0, 1fr) 72px auto 28px;
  }
  .reset {
    appearance: none;
    border: 0;
    margin: 0;
    padding: 0;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: transparent;
    color: var(--secondary-text-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .reset ha-icon {
    --mdc-icon-size: 16px;
  }
  .reset:active {
    transform: scale(0.9);
  }
  @media (hover: hover) {
    .reset:hover {
      box-shadow: inset 0 0 0 999px var(--m-hover);
    }
  }
  .grid.table {
    grid-template-columns: 20px minmax(0, 1fr) repeat(var(--values), auto);
  }
  .cell {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 32px;
  }
  .header {
    height: 24px;
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .header.label {
    grid-column: 1 / 3;
  }
  .icon-cell {
    color: var(--secondary-text-color);
  }
  .icon-cell ha-state-icon {
    --mdc-icon-size: 20px;
  }
  .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .value {
    display: block;
    line-height: 32px;
    text-align: end;
    min-width: 44px;
    max-width: ${VALUE_SHARE}cqi;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: var(--secondary-text-color);
  }
  .header.value {
    line-height: 24px;
  }
  .value.colored,
  .icon-cell.colored {
    color: var(--m-color);
  }
  .bar {
    height: 4px;
    border-radius: 2px;
    background: var(--divider-color);
    overflow: hidden;
    color: var(--secondary-text-color);
  }
  .bar.colored {
    color: var(--m-color);
  }
  .bar > div {
    height: 100%;
    width: var(--fill);
    background: currentColor;
  }
  @media (forced-colors: active) {
    .bar {
      border: 1px solid CanvasText;
    }
    .bar > div {
      background: Highlight;
    }
  }
`;

type Mode = 'plain' | 'bars' | 'table';

type Content = TemplateResult | string | typeof nothing;

const ATTENTION: ReadonlySet<Color> = new Set(['red', 'orange']);

interface Rendered {
  row: ListRow;
  stateObj: HassEntity | undefined;
  cells: TemplateResult[];
  number: number | undefined;
  color: Color | undefined;
}

function cell(className: string, content: Content = nothing, color?: Color): TemplateResult {
  return html`<div
    class=${color === undefined ? `cell ${className}` : `cell ${className} colored`}
    style=${styleMap(colorStyle(color))}
  >
    ${content}
  </div>`;
}

function rowNumber(hass: HomeAssistant, row: ListRow, stateObj: HassEntity): number | undefined {
  const value = numericState(stateObj);
  if (row.of === undefined || value === undefined) {
    return value;
  }
  const of = stateOf(hass, row.of);
  const whole = numericState(of);
  const unit = 'unit_of_measurement';
  if (whole === undefined || whole === 0 || of?.attributes[unit] !== stateObj.attributes[unit]) {
    return undefined;
  }
  return (100 * value) / whole;
}

function above(limit: number | undefined, value: number | undefined): boolean {
  return limit !== undefined && value !== undefined && value > limit;
}

function below(limit: number | undefined, value: number | undefined): boolean {
  return limit !== undefined && value !== undefined && value < limit;
}

function rowColor(
  row: ListRow,
  stateObj: HassEntity,
  value: number | undefined,
): Color | undefined {
  if (isUnavailable(stateObj)) {
    return UNAVAILABLE;
  }
  if (below(row.critical, value) || above(row.critical_high, value)) {
    return 'red';
  }
  if (below(row.low, value) || above(row.high, value)) {
    return 'orange';
  }
  return row.color !== undefined && matches(row.when, stateObj.state) ? row.color : undefined;
}

function share(hass: HomeAssistant, value: number | undefined): string {
  if (value === undefined) {
    return DASH;
  }
  const format = new Intl.NumberFormat(hass.locale.language, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  return format.format(value / 100);
}

function valueOf(
  hass: HomeAssistant,
  row: ListRow,
  stateObj: HassEntity,
  value: number | undefined,
): Content {
  if (row.flag) {
    return nothing;
  }
  if (isUnavailable(stateObj)) {
    return unavailableValue(hass, stateObj);
  }
  if (row.relative) {
    return relativeTime(hass, stateObj.state);
  }
  if (row.of !== undefined) {
    return share(hass, value);
  }
  return formatState(hass, stateObj, row.words);
}

function barCell(
  row: ListRow,
  value: number | undefined,
  color: Color | undefined,
): TemplateResult {
  const fill = row.bar ? `${Math.max(0, Math.min(100, value ?? 0))}%` : undefined;
  return html`<div
    class=${classMap({ bar: row.bar === true, colored: color !== undefined })}
    style=${styleMap({ ...colorStyle(color), '--fill': fill })}
  >
    ${row.bar ? html`<div></div>` : nothing}
  </div>`;
}

function tableCell(hass: HomeAssistant, stateObj: HassEntity | undefined): TemplateResult {
  if (isUnavailable(stateObj)) {
    return cell('value', unavailableValue(hass, stateObj), UNAVAILABLE);
  }
  return cell('value', hasValue(stateObj) ? formatState(hass, stateObj) : DASH);
}

function shareCell(
  hass: HomeAssistant,
  row: ListRow,
  stateObj: HassEntity | undefined,
): TemplateResult {
  if (stateObj === undefined || isUnavailable(stateObj) || !hasValue(stateObj)) {
    return tableCell(hass, stateObj);
  }
  const number = rowNumber(hass, row, stateObj);
  const color = above(row.critical_high, number)
    ? 'red'
    : above(row.high, number)
      ? 'orange'
      : undefined;
  return cell('value', share(hass, number), color);
}

function resetCell(hass: HomeAssistant, row: ListRow, host: Host): TemplateResult {
  const id = row.reset;
  if (id === undefined) {
    return cell('');
  }
  const label = `Reset ${nameOf(hass, row.entity, row)}`;
  return cell(
    '',
    html`<button
      type="button"
      class="reset"
      aria-label=${label}
      title=${label}
      @click=${quietly(() => {
        run(host, callService(hass, id, 'button.press'));
      })}
    >
      ${icon('mdi:restart')}
    </button>`,
  );
}

function zero(stateObj: HassEntity): HassEntity {
  return { ...stateObj, state: '0' };
}

function emptyAsZero(row: ListRow, stateObj: HassEntity | undefined): HassEntity | undefined {
  return row.zero_when_empty && stateObj !== undefined && !hasValue(stateObj)
    ? zero(stateObj)
    : stateObj;
}

function renderRow(
  hass: HomeAssistant,
  row: ListRow,
  mode: Mode,
  columns: number,
  resets: boolean,
  host: Host,
): Rendered | undefined {
  if (!shown(hass, row.show, row.entity)) {
    return undefined;
  }
  const stateObj = emptyAsZero(row, stateOf(hass, row.entity));
  const label = cell('label', nameOf(hass, row.entity, row));
  if (mode === 'table') {
    const values = Array.from({ length: columns }, (_, index) =>
      stateOf(hass, row.values?.[index]),
    );
    if (!values.some((value) => hasValue(value) || isUnavailable(value))) {
      return undefined;
    }
    const color =
      isUnavailable(stateObj) || values.some((value) => isUnavailable(value))
        ? UNAVAILABLE
        : undefined;
    const iconCell = cell(
      'icon-cell',
      stateIcon(hass, stateObj),
      isUnavailable(stateObj) ? UNAVAILABLE : undefined,
    );
    return {
      row,
      stateObj,
      cells: [
        iconCell,
        label,
        ...values.map((value, index) =>
          row.of !== undefined && index === columns - 1
            ? shareCell(hass, row, value)
            : tableCell(hass, value),
        ),
      ],
      number: undefined,
      color,
    };
  }
  if (!hasValue(stateObj) && !isUnavailable(stateObj)) {
    return undefined;
  }
  const number = rowNumber(hass, row, stateObj);
  const color = rowColor(row, stateObj, number);
  const cells = [
    cell('icon-cell', stateIcon(hass, stateObj), color),
    label,
    ...(mode === 'bars' ? [barCell(row, number, color)] : []),
    cell('value', valueOf(hass, row, stateObj, number), color),
    ...(resets ? [resetCell(hass, row, host)] : []),
  ];
  return { row, stateObj, cells, number, color };
}

function lowestFirst(rendered: Rendered[]): Rendered[] {
  return [...rendered].sort(
    (a, b) => (a.number ?? Number.POSITIVE_INFINITY) - (b.number ?? Number.POSITIVE_INFINITY),
  );
}

function decimals(state: string): number {
  return state.split('.')[1]?.length ?? 0;
}

function extreme(
  hass: HomeAssistant,
  rendered: Rendered[],
  summary: 'lowest' | 'highest',
): HeadingState | undefined {
  let pick: Rendered | undefined;
  for (const entry of rendered) {
    if (entry.number === undefined || entry.stateObj === undefined) {
      continue;
    }
    if (
      pick?.number === undefined ||
      (summary === 'lowest' ? entry.number < pick.number : entry.number > pick.number)
    ) {
      pick = entry;
    }
  }
  if (pick?.stateObj === undefined) {
    return undefined;
  }
  const value =
    pick.row.of === undefined
      ? formatState(hass, pick.stateObj, pick.row.words)
      : share(hass, pick.number);
  const text = `${summary === 'lowest' ? 'Lowest' : 'Highest'} ${value}`;
  return { text, label: text };
}

function total(
  hass: HomeAssistant,
  rendered: Rendered[],
  column: number,
  header: string | undefined,
): HeadingState | undefined {
  const states = rendered
    .map((entry) => stateOf(hass, entry.row.values?.[column]))
    .filter((stateObj) => numericState(stateObj) !== undefined);
  const [first] = states;
  const unit = 'unit_of_measurement';
  if (
    first === undefined ||
    states.some((stateObj) => stateObj?.attributes[unit] !== first.attributes[unit])
  ) {
    return undefined;
  }
  const sum = states.reduce((acc, stateObj) => acc + (numericState(stateObj) ?? 0), 0);
  const places = Math.max(...states.map((stateObj) => decimals(stateObj?.state ?? '')));
  const value = hass.formatEntityState(first, sum.toFixed(places));
  const text = header === undefined ? value : `${header} ${value}`;
  return { text, label: text };
}

function summarise(
  hass: HomeAssistant,
  rendered: Rendered[],
  summary: ListSummary | undefined,
  headers: string[] | undefined,
): HeadingState | undefined {
  if (summary === undefined) {
    return undefined;
  }
  if (typeof summary === 'string') {
    return extreme(hass, rendered, summary);
  }
  return total(hass, rendered, summary.sum, headers?.[summary.sum + 1]);
}

const SCHEMA = schema<ListCard>(
  {
    type: true,
    lowest_first: true,
    fold: true,
    summary: true,
    title: true,
    icon: true,
    headers: true,
    rows: true,
  },
  { rows: LIST_ROW },
);

export class MnmlListCard extends MnmlCard<ListCard> {
  static override styles = [BASE_STYLE, HEADING_STYLE, SECTION_STYLE, LIST_STYLE];

  @state() private choice: boolean | undefined;

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: ListCard): void {
    requireList('rows', config.rows);
    for (const [index, row] of config.rows.entries()) {
      requireString(`rows[${index}].entity`, row.entity);
    }
    if (
      config.summary !== undefined &&
      config.summary !== 'lowest' &&
      config.summary !== 'highest' &&
      typeof config.summary.sum !== 'number'
    ) {
      throw new Error('summary must be lowest, highest or { sum: <column> }');
    }
  }

  protected draw(hass: HomeAssistant, config: ListCard): TemplateResult | undefined {
    const [nameHeader, ...valueHeaders] = config.headers ?? [];
    const mode: Mode =
      nameHeader !== undefined ? 'table' : config.rows.some((row) => row.bar) ? 'bars' : 'plain';
    const resets = mode !== 'table' && config.rows.some((row) => row.reset !== undefined);
    const rendered = config.rows
      .map((row) => renderRow(hass, row, mode, valueHeaders.length, resets, this))
      .filter((entry) => entry !== undefined);
    if (rendered.length === 0) {
      return undefined;
    }
    const ordered = config.lowest_first && mode !== 'table' ? lowestFirst(rendered) : rendered;
    const headers =
      nameHeader === undefined
        ? []
        : [
            cell('header label', nameHeader),
            ...valueHeaders.map((header) => cell('header value', header)),
          ];
    const card = html`<div class="card list">
      <div
        class=${resets ? `grid ${mode} resets` : `grid ${mode}`}
        style=${styleMap({ '--values': String(valueHeaders.length) })}
      >
        ${headers}${ordered.map((entry) => entry.cells)}
      </div>
    </div>`;
    const attention = rendered.some(
      (entry) => entry.color !== undefined && ATTENTION.has(entry.color),
    );
    const fold: Fold | undefined = config.fold
      ? {
          open: this.choice ?? attention,
          chosen: (open: boolean): void => {
            this.choice = open;
          },
        }
      : undefined;
    const summary = summarise(hass, rendered, config.summary, config.headers);
    return section(card, config.title, config.icon, summary, fold);
  }
}
