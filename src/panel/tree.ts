import { isMapping, isTemplate } from '../contract/templates.ts';
import type { Template, Value } from '../contract/templates.ts';
import { toValue } from '../templates/expand.ts';

export type Path = readonly string[];

const OWN = 'my-';

function idOf(item: Value): string | undefined {
  return isMapping(item) && typeof item['id'] === 'string' ? item['id'] : undefined;
}

function step(node: Value | undefined, segment: string): Value | undefined {
  if (segment.startsWith('#')) {
    return Array.isArray(node) ? node.find((item) => idOf(item) === segment.slice(1)) : undefined;
  }
  return isMapping(node) ? node[segment] : undefined;
}

export function valueAt(template: Template, path: Path): Value | undefined {
  let node: Value | undefined = toValue(template);
  for (const segment of path) {
    node = step(node, segment);
  }
  return node;
}

function replaced(node: Value, path: Path, next: Value | undefined): Value {
  const [segment, ...rest] = path;
  if (segment === undefined) {
    return next ?? null;
  }
  if (segment.startsWith('#') && Array.isArray(node)) {
    const id = segment.slice(1);
    return node.flatMap((item) => {
      if (idOf(item) !== id) {
        return [item];
      }
      const inner = rest.length === 0 ? next : replaced(item, rest, next);
      return inner === undefined ? [] : [inner];
    });
  }
  if (isMapping(node)) {
    if (rest.length === 0 && next === undefined) {
      return Object.fromEntries(Object.entries(node).filter(([key]) => key !== segment));
    }
    return {
      ...node,
      [segment]: rest.length === 0 ? (next ?? null) : replaced(node[segment] ?? {}, rest, next),
    };
  }
  return node;
}

export function withValue(template: Template, path: Path, next: Value | undefined): Template {
  const root = replaced(toValue(template), path, next);
  return isTemplate(root) ? root : template;
}

export function uniqueId(list: readonly Value[], wanted: string): string {
  const used = new Set(list.map(idOf));
  const cleaned =
    wanted
      .replaceAll(/[^\w-]/g, '-')
      .replaceAll(/-+/g, '-')
      .replaceAll(/^-|-$/g, '') || 'part';
  const base = cleaned.startsWith(OWN) ? cleaned : `${OWN}${cleaned}`;
  let id = base;
  for (let n = 2; used.has(id); n += 1) {
    id = `${base}-${n}`;
  }
  return id;
}

export function inserted(list: readonly Value[], item: Value, after: number): Value[] {
  return [...list.slice(0, after + 1), item, ...list.slice(after + 1)];
}

export function moved(list: readonly Value[], from: number, to: number): Value[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) {
    next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  }
  return next;
}

function idFor(item: Record<string, Value>): string {
  const type = item['type'];
  const template = item['template'];
  const hash = item['hash'];
  if (typeof template === 'string' && template !== '') {
    return template;
  }
  if (typeof type === 'string' && type !== '' && !type.includes('[[')) {
    return type.replace(/^custom:mnml-/, '').replace(/-card$/, '');
  }
  return typeof hash === 'string' && hash !== '' ? hash.replace(/^#/, '') : 'part';
}

function freshId(taken: Set<string>, wanted: string): string {
  const base = uniqueId([], wanted);
  let id = base;
  for (let n = 2; taken.has(id); n += 1) {
    id = `${base}-${n}`;
  }
  taken.add(id);
  return id;
}

function bare(value: Value): string {
  return JSON.stringify(value, (key, inner: unknown) => (key === 'id' ? undefined : inner));
}

const sameKind = (a: Record<string, Value>, b: Record<string, Value>): boolean =>
  a['type'] === b['type'] && a['template'] === b['template'] && a['hash'] === b['hash'];

function adoptList(items: readonly Value[], base: readonly Value[] | undefined): Value[] {
  const shipped = (base ?? []).filter(isMapping);
  const taken = new Set<string>();
  const kept = items.map((item) => {
    const id = idOf(item);
    if (id === undefined || id === '' || taken.has(id)) {
      return undefined;
    }
    taken.add(id);
    return id;
  });
  const ids = items.map((item, index) => {
    const own = kept[index];
    if (own !== undefined || !isMapping(item)) {
      return own;
    }
    const free = shipped.filter((each) => {
      const id = idOf(each);
      return id !== undefined && !taken.has(id);
    });
    const twin = free.find((each) => bare(each) === bare(item));
    const placed = shipped[index];
    const match =
      twin ??
      (placed !== undefined && free.includes(placed) && sameKind(placed, item)
        ? placed
        : undefined);
    const id = match === undefined ? undefined : idOf(match);
    if (id !== undefined) {
      taken.add(id);
      return id;
    }
    return freshId(taken, idFor(item));
  });
  return items.map((item, index) => {
    const id = ids[index];
    if (!isMapping(item) || id === undefined) {
      return item;
    }
    const twin = shipped.find((each) => idOf(each) === id);
    const inner = adopt(item, twin);
    return isMapping(inner)
      ? { id, ...Object.fromEntries(Object.entries(inner).filter(([key]) => key !== 'id')) }
      : inner;
  });
}

function adopt(value: Value, base: Value | undefined): Value {
  if (Array.isArray(value)) {
    return value.some(isMapping) ? adoptList(value, Array.isArray(base) ? base : undefined) : value;
  }
  if (isMapping(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        adopt(inner, isMapping(base) ? base[key] : undefined),
      ]),
    );
  }
  return value;
}

export function adoptIds(template: Template, base: Template | undefined): Template {
  const popups =
    template.popups === undefined ? undefined : adoptList(template.popups, base?.popups);
  return {
    ...template,
    card: adopt(template.card, base?.card),
    ...(popups === undefined ? {} : { popups }),
  };
}
