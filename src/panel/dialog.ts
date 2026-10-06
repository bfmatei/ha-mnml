import { html, nothing, render } from 'lit';
import type { TemplateResult } from 'lit';

import { field } from '../ha/field.ts';

export interface Choice<T> {
  label: string;
  value: T;
  primary?: true;
}

export function ask<T>(
  root: ParentNode,
  title: string,
  body: TemplateResult,
  choices: readonly Choice<T>[],
  check?: (value: T) => string | undefined,
): Promise<T | undefined> {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog';
  const { promise, resolve } = Promise.withResolvers<T | undefined>();
  let problem: string | undefined;
  const close = (value: T | undefined): void => {
    dialog.close();
    dialog.remove();
    resolve(value);
  };
  const draw = (): void => {
    render(
      html`<h2>${title}</h2>
        ${body} ${problem === undefined ? nothing : html`<p class="problem-line">${problem}</p>`}
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

export async function askName(
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

export async function confirmIt(
  root: ParentNode,
  title: string,
  text: string,
  label: string,
): Promise<boolean> {
  return (
    (await ask(root, title, html`<p>${text}</p>`, [{ label, value: true, primary: true }])) === true
  );
}
