import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { test } from 'vitest';

import { isIcon } from '../contract/entities.ts';
import type { SlotSpec } from '../contract/templates.ts';

import { SHIPPED, familyNames, readShapes, readTemplates } from './shipped.ts';

test('every YAML file under templates/ is read, one template per key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-templates-'));
  try {
    writeFileSync(join(dir, 'a.yaml'), "one:\n  card: { type: x, state: 'on' }\n");
    writeFileSync(join(dir, 'b.yaml'), 'two:\n  card: [1, 2]\n');
    assert.deepEqual(readTemplates(dir), {
      one: { card: { type: 'x', state: 'on' } },
      two: { card: [1, 2] },
    });
    writeFileSync(join(dir, 'c.yaml'), 'one:\n  card: {}\n');
    assert.throws(() => readTemplates(dir), /one is defined in a\.yaml and c\.yaml/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('shapes.yaml is no family, and a template that names a shape in it is read with the shape resolved', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-templates-'));
  try {
    writeFileSync(
      join(dir, 'shapes.yaml'),
      'meter:\n  kind: object\n  fields: { power: { kind: entity }, today: { kind: entity } }\n',
    );
    writeFileSync(
      join(dir, 'a.yaml'),
      'one:\n  slots:\n    meters: { shape: meter, kind: objects, fields: { power: { required: true } } }\n  card: { type: x }\n',
    );
    assert.deepEqual(familyNames(dir), ['a']);
    assert.deepEqual(readTemplates(dir), {
      one: {
        slots: {
          meters: {
            kind: 'objects',
            fields: { power: { kind: 'entity', required: true }, today: { kind: 'entity' } },
          },
        },
        card: { type: 'x' },
      },
    });
    writeFileSync(
      join(dir, 'a.yaml'),
      'one:\n  slots:\n    meters: { shape: metre }\n  card: {}\n',
    );
    assert.throws(() => readTemplates(dir), /one: the slot meters uses the shape metre/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

function shaped(spec: SlotSpec): boolean {
  return 'shape' in spec || Object.values(spec.fields ?? {}).some(shaped);
}

test('every shipped template comes with its shapes resolved, and every shape is used', () => {
  const left = Object.entries(SHIPPED).flatMap(([name, template]) =>
    Object.entries(template.slots ?? {}).flatMap(([slot, spec]) =>
      shaped(spec) ? [`${name}.${slot}`] : [],
    ),
  );
  assert.deepEqual(left, []);
  const written = familyNames()
    .map((family) =>
      readFileSync(resolve(import.meta.dirname, `../../templates/${family}.yaml`), 'utf8'),
    )
    .join('\n');
  const shapes = readShapes();
  const text = `${written}\n${JSON.stringify(shapes)}`;
  const unused = Object.keys(shapes).filter(
    (name) => !new RegExp(`shape"?: ?"?${name}\\b`).test(text),
  );
  assert.deepEqual(unused, []);
});

test('every shipped template has a card, a description and an example', () => {
  for (const [name, template] of Object.entries(SHIPPED)) {
    assert.ok(template.card !== undefined, name);
    assert.ok(
      typeof template.description === 'string' && template.description !== '',
      `${name}: description`,
    );
    assert.ok(template.example !== undefined, `${name}: example`);
  }
});

test('every shipped template has a title in plain words and an icon, each one its own', () => {
  const missing = Object.entries(SHIPPED).flatMap(([name, template]) =>
    typeof template.title === 'string' && template.title !== '' && isIcon(template.icon)
      ? []
      : [name],
  );
  assert.deepEqual(missing, []);
  const titles = Object.values(SHIPPED).map((template) => template.title);
  assert.deepEqual(
    titles.filter((title, index) => titles.indexOf(title) !== index),
    [],
  );
  const coded = Object.entries(SHIPPED).flatMap(([name, template]) =>
    template.title === name || /[_[\]#]/.test(template.title ?? '') ? [name] : [],
  );
  assert.deepEqual(coded, []);
  const lines = familyNames().flatMap((family) =>
    readFileSync(resolve(import.meta.dirname, `../../templates/${family}.yaml`), 'utf8')
      .split('\n')
      .filter((line) => /^ {2}(description|title|icon):/.test(line))
      .map((line) => line.trim().split(':')[0]),
  );
  const order = lines.join(' ').replaceAll('description title icon', '').trim();
  assert.equal(order, '');
});

function keysOf(value: unknown, at: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => keysOf(item, `${at}[${index}]`));
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const entries = Object.entries(value);
  return [
    ...entries.map(([key]) => `${at}.${key}`),
    ...entries.flatMap(([key, inner]) => keysOf(inner, `${at}.${key}`)),
  ];
}

test("a shipped template writes a list row's values as values!, so an unfilled column keeps its place", () => {
  const loose = Object.entries(SHIPPED).flatMap(([name, template]) =>
    [...keysOf(template.card, `${name}.card`), ...keysOf(template.popups, `${name}.popups`)].filter(
      (path) => /\.values\??$/.test(path),
    ),
  );
  assert.deepEqual(loose, []);
});

const DESCRIBED = [
  'room',
  'person',
  'car',
  'car-plan',
  'proxmox-server',
  'unifi-network',
  'adguard',
  'home-assistant',
  'light-card',
];

test('the shipped card templates with many slots put every slot in a group', () => {
  for (const name of DESCRIBED) {
    const template = SHIPPED[name];
    assert.ok(template, name);
    for (const [slot, spec] of Object.entries(template.slots ?? {})) {
      assert.equal(typeof spec.group, 'string', `${name}.${slot}`);
    }
  }
});
