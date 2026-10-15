import { renamedDashboardTemplate } from '../builder/dashboard-template.ts';
import { planFrom } from '../builder/plan.ts';
import { SYSTEM_TEMPLATES } from '../contract/plan.ts';
import type { Plan, DashboardTemplate } from '../contract/plan.ts';
import { templateTitle } from '../contract/templates.ts';
import type { Templates } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';

import { readableOf } from './data.ts';
import { settleImport } from './transfer.ts';
import type { Choice, Incoming } from './transfer.ts';

export function summary(plan: Plan, words: PanelWords = PANEL_EN): string {
  const share = words.share;
  const parts = [
    { count: plan.rooms.length, say: share.rooms },
    { count: plan.devices?.length ?? 0, say: share.devices },
    { count: plan.people.length, say: share.people },
    { count: plan.cars.length, say: share.cars },
    { count: plan.system.length, say: share.system },
  ].filter((part) => part.count > 0);
  return parts.length === 0 ? share.nothing : parts.map((part) => part.say(part.count)).join(', ');
}

export function previewOf(
  dashboardTemplate: DashboardTemplate,
  plan: Plan,
  templates: Templates,
  words: PanelWords = PANEL_EN,
): string {
  const said = [words.share.makes(summary(plan, words))];
  if (dashboardTemplate.sections.rooms !== undefined && plan.rooms.length === 0) {
    said.push(words.share.noRooms);
  }
  const system = dashboardTemplate.sections.system;
  const listed = system === undefined ? [] : (system.templates ?? SYSTEM_TEMPLATES);
  const missing = listed
    .filter((name) => !plan.system.some((choice) => choice.template === name))
    .map((name) => templateTitle(templates[name], name));
  if (missing.length > 0) {
    said.push(words.share.missing(missing));
  }
  return said.join(' ');
}

export function settled(
  plan: readonly Incoming[],
  choices: Readonly<Record<string, Choice>>,
  taken: ReadonlySet<string>,
): { save: Incoming[]; renames: Record<string, string> } {
  const used = new Set(taken);
  const save: Incoming[] = [];
  const renames: Record<string, string> = {};
  for (const incoming of plan) {
    const [kept] = settleImport([incoming], choices, used);
    if (kept === undefined) {
      continue;
    }
    used.add(kept.name);
    save.push(kept);
    if (kept.name !== incoming.name) {
      renames[incoming.name] = kept.name;
    }
  }
  return { save, renames };
}

const HEADING = 'section-heading';

export function bringing(incoming: readonly Incoming[]): {
  offered: Incoming[];
  choices: Record<string, Choice>;
  alone: ReadonlySet<string>;
} {
  const choices: Record<string, Choice> = {};
  const alone = new Set<string>();
  const offered: Incoming[] = [];
  for (const each of incoming) {
    if (each.fate !== 'changes' && !each.clash) {
      offered.push(each);
      continue;
    }
    if (each.name === HEADING) {
      alone.add(each.name);
      choices[each.name] = 'skip';
    } else {
      choices[each.name] = 'both';
    }
    offered.push({ ...each, clash: true });
  }
  return { offered, choices, alone };
}

export function broughtIn(
  dashboardTemplate: DashboardTemplate,
  offered: readonly Incoming[],
  choices: Readonly<Record<string, Choice>>,
  taken: ReadonlySet<string>,
): { save: Incoming[]; dashboardTemplate: DashboardTemplate } {
  const { save, renames } = settled(offered, choices, taken);
  const renamed = renamedDashboardTemplate(dashboardTemplate, renames);
  const renamedSave: Incoming[] = [];
  for (const each of save) {
    renamedSave.push({ ...each, template: renamed.templates[each.name] ?? each.template });
  }
  return { save: renamedSave, dashboardTemplate: renamed };
}

export function previewPlan(
  dashboardTemplate: DashboardTemplate,
  offered: readonly Incoming[],
  choices: Readonly<Record<string, Choice>>,
  taken: ReadonlySet<string>,
  registries: Registries,
  resolved: Templates,
): Plan {
  const brought = broughtIn(dashboardTemplate, offered, choices, taken);
  const templates = {
    ...resolved,
    ...Object.fromEntries(
      brought.save.map((each) => [each.name, readableOf(each.name, each.template)]),
    ),
  };
  return planFrom(brought.dashboardTemplate, registries, templates);
}
