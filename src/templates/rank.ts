import type { Rule, Template, Value } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';

import { discover } from './discover.ts';
import { filled } from './expand.ts';

export interface Scope {
  readonly area?: string;
  readonly device?: string;
}

export interface Fit {
  readonly scope: Scope;
  readonly found: Readonly<Record<string, Value>>;
  readonly complete: boolean;
  readonly count: number;
}

const AREA_OWN: ReadonlySet<string> = new Set(['area.id', 'area.name', 'area.icon']);

const ownOfArea = (rule: Rule | undefined): boolean =>
  typeof rule === 'string'
    ? AREA_OWN.has(rule)
    : Array.isArray(rule) && rule.length > 0 && rule.every(ownOfArea);

export function fillsHome(template: Template, found: Readonly<Record<string, Value>>): number {
  return Object.entries(template.slots ?? {}).filter(
    ([slot, spec]) => filled(found[slot]) && !ownOfArea(spec.discover),
  ).length;
}

export function fitOf(template: Template, scope: Scope, registries: Registries): Fit {
  const found = discover(template, scope.area, registries, scope.device);
  const complete = Object.entries(template.slots ?? {}).every(
    ([slot, spec]) => spec.required !== true || filled(found[slot]),
  );
  return { scope, found, complete, count: fillsHome(template, found) };
}

export const byFit = (a: Fit, b: Fit): number =>
  Number(b.complete) - Number(a.complete) || b.count - a.count;

export function bestFit(
  template: Template,
  scopes: Iterable<Scope>,
  registries: Registries,
): Fit | undefined {
  let best: Fit | undefined;
  for (const scope of scopes) {
    const fit = fitOf(template, scope, registries);
    if (fit.count > 0 && (best === undefined || byFit(fit, best) < 0)) {
      best = fit;
    }
  }
  return best;
}
