import assert from 'node:assert/strict';

import { test } from 'vitest';

import { EN } from './en.ts';
import { RO } from './ro.ts';
import { wordsFor } from './words.ts';

function said(table: object): string[] {
  return Object.values(table).flatMap((word: unknown): string[] => {
    if (typeof word === 'string') {
      return [word];
    }
    if (typeof word === 'function') {
      const say = word as (...values: unknown[]) => string;
      return [say('X', 'Y'), say(1), say(4)];
    }
    return typeof word === 'object' && word !== null ? said(word) : [];
  });
}

test("a card's words are picked by the language, then its base language, then English", () => {
  assert.equal(wordsFor('ro'), RO);
  assert.equal(wordsFor('ro-MD'), RO);
  assert.equal(wordsFor('en'), EN);
  assert.equal(wordsFor('en-GB'), EN);
  assert.equal(wordsFor('de'), EN);
  assert.equal(wordsFor('pt-BR'), EN);
  assert.equal(wordsFor(''), EN);
  assert.equal(wordsFor('constructor'), EN);
});

test('words that take a value put it in their sentence', () => {
  assert.equal(EN.list.lowest('45 %'), 'Lowest 45 %');
  assert.equal(RO.list.lowest('45 %'), 'Minim 45 %');
  assert.equal(EN.askAbout('Unlock', 'Front door'), 'Unlock Front door? Tap again');
  assert.equal(RO.askAbout(RO.actions.unlock, 'Ușa'), 'Descuie Ușa? Atinge din nou');
});

test('a count reads as the language counts', () => {
  assert.deepEqual([1, 2, 21].map(EN.clients.count), ['1 client', '2 clients', '21 clients']);
  assert.deepEqual([1, 2, 19, 20, 101, 120].map(RO.clients.count), [
    '1 client',
    '2 clienți',
    '19 clienți',
    '20 de clienți',
    '101 clienți',
    '120 de clienți',
  ]);
  assert.deepEqual([1, 3].map(EN.car.tyresLow), ['One tyre low', '3 tyres low']);
});

test('every word is plain text with ASCII punctuation, and Romanian writes ș and ț with a comma', () => {
  const words = [...said(EN), ...said(RO)];
  assert.ok(words.length > 100);
  for (const word of words) {
    assert.ok(word.trim() !== '' && word === word.trim(), JSON.stringify(word));
    assert.doesNotMatch(word, /[\u2018\u2019\u201C\u201D\u2013\u2014\u2026]/, word);
    assert.doesNotMatch(word, /[\u015E\u015F\u0162\u0163]/, word);
  }
});
