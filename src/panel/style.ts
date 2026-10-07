import { css } from 'lit';

export const PAGE_STYLE = css`
  :host {
    min-height: 100vh;
    background: var(--primary-background-color);
  }
  .body {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
`;

export const PANEL_STYLE = css`
  :host {
    display: block;
    color: var(--primary-text-color);
    font-family: var(--ha-font-family-body, Roboto, sans-serif);
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 56px;
    padding: 0 12px;
    border-bottom: 1px solid var(--divider-color);
    background: var(--app-header-background-color, var(--primary-background-color));
    color: var(--app-header-text-color, var(--primary-text-color));
  }
  .toolbar-title {
    font-size: 20px;
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
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 8px 0 0;
    color: var(--secondary-text-color);
    font-size: 13px;
    cursor: pointer;
  }
  .switch input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--primary-color);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
  .search {
    box-sizing: border-box;
    width: 100%;
    height: 44px;
    padding: 0 14px;
    border-radius: 22px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 15px;
  }
  .offer {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px;
    border: 1px solid var(--primary-color);
    border-radius: 12px;
  }
  .offer > ha-icon {
    color: var(--primary-color);
  }
  .offer > span {
    flex: 1;
    min-width: 200px;
  }
  .start {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 16px;
    border: 1px solid var(--primary-color);
    border-radius: 12px;
    background: var(--card-background-color);
  }
  .start > ha-icon {
    --mdc-icon-size: 40px;
    color: var(--primary-color);
  }
  .start-words {
    flex: 1;
    min-width: 220px;
  }
  .start-words h2 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 500;
  }
  .start-words p {
    margin: 0;
    color: var(--secondary-text-color);
  }
  .start-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .plan-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .plan-title h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 400;
  }
  .plan-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    background: var(--card-background-color);
  }
  .plan-section h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }
  .plan-section p {
    margin: 0;
  }
  .plan-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
  }
  .plan-row input[type='checkbox'] {
    width: 20px;
    height: 20px;
    margin: 0;
    flex: none;
    accent-color: var(--primary-color);
  }
  .plan-tile {
    flex: 1;
    min-width: 0;
    max-width: 420px;
  }
  .plan-words {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  .plan-row.off .plan-words > span:first-child {
    color: var(--secondary-text-color);
  }
  .plan-field {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .plan-field > span:first-child {
    width: 120px;
    color: var(--secondary-text-color);
  }
  .plan-icon {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 200px;
  }
  .board-name {
    font-weight: 500;
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
    padding: 12px 8px 12px 16px;
    cursor: pointer;
  }
  .library-open:hover .library-name {
    color: var(--primary-color);
  }
  .library-icon {
    color: var(--secondary-text-color);
    flex: none;
  }
  .status-customised .library-icon {
    color: var(--primary-color);
  }
  .status-conflict .library-icon {
    color: var(--warning-color, var(--error-color));
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
  .library-name {
    font-family: var(--ha-font-family-code, monospace);
    font-size: 14px;
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
  .library-status {
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .status-conflict .library-status {
    color: var(--warning-color, var(--error-color));
  }
  .builder {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .builder-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--divider-color);
  }
  .builder-title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .builder-title h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 400;
    font-family: var(--ha-font-family-code, monospace);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .builder-title .muted {
    font-size: 12px;
  }
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
  .panes {
    padding-top: 0;
  }
  .work {
    display: grid;
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr) minmax(300px, 380px);
    flex: 1;
    min-height: 0;
  }
  .pane {
    overflow: auto;
    padding: 12px;
    box-sizing: border-box;
    max-height: calc(100vh - 170px);
  }
  .outline-pane {
    border-right: 1px solid var(--divider-color);
  }
  .inspector-pane {
    border-left: 1px solid var(--divider-color);
  }
  .work.narrow {
    display: block;
  }
  .work.narrow .pane {
    display: none;
    max-height: none;
    border: none;
  }
  .work.narrow.show-outline .outline-pane,
  .work.narrow.show-preview .preview-pane,
  .work.narrow.show-inspector .inspector-pane {
    display: block;
  }
  .outline-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-left: 12px;
  }
  .outline > .outline-part > .outline-group {
    margin-left: 0;
  }
  .outline-heading {
    color: var(--secondary-text-color);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 4px 2px;
  }
  .outline-row {
    display: flex;
    align-items: center;
    border-radius: 8px;
  }
  .outline-row.selected {
    background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
  }
  .outline-row.selected .outline-label {
    color: var(--primary-color);
  }
  .outline-name {
    all: unset;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 4px;
    cursor: pointer;
    flex-wrap: wrap;
  }
  .outline-name ha-icon {
    color: var(--secondary-text-color);
    --mdc-icon-size: 18px;
  }
  .outline-label {
    font-size: 14px;
  }
  .outline-add {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 4px;
  }
  .add-label {
    color: var(--secondary-text-color);
    font-size: 13px;
  }
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .inspect-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .inspect-head h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
  .inspect-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .inspect-section h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--secondary-text-color);
  }
  .binding {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .binding > ha-form {
    flex: 1;
  }
  .inspect-section > .action {
    align-self: flex-start;
  }
  .preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .preview-head {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .stage {
    max-width: 560px;
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .popup-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .yaml,
  .example,
  .simple-work {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .simple-work.narrow {
    grid-template-columns: minmax(0, 1fr);
  }
  .simple {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
  }
  .simple > p {
    margin: 0 0 8px;
  }
  .simple-group {
    margin: 8px 0 0;
    padding-left: calc(var(--depth, 0) * 20px - 20px);
    color: var(--secondary-text-color);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .simple-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 36px;
    padding-left: calc(var(--depth, 0) * 20px - 20px);
  }
  .simple-row input[type='checkbox'] {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--primary-color);
  }
  .simple-spacer {
    width: 18px;
  }
  .simple-row.off .simple-words > span:first-child {
    color: var(--secondary-text-color);
    text-decoration: line-through;
  }
  .simple-words {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 160px;
  }
  .simple-look {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .example {
    padding: 0 16px 16px;
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .example h2 {
    margin: 8px 0 0;
    font-size: 18px;
    font-weight: 500;
  }
  .example p {
    margin: 0;
  }
  .slots-tab {
    padding: 16px;
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  .slot-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .slot-group {
    margin: 8px 0 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--secondary-text-color);
  }
  .slot {
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--card-background-color);
  }
  .slot-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .slot-head .icon-button {
    margin-left: auto;
  }
  .slot-name {
    font-family: var(--ha-font-family-code, monospace);
    font-size: 14px;
  }
  .slot-facts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }
  .fact {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: var(--secondary-text-color);
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
  .finding {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .finding > .sentence,
  .finding > .trial {
    align-self: stretch;
  }
  .finding h4,
  .fields h4 {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: var(--secondary-text-color);
  }
  .sentence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .word-box input {
    width: 140px;
  }
  .or {
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .trial {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .found {
    color: var(--primary-text-color);
  }
  .fields {
    padding-left: 12px;
    border-left: 2px solid var(--divider-color);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .add-slot {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
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
    width: min(720px, calc(100vw - 32px));
  }
  .customize-body {
    max-height: calc(100vh - 220px);
    overflow: auto;
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
    .builder-head {
      padding: 6px 8px;
    }
    .pane {
      padding: 12px 8px;
    }
  }
`;
