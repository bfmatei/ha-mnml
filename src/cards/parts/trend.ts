import { css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color } from '../../contract/cards.ts';
import type { Point } from '../../ha/history.ts';
import { colorStyle } from '../../ha/templates.ts';

const SAMPLES = 96;
const MIN_SPAN = 2;

export const TREND_STYLE = css`
  .trend {
    display: block;
    overflow: visible;
    color: var(--secondary-text-color);
    opacity: 0.6;
    pointer-events: none;
  }
  .trend.colored {
    color: var(--m-color);
    opacity: 1;
  }
  .trend path {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

export function samples(
  points: readonly Point[],
  start: number,
  end: number,
): (number | undefined)[] {
  let index = 0;
  let value: number | undefined;
  return Array.from({ length: SAMPLES + 1 }, (_, step) => {
    const at = start + ((end - start) * step) / SAMPLES;
    for (let next = points[index]; next !== undefined && next.at <= at; next = points[index]) {
      value = next.value;
      index += 1;
    }
    return value;
  });
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

export function trendPath(values: readonly (number | undefined)[]): string {
  const known = values.filter((value): value is number => value !== undefined);
  if (known.length === 0) {
    return '';
  }
  const low = Math.min(...known);
  const high = Math.max(...known);
  const span = Math.max(high - low, MIN_SPAN);
  const top = (low + high) / 2 + span / 2;
  const last = Math.max(values.length - 1, 1);
  let path = '';
  let drawing = false;
  for (const [index, value] of values.entries()) {
    if (value === undefined) {
      drawing = false;
      continue;
    }
    path += `${drawing ? 'L' : 'M'}${rounded((index / last) * 100)} ${rounded(((top - value) / span) * 100)}`;
    drawing = true;
  }
  return path;
}

export function trendLine(path: string, color: Color | undefined): TemplateResult {
  return html`<svg
    class=${classMap({ trend: true, colored: color !== undefined })}
    style=${styleMap(colorStyle(color))}
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path d=${path} vector-effect="non-scaling-stroke"></path>
  </svg>`;
}
