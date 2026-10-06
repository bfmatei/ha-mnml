import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test } from 'vitest';

import { SHIPPED, readTemplates } from './shipped.ts';

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
