import assert from 'node:assert/strict';

import { test } from 'vitest';

import '../cards/register.ts';
import { SHIPPED } from '../templates/shipped.ts';
import { fakeHass } from '../test/hass.ts';
import { define, mounted } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlPreview, richestArea, trialOf, tryDraft } from './preview.ts';

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

test("a preview on a page without Home Assistant's helpers draws MNML's cards itself", async () => {
  const template = SHIPPED['room'];
  assert.ok(template);
  const preview = new MnmlPreview();
  preview.trial = () =>
    tryDraft(SHIPPED, 'room', template, trialOf(template, undefined), undefined);
  const root = await mounted(preview);
  const cards = (): string[] =>
    [...(root.querySelector('.cards')?.children ?? [])].map((card) => card.localName);
  await until(() => cards().length > 0, 'the cards');
  assert.deepEqual(cards(), ['mnml-tile-card', 'mnml-popups-card']);
  preview.remove();
});

test("a preview's pop-ups are named by their headers, and open by their hashes", async () => {
  const template = SHIPPED['room'];
  assert.ok(template);
  const preview = new MnmlPreview();
  preview.trial = () =>
    tryDraft(SHIPPED, 'room', template, trialOf(template, undefined), undefined);
  const root = await mounted(preview);
  await preview.updateComplete;
  const made = tryDraft(SHIPPED, 'room', template, trialOf(template, undefined), undefined);
  const chips = [...root.querySelectorAll('.popup-list button.chip')];
  assert.equal(chips.length, made.popups.length);
  const labels = chips.map((chip) => chip.getAttribute('aria-label') ?? '');
  assert.ok(
    labels.every((label) => !label.includes('#')),
    labels.join(', '),
  );
  const room = made.popups[0]?.hash ?? '';
  assert.ok(
    labels.some((label) => /^Open \w+: lights$/.test(label)),
    labels.join(', '),
  );
  assert.ok(chips[0]?.getAttribute('title')?.endsWith(room));
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

test("the Design tab tries a template on the area where it finds the most, the area's own name and icon not counting", () => {
  const template = SHIPPED['room'];
  assert.ok(template);
  const hass = fakeHass({
    areas: {
      porch: { area_id: 'porch', name: 'Porch', icon: 'mdi:door' },
      den: { area_id: 'den', name: 'Den' },
    },
    entities: { 'light.den': { entity_id: 'light.den', area_id: 'den', platform: 'hue' } },
    states: { 'light.den': { state: 'on' } },
  });
  const areas = [{ value: 'porch' }, { value: 'den' }];
  assert.equal(richestArea(SHIPPED, 'room', template, areas, hass), 'den');
});

test('the Design tab prefers an area that fills every required slot to one that finds more', () => {
  const template = {
    slots: {
      heater: { kind: 'entity', required: true, discover: { domain: 'climate' } },
      lights: { kind: 'entities', discover: { domain: 'light' } },
      plugs: { kind: 'entities', discover: { domain: 'switch' } },
    },
    card: { type: 'custom:mnml-entity-card', entity: '[[heater]]' },
  } as const;
  const placed: [string, string][] = [
    ['light.den', 'den'],
    ['switch.den', 'den'],
    ['climate.hall', 'hall'],
  ];
  const hass = fakeHass({
    areas: { den: { area_id: 'den', name: 'Den' }, hall: { area_id: 'hall', name: 'Hall' } },
    entities: Object.fromEntries(
      placed.map(([id, area]) => [id, { entity_id: id, area_id: area, platform: 'demo' }]),
    ),
    states: Object.fromEntries(placed.map(([id]) => [id, { state: 'on' }])),
  });
  const areas = [{ value: 'den' }, { value: 'hall' }];
  assert.equal(
    richestArea({ ...SHIPPED, heater: template }, 'heater', template, areas, hass),
    'hall',
  );
});
