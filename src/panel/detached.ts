import { isMapping } from '../contract/templates.ts';
import type { Templates, Value, WrittenTemplate } from '../contract/templates.ts';
import { detach } from '../templates/detach.ts';

import type { Part } from './outline.ts';
import { listAt, uniqueId, withValue } from './tree.ts';

export function detachedOf(
  template: WrittenTemplate,
  chain: readonly Part[],
  templates: Templates,
): ReturnType<typeof detach> {
  const part = chain.at(-1);
  if (part === undefined) {
    return undefined;
  }
  const taken = new Set([
    ...Object.keys(template.slots ?? {}),
    ...chain.flatMap((each) => {
      const alias = each.value['as'];
      return typeof alias === 'string' ? [alias] : [];
    }),
  ]);
  return detach(part.value, templates, taken);
}

export function withDetached(
  template: WrittenTemplate,
  chain: readonly Part[],
  templates: Templates,
): WrittenTemplate | undefined {
  const part = chain.at(-1);
  const done = detachedOf(template, chain, templates);
  if (part === undefined || done === undefined) {
    return undefined;
  }
  const last = part.path.at(-1) ?? '';
  const listPath = part.path.slice(0, -1);
  let next = template;
  if (last.startsWith('#')) {
    const list = listAt(template, listPath);
    const index = list.findIndex((item) => isMapping(item) && item['id'] === last.slice(1));
    const others = list.filter((_item, at) => at !== index);
    const items: Value[] = [];
    for (const item of done.items) {
      if (isMapping(item)) {
        const id = uniqueId(others, typeof item['id'] === 'string' ? item['id'] : 'part');
        others.push({ id });
        items.push({ ...item, id });
      } else {
        items.push(item);
      }
    }
    next = withValue(next, listPath, [...list.slice(0, index), ...items, ...list.slice(index + 1)]);
  } else {
    next = withValue(next, part.path, done.list ? done.items : (done.items[0] ?? null));
  }
  if (done.popups.length > 0) {
    const have = [...(next.popups ?? [])];
    const added: Value[] = [];
    for (const popup of done.popups) {
      if (isMapping(popup)) {
        const id = uniqueId(have, typeof popup['id'] === 'string' ? popup['id'] : 'popup');
        have.push({ id });
        added.push({ ...popup, id });
      } else {
        added.push(popup);
      }
    }
    next = { ...next, popups: [...(next.popups ?? []), ...added] };
  }
  return next;
}
