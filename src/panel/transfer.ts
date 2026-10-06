import { isMapping, isTemplate } from '../contract/templates.ts';
import type { Template, Templates } from '../contract/templates.ts';
import { toYaml } from '../contract/yaml.ts';
import { field } from '../ha/field.ts';
import { changesOf, nodeHash } from '../templates/changes.ts';
import { toValue } from '../templates/expand.ts';

import type { Entry } from './builder.ts';
import type { Dashboard, Kept } from './data.ts';
import { adoptIds } from './tree.ts';
import { readYaml } from './yaml.ts';

type Fate = 'changes' | 'own' | 'replaces' | 'same';

export interface Incoming {
  name: string;
  template: Template;
  fate: Fate;
  clash: boolean;
  from: readonly string[];
}

export type Choice = 'replace' | 'both' | 'skip';

export function templatesIn(text: string): Record<string, Template> {
  const read = readYaml(text);
  const inner =
    isMapping(read) && isMapping(read['mnml_templates']) ? read['mnml_templates'] : read;
  if (!isMapping(inner)) {
    throw new Error('the file holds no mapping of names to templates');
  }
  const found: Record<string, Template> = {};
  for (const [name, template] of Object.entries(inner)) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) {
      throw new Error(`${name}: a template's name is lower case letters, digits, - and _`);
    }
    if (!isTemplate(template)) {
      throw new Error(`${name}: a template is a mapping with a card`);
    }
    found[name] = template;
  }
  return found;
}

const same = (a: Template, b: Template): boolean => nodeHash(toValue(a)) === nodeHash(toValue(b));

function adopted(name: string, template: Template, shipped: Templates, kept: Kept): Template {
  return adoptIds(template, kept.own[name] ?? shipped[name]);
}

export function planImport(
  incoming: Readonly<Record<string, Template>>,
  shipped: Templates,
  kept: Kept,
  resolved: Templates,
  from: Readonly<Record<string, readonly string[]>> = {},
): Incoming[] {
  return Object.entries(incoming).map(([name, given]) => {
    const template = adopted(name, given, shipped, kept);
    const now = resolved[name];
    const fate: Fate =
      now !== undefined && same(now, template)
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
    const changes = changesOf(base, incoming.template);
    return changes.length === 0 ? undefined : { kind: 'changes', changes };
  }
  return { kind: 'own', template: incoming.template };
}

export function exportText(names: readonly string[], resolved: Templates): string {
  return toYaml(
    Object.fromEntries(
      names.flatMap((name) => (resolved[name] === undefined ? [] : [[name, resolved[name]]])),
    ),
  );
}

const SHARED = 'mnml-templates';

export function dashboardTemplates(dashboards: readonly Dashboard[]): {
  templates: Record<string, Template>;
  from: Record<string, string[]>;
  differ: string[];
} {
  const ordered = [...dashboards].toSorted(
    (a, b) => Number(b.path === SHARED) - Number(a.path === SHARED),
  );
  const templates: Record<string, Template> = {};
  const from: Record<string, string[]> = {};
  const differ = new Set<string>();
  for (const dashboard of ordered) {
    const own = field(dashboard.config, 'mnml_templates');
    for (const [name, template] of Object.entries(isMapping(own) ? own : {})) {
      if (!isTemplate(template)) {
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
  found: Readonly<Record<string, Template>>,
  kept: Kept,
  resolved: Templates,
  shipped: Templates,
): Record<string, Template> {
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
  template: Template,
  from: string,
  to: string,
): Template | undefined {
  const { value, count } = renamed(template, from, to, false);
  return count > 0 && isTemplate(value) ? value : undefined;
}

export interface Renamed {
  written: string[];
  byHand: string[];
  failed: string[];
}

type Call = (message: { type: string } & Record<string, unknown>) => Promise<unknown>;

const said = (error: unknown): string => {
  const text = field(error, 'message');
  return typeof text === 'string' ? text : String(error);
};

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
        return ['failed', `${dashboard.title}: ${said(error)}`];
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
