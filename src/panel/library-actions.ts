import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import { isTemplate } from '../contract/templates.ts';
import type { Template, WrittenTemplate } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import { isChange } from '../templates/changes.ts';

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
}

const NEW_TEMPLATE: Template = {
  description: '',
  slots: { title: { kind: 'text', required: true, label: 'Title' } },
  card: { type: 'custom:mnml-heading-card', title: '[[title]]', icon: 'mdi:star-outline' },
  example: { title: 'New' },
};
const FATES: Record<Incoming['fate'], string> = {
  changes: 'comes in as changes to the shipped template',
  own: 'comes in as a template of the home',
  replaces: 'replaces the template of the same name',
  same: 'is the same as the one MNML keeps, so it is left out',
};

function versionText(version: unknown): string {
  const updated = field(version, 'updated');
  const changes = field(version, 'changes');
  const when =
    typeof updated === 'string' ? new Date(updated).toLocaleString() : 'an earlier version';
  const what =
    field(version, 'kind') === 'own'
      ? 'the whole template'
      : `${Array.isArray(changes) ? changes.length : 0} changes to the shipped one`;
  return `${when}: ${what}`;
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
  const name = await host.dialogs.name('A new template', '', host.state().taken);
  return name === undefined
    ? undefined
    : {
        name,
        template: structuredClone(NEW_TEMPLATE),
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
  const name = await host.dialogs.name(`A copy of ${of}`, `${of}-copy`, host.state().taken);
  return name === undefined || template === undefined
    ? undefined
    : { name, template: structuredClone(template), shipped: undefined, conflicts: [], fresh: true };
}

export async function chooseVersion(host: LibraryHost, name: string): Promise<Entry | undefined> {
  const title = `The history of ${name}`;
  let versions: unknown[];
  try {
    const list = field(await host.call({ type: 'mnml/templates/history', name }), 'history');
    versions = Array.isArray(list) ? list : [];
  } catch (error) {
    await host.dialogs.confirm(title, `It could not be read: ${messageOf(error)}`, 'OK');
    return undefined;
  }
  if (versions.length === 0) {
    await host.dialogs.confirm(title, 'There is no earlier version.', 'OK');
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
            /><span>${versionText(version)}</span></label
          >`,
      )}
    </div>`,
    [{ label: 'Restore', value: true, primary: true }],
    () => (chosen === -1 ? 'Choose a version first.' : undefined),
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
  plan: readonly Incoming[],
  choices: Record<string, Choice>,
  differ: readonly string[] = [],
  alone: ReadonlySet<string> = new Set(),
  changed: () => void = () => undefined,
): TemplateResult {
  return html`<div class="import-plan">
    ${plan.map(
      (incoming) =>
        html`<div class="import-row">
          <code>${incoming.name}</code><span class="muted">${FATES[incoming.fate]}</span>
          ${
            incoming.from.length > 0
              ? html`<span class="muted">from ${incoming.from.join(', ')}</span>`
              : nothing
          }
          ${
            differ.includes(incoming.name)
              ? html`<span class="muted"
                  >the dashboards hold different versions of it; this is the one from
                  ${incoming.from[0] ?? 'the first'}</span
                >`
              : nothing
          }
          ${
            incoming.clash
              ? html`<select
                  class="word"
                  aria-label=${`What to do with ${incoming.name}`}
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
                    Replace the one MNML keeps
                  </option>
                  ${
                    alone.has(incoming.name)
                      ? nothing
                      : html`<option value="both" ?selected=${choices[incoming.name] === 'both'}>
                          Keep both, this one under a new name
                        </option>`
                  }
                  <option value="skip" ?selected=${choices[incoming.name] === 'skip'}>
                    Skip it
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
  const go = await host.dialogs.ask(
    'Import',
    html`${drawFates(plan, choices, differ)}
      <p class="muted">Nothing on the dashboards is written.</p>`,
    [{ label: 'Import', value: true, primary: true }],
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
  const found = await host.dialogs.yaml(
    'Import templates',
    {
      file: 'A file of templates',
      text: 'Templates in YAML',
      placeholder: 'Paste templates, or choose a file',
    },
    (text) => {
      const read = templatesIn(text, new Set(Object.keys(host.state().shipped)));
      if (Object.keys(read).length === 0) {
        throw new Error('The text holds no template.');
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
  const use =
    row.use.cards === 0
      ? 'No dashboard uses it.'
      : `It is on ${row.use.cards} ${row.use.cards === 1 ? 'card' : 'cards'}, on ${row.use.dashboards.join(', ')}.`;
  const sure =
    row.status === 'own'
      ? await host.dialogs.confirm(`Delete ${row.name}?`, `${use} Its history keeps it.`, 'Delete')
      : await host.dialogs.confirm(
          `Reset ${row.name} to shipped?`,
          `${use} Your changes go; its history keeps them.`,
          'Reset',
        );
  if (sure) {
    await host.call({ type: 'mnml/templates/delete', name: row.name });
  }
}

export async function renameTemplate(host: LibraryHost, row: Row): Promise<void> {
  const template = host.state().kept.own[row.name];
  if (template === undefined) {
    return;
  }
  const name = await host.dialogs.name(`Rename ${row.name}`, row.name, host.state().taken);
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
    ...(now.boardsFailure === undefined
      ? []
      : [`Home Assistant's dashboards, which MNML could not read: ${now.boardsFailure}`]),
    ...(now.built === undefined
      ? ['the dashboards MNML built, which it could not read']
      : await renamePlans(host.call, now.built, row.name, name)),
  ];
  if (failed.length === 0) {
    await host.call({ type: 'mnml/templates/delete', name: row.name });
  }
  await host.refresh();
  const told = [
    written.length === 0
      ? 'No dashboard stored in the UI used it.'
      : `Updated the cards on ${written.join(', ')}.`,
    ...(byHand.length === 0
      ? []
      : [
          `These dashboards are YAML files; change ${row.name} to ${name} in them by hand: ${byHand.join(', ')}.`,
        ]),
    ...(failed.length === 0
      ? []
      : [
          `These could not be saved, so ${row.name} stays beside ${name} until they are changed by hand: ${failed.join('; ')}.`,
        ]),
  ];
  await host.dialogs.confirm(`${row.name} is now ${name}`, told.join(' '), 'OK');
}
