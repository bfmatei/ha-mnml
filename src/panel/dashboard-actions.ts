import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import {
  readDashboardTemplate,
  dashboardTemplateOf,
  dashboardTemplateText,
} from '../builder/dashboard-template.ts';
import { dashboardOf } from '../builder/dashboard.ts';
import { defaultPlan, planFrom, unplaced } from '../builder/plan.ts';
import { lookOf } from '../contract/plan.ts';
import type { Plan } from '../contract/plan.ts';

import {
  addressFor,
  forgetDashboard,
  makeDashboard,
  rebuildDashboard,
  undoDashboard,
} from './building.ts';
import type { Board, Built } from './building.ts';
import { readableOf } from './data.ts';
import type { Choice as Option } from './dialog.ts';
import { drawFates, shippedWhole } from './library-actions.ts';
import type { LibraryHost } from './library-actions.ts';
import { changesIn, rowNames } from './plan-edits.ts';
import type { PlanChange } from './plan-edits.ts';
import { bringing, broughtIn, previewOf, previewPlan, summary } from './share.ts';
import { entryFor, planImport, resolvable } from './transfer.ts';

export interface DashboardHost extends LibraryHost {
  go: (path: string) => void;
  visit: (path: string) => void;
}

type Said = DashboardHost['words']['boardActions'];

export function boardOf(boards: readonly Board[], built: Built): Board | undefined {
  return boards.find((board) => board.url_path === built.url_path);
}

async function offerOpen(
  host: DashboardHost,
  plan: Plan,
  address: string,
  done: string,
): Promise<void> {
  const said = host.words.boardActions;
  const open = await host.dialogs.ask(done, html`<p>${said.at(plan.title, address)}</p>`, [
    { label: said.openIt, value: true, primary: true },
  ]);
  if (open === true) {
    host.visit(`/${address}`);
  }
}

const MOSTLY_UNPLACED = 0.5;

export async function quickStart(host: DashboardHost): Promise<void> {
  const { registries, resolved, addresses } = host.state();
  if (unplaced(registries).share > MOSTLY_UNPLACED) {
    const areas = host.words.areas;
    const next = await host.dialogs.ask(
      areas.mostUnplaced,
      html`<p>${areas.mostUnplacedText}</p>`,
      [
        { label: areas.buildAnyway, value: 'build' },
        { label: areas.sortFirst, value: 'sort', primary: true },
      ],
    );
    if (next === 'sort') {
      host.go('/areas');
    }
    if (next !== 'build') {
      return;
    }
  }
  const plan = defaultPlan(registries, resolved);
  const address = addressFor(plan.title, addresses);
  const said = host.words.boardActions;
  const sure = await host.dialogs.confirm(
    said.quickStart,
    said.quickMakes(plan.title, address, summary(plan, host.words)),
    said.makeIt,
  );
  if (!sure) {
    return;
  }
  try {
    await makeDashboard(host.call, address, plan, dashboardOf(plan, registries, resolved));
  } finally {
    await host.refresh();
  }
  await offerOpen(host, plan, address, said.ready(plan.title));
}

function changeLine(change: PlanChange, plan: Plan, said: Said): string {
  if (change.field !== undefined) {
    return said.fields[change.field];
  }
  const section = lookOf(plan, change.section).title;
  switch (change.how) {
    case 'moved':
      return said.moved(section);
    case 'added':
      return said.added(section, change.name);
    case 'removed':
      return said.removed(section, change.name);
    case 'changed':
      return said.edited(section, change.name);
  }
}

function rebuildBody(host: DashboardHost, built: Plan, plan: Plan): TemplateResult {
  const { registries, resolved } = host.state();
  const said = host.words.boardActions;
  const changes = changesIn(built, plan, rowNames(registries, resolved, host.words.plan.aRoom));
  return html`<p>${said.rebuildText}</p>
    ${
      changes.length === 0
        ? html`<p class="muted">${said.unchanged}</p>`
        : html`<p>${said.changed}</p>
            <ul class="changes">
              ${changes.map((change) => html`<li>${changeLine(change, plan, said)}</li>`)}
            </ul>`
    }`;
}

export async function buildDashboard(
  host: DashboardHost,
  at: string | undefined,
  plan: Plan,
  address: string,
): Promise<void> {
  const state = host.state();
  const built = state.built?.find((each) => each.url_path === at);
  const config = dashboardOf(plan, state.registries, state.resolved);
  const said = host.words.boardActions;
  if (built !== undefined && state.boardsFailure !== undefined) {
    throw new Error(said.unlisted(built.plan.title, state.boardsFailure));
  }
  if (
    built !== undefined &&
    (await host.dialogs.ask(said.rebuild(built.plan.title), rebuildBody(host, built.plan, plan), [
      { label: said.rebuildIt, value: true, primary: true },
    ])) !== true
  ) {
    return;
  }
  try {
    await (built === undefined
      ? makeDashboard(host.call, address, plan, config)
      : rebuildDashboard(host.call, built, boardOf(host.state().boards, built), plan, config));
  } catch (error) {
    await host.refresh();
    if (built === undefined && host.state().built?.some((each) => each.url_path === address)) {
      host.go(`/dashboards/${address}`);
    }
    throw error;
  }
  await host.refresh();
  host.go('');
  await offerOpen(
    host,
    plan,
    built?.url_path ?? address,
    built === undefined ? said.ready(plan.title) : said.rebuilt(plan.title),
  );
}

export async function undoRebuild(host: DashboardHost, built: Built): Promise<void> {
  const board = boardOf(host.state().boards, built);
  const previous = built.previous;
  if (board === undefined || previous === undefined) {
    return;
  }
  const said = host.words.boardActions;
  const sure = await host.dialogs.confirm(
    said.undo(built.plan.title),
    said.undoText(previous.plan.title, summary(previous.plan, host.words)),
    said.undoIt,
  );
  if (!sure) {
    return;
  }
  try {
    await undoDashboard(host.call, built, board);
  } finally {
    await host.refresh();
  }
}

export async function shareBuilt(host: DashboardHost, built: Built): Promise<void> {
  const { resolved, shipped } = host.state();
  const text = dashboardTemplateText(dashboardTemplateOf(built.plan, resolved, shipped));
  const said = host.words.boardActions;
  const copy: Option<'copy'>[] =
    window.isSecureContext && 'clipboard' in navigator ? [{ label: said.copy, value: 'copy' }] : [];
  const choices: Option<'copy' | 'download'>[] = [
    ...copy,
    { label: said.download, value: 'download', primary: true },
  ];
  const choice = await host.dialogs.ask(
    said.share(built.plan.title),
    html`<p class="muted">${said.shareText}</p>
      <textarea
        class="yaml-text"
        readonly
        aria-label=${said.shareLabel}
        .value=${text}
      ></textarea>`,
    choices,
  );
  if (choice === 'copy') {
    await navigator.clipboard.writeText(text);
  } else if (choice === 'download') {
    host.download(`${built.url_path}.yaml`, text);
  }
}

export async function fromTemplate(host: DashboardHost): Promise<Plan | undefined> {
  shippedWhole(host.state());
  const shipped = host.state().shipped;
  const said = host.words.boardActions;
  const given = await host.dialogs.yaml(
    said.fromTemplate,
    { file: said.file, text: said.text, placeholder: said.placeholder },
    (text) => {
      const dashboardTemplate = readDashboardTemplate(text, shipped);
      resolvable(dashboardTemplate.templates);
      return dashboardTemplate;
    },
  );
  if (given === undefined) {
    return undefined;
  }
  const { kept, resolved, taken } = host.state();
  const incoming = planImport(given.templates, shipped, kept, resolved);
  const { offered, choices, alone } = bringing(incoming);
  const open = await host.dialogs.ask(
    given.title,
    (redraw) =>
      html`<p>
          ${previewOf(
            given,
            previewPlan(
              given,
              offered,
              choices,
              taken,
              host.state().registries,
              host.state().resolved,
            ),
            { ...host.state().resolved, ...given.templates },
            host.words,
          )}
        </p>
        ${
          incoming.length === 0
            ? nothing
            : html`<p class="muted">${said.brings}</p>
                ${drawFates(host.words, offered, choices, [], alone, redraw)}`
        }`,
    [{ label: said.openBuilder, value: true, primary: true }],
  );
  if (open !== true) {
    return undefined;
  }
  const brought = broughtIn(given, offered, choices, host.state().taken);
  await Promise.all(brought.save.map((each) => host.save(each.name, entryFor(each, shipped))));
  const now = host.state();
  return planFrom(brought.dashboardTemplate, now.registries, {
    ...now.resolved,
    ...Object.fromEntries(
      brought.save.map((each) => [each.name, readableOf(each.name, each.template)]),
    ),
  });
}

export async function forgetBuilt(host: DashboardHost, built: Built): Promise<void> {
  const board = boardOf(host.state().boards, built);
  const said = host.words.boardActions;
  const remove: Option<'delete'>[] =
    board === undefined ? [] : [{ label: said.deleteToo, value: 'delete' }];
  const choices: Option<'forget' | 'delete'>[] = [
    ...remove,
    { label: said.forgetIt, value: 'forget', primary: true },
  ];
  const choice = await host.dialogs.ask(
    said.forget(built.plan.title),
    html`<p>${said.forgetText}</p>`,
    choices,
  );
  if (choice === undefined) {
    return;
  }
  try {
    await forgetDashboard(host.call, built, board, choice === 'delete');
  } finally {
    await host.refresh();
  }
}
