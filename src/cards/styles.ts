import { css } from 'lit';

export const MOTION_STYLE = css`
  @keyframes mnml-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes mnml-rise {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
  }
  @keyframes mnml-sheet {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes mnml-vanish {
    to {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after,
    ::backdrop {
      animation: none !important;
      transition: none !important;
    }
  }
`;

export const BASE_STYLE = css`
  :host {
    display: block;
    --m-pill: var(--mnml-pill-color, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
    --m-hover: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
    --m-edge: var(
      --mnml-card-edge-color,
      color-mix(in srgb, var(--primary-text-color) 12%, transparent)
    );
    --m-edge-strong: color-mix(in srgb, var(--primary-text-color) 50%, transparent);
    --m-card: var(--mnml-card-background-color, var(--card-background-color));
    --m-raised: var(--mnml-pill-raised-color, var(--card-background-color));
    --m-shadow: var(--mnml-card-shadow, none);
    --m-well: var(--mnml-button-shadow, 0 0 0 transparent);
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .card {
    position: relative;
    overflow: hidden;
    background: var(--m-card);
    -webkit-backdrop-filter: var(--mnml-card-backdrop-filter, none);
    backdrop-filter: var(--mnml-card-backdrop-filter, none);
    border-radius: var(--ha-card-border-radius, 22px);
    box-shadow: var(--m-shadow);
    color: var(--primary-text-color);
    font-size: 13px;
    line-height: 1.25;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .card::after,
  .slider.full:not(.gradient)::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px var(--m-edge),
      inset 0 1px 0 var(--mnml-card-highlight-color, transparent);
    pointer-events: none;
  }
  .tile,
  .card.button,
  .glance.link,
  .row.link,
  .control:not(.inert),
  .reset,
  .heading.fold .chevron,
  .header .round:not(.inert) {
    position: relative;
    isolation: isolate;
  }
  .tile::before,
  .card.button::before,
  .glance.link::before,
  .row.link::before,
  .control:not(.inert)::before,
  .reset::before,
  .heading.fold .chevron::before,
  .header .round:not(.inert)::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: var(--m-hover);
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease-out;
  }
  @media (hover: hover) {
    .card.button:hover::before,
    .glance.link:hover::before,
    .control:not(.inert):hover::before,
    .reset:hover::before,
    .header .round:not(.inert):hover::before,
    .tile:hover::before,
    .row.link:hover::before,
    .heading.fold:hover .chevron::before {
      opacity: 1;
    }
  }
  .hidden {
    display: none !important;
  }
  .colored {
    color: var(--m-color);
  }
  :focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  button,
  [role='button'],
  .link,
  .heading.fold {
    -webkit-user-select: none;
    user-select: none;
  }
  ha-icon,
  ha-state-icon,
  ha-attribute-icon {
    display: flex;
  }
  ${MOTION_STYLE}
  @media (prefers-contrast: more) {
    .card::after,
    .slider.full:not(.gradient)::after {
      box-shadow: inset 0 0 0 1px var(--m-edge-strong);
    }
  }
  @media (forced-colors: active) {
    .card {
      border: 1px solid CanvasText;
    }
    .card::after,
    .slider.full::after {
      content: none;
    }
  }
`;

export const HEADING_STYLE = css`
  .heading {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 8px;
    color: var(--secondary-text-color);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .heading ha-icon {
    --mdc-icon-size: 16px;
    flex: none;
  }
  .heading .state {
    display: flex;
    align-items: center;
    gap: 3px;
    flex: none;
    margin-left: auto;
    padding-left: 8px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    font-variant-numeric: tabular-nums;
  }
  .heading .trail {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
    margin-left: auto;
  }
  .heading .state > span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }
  .heading .state ha-state-icon {
    display: inline-flex;
    line-height: 0;
    --mdc-icon-size: 16px;
  }
`;

export const ROW_STYLE = css`
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px;
  }
  .pill {
    position: relative;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--m-pill);
    box-shadow: var(--m-well);
    color: var(--primary-text-color);
    display: grid;
    place-items: center;
  }
  .pill.colored {
    background: color-mix(in srgb, var(--m-color) 16%, var(--m-pill));
    color: var(--m-color);
  }
  .pill.link {
    cursor: pointer;
  }
  .pill ha-icon,
  .pill ha-state-icon,
  .pill ha-attribute-icon {
    --mdc-icon-size: 22px;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name,
  .state {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.011em;
    line-height: 1.2;
  }
  .state {
    font-size: 13px;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
  }
  .state:empty {
    display: none;
  }
  .state > span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    vertical-align: top;
    white-space: nowrap;
    max-width: 100%;
  }
  .state > span > .value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .state ha-state-icon {
    display: inline-flex;
    line-height: 0;
    --mdc-icon-size: 15px;
  }
  .row.link {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .row.link:active:not(:has(.control:active))::before {
    opacity: 1;
  }
`;

export const CONTROL_STYLE = css`
  .lane {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    flex: none;
  }
  .control {
    appearance: none;
    border: 0;
    margin: 0;
    padding: 0;
    background: transparent;
    color: var(--secondary-text-color);
    min-width: 36px;
    height: 36px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .control.primary {
    background: var(--m-pill);
    box-shadow: var(--m-well);
    color: var(--primary-text-color);
  }
  .control.colored {
    color: var(--m-color);
  }
  .control.inert {
    cursor: default;
  }
  .control:not(.inert) {
    transition: transform 90ms ease-out;
  }
  .control:not(.inert):active {
    transform: scale(0.94);
  }
  .control ha-icon,
  .control ha-state-icon,
  .control ha-attribute-icon {
    --mdc-icon-size: 20px;
  }
`;

export const SELECT_STYLE = css`
  select,
  select.area-picker,
  select.word {
    appearance: none;
    -webkit-appearance: none;
    box-sizing: border-box;
    height: 36px;
    max-width: 100%;
    padding: 0 34px 0 14px;
    border: 1px solid var(--divider-color);
    border-radius: 18px;
    background-color: var(--card-background-color);
    background-image:
      linear-gradient(45deg, transparent 50%, var(--secondary-text-color) 50%),
      linear-gradient(135deg, var(--secondary-text-color) 50%, transparent 50%);
    background-position:
      calc(100% - 19px) 50%,
      calc(100% - 14px) 50%;
    background-size: 5px 5px;
    background-repeat: no-repeat;
    color: var(--primary-text-color);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
    transition: border-color 120ms ease-out;
  }
  select:hover {
    border-color: var(--secondary-text-color);
  }
  select:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  select:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
