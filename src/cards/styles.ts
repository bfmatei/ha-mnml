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
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .card {
    position: relative;
    overflow: hidden;
    background: var(--card-background-color);
    border-radius: var(--ha-card-border-radius, 18px);
    color: var(--primary-text-color);
    font-size: 13px;
    line-height: 1.25;
  }
  .card::after,
  .slider.full:not(.gradient)::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px var(--m-edge);
    pointer-events: none;
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
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .heading ha-icon {
    --mdc-icon-size: 18px;
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
    border-radius: 50%;
    background: var(--m-pill);
    color: var(--primary-text-color);
    display: grid;
    place-items: center;
  }
  .pill.colored {
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
    gap: 3px;
  }
  .name,
  .state {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name {
    font-size: 15px;
    font-weight: 600;
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
    transition: box-shadow 120ms ease-out;
    -webkit-tap-highlight-color: transparent;
  }
  .row.link:active:not(:has(.control:active)) {
    box-shadow: inset 0 0 0 999px var(--m-hover);
  }
  @media (hover: hover) {
    .row.link:hover:not(:has(.control:hover)) {
      box-shadow: inset 0 0 0 999px var(--m-hover);
    }
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
    color: var(--primary-text-color);
  }
  .control.colored {
    color: var(--m-color);
  }
  .control.inert {
    cursor: default;
  }
  .control:not(.inert) {
    transition:
      transform 90ms ease-out,
      box-shadow 120ms ease-out;
  }
  .control:not(.inert):active {
    transform: scale(0.94);
  }
  .control ha-icon,
  .control ha-state-icon,
  .control ha-attribute-icon {
    --mdc-icon-size: 20px;
  }
  @media (hover: hover) {
    .control:not(.inert):hover {
      box-shadow: inset 0 0 0 999px var(--m-hover);
    }
  }
`;
