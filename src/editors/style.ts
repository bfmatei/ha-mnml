import { css } from 'lit';

export const EDITOR_STYLE = css`
  [hidden] {
    display: none !important;
  }
  :host {
    display: block;
  }
  .object {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  ha-expansion-panel {
    --expansion-panel-summary-padding: 0 16px;
    --expansion-panel-content-padding: 0 16px 16px;
  }
  .panel {
    border: 1px solid var(--divider-color);
    border-radius: 12px;
  }
  .panel-head {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 16px;
    cursor: pointer;
  }
  .panel-icon {
    color: var(--secondary-text-color);
    --mdc-icon-size: 24px;
  }
  .panel-words {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .panel-title {
    color: var(--primary-text-color);
    font-size: 15px;
  }
  .panel-summary {
    color: var(--secondary-text-color);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .panel-chevron {
    color: var(--secondary-text-color);
  }
  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 16px 16px;
  }
  ha-expansion-panel .panel-body {
    padding: 0;
  }
  .parts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .part {
    border: 1px solid var(--divider-color);
    border-radius: 12px;
  }
  .part-head {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 48px;
    padding-left: 4px;
  }
  .part-title {
    all: unset;
    flex: 1;
    padding: 0 12px;
    cursor: pointer;
    color: var(--primary-text-color);
  }
  .part-body {
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .kinds .control {
    padding: 0 12px;
  }
  .kinds .control[aria-pressed='true'] {
    background: var(--m-pill);
    color: var(--primary-text-color);
  }
  .adding {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .adding .control {
    padding: 0 12px;
  }
  select,
  input {
    font: inherit;
    font-size: 13px;
    color: var(--primary-text-color);
    background: var(--m-pill);
    border: 0;
    border-radius: 10px;
    padding: 8px 10px;
  }
  .heading {
    color: var(--primary-text-color);
    font-size: 14px;
    font-weight: 500;
    margin: 4px 0 0;
  }
  .problem {
    color: var(--error-color);
  }
  .findings {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    font-size: 14px;
  }
  .found {
    color: var(--primary-text-color);
  }
  .needs {
    color: var(--error-color);
  }
  .fold {
    justify-content: flex-start;
    margin: 12px 0 0;
    color: var(--primary-color);
    font-size: 14px;
    font-weight: 500;
  }
  .gallery {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  .tile {
    height: auto;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    text-align: left;
    padding: 8px;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1px var(--divider-color);
    white-space: normal;
  }
  .tile-name {
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .tile-description {
    font-size: 12px;
  }
  .tile-preview {
    height: 120px;
    overflow: hidden;
    pointer-events: none;
    border-radius: 8px;
  }
  .template-head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .template-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .template-name {
    font-size: 16px;
    color: var(--primary-text-color);
  }
  .template-description {
    color: var(--secondary-text-color);
    font-size: 13px;
  }
  .sources {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .source {
    all: unset;
    display: grid;
    grid-template-columns: 24px 1fr;
    column-gap: 12px;
    padding: 8px 12px;
    border-radius: 12px;
    cursor: pointer;
  }
  .source[aria-checked='true'] {
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  }
  .source-title {
    color: var(--primary-text-color);
  }
  .source-help {
    grid-column: 2;
    color: var(--secondary-text-color);
    font-size: 13px;
  }
  .panel-head:focus-visible,
  .part-title:focus-visible,
  .source:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .slot-note {
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .adder {
    color: var(--primary-color);
    gap: 8px;
    padding: 0 12px;
    font-weight: 500;
    align-self: flex-start;
  }
`;
