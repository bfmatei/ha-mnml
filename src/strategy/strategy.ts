import { ReactiveElement } from 'lit';

import { dashboardOf } from '../builder/dashboard.ts';
import { DEFAULT_DASHBOARD_TEMPLATE } from '../builder/plan.ts';
import { strategyPlan } from '../builder/strategy.ts';
import type { Dashboard } from '../contract/dashboard.ts';
import type { MdiIcon } from '../contract/entities.ts';
import type { Templates } from '../contract/templates.ts';
import { energyPrefs } from '../ha/energy.ts';
import type { HassConnection, HomeAssistant } from '../ha/hass.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { onShared, resolvedTemplates, sharedTemplates } from '../store/store.ts';
import type { SharedState } from '../store/store.ts';
import { OWNER } from '../templates/families.ts';

export const STRATEGY_EDITOR = 'mnml-strategy-editor';

function settled(connection: HassConnection): Promise<SharedState> {
  const now = sharedTemplates(connection);
  if (now.status !== 'waiting') {
    return Promise.resolve(now);
  }
  return new Promise((resolve) => {
    const stop = onShared(() => {
      const shared = sharedTemplates(connection);
      if (shared.status !== 'waiting') {
        stop();
        resolve(shared);
      }
    });
  });
}

export async function homeTemplates(hass: HomeAssistant): Promise<Templates> {
  const names = Object.keys(OWNER);
  const [shared] = await Promise.all([settled(hass.connection), SHIPPED_TEMPLATES.need(names)]);
  const failure = SHIPPED_TEMPLATES.failure(names);
  if (failure !== undefined) {
    throw new Error(failure);
  }
  if (shared.status === 'failed') {
    throw new Error(shared.error);
  }
  return resolvedTemplates(shared, SHIPPED_TEMPLATES.templates());
}

export class MnmlStrategy extends ReactiveElement {
  static readonly registryDependencies: readonly string[] = ['areas', 'devices', 'entities'];

  static getCreateSuggestions(): { title: string; icon: MdiIcon } {
    return { title: DEFAULT_DASHBOARD_TEMPLATE.title, icon: DEFAULT_DASHBOARD_TEMPLATE.icon };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(STRATEGY_EDITOR);
  }

  static async generate(
    config: Readonly<Record<string, unknown>>,
    hass: HomeAssistant,
  ): Promise<Dashboard> {
    const [templates] = await Promise.all([homeTemplates(hass), energyPrefs(hass.connection)]);
    const registries = registriesOf(hass);
    return dashboardOf(strategyPlan(config, registries, templates), registries, templates);
  }
}
