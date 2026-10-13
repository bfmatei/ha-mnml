import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type { Clash } from './data.ts';

function describeClash(clash: Clash): string {
  const where = clash.change.path.join(' / ') || 'the template';
  const what =
    clash.change.op === 'set'
      ? `${clash.change.key} at ${where}`
      : `${clash.change.op} at ${where}`;
  if (clash.reason === 'gone') {
    return `${what}: this part is gone from the shipped template, so the change is left out`;
  }
  return clash.reason === 'taken'
    ? `${what}: the shipped template has a part of this id now, so yours is left out`
    : `${what}: the shipped template changed here since; your change still applies`;
}

export function drawConflicts(clashes: readonly Clash[]): TemplateResult | typeof nothing {
  if (clashes.length === 0) {
    return nothing;
  }
  return html`<div class="conflicts">
    <strong>A release changed this template under your changes</strong>
    <ul>
      ${clashes.map((clash) => html`<li>${describeClash(clash)}</li>`)}
    </ul>
    <p class="muted">Saving keeps the changes that still apply.</p>
  </div>`;
}

export const CONFLICTS_STYLE = css`
  .conflicts {
    margin: 12px 16px 0;
    padding: 10px 12px;
    border: 1px solid var(--warning-color, var(--error-color));
    border-radius: 12px;
  }
  .conflicts strong {
    color: var(--warning-color, var(--error-color));
    font-weight: 500;
  }
  .conflicts ul {
    margin: 6px 0;
    padding-left: 20px;
  }
  .conflicts p {
    margin: 0;
  }
`;
