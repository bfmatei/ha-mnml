import { isMapping, isTemplate } from '../contract/templates.ts';
import type { Template, Value } from '../contract/templates.ts';

import { toValue } from './expand.ts';

interface SetChange {
  op: 'set';
  path: readonly string[];
  key: string;
  value: Value;
  id?: never;
  after?: never;
  base: string;
}

interface RemoveChange {
  op: 'remove';
  path: readonly string[];
  key?: never;
  value?: never;
  id?: never;
  after?: never;
  base: string;
}

interface InsertChange {
  op: 'insert';
  path: readonly string[];
  key?: never;
  value: Value;
  id?: never;
  after: string | null;
  base: string;
}

interface MoveChange {
  op: 'move';
  path: readonly string[];
  key?: never;
  value?: never;
  id: string;
  after: string | null;
  base: string;
}

export type Change = SetChange | RemoveChange | InsertChange | MoveChange;

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

const isSegment = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !UNSAFE.has(value);

const isAfter = (value: unknown): boolean => value === null || typeof value === 'string';

export function isChange(value: unknown): value is Change {
  if (!isMapping(value)) {
    return false;
  }
  const { op, path, base } = value;
  if (!Array.isArray(path) || !path.every(isSegment) || typeof base !== 'string') {
    return false;
  }
  if (op === 'set') {
    return isSegment(value['key']) && Object.hasOwn(value, 'value');
  }
  if (op === 'remove') {
    return path.length > 1 || (path.length === 1 && path[0] !== 'card');
  }
  if (op === 'insert') {
    const inserted = value['value'];
    return isAfter(value['after']) && isMapping(inserted) && isSegment(inserted['id']);
  }
  return (
    op === 'move' &&
    isSegment(value['id']) &&
    isAfter(value['after']) &&
    value['after'] !== value['id']
  );
}

export interface Conflict {
  index: number;
  reason: 'changed' | 'gone' | 'taken';
}

interface Applied {
  template: Template;
  conflicts: Conflict[];
}

function canonical(value: Value | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (isMapping(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value ?? null;
}

export function nodeHash(value: Value | undefined): string {
  const text = JSON.stringify(canonical(value));
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 2_654_435_761);
    second = Math.imul(second ^ code, 1_597_334_677);
  }
  first =
    Math.imul(first ^ (first >>> 16), 2_246_822_507) ^
    Math.imul(second ^ (second >>> 13), 3_266_489_909);
  second =
    Math.imul(second ^ (second >>> 16), 2_246_822_507) ^
    Math.imul(first ^ (first >>> 13), 3_266_489_909);
  return `${(second >>> 0).toString(16).padStart(8, '0')}${(first >>> 0).toString(16).padStart(8, '0')}`;
}

function idOf(item: Value): string | undefined {
  return isMapping(item) && typeof item['id'] === 'string' ? item['id'] : undefined;
}

function child(node: Value | undefined, segment: string): Value | undefined {
  if (segment.startsWith('#')) {
    return Array.isArray(node) ? node.find((item) => idOf(item) === segment.slice(1)) : undefined;
  }
  return isMapping(node) && Object.hasOwn(node, segment) ? node[segment] : undefined;
}

function at(root: Value, path: readonly string[]): Value | undefined {
  let node: Value | undefined = root;
  for (const segment of path) {
    node = child(node, segment);
  }
  return node;
}

function after(list: Value[], id: string | null): number {
  if (id === null) {
    return 0;
  }
  const index = list.findIndex((item) => idOf(item) === id);
  return index < 0 ? list.length : index + 1;
}

function touched(root: Value, change: Change): Value | undefined {
  const node = at(root, change.path);
  if (change.op === 'set') {
    return isMapping(node) && Object.hasOwn(node, change.key) ? node[change.key] : undefined;
  }
  if (change.op === 'remove') {
    return node;
  }
  return Array.isArray(node) ? node.map((item) => idOf(item) ?? null) : undefined;
}

export function baseOf(template: Template, change: Change): string {
  return nodeHash(touched(toValue(template), change));
}

function apply(root: Value, shipped: Value, change: Change): Conflict['reason'] | undefined {
  const target = at(root, change.path);
  const original = at(shipped, change.path);
  const changed = original !== undefined && nodeHash(touched(shipped, change)) !== change.base;
  if (change.op === 'set') {
    if (!isMapping(target) || UNSAFE.has(change.key)) {
      return 'gone';
    }
    target[change.key] = toValue(change.value);
    return changed ? 'changed' : undefined;
  }
  if (change.op === 'remove') {
    const parent = at(root, change.path.slice(0, -1));
    const last = change.path.at(-1);
    if (target === undefined || last === undefined) {
      return 'gone';
    }
    if (Array.isArray(parent)) {
      parent.splice(
        parent.findIndex((item) => idOf(item) === last.slice(1)),
        1,
      );
    } else if (isMapping(parent)) {
      Reflect.deleteProperty(parent, last);
    }
    return changed ? 'changed' : undefined;
  }
  if (!Array.isArray(target)) {
    return 'gone';
  }
  if (change.op === 'insert') {
    const id = idOf(change.value);
    if (id === undefined || target.some((item) => idOf(item) === id)) {
      return 'taken';
    }
    target.splice(after(target, change.after), 0, toValue(change.value));
    return changed ? 'changed' : undefined;
  }
  const from = target.findIndex((item) => idOf(item) === change.id);
  if (from < 0) {
    return 'gone';
  }
  const [moved] = target.splice(from, 1);
  if (moved !== undefined) {
    target.splice(after(target, change.after), 0, moved);
  }
  return changed ? 'changed' : undefined;
}

export function applyChanges(template: Template, changes: readonly Change[]): Applied {
  const root = toValue(template);
  const shipped = toValue(template);
  const conflicts: Conflict[] = [];
  for (const [index, change] of changes.entries()) {
    const reason = apply(root, shipped, change);
    if (reason !== undefined) {
      conflicts.push({ index, reason });
    }
  }
  return { template: isTemplate(root) ? root : template, conflicts };
}

function same(a: Value | undefined, b: Value | undefined): boolean {
  return nodeHash(a) === nodeHash(b);
}

function isParts(value: Value | undefined): value is Value[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every((item) => idOf(item) !== undefined)
  );
}

function diffParts(before: Value[], after: Value[], path: string[], out: Change[]): void {
  const kept = new Set(after.map(idOf));
  for (const item of before) {
    const id = idOf(item);
    if (id !== undefined && !kept.has(id)) {
      out.push({ op: 'remove', path: [...path, `#${id}`], base: '' });
    }
  }
  const had = new Map(before.map((item) => [idOf(item), item]));
  const order = before.map(idOf).filter((id) => id !== undefined && kept.has(id));
  let previous: string | null = null;
  for (const item of after) {
    const id = idOf(item);
    if (id === undefined) {
      continue;
    }
    const was = had.get(id);
    if (was === undefined) {
      out.push({ op: 'insert', path, after: previous, value: item, base: '' });
      order.splice(previous === null ? 0 : order.indexOf(previous) + 1, 0, id);
    } else {
      const at = order.indexOf(id);
      const expected = previous === null ? 0 : order.indexOf(previous) + 1;
      if (at !== expected) {
        out.push({ op: 'move', path, id, after: previous, base: '' });
        order.splice(at, 1);
        order.splice(previous === null ? 0 : order.indexOf(previous) + 1, 0, id);
      }
      diff(was, item, [...path, `#${id}`], out);
    }
    previous = id;
  }
}

function diff(before: Value, after: Value, path: string[], out: Change[]): void {
  if (!isMapping(before) || !isMapping(after)) {
    return;
  }
  for (const [key, now] of Object.entries(after)) {
    const was = before[key];
    if (Object.hasOwn(before, key) && same(was, now)) {
      continue;
    }
    if (isMapping(was) && isMapping(now)) {
      diff(was, now, [...path, key], out);
    } else if (isParts(was) && isParts(now)) {
      diffParts(was, now, [...path, key], out);
    } else {
      out.push({ op: 'set', path, key, value: now, base: '' });
    }
  }
  for (const key of Object.keys(before)) {
    if (!Object.hasOwn(after, key)) {
      out.push({ op: 'remove', path: [...path, key], base: '' });
    }
  }
}

export function changesOf(base: Template, edited: Template): Change[] {
  const changes: Change[] = [];
  diff(toValue(base), toValue(edited), [], changes);
  for (const change of changes) {
    change.base = baseOf(base, change);
  }
  return changes;
}
