import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Rule, SlotSpec, Template, Value } from '../contract/templates.ts';
import { expand } from '../templates/expand.ts';
import { SHIPPED } from '../templates/shipped.ts';

import './register.ts';

interface Configurable {
  setConfig(config: unknown): void;
}

function cards(value: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      cards(item, found);
    }
  } else if (typeof value === 'object' && value !== null) {
    const record = Object.fromEntries(Object.entries(value));
    if (typeof record['type'] === 'string' && record['type'].startsWith('custom:mnml-')) {
      found.push(record);
    }
    for (const item of Object.values(record)) {
      cards(item, found);
    }
  }
  return found;
}

test('every shipped template, from its example, draws cards their own check accepts', () => {
  for (const [name, template] of Object.entries(SHIPPED)) {
    const { card, popups } = expand(SHIPPED, { template: name, slots: template.example ?? {} });
    for (const config of cards([card, popups])) {
      const tag = String(config['type']).slice('custom:'.length);
      const Card = customElements.get(tag) as unknown as (new () => Configurable) | undefined;
      assert.ok(Card, `${name}: ${tag} is a card`);
      assert.doesNotThrow(() => {
        new Card().setConfig(config);
      }, `${name}: ${tag}`);
    }
  }
});

const HASS = {
  states: {},
  entities: {},
  devices: {},
  areas: {},
  locale: { language: 'en' },
  formatEntityState: (): string => '',
  formatEntityAttributeValue: (): string => '',
  callApi: (): Promise<unknown> => Promise.resolve([]),
  callService: (): Promise<unknown> => Promise.resolve(),
};

interface Rendered extends Configurable {
  hass: unknown;
}

test('every shipped template, with only its required slots, draws cards that render', () => {
  for (const [name, template] of Object.entries(SHIPPED)) {
    const required = Object.entries(template.slots ?? {}).filter(([, spec]) => spec.required);
    const slots = Object.fromEntries(
      required.map(([slot]) => [slot, template.example?.[slot] ?? null]),
    );
    const { card, popups } = expand(SHIPPED, { template: name, slots });
    for (const config of cards([card, popups])) {
      const tag = String(config['type']).slice('custom:'.length);
      const Card = customElements.get(tag) as unknown as (new () => Rendered) | undefined;
      assert.ok(Card, `${name}: ${tag} is a card`);
      const element = new Card();
      assert.doesNotThrow(() => {
        element.setConfig(config);
        element.hass = HASS;
      }, `${name}: ${tag}`);
    }
  }
});

function shapeless(spec: SlotSpec, path: string): string[] {
  if (spec.kind !== 'object' && spec.kind !== 'objects') {
    return [];
  }
  if (spec.fields === undefined) {
    return [path];
  }
  return Object.entries(spec.fields).flatMap(([field, inner]) =>
    shapeless(inner, `${path}.${field}`),
  );
}

function undeclared(rule: Rule | undefined, spec: SlotSpec, path: string): string[] {
  if (rule === undefined || typeof rule === 'string') {
    return [];
  }
  if (Array.isArray(rule)) {
    return rule.flatMap((item) => undeclared(item, spec, path));
  }
  if (!('fields' in rule)) {
    return [];
  }
  return Object.keys(rule.fields)
    .filter((field) => spec.fields === undefined || !Object.hasOwn(spec.fields, field))
    .map((field) => `${path}.${field}`);
}

function uses(node: Value, slot: string, key: string, inSlots: boolean): string[] {
  if (typeof node === 'string') {
    if (node === `[[${slot}]]`) {
      return [inSlots ? '' : key];
    }
    return new RegExp(`\\[\\[${slot}[.\\]]`).test(node) ? [''] : [];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => uses(item, slot, key, inSlots));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const each = node['each'];
  const own = typeof each === 'string' && each.split('.')[0] === slot ? [''] : [];
  return [
    ...own,
    ...Object.entries(node).flatMap(([name, item]) =>
      uses(item, slot, name, inSlots || name === 'slots'),
    ),
  ];
}

function passes(template: Template, slot: string): boolean {
  const found = uses([template.card, ...(template.popups ?? [])], slot, '', false);
  return found.length > 0 && found.every((key) => key !== '');
}

function strays(node: Value, specs: ReadonlyMap<string, SlotSpec | undefined>): string[] {
  if (typeof node === 'string') {
    return [...node.matchAll(/\[\[([a-z_][a-z0-9_.]*)\]\]/g)].flatMap(([, path = '']) => {
      const [head = '', ...rest] = path.split('.');
      let spec = specs.get(head);
      for (const step of rest) {
        if (/^\d+$/.test(step) || spec?.kind === 'objects') {
          spec =
            spec?.kind === 'objects' ? { kind: 'object', fields: spec.fields ?? {} } : undefined;
          if (/^\d+$/.test(step)) {
            continue;
          }
        }
        if (spec?.kind !== 'object' || spec.fields === undefined) {
          return [];
        }
        if (!Object.hasOwn(spec.fields, step)) {
          return [path];
        }
        spec = spec.fields[step];
      }
      return [];
    });
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => strays(item, specs));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const each = node['each'];
  const alias = node['as'];
  let inner = specs;
  if (typeof each === 'string' && typeof alias === 'string') {
    const [head = '', ...rest] = each.split('.');
    let spec = specs.get(head);
    for (const step of rest) {
      spec = spec?.kind === 'object' ? spec.fields?.[step] : undefined;
    }
    const member: SlotSpec | undefined =
      spec?.kind === 'objects' ? { kind: 'object', fields: spec.fields ?? {} } : undefined;
    inner = new Map([...specs, [alias, member]]);
  }
  return Object.values(node).flatMap((item) => strays(item, inner));
}

test('every object slot declares its fields, and discovery fills only declared ones', () => {
  const missing: string[] = [];
  for (const [name, template] of Object.entries(SHIPPED)) {
    for (const [slot, spec] of Object.entries(template.slots ?? {})) {
      if (passes(template, slot)) {
        continue;
      }
      missing.push(
        ...shapeless(spec, `${name}.${slot}`),
        ...undeclared(spec.discover, spec, `${name}.${slot}`),
      );
    }
  }
  assert.deepEqual(missing, []);
});

test('every path into an object slot names one of its declared fields', () => {
  const stray: string[] = [];
  for (const [name, template] of Object.entries(SHIPPED)) {
    const specs = new Map(Object.entries(template.slots ?? {}));
    stray.push(
      ...strays([template.card, ...(template.popups ?? [])], specs).map(
        (path) => `${name}: ${path}`,
      ),
    );
  }
  assert.deepEqual(stray, []);
});
