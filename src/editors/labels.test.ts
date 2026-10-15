import assert from 'node:assert/strict';

import { test } from 'vitest';

import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Key, Structure } from '../contract/structure.ts';
import { humanise } from '../ha/format.ts';
import { EDITORS_EN } from '../words/panel/editors-en.ts';
import { EDITORS_RO } from '../words/panel/editors-ro.ts';

import { DESCRIPTIONS, descriptionsFor } from './cards.ts';
import type { Form } from './form.ts';
import { labelsOf } from './labels.ts';

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
const LANGUAGES = [EDITORS_EN, EDITORS_RO];

test('every card and part the editors draw has labels in every language, and the table labels nothing else', () => {
  for (const words of LANGUAGES) {
    assert.deepEqual(Object.keys(labelsOf(words)).toSorted(), [...DRAWN.keys()].toSorted());
  }
});

const SHORT_WORDS: ReadonlySet<string> = new Set(['at', 'by', 'in', 'is', 'of', 'on', 'to', 'up']);

const keyNames = (structure: Structure): Set<string> =>
  new Set(keysIn(structure).flatMap((each) => Object.keys(each)));

test('the key labels name every key the editors draw, and nothing else', () => {
  const keys = new Set<string>();
  for (const structure of DRAWN.values()) {
    for (const key of keyNames(structure)) {
      keys.add(key);
    }
  }
  assert.deepEqual(Object.keys(EDITORS_EN.keys).toSorted(), [...keys].toSorted());
});

test('in English a key reads as its humanised name, unless that holds an abbreviation of two letters such as ip', () => {
  const unreadable: string[] = [];
  for (const [key, label] of Object.entries(EDITORS_EN.keys)) {
    const plain = key
      .split('_')
      .every((word) => /^[a-z]+$/.test(word) && (word.length > 2 || SHORT_WORDS.has(word)));
    if (plain !== (label === humanise(key))) {
      unreadable.push(`${key}: ${label}`);
    }
  }
  assert.deepEqual(unreadable, []);
});

test('every kind of a card or part has its own label, and a part without kinds has none', () => {
  for (const words of LANGUAGES) {
    const table = labelsOf(words);
    for (const [name, structure] of DRAWN) {
      const labels = table[name];
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
  }
});

const iconsOf = (form: Form): string[] =>
  form.kind === 'plain'
    ? form.sections.map((section) => section.icon ?? '')
    : form.variants.flatMap((variant) => iconsOf(variant.form));

test('a panel keeps its icon in every language, and its keys', () => {
  const romanian = descriptionsFor(EDITORS_RO);
  for (const [type, form] of Object.entries(DESCRIPTIONS)) {
    const other = romanian[type];
    assert.ok(other, type);
    assert.deepEqual(iconsOf(other), iconsOf(form), type);
    assert.ok(!iconsOf(form).includes(''), type);
  }
  const tile = romanian['custom:mnml-tile-card'];
  assert.ok(tile?.kind === 'tagged' || tile?.kind === 'marked');
  const named = tile.variants[0]?.form;
  assert.deepEqual(
    named?.sections.map((section) => section.title),
    ['Subiect', 'Stare', 'Cipuri', 'Element'],
  );
  assert.equal(named?.labels?.['popup'], 'Pop-up');
});
