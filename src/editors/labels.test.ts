import assert from 'node:assert/strict';

import { test } from 'vitest';

import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Key, Structure } from '../contract/structure.ts';
import { humanise } from '../ha/format.ts';

import { DESCRIPTIONS } from './cards.ts';
import { LABELS } from './labels.ts';

const keysIn = (structure: Structure): Readonly<Record<string, Key>>[] =>
  structure.kind === 'plain' ? [structure.keys] : structure.variants.map((variant) => variant.keys);

function drawn(): Map<string, Structure> {
  const found = new Map<string, Structure>();
  const walk = (structure: Structure): void => {
    const known = found.get(structure.name);
    assert.ok(
      known === undefined || known === structure,
      `two structures are named ${structure.name}`,
    );
    if (known !== undefined) {
      return;
    }
    found.set(structure.name, structure);
    for (const keys of keysIn(structure)) {
      for (const key of Object.values(keys)) {
        if ((key.kind === 'part' || key.kind === 'parts') && key.of !== undefined) {
          walk(key.of);
        }
      }
    }
  };
  for (const [type, structure] of Object.entries(CARD_STRUCTURES)) {
    if (Object.hasOwn(DESCRIPTIONS, type)) {
      walk(structure);
    }
  }
  return found;
}

const DRAWN = drawn();

test('every card and part the editors draw has labels, and the table labels nothing else', () => {
  assert.deepEqual(Object.keys(LABELS).toSorted(), [...DRAWN.keys()].toSorted());
});

const SHORT_WORDS: ReadonlySet<string> = new Set(['at', 'by', 'in', 'is', 'of', 'on', 'to', 'up']);

const keyNames = (structure: Structure): Set<string> =>
  new Set(keysIn(structure).flatMap((each) => Object.keys(each)));

test('every label and help names a key of its card or part, and no label repeats the humanised key it falls back to', () => {
  const unknown: string[] = [];
  const repeated: string[] = [];
  for (const [name, structure] of DRAWN) {
    const labels = LABELS[name];
    const keys = keyNames(structure);
    for (const key of [...Object.keys(labels?.keys ?? {}), ...Object.keys(labels?.help ?? {})]) {
      if (!keys.has(key)) {
        unknown.push(`${name}.${key}`);
      }
    }
    for (const [key, label] of Object.entries(labels?.keys ?? {})) {
      if (label === humanise(key)) {
        repeated.push(`${name}.${key}`);
      }
    }
  }
  assert.deepEqual(unknown, [], 'labels or help for keys the structure lacks');
  assert.deepEqual(repeated, [], 'labels the fallback already gives');
});

test('a key without a label reads by its humanised name, so it is plain lowercase words, none an abbreviation of two letters such as ip', () => {
  const unreadable: string[] = [];
  for (const [name, structure] of DRAWN) {
    const labelled = LABELS[name]?.keys ?? {};
    for (const key of keyNames(structure)) {
      const words = key.split('_');
      const plain = words.every(
        (word) => /^[a-z]+$/.test(word) && (word.length > 2 || SHORT_WORDS.has(word)),
      );
      if (!Object.hasOwn(labelled, key) && !plain) {
        unreadable.push(`${name}.${key}`);
      }
    }
  }
  assert.deepEqual(unreadable, [], 'keys that need a label of their own');
});

test('every kind of a card or part has its own label, and a part without kinds has none', () => {
  for (const [name, structure] of DRAWN) {
    const labels = LABELS[name];
    assert.ok(labels, name);
    if (structure.kind === 'plain') {
      assert.equal(labels.kinds, undefined, name);
      assert.equal(labels.otherwise, undefined, name);
      continue;
    }
    assert.equal(labels.sections, undefined, name);
    const kinds = structure.variants.flatMap((variant) => variant.when ?? []);
    assert.deepEqual(Object.keys(labels.kinds ?? {}).toSorted(), kinds.toSorted(), name);
    assert.equal(labels.otherwise !== undefined, structure.kind === 'marked', name);
  }
});
