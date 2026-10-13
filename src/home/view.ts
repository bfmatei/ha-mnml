import { dashboardOf } from '../builder/dashboard.ts';
import type { Value } from '../contract/templates.ts';
import { expandDashboard } from '../templates/dashboard.ts';
import type { Registries } from '../templates/discover.ts';
import { toValue } from '../templates/expand.ts';
import { SHIPPED } from '../templates/shipped.ts';

import { homePlan } from './plan.ts';
import type { Dashboard, Home } from './types.ts';

const NOTHING: Registries = { areas: {}, devices: {}, entities: {}, states: {} };

export function build(home: Home): Dashboard {
  return dashboardOf(homePlan(home), NOTHING, SHIPPED);
}

export function drawn(home: Home): Value {
  return expandDashboard(SHIPPED, toValue(build(home)));
}
