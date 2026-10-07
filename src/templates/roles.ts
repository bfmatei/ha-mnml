import { isMapping } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';

export type Role = 'tile' | 'popup' | 'part';

function namesIn(value: Value | undefined, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      namesIn(item, into);
    }
    return;
  }
  if (!isMapping(value)) {
    return;
  }
  const named = value['template'];
  if (typeof named === 'string') {
    into.add(named);
  }
  for (const inner of Object.values(value)) {
    namesIn(inner, into);
  }
}

export function rolesOf(templates: Templates): Readonly<Record<string, Role>> {
  const used = new Set<string>();
  for (const template of Object.values(templates)) {
    namesIn(template.card, used);
    namesIn(template.popups, used);
  }
  return Object.fromEntries(
    Object.entries(templates).map(([name, template]) => {
      const card = template.card;
      const popup = isMapping(card) && card['hash'] !== undefined && card['type'] === undefined;
      const role: Role = popup ? 'popup' : used.has(name) ? 'part' : 'tile';
      return [name, role];
    }),
  );
}
