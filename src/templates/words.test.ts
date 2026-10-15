import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isMapping } from '../contract/templates.ts';
import type { Value } from '../contract/templates.ts';
import { EN } from '../words/en.ts';
import { RO } from '../words/ro.ts';

import { WORDS, expand } from './expand.ts';
import { rolesOf } from './roles.ts';
import { SHIPPED } from './shipped.ts';

const ROLES = rolesOf(SHIPPED);
const TILES = Object.entries(SHIPPED).filter(([name]) => ROLES[name] === 'tile');

test("every required slot of a tile says what it is for, so the card editor's fields explain themselves", () => {
  const silent = TILES.flatMap(([name, template]) =>
    Object.entries(template.slots ?? {})
      .filter(([, spec]) => spec.required === true && spec.help === undefined)
      .map(([slot]) => `${name}.${slot}`),
  );
  assert.deepEqual(silent, []);
});

test('every slot of a tile whose name is not a plain word has a label', () => {
  const unnamed = TILES.flatMap(([name, template]) =>
    Object.entries(template.slots ?? {})
      .filter(([slot, spec]) => (slot.includes('_') || slot === 'key') && spec.label === undefined)
      .map(([slot]) => `${name}.${slot}`),
  );
  assert.deepEqual(unnamed, []);
});

const WORD = new RegExp(`\\[\\[${WORDS}\\.([a-z0-9_]+)\\]\\]`, 'g');
const SHOWN = new Set(['title', 'name', 'headers', 'text', 'words']);

function written(node: Value | undefined, key = ''): [string, string][] {
  if (typeof node === 'string') {
    return [[key, node]];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => written(item, key));
  }
  if (!isMapping(node)) {
    return [];
  }
  return Object.entries(node).flatMap(([inner, value]) =>
    written(value, key === 'words' ? key : inner.replace(/[?!]$/, '')),
  );
}

const TEXTS = Object.entries(SHIPPED).flatMap(([name, template]) =>
  written([template.card, ...(template.popups ?? [])]).map(([key, text]) => ({ name, key, text })),
);

test('every word a shipped template names is in the English table, and every word of the table is named', () => {
  const named = new Set(
    TEXTS.flatMap(({ text }) => [...text.matchAll(WORD)].map((match) => match[1] ?? '')),
  );
  assert.ok(named.size > 100);
  assert.deepEqual(
    [...named].filter((word) => !Object.hasOwn(EN.templates, word)),
    [],
  );
  assert.deepEqual(
    Object.keys(EN.templates).filter((word) => !named.has(word)),
    [],
  );
});

test('what a shipped template shows is a word of the table, never a literal in English', () => {
  const literal = TEXTS.filter(
    ({ key, text }) => SHOWN.has(key) && /\p{L}/u.test(text.replaceAll(/\[\[[^\]]*\]\]/g, '')),
  ).map(({ name, key, text }) => `${name}.${key}: ${text}`);
  assert.deepEqual(literal, []);
});

function title(card: Value): Value | undefined {
  const [first] = Array.isArray(card) ? card : [];
  return isMapping(first) ? first['title'] : undefined;
}

test('without a Home Assistant the expansion writes English, and with one the words of its language', () => {
  const instance = { template: 'batteries', slots: SHIPPED['batteries']?.example ?? {} };
  assert.equal(title(expand(SHIPPED, instance).card), 'Batteries');
  assert.equal(
    title(expand(SHIPPED, instance, {}, new Set(), undefined, RO.templates).card),
    'Baterii',
  );
});
