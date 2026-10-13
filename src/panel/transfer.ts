import { SECTION_ORDER } from '../contract/builder.ts';
import type { Plan, SectionKey, SectionLook } from '../contract/builder.ts';
import { isMapping, isStorable, isTemplate } from '../contract/templates.ts';
import type { Templates, WrittenTemplate } from '../contract/templates.ts';
import { toYaml } from '../contract/yaml.ts';
import { field } from '../ha/field.ts';
import { changesOf, nodeHash } from '../templates/changes.ts';
import type { Change } from '../templates/changes.ts';
import { toValue } from '../templates/expand.ts';

import type { Built, Call } from './building.ts';
import { shapedOf } from './data.ts';
import type { Dashboard, Entry, Kept } from './data.ts';
import { messageOf } from './message.ts';
import { adoptIds } from './tree.ts';
import { NOT_A_TEMPLATE, readYaml } from './yaml.ts';

type Fate = 'changes' | 'own' | 'replaces' | 'same';

export interface Incoming {
  name: string;
  template: WrittenTemplate;
  fate: Fate;
  clash: boolean;
  from: readonly string[];
}

export type Choice = 'replace' | 'both' | 'skip';

export function templatesIn(
  text: string,
  shipped: ReadonlySet<string> = new Set(),
): Record<string, WrittenTemplate> {
  const read = readYaml(text);
  const inner =
    isMapping(read) && isMapping(read['mnml_templates']) ? read['mnml_templates'] : read;
  if (!isMapping(inner)) {
    throw new Error('the file holds no mapping of names to templates');
  }
  const found: Record<string, WrittenTemplate> = {};
  for (const [name, template] of Object.entries(inner)) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) {
      throw new Error(`${name}: a template's name is lower case letters, digits, - and _`);
    }
    if (!isStorable(template, shipped.has(name))) {
      throw new Error(`${name}: ${NOT_A_TEMPLATE}`);
    }
    found[name] = template;
  }
  resolvable(found);
  return found;
}

export function resolvable(templates: Readonly<Record<string, WrittenTemplate>>): void {
  for (const [name, template] of Object.entries(templates)) {
    shapedOf(name, template);
  }
}

const same = (a: WrittenTemplate, b: WrittenTemplate): boolean =>
  nodeHash(toValue(a)) === nodeHash(toValue(b));

function adopted(
  name: string,
  template: WrittenTemplate,
  shipped: Templates,
  kept: Kept,
): WrittenTemplate {
  return adoptIds(template, kept.own[name] ?? shipped[name]);
}

export function planImport(
  incoming: Readonly<Record<string, WrittenTemplate>>,
  shipped: Templates,
  kept: Kept,
  resolved: Templates,
  from: Readonly<Record<string, readonly string[]>> = {},
): Incoming[] {
  return Object.entries(incoming).map(([name, given]) => {
    const template = adopted(name, given, shipped, kept);
    const fate: Fate = [kept.own[name], resolved[name]].some(
      (now) => now !== undefined && same(now, template),
    )
      ? 'same'
      : kept.own[name] !== undefined
        ? 'replaces'
        : shipped[name] !== undefined
          ? 'changes'
          : 'own';
    const clash =
      fate !== 'same' && (kept.own[name] !== undefined || kept.changes[name] !== undefined);
    return { name, template, fate, clash, from: from[name] ?? [] };
  });
}

function freeName(taken: Set<string>, name: string): string {
  let next = `${name}-2`;
  for (let n = 3; taken.has(next); n += 1) {
    next = `${name}-${n}`;
  }
  taken.add(next);
  return next;
}

export function settleImport(
  plan: readonly Incoming[],
  choices: Readonly<Record<string, Choice>>,
  taken: ReadonlySet<string>,
): Incoming[] {
  const used = new Set(taken);
  return plan.flatMap((incoming) => {
    if (incoming.fate === 'same') {
      return [];
    }
    const choice = incoming.clash ? (choices[incoming.name] ?? 'replace') : 'replace';
    if (choice === 'skip') {
      return [];
    }
    return choice === 'both'
      ? [{ ...incoming, name: freeName(used, incoming.name), fate: 'own', clash: false }]
      : [incoming];
  });
}

export function entryFor(incoming: Incoming, shipped: Templates): Entry | undefined {
  const base = shipped[incoming.name];
  if (incoming.fate === 'changes' && base !== undefined) {
    const changes = changesOf(base, shapedOf(incoming.name, incoming.template));
    return changes.length === 0 ? undefined : { kind: 'changes', changes };
  }
  return { kind: 'own', template: incoming.template };
}

export function exportText(
  names: readonly string[],
  templates: Readonly<Record<string, WrittenTemplate>>,
): string {
  return toYaml(
    Object.fromEntries(
      names.flatMap((name) => (templates[name] === undefined ? [] : [[name, templates[name]]])),
    ),
  );
}

const SHARED = 'mnml-templates';

export function dashboardTemplates(
  dashboards: readonly Dashboard[],
  shipped: ReadonlySet<string> = new Set(),
): {
  templates: Record<string, WrittenTemplate>;
  from: Record<string, string[]>;
  differ: string[];
} {
  const ordered = [...dashboards].toSorted(
    (a, b) => Number(b.path === SHARED) - Number(a.path === SHARED),
  );
  const templates: Record<string, WrittenTemplate> = {};
  const from: Record<string, string[]> = {};
  const differ = new Set<string>();
  for (const dashboard of ordered) {
    const own = field(dashboard.config, 'mnml_templates');
    for (const [name, template] of Object.entries(isMapping(own) ? own : {})) {
      if (!isStorable(template, shipped.has(name))) {
        continue;
      }
      const first = templates[name];
      if (first === undefined) {
        templates[name] = template;
      } else if (!same(first, template)) {
        differ.add(name);
      }
      from[name] = [...(from[name] ?? []), dashboard.title];
    }
  }
  return { templates, from, differ: [...differ].toSorted() };
}

export function notKept(
  found: Readonly<Record<string, WrittenTemplate>>,
  kept: Kept,
  resolved: Templates,
  shipped: Templates,
): Record<string, WrittenTemplate> {
  return Object.fromEntries(
    Object.entries(found).filter(([name, template]) => {
      const now = resolved[name];
      return (
        kept.own[name] === undefined &&
        kept.changes[name] === undefined &&
        (now === undefined || !same(now, adopted(name, template, shipped, kept)))
      );
    }),
  );
}

const TEMPLATE_CARD = 'custom:mnml-template-card';

function renamed(
  value: unknown,
  from: string,
  to: string,
  cards: boolean,
): { value: unknown; count: number } {
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const inner = renamed(item, from, to, cards);
      count += inner.count;
      return inner.value;
    });
    return { value: next, count };
  }
  if (isMapping(value)) {
    let count = 0;
    const hit = value['template'] === from && (!cards || value['type'] === TEMPLATE_CARD);
    const next: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'template' && hit) {
        next[key] = to;
        count += 1;
      } else {
        const deeper = renamed(inner, from, to, cards);
        count += deeper.count;
        next[key] = deeper.value;
      }
    }
    return { value: next, count };
  }
  return { value, count: 0 };
}

export function renamedConfig(
  config: unknown,
  from: string,
  to: string,
): { config: unknown; count: number } {
  const { value, count } = renamed(config, from, to, true);
  return { config: value, count };
}

export function renamedTemplate(
  template: WrittenTemplate,
  from: string,
  to: string,
): WrittenTemplate | undefined {
  const { value, count } = renamed(template, from, to, false);
  return count > 0 && isTemplate(value) ? value : undefined;
}

export function renamedChanges(
  changes: readonly Change[],
  from: string,
  to: string,
): Change[] | undefined {
  let count = 0;
  const next = changes.map((change): Change => {
    if (change.op === 'set' && change.key === 'template' && change.value === from) {
      count += 1;
      return { ...change, value: to };
    }
    if (change.op !== 'set' && change.op !== 'insert') {
      return change;
    }
    const inner = renamed(change.value, from, to, false);
    count += inner.count;
    return { ...change, value: toValue(inner.value) };
  });
  return count > 0 ? next : undefined;
}

function renamedPlan(plan: Plan, from: string, to: string): Plan | undefined {
  const sections: Partial<Record<SectionKey, SectionLook>> = {};
  let count = 0;
  for (const key of SECTION_ORDER) {
    const look = plan.sections?.[key];
    if (look !== undefined) {
      count += look.template === from ? 1 : 0;
      sections[key] = look.template === from ? { ...look, template: to } : look;
    }
  }
  const system = plan.system.map((choice) => {
    count += choice.template === from ? 1 : 0;
    return choice.template === from ? { ...choice, template: to } : choice;
  });
  return count === 0
    ? undefined
    : { ...plan, system, ...(plan.sections === undefined ? {} : { sections }) };
}

export interface Renamed {
  written: string[];
  byHand: string[];
  failed: string[];
}

export async function renameEverywhere(
  call: Call,
  dashboards: readonly Dashboard[],
  from: string,
  to: string,
): Promise<Renamed> {
  const using = dashboards.filter(
    (dashboard) => renamedConfig(dashboard.config, from, to).count > 0,
  );
  const results = await Promise.all(
    using.map(async (dashboard): Promise<[keyof Renamed, string] | undefined> => {
      if (!dashboard.storage) {
        return ['byHand', dashboard.title];
      }
      try {
        const now = await call({ type: 'lovelace/config', url_path: dashboard.path });
        const { config, count } = renamedConfig(now, from, to);
        if (count === 0) {
          return undefined;
        }
        await call({ type: 'lovelace/config/save', url_path: dashboard.path, config });
        return ['written', `${dashboard.title} (${count})`];
      } catch (error) {
        return ['failed', `${dashboard.title}: ${messageOf(error)}`];
      }
    }),
  );
  const renamed: Renamed = { written: [], byHand: [], failed: [] };
  for (const result of results) {
    if (result !== undefined) {
      renamed[result[0]].push(result[1]);
    }
  }
  return renamed;
}

export async function renamePlans(
  call: Call,
  built: readonly Built[],
  from: string,
  to: string,
): Promise<string[]> {
  const failed = await Promise.all(
    built.map(async (each): Promise<string[]> => {
      const before = each.previous;
      const plan = renamedPlan(each.plan, from, to);
      const earlier = before === undefined ? undefined : renamedPlan(before.plan, from, to);
      const cards = renamedConfig(before?.config, from, to);
      if (plan === undefined && earlier === undefined && cards.count === 0) {
        return [];
      }
      const config = isMapping(cards.config) ? cards.config : undefined;
      try {
        await call({
          type: 'mnml/dashboards/save',
          url_path: each.url_path,
          plan: plan ?? each.plan,
          ...(before === undefined || config === undefined
            ? {}
            : { previous: { plan: earlier ?? before.plan, config } }),
        });
        return [];
      } catch (error) {
        return [`the plan of ${each.plan.title}: ${messageOf(error)}`];
      }
    }),
  );
  return failed.flat();
}
