import { html, nothing, render } from 'lit';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

let opened = 0;

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

async function templateEditor(said: PanelWords['customize']): Promise<CardEditor> {
  const card = customElements.get('mnml-template-card');
  if (!isEditable(card)) {
    throw new Error(said.unloaded);
  }
  const editor = await card.getConfigElement();
  if (!isEditor(editor)) {
    throw new Error(said.failed);
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
  const words = panelWordsFor(hass?.locale.language);
  const editor = await templateEditor(words.customize);
  editor.hass = hass;
  editor.setConfig(config);
  let latest = config;
  const dialog = document.createElement('dialog');
  const named = `mnml-customize-${(opened += 1)}`;
  dialog.className = 'dialog customize';
  dialog.setAttribute('aria-labelledby', named);
  const { promise, resolve } = Promise.withResolvers<Record<string, Value> | undefined>();
  let problem: string | undefined;
  const close = (value: Record<string, Value> | undefined): void => {
    dialog.close();
    dialog.remove();
    resolve(value);
  };
  const draw = (): void => {
    render(
      html`<h2 id=${named}>${title}</h2>
        <div class="customize-body">
          <div class="customize-form">${editor}</div>
          <mnml-live-card
            class="customize-preview"
            inert
            .config=${latest}
            .hass=${hass}
          ></mnml-live-card>
        </div>
        ${problem === undefined ? nothing : html`<p class="problem-line">${problem}</p>`}
        <div class="dialog-actions">
          <button
            type="button"
            class="action"
            @click=${() => {
              close(undefined);
            }}
          >
            ${words.dialog.cancel}
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
            ${words.customize.done}
          </button>
        </div>`,
      dialog,
    );
  };
  editor.addEventListener('config-changed', (event) => {
    const next = field(field(event, 'detail'), 'config');
    if (isMapping(next)) {
      latest = next;
      draw();
    }
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close(undefined);
  });
  draw();
  root.append(dialog);
  dialog.showModal();
  return promise;
}
