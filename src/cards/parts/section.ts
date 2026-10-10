import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import type { MdiIcon } from '../../contract/entities.ts';
import { reduced } from '../../ha/motion.ts';
import { icon, quietly } from '../../ha/templates.ts';

export const SECTION_STYLE = css`
  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .heading.fold {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .heading .chevron {
    appearance: none;
    border: 0;
    margin: 0 -4px 0 auto;
    padding: 0;
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .heading .state ~ .chevron {
    margin-left: 0;
  }
  .heading.fold:active .chevron {
    transform: scale(0.9);
  }
  @media (hover: hover) {
    .heading.fold:hover .chevron {
      box-shadow: inset 0 0 0 999px var(--m-hover);
    }
  }
`;

export interface HeadingState {
  text: string;
  label: string;
}

export interface Fold {
  open: boolean;
  chosen(open: boolean): void;
}

export function heading(
  title: string,
  iconName?: MdiIcon,
  state?: HeadingState,
  trail: TemplateResult | typeof nothing = nothing,
  fold?: Fold,
): TemplateResult {
  const toggle = (event: Event): void => {
    if (fold === undefined) {
      return;
    }
    const opening = !fold.open;
    const shown =
      opening && event.currentTarget instanceof Element
        ? event.currentTarget.closest('.section')
        : null;
    fold.chosen(opening);
    if (shown !== null) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          shown.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' });
        });
      });
    }
  };
  return html`<div
    class=${classMap({ heading: true, fold: fold !== undefined })}
    @click=${fold === undefined ? nothing : toggle}
  >
    ${iconName === undefined ? nothing : icon(iconName)}
    <span role="heading" aria-level="2">${title}</span>
    ${
      state === undefined
        ? nothing
        : html`<span class="state" role="img" aria-label=${state.label}>${state.text}</span>`
    }
    ${trail}
    ${
      fold === undefined
        ? nothing
        : html`<button
            type="button"
            class="chevron"
            aria-label=${title}
            title=${title}
            aria-expanded=${String(fold.open)}
            @click=${quietly(toggle)}
          >
            ${icon(fold.open ? 'mdi:chevron-up' : 'mdi:chevron-down')}
          </button>`
    }
  </div>`;
}

export function section(
  card: TemplateResult,
  title?: string,
  iconName?: MdiIcon,
  state?: HeadingState,
  fold?: Fold,
): TemplateResult {
  if (title === undefined) {
    return card;
  }
  return html`<div class="section">
    ${heading(title, iconName, state, nothing, fold)}${fold === undefined || fold.open ? card : nothing}
  </div>`;
}
