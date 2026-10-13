import assert from 'node:assert/strict';

import { test } from 'vitest';

import { SHIPPED } from '../templates/shipped.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlPreview, trialOf, tryDraft } from './preview.ts';

define('mnml-preview', MnmlPreview);

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

test('a marked trial tells each part of the card its path', () => {
  const template = SHIPPED['room'];
  assert.ok(template);
  const plain = tryDraft(SHIPPED, 'room', template, trialOf(template, undefined), undefined);
  assert.ok(!JSON.stringify(plain).includes('_part'));
  const marked = tryDraft(SHIPPED, 'room', template, trialOf(template, undefined), undefined, {
    singles: new Set(['card', 'card/item']),
  });
  const text = JSON.stringify(marked.card);
  assert.ok(text.includes('"_part":"card"'));
  assert.ok(text.includes('"_part":"card/item"'));
  assert.ok(marked.sources.every((source) => source === '' || source.startsWith('popups/')));
});

test('a preview on a page without the card helpers says why it draws nothing', async () => {
  const template = SHIPPED['room'];
  assert.ok(template);
  const preview = new MnmlPreview();
  preview.trial = () =>
    tryDraft(SHIPPED, 'room', template, trialOf(template, undefined), undefined);
  const root = await mounted(preview);
  await preview.updateComplete;
  assert.match(text(root), /Home Assistant has not loaded its card helpers on this page/);
  assert.equal(root.querySelector('.cards')?.childElementCount, 0);
  preview.remove();
});

const YARD = {
  slots: { energy: { shape: 'meter', required: true as const } },
  card: { type: 'custom:mnml-heading-card', title: '[[energy.power]]', icon: 'mdi:barn' },
  example: { energy: { power: 'sensor.yard_power', today: 'sensor.yard_today' } },
};

test('a draft whose slot names a shape is tried with the shape resolved, as the store reads it', () => {
  const made = tryDraft(SHIPPED, 'yard', YARD, trialOf(YARD, undefined), undefined);
  assert.equal(
    typeof made.card === 'object' && made.card !== null && !Array.isArray(made.card)
      ? made.card['title']
      : undefined,
    'sensor.yard_power',
  );
  const sized = { ...YARD, example: { energy: { power: 'sensor.yard_power', size: 'big' } } };
  assert.throws(
    () => tryDraft(SHIPPED, 'yard', sized, trialOf(sized, undefined), undefined),
    /energy has no field named size/,
  );
});

test('a draft naming a shape that is not known is not tried, and says why', () => {
  assert.throws(
    () =>
      tryDraft(
        SHIPPED,
        'yard',
        { ...YARD, slots: { energy: { shape: 'metre' } } },
        trialOf(YARD, undefined),
        undefined,
      ),
    /yard: the slot energy uses the shape metre, which is not known/,
  );
});
