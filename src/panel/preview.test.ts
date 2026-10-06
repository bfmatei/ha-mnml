import assert from 'node:assert/strict';

import { test } from 'vitest';

import { SHIPPED } from '../templates/shipped.ts';

import { trialOf, tryDraft } from './preview.ts';

test('a template whose card is a pop-up is tried as that pop-up, not as a card without a type', () => {
  const template = SHIPPED['vacuum-popup'];
  assert.ok(template);
  const made = tryDraft(SHIPPED, 'vacuum-popup', template, trialOf(template, undefined), undefined);
  assert.equal(made.card, null);
  assert.ok(made.popups.some((popup) => popup.hash.endsWith('-vacuum')));
});

test('a template whose card is a card is tried as that card', () => {
  const template = SHIPPED['room'];
  assert.ok(template);
  const made = tryDraft(SHIPPED, 'room', template, trialOf(template, undefined), undefined);
  assert.ok(typeof made.card === 'object' && made.card !== null && 'type' in made.card);
});
