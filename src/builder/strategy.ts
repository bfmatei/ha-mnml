import { isPlan } from '../contract/plan.ts';
import type { Plan } from '../contract/plan.ts';
import type { Templates } from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';

import { defaultPlan } from './plan.ts';

export function strategyPlan(
  config: Readonly<Record<string, unknown>>,
  registries: Registries,
  templates: Templates,
): Plan {
  const { type: _type, ...given } = config;
  const found = defaultPlan(registries, templates);
  const plan = { ...found, ...given };
  if (isPlan(plan)) {
    return plan;
  }
  const wrong = Object.keys(given).filter((key) => !isPlan({ ...found, [key]: given[key] }));
  throw new Error(
    `MNML strategy: ${wrong.join(', ')} ${wrong.length === 1 ? 'is not a dashboard choice' : 'are not dashboard choices'}`,
  );
}
