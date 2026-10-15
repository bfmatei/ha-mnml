import assert from 'node:assert/strict';

import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { test } from 'vitest';

import { entity, need, plain, text as words } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { fakeHass, fakeState } from '../test/hass.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlCard } from './base.ts';

interface ProbeConfig {
  type: 'probe';
  entity: string;
  service?: string;
}

const PROBE = plain<ProbeConfig>('probe', { entity: need(entity()), service: words() });

class ProbeCard extends MnmlCard<ProbeConfig> {
  draws = 0;

  protected structure(): Structure {
    return PROBE;
  }

  protected draw(hass: HomeAssistant): TemplateResult | undefined {
    this.draws += 1;
    return hass.states['light.a']?.state === 'gone' ? undefined : html`<div>shown</div>`;
  }
}

define('mnml-probe-card', ProbeCard);

const BASE = fakeHass();

function hassOf(states: HomeAssistant['states']): HomeAssistant {
  return { ...BASE, states };
}

function hassWith(state: string): HomeAssistant {
  return hassOf({ 'light.a': fakeState('light.a', { state }) });
}

function probe(): ProbeCard {
  const made = document.createElement('mnml-probe-card');
  assert.ok(made instanceof ProbeCard);
  return made;
}

async function mount(): Promise<ProbeCard> {
  const card = probe();
  card.setConfig({ type: 'probe', entity: 'light.a' });
  card.hass = hassWith('on');
  await mounted(card);
  return card;
}

test('a release issued before a disconnect cannot drive the hold count negative', async () => {
  const card = await mount();
  assert.equal(card.draws, 1);
  const stale = card.hold();
  card.remove();
  stale();
  stale();
  document.body.append(card);
  await card.updateComplete;
  card.hold();
  const before = card.draws;
  card.hass = hassWith('off');
  await card.updateComplete;
  assert.equal(card.draws, before, 'the hold still suppresses the redraw');
});

test('a teardown during disconnect does not leave the card held', async () => {
  const card = await mount();
  const release = card.hold();
  card.register(() => {
    release();
  });
  card.remove();
  document.body.append(card);
  card.hass = hassWith('off');
  await card.updateComplete;
  assert.equal(text(card.shadowRoot), 'shown');
  assert.ok(card.draws > 1, 'the card draws again once it is back');
});

test('setConfig drains teardowns, so a reconfigured card cannot freeze', async () => {
  const card = await mount();
  let torn = false;
  const release = card.hold();
  card.register(() => {
    torn = true;
    release();
  });
  card.setConfig({ type: 'probe', entity: 'light.a' });
  assert.ok(torn);
  await card.updateComplete;
  const before = card.draws;
  card.hass = hassWith('off');
  await card.updateComplete;
  assert.ok(card.draws > before, 'the card is live again, not stuck behind a hold');
});

test('a card draws again only when an entity its config names changes, not a service it calls', async () => {
  const card = probe();
  card.setConfig({ type: 'probe', entity: 'light.a', service: 'light.turn_on' });
  const light = fakeState('light.a', { state: 'on' });
  card.hass = hassOf({ 'light.a': light });
  await mounted(card);
  const first = card.draws;
  card.hass = hassOf({
    'light.a': light,
    'sensor.other': fakeState('sensor.other', { state: '1' }),
  });
  await card.updateComplete;
  assert.equal(card.draws, first, 'another entity changed');
  card.hass = hassOf({
    'light.a': light,
    'light.turn_on': fakeState('light.turn_on', { state: 'x' }),
  });
  await card.updateComplete;
  assert.equal(card.draws, first, 'a service name is not an entity to watch');
  card.hass = hassOf({ 'light.a': { ...light, state: 'off' } });
  await card.updateComplete;
  assert.equal(card.draws, first + 1, 'its own entity changed');
});

test('an ordinary hold suppresses and then draws again', async () => {
  const card = await mount();
  const release = card.hold();
  const held = card.draws;
  card.hass = hassWith('off');
  await card.updateComplete;
  assert.equal(card.draws, held);
  release();
  await card.updateComplete;
  assert.ok(card.draws > held);
});

test('a card that draws nothing takes no space, and comes back when it has content', async () => {
  const card = probe();
  card.setConfig({ type: 'probe', entity: 'light.a' });
  card.hass = hassWith('gone');
  await mounted(card);
  assert.equal(
    card.style.display,
    'none',
    'an empty card is not a zero-height box in a gapped column',
  );
  assert.equal(text(card.shadowRoot), '');
  card.hass = hassWith('on');
  await card.updateComplete;
  assert.equal(card.style.display, '', 'it shows again once it has something to draw');
});

test('a card asks the sections grid for a full section, and its own height', () => {
  assert.deepEqual(probe().getGridOptions(), { columns: 12, rows: 'auto' });
});

test('a change that came during a hold is drawn when the card comes back to the page', async () => {
  const card = await mount();
  card.hold();
  card.hass = hassWith('gone');
  await card.updateComplete;
  assert.equal(text(card.shadowRoot), 'shown', 'held, so not drawn yet');
  card.remove();
  document.body.append(card);
  await card.updateComplete;
  assert.equal(text(card.shadowRoot), '');
});

test('a new language or formatter draws the card again, though no state it watches changed', async () => {
  const same = hassWith('on');
  const hass = (changes: Partial<HomeAssistant>): HomeAssistant => ({ ...same, ...changes });
  const card = probe();
  card.setConfig({ type: 'probe', entity: 'light.a' });
  card.hass = hass({});
  await mounted(card);
  const redraws = async (changes: Partial<HomeAssistant>): Promise<boolean> => {
    const before = card.draws;
    card.hass = hass(changes);
    await card.updateComplete;
    card.hass = hass({});
    await card.updateComplete;
    return card.draws > before;
  };
  assert.equal(await redraws({}), false, 'the same hass draws nothing');
  assert.equal(await redraws({ localize: (): string => '' }), true, 'localize');
  assert.equal(await redraws({ formatEntityState: (): string => '' }), true, 'state formatter');
  assert.equal(
    await redraws({ formatEntityAttributeName: (): string => '' }),
    true,
    'attribute name formatter',
  );
  assert.equal(
    await redraws({ formatEntityAttributeValue: (): string => '' }),
    true,
    'attribute formatter',
  );
  assert.equal(await redraws({ config: { state: 'NOT_RUNNING' } }), true, 'core state');
  card.remove();
});
