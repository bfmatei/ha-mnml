import { html, nothing, render } from 'lit';
import type { TemplateResult } from 'lit';

import { field } from '../ha/field.ts';

import { messageOf } from './message.ts';

let asked = 0;

export interface Choice<T> {
  label: string;
  value: T;
  primary?: true;
}

type Body = TemplateResult | ((redraw: () => void) => TemplateResult);

interface YamlWords {
  file: string;
  text: string;
  placeholder: string;
}

export interface Dialogs {
  ask: <T>(
    title: string,
    body: Body,
    choices: readonly Choice<T>[],
    check?: (value: T) => string | undefined,
  ) => Promise<T | undefined>;
  confirm: (title: string, text: string, label: string) => Promise<boolean>;
  name: (title: string, initial: string, taken: ReadonlySet<string>) => Promise<string | undefined>;
  yaml: <T>(title: string, words: YamlWords, read: (text: string) => T) => Promise<T | undefined>;
}

function ask<T>(
  root: ParentNode,
  title: string,
  body: Body,
  choices: readonly Choice<T>[],
  check?: (value: T) => string | undefined,
): Promise<T | undefined> {
  const dialog = document.createElement('dialog');
  const named = `mnml-dialog-${(asked += 1)}`;
  dialog.className = 'dialog';
  dialog.setAttribute('aria-labelledby', named);
  const { promise, resolve } = Promise.withResolvers<T | undefined>();
  let problem: string | undefined;
  const close = (value: T | undefined): void => {
    dialog.close();
    dialog.remove();
    resolve(value);
  };
  const draw = (): void => {
    render(
      html`<h2 id=${named}>${title}</h2>
        ${typeof body === 'function' ? body(draw) : body}
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
          ${choices.map(
            (choice) =>
              html`<button
                type="button"
                class=${choice.primary === true ? 'action primary' : 'action'}
                @click=${() => {
                  problem = check?.(choice.value);
                  if (problem === undefined) {
                    close(choice.value);
                  } else {
                    draw();
                  }
                }}
              >
                ${choice.label}
              </button>`,
          )}
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

async function askName(
  root: ParentNode,
  title: string,
  initial: string,
  taken: ReadonlySet<string>,
): Promise<string | undefined> {
  let name = initial;
  const chosen = await ask(
    root,
    title,
    html`<input
        class="fact-input wide"
        aria-label="Name"
        .value=${initial}
        @input=${(event: Event) => {
          const value = field(event.target, 'value');
          name = typeof value === 'string' ? value : '';
        }}
      />
      <p class="muted">Lower case letters, digits, - and _, starting with a letter or a digit.</p>`,
    [{ label: 'OK', value: true, primary: true }],
    () => {
      const wanted = name.trim();
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(wanted)) {
        return 'That name has letters MNML does not take.';
      }
      return taken.has(wanted) ? `${wanted} is taken.` : undefined;
    },
  );
  return chosen === true ? name.trim() : undefined;
}

async function confirmIt(
  root: ParentNode,
  title: string,
  text: string,
  label: string,
): Promise<boolean> {
  return (
    (await ask(root, title, html`<p>${text}</p>`, [{ label, value: true, primary: true }])) === true
  );
}

async function askYaml<T>(
  root: ParentNode,
  title: string,
  words: YamlWords,
  read: (text: string) => T,
): Promise<T | undefined> {
  let text = '';
  let found: { value: T } | undefined;
  const next = await ask(
    root,
    title,
    html`<input
        type="file"
        accept=".yaml,.yml,text/yaml"
        aria-label=${words.file}
        @change=${async (event: Event) => {
          const files = field(event.target, 'files');
          const file = files instanceof FileList ? files[0] : undefined;
          const area = event.target instanceof Element ? event.target.nextElementSibling : null;
          text = (await file?.text()) ?? text;
          if (area instanceof HTMLTextAreaElement) {
            area.value = text;
          }
        }}
      /><textarea
        class="yaml-text"
        placeholder=${words.placeholder}
        aria-label=${words.text}
        @input=${(event: Event) => {
          const value = field(event.target, 'value');
          text = typeof value === 'string' ? value : '';
        }}
      ></textarea>`,
    [{ label: 'Next', value: true, primary: true }],
    () => {
      try {
        found = { value: read(text) };
        return undefined;
      } catch (error) {
        return messageOf(error);
      }
    },
  );
  return next === true ? found?.value : undefined;
}

export function dialogsOn(root: ParentNode): Dialogs {
  return {
    ask: (title, body, choices, check) => ask(root, title, body, choices, check),
    confirm: (title, text, label) => confirmIt(root, title, text, label),
    name: (title, initial, taken) => askName(root, title, initial, taken),
    yaml: (title, words, read) => askYaml(root, title, words, read),
  };
}
