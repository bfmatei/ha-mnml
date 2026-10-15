import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import { isTemplate, templateTitle, templateWithLook } from '../contract/templates.ts';
import type { Template, WrittenTemplate } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import { isChange } from '../templates/changes.ts';
import type { PanelWords } from '../words/panel/en.ts';

import type { Call } from './building.ts';
import { storedAs } from './data.ts';
import type { Draft, Entry, Kept, PanelState, Row } from './data.ts';
import type { Dialogs } from './dialog.ts';
import { messageOf } from './message.ts';
import {
  dashboardTemplates,
  entryFor,
  exportText,
  notKept,
  planImport,
  renameEverywhere,
  renamePlans,
  renamedChanges,
  renamedTemplate,
  resolvable,
  settleImport,
  templatesIn,
} from './transfer.ts';
import type { Choice, Incoming } from './transfer.ts';

export interface LibraryHost {
  call: Call;
  dialogs: Dialogs;
  state: () => PanelState;
  refresh: () => Promise<void>;
  save: (name: string, entry: Entry | undefined) => Promise<void>;
  download: (name: string, text: string) => void;
  words: PanelWords;
}

const newOne = (title: string): Template => ({
  description: '',
  title,
  slots: { title: { kind: 'text', required: true, label: 'Title' } },
  card: { type: 'custom:mnml-heading-card', title: '[[title]]', icon: 'mdi:star-outline' },
  example: { title: 'New' },
});
function versionText(version: unknown, said: PanelWords['templateActions']): string {
  const updated = field(version, 'updated');
  const changes = field(version, 'changes');
  const when = typeof updated === 'string' ? new Date(updated).toLocaleString() : said.earlier;
  const what =
    field(version, 'kind') === 'own'
      ? said.whole
      : said.changes(Array.isArray(changes) ? changes.length : 0);
  return said.version(when, what);
}

function entryOfVersion(version: unknown): Entry | undefined {
  const template = field(version, 'template');
  const changes = field(version, 'changes');
  if (field(version, 'kind') === 'own' && isTemplate(template)) {
    return { kind: 'own', template };
  }
  return field(version, 'kind') === 'changes' && Array.isArray(changes) && changes.every(isChange)
    ? { kind: 'changes', changes }
    : undefined;
}

export function shippedWhole(state: PanelState): void {
  if (state.shippedFailure !== undefined) {
    throw new Error(state.shippedFailure);
  }
}

export async function saveTemplate(
  call: Call,
  kept: Kept,
  name: string,
  entry: Entry | undefined,
): Promise<void> {
  if (!storedAs(entry, kept, name)) {
    await call(
      entry === undefined
        ? { type: 'mnml/templates/delete', name }
        : { type: 'mnml/templates/save', name, entry },
    );
  }
}

export async function newTemplate(host: LibraryHost): Promise<Draft | undefined> {
  const named = await host.dialogs.titled(
    host.words.templateActions.newOne,
    '',
    host.state().taken,
  );
  return named === undefined
    ? undefined
    : {
        name: named.name,
        template: newOne(named.title),
        shipped: undefined,
        conflicts: [],
        fresh: true,
        blank: true,
      };
}

export async function duplicateTemplate(
  host: LibraryHost,
  of: string,
  template: WrittenTemplate | undefined,
): Promise<Draft | undefined> {
  const title = templateTitle(template, of);
  const said = host.words.templateActions;
  const named = await host.dialogs.titled(
    said.copyOf(title),
    said.copyTitle(title),
    host.state().taken,
  );
  return named === undefined || template === undefined
    ? undefined
    : {
        name: named.name,
        template: templateWithLook(structuredClone(template), 'title', named.title),
        shipped: undefined,
        conflicts: [],
        fresh: true,
      };
}

export async function chooseVersion(host: LibraryHost, name: string): Promise<Entry | undefined> {
  const said = host.words.templateActions;
  const ok = host.words.dialog.ok;
  const title = said.history(templateTitle(host.state().resolved[name], name));
  let versions: unknown[];
  try {
    const list = field(await host.call({ type: 'mnml/templates/history', name }), 'history');
    versions = Array.isArray(list) ? list : [];
  } catch (error) {
    await host.dialogs.confirm(title, said.unread(messageOf(error)), ok);
    return undefined;
  }
  if (versions.length === 0) {
    await host.dialogs.confirm(title, said.noHistory, ok);
    return undefined;
  }
  let chosen = -1;
  const restore = await host.dialogs.ask(
    title,
    html`<div class="history">
      ${versions.map(
        (version, index) =>
          html`<label class="history-row"
            ><input
              type="radio"
              name="version"
              @change=${() => {
                chosen = index;
              }}
            /><span>${versionText(version, said)}</span></label
          >`,
      )}
    </div>`,
    [{ label: said.restore, value: true, primary: true }],
    () => (chosen === -1 ? said.chooseFirst : undefined),
  );
  return restore === true ? entryOfVersion(versions[chosen]) : undefined;
}

export async function restoreVersion(host: LibraryHost, name: string): Promise<void> {
  const entry = await chooseVersion(host, name);
  if (entry !== undefined) {
    await host.save(name, entry);
  }
}

export function exportTemplates(
  host: LibraryHost,
  names: readonly string[],
  templates: Readonly<Record<string, WrittenTemplate>>,
): void {
  host.download(
    names.length === 1 ? `${names[0] ?? 'template'}.yaml` : 'mnml-templates.yaml',
    exportText(names, templates),
  );
}

export function drawFates(
  words: PanelWords,
  plan: readonly Incoming[],
  choices: Record<string, Choice>,
  differ: readonly string[] = [],
  alone: ReadonlySet<string> = new Set(),
  changed: () => void = () => undefined,
): TemplateResult {
  const said = words.templateActions;
  return html`<div class="import-plan">
    ${plan.map(
      (incoming) =>
        html`<div class="import-row">
          <span>${templateTitle(incoming.template, incoming.name)}</span>
          <code class="code-name">${incoming.name}</code>
          <span class="muted">${said.fates[incoming.fate]}</span>
          ${
            incoming.from.length > 0
              ? html`<span class="muted">${said.from(incoming.from)}</span>`
              : nothing
          }
          ${
            differ.includes(incoming.name)
              ? html`<span class="muted">${said.differ(incoming.from[0])}</span>`
              : nothing
          }
          ${
            incoming.clash
              ? html`<select
                  class="word"
                  aria-label=${said.whatToDo(templateTitle(incoming.template, incoming.name))}
                  @change=${(event: Event) => {
                    const value = field(event.target, 'value');
                    choices[incoming.name] =
                      value === 'both' ? 'both' : value === 'skip' ? 'skip' : 'replace';
                    changed();
                  }}
                >
                  <option
                    value="replace"
                    ?selected=${(choices[incoming.name] ?? 'replace') === 'replace'}
                  >
                    ${said.replace}
                  </option>
                  ${
                    alone.has(incoming.name)
                      ? nothing
                      : html`<option value="both" ?selected=${choices[incoming.name] === 'both'}>
                          ${said.both}
                        </option>`
                  }
                  <option value="skip" ?selected=${choices[incoming.name] === 'skip'}>
                    ${said.skip}
                  </option>
                </select>`
              : nothing
          }
        </div>`,
    )}
  </div>`;
}

export function waitingImport(state: PanelState): {
  templates: Record<string, WrittenTemplate>;
  from: Record<string, string[]>;
  differ: string[];
} {
  const { templates, from, differ } = dashboardTemplates(
    state.dashboards,
    new Set(Object.keys(state.shipped)),
  );
  return { templates: notKept(templates, state.kept, state.resolved, state.shipped), from, differ };
}

async function importFrom(
  host: LibraryHost,
  found: Record<string, WrittenTemplate>,
  from: Record<string, readonly string[]> = {},
  differ: readonly string[] = [],
): Promise<void> {
  const state = host.state();
  const plan = planImport(found, state.shipped, state.kept, state.resolved, from);
  const choices: Record<string, Choice> = {};
  const said = host.words.templateActions;
  const go = await host.dialogs.ask(
    said.importIt,
    html`${drawFates(host.words, plan, choices, differ)}
      <p class="muted">${said.unwritten}</p>`,
    [{ label: said.importIt, value: true, primary: true }],
  );
  if (go !== true) {
    return;
  }
  await Promise.all(
    settleImport(plan, choices, host.state().taken).map((incoming) =>
      host.save(incoming.name, entryFor(incoming, state.shipped)),
    ),
  );
}

export async function importFile(host: LibraryHost): Promise<void> {
  shippedWhole(host.state());
  const said = host.words.templateActions;
  const found = await host.dialogs.yaml(
    said.importFile,
    { file: said.file, text: said.text, placeholder: said.placeholder },
    (text) => {
      const read = templatesIn(text, new Set(Object.keys(host.state().shipped)), host.words);
      if (Object.keys(read).length === 0) {
        throw new Error(said.none);
      }
      return read;
    },
  );
  if (found !== undefined) {
    await importFrom(host, found);
  }
}

export async function importDashboards(host: LibraryHost): Promise<void> {
  shippedWhole(host.state());
  const { templates, from, differ } = waitingImport(host.state());
  resolvable(templates);
  await importFrom(host, templates, from, differ);
}

export async function removeTemplate(host: LibraryHost, row: Row): Promise<void> {
  const said = host.words.templateActions;
  const use = row.use.cards === 0 ? said.unused : said.used(row.use.cards, row.use.dashboards);
  const sure =
    row.status === 'own'
      ? await host.dialogs.confirm(said.delete(row.title), said.deleteText(use), said.deleteIt)
      : await host.dialogs.confirm(said.reset(row.title), said.resetText(use), said.resetIt);
  if (sure) {
    await host.call({ type: 'mnml/templates/delete', name: row.name });
  }
}

export async function renameTemplate(host: LibraryHost, row: Row): Promise<void> {
  const template = host.state().kept.own[row.name];
  if (template === undefined) {
    return;
  }
  const said = host.words.templateActions;
  const name = await host.dialogs.name(said.rename(row.title), row.name, host.state().taken);
  if (name === undefined || name === row.name) {
    return;
  }
  await host.refresh();
  const kept = host.state().kept;
  await host.save(name, { kind: 'own', template });
  await Promise.all([
    ...Object.entries(kept.own).flatMap(([other, inner]) => {
      const next = other === row.name ? undefined : renamedTemplate(inner, row.name, name);
      return next === undefined ? [] : [host.save(other, { kind: 'own', template: next })];
    }),
    ...Object.entries(kept.changes).flatMap(([other, changes]) => {
      const next = renamedChanges(changes, row.name, name);
      return next === undefined ? [] : [host.save(other, { kind: 'changes', changes: next })];
    }),
  ]);
  const now = host.state();
  const everywhere = await renameEverywhere(host.call, now.dashboards, row.name, name);
  const { written, byHand } = everywhere;
  const failed = [
    ...everywhere.failed,
    ...(now.boardsFailure === undefined ? [] : [said.unlisted(now.boardsFailure)]),
    ...(now.built === undefined
      ? [said.unbuilt]
      : await renamePlans(host.call, now.built, row.name, name, host.words)),
  ];
  if (failed.length === 0) {
    await host.call({ type: 'mnml/templates/delete', name: row.name });
  }
  await host.refresh();
  const told = [
    written.length === 0 ? said.noneInUi : said.updated(written),
    ...(byHand.length === 0 ? [] : [said.byHand(row.name, name, byHand)]),
    ...(failed.length === 0 ? [] : [said.unsaved(row.name, name, failed)]),
  ];
  await host.dialogs.confirm(said.renamed(row.title, name), told.join(' '), host.words.dialog.ok);
}
