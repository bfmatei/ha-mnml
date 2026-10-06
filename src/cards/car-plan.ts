import { css, html, nothing, svg } from 'lit';
import type { SVGTemplateResult, TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import type { CarPlanCard } from '../contract/cards.ts';
import type { Corners } from '../contract/entities.ts';
import { DASH } from '../ha/format.ts';
import { hasValue, isUnavailable, numericState, stateOf, stringAttribute } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { normalise, tyreBand } from '../ha/rules.ts';

import { MnmlCard, requireList, requireNumber, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { SECTION_STYLE, section } from './parts/section.ts';
import { BASE_STYLE, HEADING_STYLE } from './styles.ts';

const CAR_STYLE = css`
  .plan {
    padding: 8px;
  }
  .drawing {
    max-width: 520px;
    margin: 0 auto;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .labels {
    position: relative;
    height: 18px;
  }
  .labels span {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 12px;
    line-height: 18px;
    font-variant-numeric: tabular-nums;
    color: var(--secondary-text-color);
  }
  .labels span.low {
    color: var(--red-color);
  }
  .labels span.warn,
  .labels span.unavailable {
    color: var(--orange-color);
  }
  .body {
    fill: var(--m-pill);
    stroke: color-mix(in srgb, var(--primary-text-color) 32%, transparent);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .part {
    fill: transparent;
  }
  .roof {
    fill: none;
    stroke: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .sunroof {
    fill: transparent;
    stroke: color-mix(in srgb, var(--primary-text-color) 26%, transparent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .glass {
    fill: color-mix(in srgb, var(--primary-text-color) 26%, transparent);
  }
  .seam {
    fill: none;
    stroke: color-mix(in srgb, var(--primary-text-color) 20%, transparent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .lamp {
    fill: color-mix(in srgb, var(--primary-text-color) 22%, var(--card-background-color));
  }
  .lamp.front {
    fill: color-mix(in srgb, var(--primary-text-color) 52%, var(--card-background-color));
  }
  .cowl {
    fill: color-mix(in srgb, var(--primary-text-color) 26%, transparent);
  }
  .part.open {
    fill: var(--orange-color);
    fill-opacity: 0.85;
  }
  .part.half {
    fill: var(--orange-color);
    fill-opacity: 0.45;
  }
  .tyre {
    fill: color-mix(in srgb, var(--primary-text-color) 38%, transparent);
  }
  .tyre.low {
    fill: var(--red-color);
  }
  .tyre.warn {
    fill: var(--orange-color);
  }
  .caption {
    padding: 4px 8px 0;
    font-size: 13px;
    color: var(--secondary-text-color);
    text-align: center;
  }
  .caption.alert {
    color: var(--orange-color);
  }
`;

const CORNER_NAMES: Corners<string> = ['Front left', 'Front right', 'Rear left', 'Rear right'];

const TRACE = { x: 13, y: 65, w: 966, h: 490 };
const MARGIN = 8;
const WIDTH = 480;
const SCALE = (WIDTH - MARGIN * 2) / TRACE.w;
const HEIGHT = Math.round(TRACE.h * SCALE + MARGIN * 2);
const VIEW_BOX = `0 0 ${WIDTH} ${HEIGHT}`;
const PLAN =
  `translate(${MARGIN} ${MARGIN}) scale(${-SCALE} ${SCALE})` +
  ` translate(${-(TRACE.x + TRACE.w)} ${-TRACE.y})`;

const BODY =
  'M 620 554 C 618 552 619 546 621 540 C 624 532 631 517 634 512 L 637 508 L 383 508 L 130 507' +
  ' L 120 505 C 84 497 58 481 43 458 C 32 441 20 409 15 378 C 13 364 12 283 14 262 C 17 225 25' +
  ' 191 37 170 C 49 146 76 128 116 118 C 140 112 120 112 390 112 L 636 112 L 627 95 C 618 78 618' +
  ' 77 619 73 C 620 65 621 65 636 65 C 652 66 655 67 666 77 C 673 85 679 94 683 106 L 685 112 L' +
  ' 775 112 L 865 113 L 877 115 C 904 121 926 131 936 143 C 941 148 950 161 955 171 C 966 189' +
  ' 971 209 977 254 C 979 270 979 274 979 324 C 978 375 978 377 976 390 C 966 441 946 475 914' +
  ' 492 C 904 497 894 500 873 505 L 856 508 L 770 509 L 685 509 L 684 512 C 681 520 673 535 668' +
  ' 540 C 663 547 656 552 650 554 C 645 555 622 555 620 554 Z';

const WINDSCREEN =
  'M 708 472 C 713 470 718 463 726 447 C 754 391 762 324 750 249 C 747 234 742 214 738 200 C' +
  ' 730 177 716 154 708 150 C 704 148 703 148 696 149 C 691 150 682 152 676 154 C 658 160 629' +
  ' 172 625 175 L 622 178 L 624 189 C 627 206 631 243 631 260 C 633 293 632 356 631 374 C 628' +
  ' 401 626 420 624 428 C 622 441 622 442 624 446 C 626 450 629 451 664 463 C 694 473 701 474' +
  ' 708 472 Z';

const REAR_SCREEN =
  'M 194 429 C 205 428 225 424 230 421 C 233 420 233 419 233 417 C 232 412 229 386 228 365 C' +
  ' 224 324 226 250 232 214 C 233 202 233 201 226 198 C 218 195 181 190 165 191 C 149 192 143' +
  ' 197 137 216 C 125 251 121 307 126 350 C 133 399 139 420 151 427 C 157 430 176 431 194 429 Z';

const COWL =
  'M 755 443 C 764 427 773 399 778 366 C 782 344 783 332 783 303 C 783 282 783 274 781 263 C' +
  ' 778 245 775 229 769 212 C 763 195 751 168 747 164 C 744 162 745 163 749 173 C 763 201 771' +
  ' 227 775 258 C 778 274 779 326 777 342 C 773 381 762 423 750 447 C 746 455 746 456 748 453 C' +
  ' 750 452 753 447 755 443 Z';

const WINDOW_PANES: Corners<string> = [
  'M 636 484 C 626 481 601 475 588 472 C 565 468 488 462 488 465 C 488 465 490 470 494 476' +
    ' L 499 487 L 571 487 L 643 487 L 636 484 Z',
  'M 533 155 C 578 152 603 148 636 137 L 645 134 L 572 134 L 500 135 L 494 146 C 491 152 488' +
    ' 157 488 157 C 488 158 503 157 533 155 Z',
  'M 476 487 C 476 487 464 463 464 463 C 463 463 252 456 252 457 C 249 458 255 470 262 477 C' +
    ' 265 480 270 483 273 485 L 279 488 L 377 488 C 432 488 476 488 476 487 Z',
  'M 363 162 C 413 161 456 160 459 159 L 464 159 L 470 147 C 473 140 476 135 476 135 C 476 134' +
    ' 432 134 377 134 L 279 134 L 273 137 C 265 141 257 150 253 157 C 249 166 249 166 262 166 C' +
    ' 268 165 313 164 363 162 Z',
];

const FRONT_LAMPS: [string, string] = [
  'M 950 227 C 951 224 942 199 936 187 C 925 164 916 155 897 149 C 888 146 875 144 875 146 C' +
    ' 875 148 887 169 896 183 C 910 205 925 219 942 226 C 949 228 949 228 950 227 Z',
  'M 894 471 C 907 468 918 460 925 451 C 930 446 936 434 940 423 C 943 416 950 393 950 391 C' +
    ' 950 389 946 390 939 394 C 927 399 916 409 908 418 C 898 431 879 464 877 473 C 876 475 876' +
    ' 475 882 474 C 885 473 890 472 894 471 Z',
];

const REAR_LAMPS: [string, string] = [
  'M 57 228 C 58 225 61 217 63 211 C 68 197 78 177 87 165 L 94 156 L 88 158 C 77 162 74 165 68' +
    ' 171 C 57 183 48 206 48 225 C 47 237 51 239 57 228 Z',
  'M 88 456 C 77 442 70 427 63 407 C 59 394 56 388 52 385 C 48 381 47 393 50 408 C 54 430 66' +
    ' 451 77 457 C 81 459 92 464 94 464 C 94 464 91 461 88 456 Z',
];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
}

const SCREEN_SHIFT = 12;
const SHIFT = `translate(${SCREEN_SHIFT} 0)`;
const ROOF: Rect = { x: 247, y: 170, w: 373, h: 280, rx: 30 };
const SUNROOF: Rect = { x: 376, y: 205, w: 192, h: 213, rx: 12 };

const DOOR_PANELS: Corners<string> = [
  '482,510 650,510 645,486 488,486',
  '482,110 650,110 645,135 488,135',
  '241,510 482,510 476,487 249,487',
  '241,110 482,110 476,135 249,135',
];

const HOOD: Rect = { x: 790, y: 60, w: 210, h: 500 };
const TAILGATE: Rect = { x: 0, y: 60, w: 121, h: 500 };

const TYRES: Corners<Rect> = [
  { x: 750, y: 486, w: 130, h: 46, rx: 9 },
  { x: 750, y: 88, w: 130, h: 46, rx: 9 },
  { x: 170, y: 486, w: 130, h: 46, rx: 9 },
  { x: 170, y: 88, w: 130, h: 46, rx: 9 },
];

interface Mark {
  state: 'open' | 'half' | undefined;
  title: string;
}

function classOf(className: string, extra: string | undefined): string {
  return extra === undefined ? className : `${className} ${extra}`;
}

function titleOf(mark: Mark | undefined): SVGTemplateResult | typeof nothing {
  return mark === undefined ? nothing : svg`<title>${mark.title}</title>`;
}

function rect(shape: Rect, className: string, mark?: Mark): SVGTemplateResult {
  return svg`<rect
    x=${shape.x}
    y=${shape.y}
    width=${shape.w}
    height=${shape.h}
    rx=${shape.rx ?? 0}
    class=${classOf(className, mark?.state)}
  >${titleOf(mark)}</rect>`;
}

function path(d: string, className: string, mark?: Mark): SVGTemplateResult {
  return svg`<path d=${d} class=${classOf(className, mark?.state)}>${titleOf(mark)}</path>`;
}

function poly(points: string, className: string, mark: Mark): SVGTemplateResult {
  return svg`<polygon points=${points} class=${classOf(className, mark.state)}>${titleOf(
    mark,
  )}</polygon>`;
}

function shifted(d: string, className: string): SVGTemplateResult {
  return svg`<path d=${d} class=${className} transform=${SHIFT}></path>`;
}

function planLeft(x: number): string {
  return `${((MARGIN + (TRACE.x + TRACE.w - x) * SCALE) / WIDTH) * 100}%`;
}

const OPEN_STATES = ['on', 'open'];

const HALF_STATES = ['intermediate'];

function openness(
  config: CarPlanCard,
  stateObj: HassEntity | undefined,
): 'open' | 'half' | undefined {
  if (!hasValue(stateObj)) {
    return undefined;
  }
  const state = normalise(stateObj.state);
  if ((config.open_states ?? OPEN_STATES).some((entry) => normalise(entry) === state)) {
    return 'open';
  }
  return (config.half_states ?? HALF_STATES).some((entry) => normalise(entry) === state)
    ? 'half'
    : undefined;
}

function describe(hass: HomeAssistant, stateObj: HassEntity | undefined): string {
  return hasValue(stateObj) || isUnavailable(stateObj) ? hass.formatEntityState(stateObj) : DASH;
}

const formats = new Map<string, Intl.NumberFormat>();

function formatNumber(hass: HomeAssistant, stateObj: HassEntity, value: number): string {
  const precision = hass.entities[stateObj.entity_id]?.display_precision;
  const key = `${hass.locale.language} ${precision ?? ''}`;
  let format = formats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(
      hass.locale.language,
      precision === undefined
        ? { maximumFractionDigits: 2 }
        : { minimumFractionDigits: precision, maximumFractionDigits: precision },
    );
    formats.set(key, format);
  }
  return format.format(value);
}

function pressure(
  hass: HomeAssistant,
  current: HassEntity | undefined,
  target: HassEntity | undefined,
): string {
  const value = numericState(current);
  if (current === undefined || value === undefined) {
    return DASH;
  }
  const goal = numericState(target);
  const unit = stringAttribute(current, 'unit_of_measurement') ?? '';
  const now = formatNumber(hass, current, value);
  const text =
    target === undefined || goal === undefined
      ? now
      : `${now} / ${formatNumber(hass, target, goal)}`;
  return unit === '' ? text : `${text} ${unit}`;
}

const SCHEMA = schema<CarPlanCard>({
  type: true,
  title: true,
  icon: true,
  doors: true,
  hood: true,
  tailgate: true,
  windows: true,
  sunroof: true,
  open_states: true,
  half_states: true,
  tyres: true,
  tyre_targets: true,
  tyre_low_share: true,
  tyre_warn_share: true,
});

export class MnmlCarPlanCard extends MnmlCard<CarPlanCard> {
  static override styles = [BASE_STYLE, HEADING_STYLE, SECTION_STYLE, CAR_STYLE];

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: CarPlanCard): void {
    requireList('doors', config.doors, 4);
    requireList('windows', config.windows, 4);
    requireList('tyres', config.tyres, 4);
    requireList('tyre_targets', config.tyre_targets, 4);
    requireString('hood', config.hood);
    requireString('tailgate', config.tailgate);
    requireNumber('tyre_low_share', config.tyre_low_share);
    requireNumber('tyre_warn_share', config.tyre_warn_share);
  }

  protected draw(hass: HomeAssistant, config: CarPlanCard): TemplateResult {
    const problems: string[] = [];
    const mark = (name: string, stateObj: HassEntity | undefined): Mark => {
      const state = openness(config, stateObj);
      if (state !== undefined) {
        problems.push(`${name} ${state === 'half' ? 'half open' : 'open'}`);
      }
      return { state, title: `${name}: ${describe(hass, stateObj)}` };
    };
    const hood = rect(HOOD, 'part', mark('Hood', stateOf(hass, config.hood)));
    const tailgate = rect(TAILGATE, 'part', mark('Tailgate', stateOf(hass, config.tailgate)));
    const doors = DOOR_PANELS.map((panel, index) =>
      poly(
        panel,
        'part',
        mark(`${CORNER_NAMES[index] ?? ''} door`, stateOf(hass, config.doors[index])),
      ),
    );
    const windows = WINDOW_PANES.map((pane, index) =>
      path(
        pane,
        'glass part',
        mark(`${CORNER_NAMES[index] ?? ''} window`, stateOf(hass, config.windows[index])),
      ),
    );
    const sunroof =
      config.sunroof === undefined
        ? nothing
        : rect(SUNROOF, 'sunroof part', mark('Sunroof', stateOf(hass, config.sunroof)));
    const tyres = TYRES.map((shape, index) => {
      const current = stateOf(hass, config.tyres[index]);
      const target = stateOf(hass, config.tyre_targets[index]);
      const band = tyreBand(
        numericState(current),
        numericState(target),
        config.tyre_low_share,
        config.tyre_warn_share,
      );
      const label = html`<span
        class=${band ?? (isUnavailable(current) ? 'unavailable' : nothing)}
        style=${styleMap({ left: planLeft(shape.x + shape.w / 2) })}
        >${pressure(hass, current, target)}</span
      >`;
      return { band, shape, label };
    });
    const lowTyres = tyres.filter((tyre) => tyre.band === 'low').length;
    const warnTyres = tyres.filter((tyre) => tyre.band === 'warn').length;
    if (lowTyres > 0) {
      problems.push(lowTyres === 1 ? 'One tyre low' : `${lowTyres} tyres low`);
    }
    if (warnTyres > 0) {
      problems.push(warnTyres === 1 ? 'One tyre dropping' : `${warnTyres} tyres dropping`);
    }
    const card = html`<div class="card plan">
      <div class="drawing">
        <div class="labels">
          ${tyres.filter((_, index) => index % 2 === 1).map((tyre) => tyre.label)}
        </div>
        <svg viewBox=${VIEW_BOX} role="img">
          <g transform=${PLAN}>
            ${tyres.map((tyre) => rect(tyre.shape, classOf('tyre', tyre.band)))}
            <clipPath id="body"><path d=${BODY}></path></clipPath>
            ${path(BODY, 'body')}
            <g clip-path="url(#body)">
              ${hood}${tailgate}${doors}${FRONT_LAMPS.map((d) => path(d, 'lamp front'))}${REAR_LAMPS.map(
                (d) => path(d, 'lamp'),
              )}${shifted(WINDSCREEN, 'glass')}${path(REAR_SCREEN, 'glass')}${windows}${sunroof}${rect(
                ROOF,
                'roof',
              )}${shifted(COWL, 'cowl')}
            </g>
            ${path(BODY, 'seam')}
          </g>
        </svg>
        <div class="labels">
          ${tyres.filter((_, index) => index % 2 === 0).map((tyre) => tyre.label)}
        </div>
      </div>
      <div class=${problems.length > 0 ? 'caption alert' : 'caption'}>
        ${problems.length > 0 ? problems.join(' • ') : 'All closed'}
      </div>
    </div>`;
    return section(card, config.title, config.icon);
  }
}
