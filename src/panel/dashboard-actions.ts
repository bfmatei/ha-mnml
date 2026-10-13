import { html, nothing } from 'lit';

import { dashboardOf } from '../builder/dashboard.ts';
import { defaultPlan, planFrom } from '../builder/plan.ts';
import { readRecipe, recipeOf, recipeText } from '../builder/recipe.ts';
import type { Plan } from '../contract/builder.ts';

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
import { bringing, broughtIn, previewOf, previewPlan, summary } from './share.ts';
import { entryFor, planImport, resolvable } from './transfer.ts';

export interface DashboardHost extends LibraryHost {
  go: (path: string) => void;
  visit: (path: string) => void;
}

export function boardOf(boards: readonly Board[], built: Built): Board | undefined {
  return boards.find((board) => board.url_path === built.url_path);
}

async function offerOpen(
  host: DashboardHost,
  plan: Plan,
  address: string,
  done: string,
): Promise<void> {
  const open = await host.dialogs.ask(
    done,
    html`<p>${plan.title} is at /${address}, in the sidebar.</p>`,
    [{ label: 'Open it', value: true, primary: true }],
  );
  if (open === true) {
    host.visit(`/${address}`);
  }
}

export async function quickStart(host: DashboardHost): Promise<void> {
  const { registries, resolved, addresses } = host.state();
  const plan = defaultPlan(registries, resolved);
  const address = addressFor(plan.title, addresses);
  const sure = await host.dialogs.confirm(
    'Quick start',
    `MNML makes ${plan.title} at /${address}: ${summary(plan)}. Edit changes any of it later.`,
    'Make it',
  );
  if (!sure) {
    return;
  }
  try {
    await makeDashboard(host.call, address, plan, dashboardOf(plan, registries, resolved));
  } finally {
    await host.refresh();
  }
  await offerOpen(host, plan, address, `${plan.title} is ready`);
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
  if (built !== undefined && state.boardsFailure !== undefined) {
    throw new Error(
      `MNML cannot read Home Assistant's dashboards, so it cannot tell whether ${built.plan.title} is still there: ${state.boardsFailure}`,
    );
  }
  if (
    built !== undefined &&
    !(await host.dialogs.confirm(
      `Rebuild ${built.plan.title}?`,
      'MNML replaces its cards, with any change made to them by hand. Undo brings back the version this replaces.',
      'Rebuild',
    ))
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
    built === undefined ? `${plan.title} is ready` : `${plan.title} is rebuilt`,
  );
}

export async function undoRebuild(host: DashboardHost, built: Built): Promise<void> {
  const board = boardOf(host.state().boards, built);
  const previous = built.previous;
  if (board === undefined || previous === undefined) {
    return;
  }
  const sure = await host.dialogs.confirm(
    `Undo the last rebuild of ${built.plan.title}?`,
    `Its cards, title and icon go back to how they were before it: ${previous.plan.title}, with ${summary(previous.plan)}.`,
    'Undo',
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
  const text = recipeText(recipeOf(built.plan, resolved, shipped));
  const copy: Option<'copy'>[] =
    window.isSecureContext && 'clipboard' in navigator ? [{ label: 'Copy', value: 'copy' }] : [];
  const choices: Option<'copy' | 'download'>[] = [
    ...copy,
    { label: 'Download', value: 'download', primary: true },
  ];
  const choice = await host.dialogs.ask(
    `Share ${built.plan.title}`,
    html`<p class="muted">
        Its layout, its sections' looks and every template of yours it uses. Its layout names no
        area, person or entity of this home; the templates go whole, and a template's example may
        name this home's entities.
      </p>
      <textarea
        class="yaml-text"
        readonly
        aria-label="The dashboard template"
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
  const given = await host.dialogs.yaml(
    'A dashboard from a template',
    {
      file: 'A dashboard template file',
      text: 'A dashboard template in YAML',
      placeholder: 'Paste a dashboard template, or choose a file',
    },
    (text) => {
      const recipe = readRecipe(text, shipped);
      resolvable(recipe.templates);
      return recipe;
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
          )}
        </p>
        ${
          incoming.length === 0
            ? nothing
            : html`<p class="muted">
                  It brings these templates. Replacing one changes it on every dashboard of this
                  home; keeping both brings this one in beside it, under a new name.
                </p>
                ${drawFates(offered, choices, [], alone, redraw)}`
        }`,
    [{ label: 'Open in the builder', value: true, primary: true }],
  );
  if (open !== true) {
    return undefined;
  }
  const brought = broughtIn(given, offered, choices, host.state().taken);
  await Promise.all(brought.save.map((each) => host.save(each.name, entryFor(each, shipped))));
  const now = host.state();
  return planFrom(brought.recipe, now.registries, {
    ...now.resolved,
    ...Object.fromEntries(
      brought.save.map((each) => [each.name, readableOf(each.name, each.template)]),
    ),
  });
}

export async function forgetBuilt(host: DashboardHost, built: Built): Promise<void> {
  const board = boardOf(host.state().boards, built);
  const remove: Option<'delete'>[] =
    board === undefined ? [] : [{ label: 'Delete it too', value: 'delete' }];
  const choices: Option<'forget' | 'delete'>[] = [
    ...remove,
    { label: 'Forget', value: 'forget', primary: true },
  ];
  const choice = await host.dialogs.ask(
    `Forget ${built.plan.title}?`,
    html`<p>
      MNML stops building it. The dashboard stays in Home Assistant as it is, unless it is deleted
      too.
    </p>`,
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
