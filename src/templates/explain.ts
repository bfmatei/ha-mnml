import type { Value, Template } from '../contract/templates.ts';

import { areaOf, describe, discoverSlot, matches } from './discover.ts';
import type { Registries, Step } from './discover.ts';

export interface Trace {
  value: Value | undefined;
  steps: Step[];
  reason?: string;
}

const ELSEWHERE = 3;

function reasonOf(steps: Step[], registries: Registries): string | undefined {
  const first = steps.find((step) => step.filter !== undefined);
  if (first?.filter === undefined) {
    const named = steps[0];
    return named?.area === null || named?.area === undefined
      ? 'needs an area: without one only whole-home rules run'
      : 'the area has none';
  }
  const { filter } = first;
  const everywhere = first.everywhere;
  if (!everywhere && (first.area === null || first.area === undefined)) {
    return 'needs an area: without one only whole-home rules run';
  }
  const where = everywhere
    ? 'the home'
    : (registries.areas[first.area ?? '']?.name ?? String(first.area));
  const parts = [`no ${describe(filter)} in ${where}`];
  const near = steps.flatMap((step) => step.near).slice(0, ELSEWHERE);
  if (near.length > 0) {
    parts.push(
      `almost: ${near.map((miss) => `${miss.entity_id} ${miss.why.join(' and ')}`).join('; ')}`,
    );
  }
  if (!everywhere) {
    const elsewhere = Object.values(registries.entities)
      .filter((entry) => entry.hidden !== true && matches(entry, filter, registries))
      .filter((entry) => areaOf(entry, registries) !== first.area)
      .toSorted((a, b) => a.entity_id.localeCompare(b.entity_id))
      .slice(0, ELSEWHERE);
    if (elsewhere.length > 0) {
      parts.push(
        `found elsewhere: ${elsewhere
          .map((entry) => {
            const area = areaOf(entry, registries);
            return `${entry.entity_id}${area === undefined ? ' (in no area)' : ` in ${registries.areas[area]?.name ?? area}`}`;
          })
          .join(', ')}`,
      );
    }
  }
  return parts.join('; ');
}

export function explain(
  template: Template,
  area: string | undefined,
  registries: Registries,
): Record<string, Trace> {
  const traces: Record<string, Trace> = {};
  for (const [slot, spec] of Object.entries(template.slots ?? {})) {
    if (spec.discover === undefined) {
      continue;
    }
    const steps: Step[] = [];
    const value = discoverSlot(slot, spec, area, registries, { step: (step) => steps.push(step) });
    traces[slot] = {
      value,
      steps,
      ...(value === undefined ? { reason: reasonOf(steps, registries) } : {}),
    };
  }
  return traces;
}
