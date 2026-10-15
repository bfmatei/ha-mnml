import { html, nothing, render } from 'lit';
import type { TemplateResult } from 'lit';

import { field } from '../ha/field.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';

import { messageOf } from './message.ts';

let asked = 0;

const LONGEST_NAME = 64;

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
  titled: (
    title: string,
    initial: string,
    taken: ReadonlySet<string>,
  ) => Promise<Titled | undefined>;
  yaml: <T>(title: string, words: YamlWords, read: (text: string) => T) => Promise<T | undefined>;
}

interface Titled {
  title: string;
  name: string;
}

type Said = PanelWords['dialog'];

function ask<T>(
  root: ParentNode,
  said: Said,
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
            ${said.cancel}
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

const slugOf = (typed: string): string =>
  typed
    .normalize('NFKD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, LONGEST_NAME)
    .replace(/-+$/, '');

async function askName(
  root: ParentNode,
  said: Said,
  title: string,
  initial: string,
  taken: ReadonlySet<string>,
): Promise<string | undefined> {
  let name = initial;
  const chosen = await ask(
    root,
    said,
    title,
    (redraw) => {
      const slug = slugOf(name);
      return html`<input
          class="fact-input wide"
          aria-label=${said.name}
          .value=${initial}
          @input=${(event: Event) => {
            const value = field(event.target, 'value');
            name = typeof value === 'string' ? value : '';
            redraw();
          }}
        />
        <p class="muted">
          ${slug === '' || slug === name.trim() ? said.nameRule : said.savedAs(slug)}
        </p>`;
    },
    [{ label: said.ok, value: true, primary: true }],
    () => {
      const wanted = slugOf(name);
      if (wanted === '') {
        return said.nameNeeds;
      }
      return taken.has(wanted) ? said.taken(wanted) : undefined;
    },
  );
  return chosen === true ? slugOf(name) : undefined;
}

function freeName(title: string, taken: ReadonlySet<string>): string {
  const slug = slugOf(title);
  let name = slug;
  for (let count = 2; name !== '' && taken.has(name); count += 1) {
    name = `${slug.slice(0, LONGEST_NAME - `-${count}`.length).replace(/-+$/, '')}-${count}`;
  }
  return name;
}

async function askTitled(
  root: ParentNode,
  said: Said,
  heading: string,
  initial: string,
  taken: ReadonlySet<string>,
): Promise<Titled | undefined> {
  let title = initial;
  let typed: string | undefined;
  const nameOf = (): string => (typed === undefined ? freeName(title, taken) : slugOf(typed));
  const chosen = await ask(
    root,
    said,
    heading,
    (redraw) =>
      html`<input
          class="fact-input wide"
          aria-label=${said.title}
          .value=${initial}
          @input=${(event: Event) => {
            const value = field(event.target, 'value');
            title = typeof value === 'string' ? value : '';
            redraw();
          }}
        />
        <p class="muted name-line">
          ${said.nameInYaml}
          <input
            class="fact-input"
            aria-label=${said.nameInYamlLabel}
            .value=${typed ?? nameOf()}
            @input=${(event: Event) => {
              const value = field(event.target, 'value');
              typed = typeof value === 'string' ? value : '';
              redraw();
            }}
          />
          ${
            typed === undefined || slugOf(typed) === typed.trim()
              ? nothing
              : html`<span>${said.savedAs(slugOf(typed))}</span>`
          }
        </p>`,
    [{ label: said.ok, value: true, primary: true }],
    () => {
      if (title.trim() === '') {
        return said.titleNeeds;
      }
      const wanted = nameOf();
      if (wanted === '') {
        return said.nameNeeds;
      }
      return taken.has(wanted) ? said.taken(wanted) : undefined;
    },
  );
  return chosen === true ? { title: title.trim(), name: nameOf() } : undefined;
}

async function confirmIt(
  root: ParentNode,
  said: Said,
  title: string,
  text: string,
  label: string,
): Promise<boolean> {
  return (
    (await ask(root, said, title, html`<p>${text}</p>`, [
      { label, value: true, primary: true },
    ])) === true
  );
}

async function askYaml<T>(
  root: ParentNode,
  said: Said,
  title: string,
  words: YamlWords,
  read: (text: string) => T,
): Promise<T | undefined> {
  let text = '';
  let found: { value: T } | undefined;
  const next = await ask(
    root,
    said,
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
    [{ label: said.next, value: true, primary: true }],
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

export function dialogsOn(root: ParentNode, words: PanelWords = PANEL_EN): Dialogs {
  const said = words.dialog;
  return {
    ask: (title, body, choices, check) => ask(root, said, title, body, choices, check),
    confirm: (title, text, label) => confirmIt(root, said, title, text, label),
    name: (title, initial, taken) => askName(root, said, title, initial, taken),
    titled: (title, initial, taken) => askTitled(root, said, title, initial, taken),
    yaml: (title, yaml, read) => askYaml(root, said, title, yaml, read),
  };
}
