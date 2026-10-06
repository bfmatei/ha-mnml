import { isMapping } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';

import { expand } from './expand.ts';

type Mapping = Record<string, Value>;

function slotsOf(node: Mapping): Mapping {
  const slots = node['slots'];
  return isMapping(slots) ? slots : {};
}

function walk(node: Value, templates: Templates, popups: Value[]): Value {
  if (Array.isArray(node)) {
    return node.map((item) => walk(item, templates, popups));
  }
  if (!isMapping(node)) {
    return node;
  }
  if (node['type'] === 'custom:mnml-template-card' && typeof node['template'] === 'string') {
    const expanded = expand(templates, { template: node['template'], slots: slotsOf(node) });
    popups.push(...expanded.popups);
    return expanded.card;
  }
  return Object.fromEntries(
    Object.entries(node).map(([key, item]) => [key, walk(item, templates, popups)]),
  );
}

function gather(node: Value, popups: readonly Value[]): Value {
  if (Array.isArray(node)) {
    return node.map((item) => gather(item, popups));
  }
  if (!isMapping(node)) {
    return node;
  }
  if (node['type'] === 'custom:mnml-popups-card') {
    const own = Array.isArray(node['popups']) ? node['popups'] : [];
    return { ...node, popups: [...own, ...popups] };
  }
  return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, gather(item, popups)]));
}

export function expandDashboard(templates: Templates, config: Value): Value {
  const popups: Value[] = [];
  return gather(walk(config, templates, popups), popups);
}
