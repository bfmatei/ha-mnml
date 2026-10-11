import assert from 'node:assert/strict';

import { test } from 'vitest';

import { keepPicks, picksOf } from './picks.ts';

test('what was picked for the preview of a template is found again, template by template', () => {
  localStorage.clear();
  assert.deepEqual(picksOf('room'), []);
  assert.equal(keepPicks('room', new Set(['temperature', 'lights'])), true);
  assert.deepEqual(picksOf('room'), ['temperature', 'lights']);
  assert.deepEqual(picksOf('hall'), []);
});

test('a page that keeps nothing, or keeps something else, finds no picks and loses none', () => {
  localStorage.setItem('mnml-picks:room', '{"not":"a list"}');
  assert.deepEqual(picksOf('room'), []);
  localStorage.setItem('mnml-picks:room', 'not json');
  assert.deepEqual(picksOf('room'), []);
  localStorage.setItem('mnml-picks:room', '[1, "door", null]');
  assert.deepEqual(picksOf('room'), ['door']);
  localStorage.clear();
});
