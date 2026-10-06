import { isMapping } from '../contract/templates.ts';
import type { Template, Templates, Value } from '../contract/templates.ts';
import { applyChanges } from '../templates/changes.ts';
import type { Change, Conflict } from '../templates/changes.ts';

export type Status = 'shipped' | 'customised' | 'own' | 'conflict';

export interface Kept {
  own: Templates;
  changes: Readonly<Record<string, readonly Change[]>>;
}

export interface Use {
  cards: number;
  dashboards: readonly string[];
}

export interface Row {
  name: string;
  description: string;
  family: string | undefined;
  status: Status;
  changes: number;
  use: Use;
}

export interface Clash {
  change: Change;
  reason: Conflict['reason'];
}

export interface Draft {
  name: string;
  template: Template;
  shipped: Template | undefined;
  conflicts: readonly Clash[];
  fresh?: true;
}

export interface Dashboard {
  path: string | null;
  title: string;
  storage: boolean;
  config: unknown;
}

const NONE: Use = { cards: 0, dashboards: [] };
const TEMPLATE_CARD = 'custom:mnml-template-card';

function walk(value: unknown, visit: (node: Record<string, Value>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit);
    }
  } else if (isMapping(value)) {
    visit(value);
    for (const inner of Object.values(value)) {
      walk(inner, visit);
    }
  }
}

export function usesOf(dashboards: readonly Dashboard[]): Map<string, Use> {
  const uses = new Map<string, { cards: number; dashboards: Set<string> }>();
  for (const dashboard of dashboards) {
    walk(dashboard.config, (node) => {
      const name = node['template'];
      if (node['type'] === TEMPLATE_CARD && typeof name === 'string') {
        const use = uses.get(name) ?? { cards: 0, dashboards: new Set<string>() };
        use.cards += 1;
        use.dashboards.add(dashboard.title);
        uses.set(name, use);
      }
    });
  }
  return new Map(
    [...uses].map(([name, use]) => [name, { cards: use.cards, dashboards: [...use.dashboards] }]),
  );
}

export function rowsOf(
  shipped: Templates,
  owner: Readonly<Record<string, string>>,
  kept: Kept,
  uses: ReadonlyMap<string, Use>,
): Row[] {
  const names = [...new Set([...Object.keys(shipped), ...Object.keys(kept.own)])].toSorted();
  return names.map((name) => {
    const own = kept.own[name];
    const base = shipped[name];
    const changes = kept.changes[name] ?? [];
    const conflicts =
      base === undefined || changes.length === 0 ? 0 : applyChanges(base, changes).conflicts.length;
    const status: Status =
      own !== undefined
        ? 'own'
        : conflicts > 0
          ? 'conflict'
          : changes.length > 0
            ? 'customised'
            : 'shipped';
    return {
      name,
      description: (own ?? base)?.description ?? '',
      family: own === undefined ? (owner[name] ?? 'common') : undefined,
      status,
      changes: changes.length,
      use: uses.get(name) ?? NONE,
    };
  });
}

export function draftOf(name: string, shipped: Templates, kept: Kept): Draft | undefined {
  const own = kept.own[name];
  if (own !== undefined) {
    return { name, template: structuredClone(own), shipped: undefined, conflicts: [] };
  }
  const base = shipped[name];
  if (base === undefined) {
    return undefined;
  }
  const changes = kept.changes[name] ?? [];
  const { template, conflicts } = applyChanges(base, changes);
  return {
    name,
    template,
    shipped: base,
    conflicts: conflicts.flatMap((conflict) => {
      const change = changes[conflict.index];
      return change === undefined ? [] : [{ change, reason: conflict.reason }];
    }),
  };
}

export function describe(row: Row): string {
  const parts: string[] = [];
  if (row.status === 'customised') {
    parts.push(`customised, ${row.changes} ${row.changes === 1 ? 'change' : 'changes'}`);
  } else if (row.status === 'conflict') {
    parts.push('conflict');
  } else if (row.status === 'own') {
    parts.push('yours');
  }
  if (row.use.cards > 0) {
    const boards = row.use.dashboards.length;
    parts.push(
      `on ${row.use.cards} ${row.use.cards === 1 ? 'card' : 'cards'}, ${boards} ${boards === 1 ? 'dashboard' : 'dashboards'}`,
    );
  }
  return parts.join(' • ');
}
