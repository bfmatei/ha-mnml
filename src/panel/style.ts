import { css } from 'lit';

import { SELECT_STYLE } from '../cards/styles.ts';

export const PANEL_STYLE = css`
  :host {
    display: block;
    color: var(--primary-text-color);
    font-family: var(--ha-font-family-body, Roboto, sans-serif);
  }
  .muted {
    color: var(--secondary-text-color);
  }
  .loading {
    padding: 24px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    height: 20px;
    border-radius: 10px;
    border: 1px solid var(--divider-color);
    color: var(--secondary-text-color);
    font-size: 12px;
    white-space: nowrap;
  }
  .code-name {
    font-family: var(--ha-font-family-code, monospace);
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .badge.changed {
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
  .badge.conflict {
    color: var(--warning-color, var(--error-color));
    border-color: var(--warning-color, var(--error-color));
  }
  .action {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px;
    border-radius: 18px;
    border: 1px solid var(--divider-color);
    color: var(--primary-text-color);
    cursor: pointer;
    font-size: 14px;
  }
  .action.primary {
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
  .action:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .action:focus-visible,
  .icon-button:focus-visible,
  .chip:focus-visible,
  .tab:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .icon-button {
    all: unset;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--secondary-text-color);
    cursor: pointer;
    flex: none;
  }
  .icon-button:hover {
    background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
  }
  .icon-button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .icon-button.back ha-icon:dir(rtl) {
    transform: scaleX(-1);
  }
  .chip {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 32px;
    padding: 0 12px;
    border-radius: 16px;
    border: 1px solid var(--divider-color);
    color: var(--secondary-text-color);
    cursor: pointer;
    font-size: 13px;
  }
  .chip.active {
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
  .problem {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 16px 0;
    padding: 10px 12px;
    border: 1px solid var(--error-color);
    border-radius: 12px;
    color: var(--error-color);
  }
  .problem-line {
    color: var(--error-color);
    margin: 4px 0;
    font-size: 13px;
  }
  .library {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    max-width: 960px;
    width: 100%;
    box-sizing: border-box;
    margin: 0 auto;
  }
  .library-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .library-head h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 400;
  }
  .library-tools {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .row-actions {
    display: flex;
    gap: 4px;
    padding: 0 8px;
  }
  .library-list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    background: var(--card-background-color);
  }
  .library-row {
    display: flex;
    align-items: center;
    border-top: 1px solid var(--divider-color);
  }
  .library-row:first-child {
    border-top: none;
  }
  .library-open {
    all: unset;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    padding-block: 12px;
    padding-inline: 16px 8px;
    cursor: pointer;
  }
  .library-icon {
    color: var(--secondary-text-color);
    flex: none;
  }
  .library-words {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .library-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .library-description {
    color: var(--secondary-text-color);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px 0;
    overflow-x: auto;
    border-bottom: 1px solid var(--divider-color);
  }
  .tab {
    all: unset;
    padding: 10px 14px;
    color: var(--secondary-text-color);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .tab.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
  }
  .area-picker,
  .word {
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    padding: 0 8px;
    font-size: 14px;
  }
  .yaml,
  .slots-tab {
    padding: 16px;
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .pick {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pick-label {
    color: var(--secondary-text-color);
    font-size: 13px;
  }
  .chip.danger {
    color: var(--error-color);
  }
  .chip[disabled] {
    opacity: 0.4;
    cursor: default;
  }
  .yaml-text {
    box-sizing: border-box;
    width: 100%;
    min-height: 50vh;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-family: var(--ha-font-family-code, monospace);
    font-size: 13px;
    line-height: 1.5;
    tab-size: 2;
  }
  .yaml-text.small {
    min-height: 96px;
  }
  .fact-input {
    box-sizing: border-box;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    padding: 0 8px;
    font-size: 14px;
  }
  .fact-input.wide {
    width: 100%;
  }
  .name-line .fact-input {
    height: 28px;
    font-family: var(--ha-font-family-code, monospace);
    font-size: 12px;
  }
  .dialog {
    border: none;
    border-radius: 16px;
    padding: 20px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    width: min(560px, calc(100vw - 32px));
    box-sizing: border-box;
  }
  .dialog.customize {
    width: min(1040px, calc(100vw - 32px));
  }
  .customize-body {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
    gap: 16px;
    max-height: calc(100vh - 220px);
    overflow: auto;
  }
  .customize-preview {
    position: sticky;
    top: 0;
  }
  @media (max-width: 720px) {
    .customize-body {
      grid-template-columns: minmax(0, 1fr);
    }
    .customize-preview {
      position: static;
    }
  }
  .dialog::backdrop {
    background: rgba(0, 0, 0, 0.4);
  }
  .dialog h2 {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 400;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
  .history,
  .import-plan {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 50vh;
    overflow: auto;
  }
  .history-row,
  .import-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  @media (max-width: 600px) {
    .library {
      padding: 12px;
    }
  }
  ${SELECT_STYLE}
`;
