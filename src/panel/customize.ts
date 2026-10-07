import { html, nothing, render } from 'lit';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';

interface Editable {
  getConfigElement(): Promise<unknown>;
}

interface CardEditor extends HTMLElement {
  hass?: HomeAssistant | undefined;
  setConfig(config: unknown): void;
}

const isEditable = (value: unknown): value is Editable =>
  typeof value === 'function' && typeof Reflect.get(value, 'getConfigElement') === 'function';

const isEditor = (value: unknown): value is CardEditor =>
  value instanceof HTMLElement && typeof field(value, 'setConfig') === 'function';

async function templateEditor(): Promise<CardEditor> {
  const card = customElements.get('mnml-template-card');
  if (!isEditable(card)) {
    throw new Error('The MNML cards are not loaded on this page, so their editor cannot open.');
  }
  const editor = await card.getConfigElement();
  if (!isEditor(editor)) {
    throw new Error("The template card's editor did not load.");
  }
  return editor;
}

export async function customize(
  root: ParentNode,
  hass: HomeAssistant | undefined,
  title: string,
  config: Record<string, Value>,
  check: (config: Record<string, Value>) => string | undefined,
): Promise<Record<string, Value> | undefined> {
  const editor = await templateEditor();
  editor.hass = hass;
  editor.setConfig(config);
  let latest = config;
  editor.addEventListener('config-changed', (event) => {
    const next = field(field(event, 'detail'), 'config');
    if (isMapping(next)) {
      latest = next;
    }
  });
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog customize';
  const { promise, resolve } = Promise.withResolvers<Record<string, Value> | undefined>();
  let problem: string | undefined;
  const close = (value: Record<string, Value> | undefined): void => {
    dialog.close();
    dialog.remove();
    resolve(value);
  };
  const draw = (): void => {
    render(
      html`<h2>${title}</h2>
        <div class="customize-body">${editor}</div>
        ${problem === undefined ? nothing : html`<p class="problem-line">${problem}</p>`}
        <div class="dialog-actions">
          <button
            type="button"
            class="action"
            @click=${() => {
              close(undefined);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            class="action primary"
            @click=${() => {
              problem = check(latest);
              if (problem === undefined) {
                close(latest);
              } else {
                draw();
              }
            }}
          >
            Done
          </button>
        </div>`,
      dialog,
    );
  };
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close(undefined);
  });
  draw();
  root.append(dialog);
  dialog.showModal();
  return promise;
}
