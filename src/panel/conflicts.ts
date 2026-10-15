import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type { PanelWords } from '../words/panel/en.ts';

import type { Clash } from './data.ts';

type Said = PanelWords['conflicts'];

function describeClash(clash: Clash, said: Said): string {
  const where = clash.change.path.join(' / ') || said.template;
  const what = said.at(
    clash.change.op === 'set' ? clash.change.key : said.ops[clash.change.op],
    where,
  );
  return said.reasons[clash.reason](what);
}

export function drawConflicts(
  clashes: readonly Clash[],
  said: Said,
): TemplateResult | typeof nothing {
  if (clashes.length === 0) {
    return nothing;
  }
  return html`<div class="conflicts">
    <strong>${said.heading}</strong>
    <ul>
      ${clashes.map((clash) => html`<li>${describeClash(clash, said)}</li>`)}
    </ul>
    <p class="muted">${said.keeps}</p>
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
    padding-inline-start: 20px;
  }
  .conflicts p {
    margin: 0;
  }
`;
