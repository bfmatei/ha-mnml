import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlSelectCard } from './select.ts';

define('mnml-select-card', MnmlSelectCard);

function card(): MnmlSelectCard {
  const made = document.createElement('mnml-select-card');
  assert.ok(made instanceof MnmlSelectCard);
  return made;
}

test('a mode attribute the select card does not know is an error card that lists them', () => {
  const made = card();
  const select = { type: 'custom:mnml-select-card', entity: 'climate.a' };
  assert.throws(() => {
    made.setConfig({ ...select, attribute: 'hvac_mode' } as never);
  }, /attribute must be one of hvac_modes, preset_modes/);
  assert.doesNotThrow(() => {
    made.setConfig({ ...select, attribute: 'preset_modes' } as never);
  });
});

test("a select over an entity takes none of the scenes form's keys", () => {
  const made = card();
  assert.throws(() => {
    made.setConfig({
      type: 'custom:mnml-select-card',
      entity: 'select.a',
      active_scene: 'select.b',
    } as never);
  }, /unknown key: active_scene/);
});

if (typeof HTMLElement.prototype.showPopover !== 'function') {
  Object.assign(HTMLElement.prototype, {
    showPopover: () => undefined,
    hidePopover: () => undefined,
  });
}

interface Call {
  domain: string;
  service: string;
  data: unknown;
  target: unknown;
}

function recorder(states: Record<string, unknown>, calls: Call[]): unknown {
  return {
    states,
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }, state?: string): string =>
      state ?? stateObj.state,
    formatEntityAttributeValue: (_stateObj: unknown, _name: string, value: unknown): string =>
      String(value),
    callService: (
      domain: string,
      service: string,
      data: unknown,
      target: unknown,
    ): Promise<unknown> => {
      calls.push({ domain, service, data, target });
      return Promise.resolve();
    },
  };
}

const OPTIONS = {
  'select.a': {
    entity_id: 'select.a',
    state: 'One',
    attributes: { options: ['One', 'Two'], friendly_name: 'Mode' },
  },
};

async function painted(config: unknown, hass: unknown): Promise<ShadowRoot> {
  const made = card();
  made.setConfig(config as never);
  made.hass = hass as never;
  return mounted(made);
}

function tap(target: Element): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
}

function choose(root: ShadowRoot, label: string): void {
  const item = [...root.querySelectorAll('.menu button')].find(
    (button) => button.textContent?.trim() === label,
  );
  assert.ok(item instanceof HTMLElement, `the menu offers ${label}`);
  item.click();
}

test('tapping the trigger of an open menu closes it, and tapping it again opens it', async () => {
  const root = await painted(
    { type: 'custom:mnml-select-card', entity: 'select.a' },
    recorder(OPTIONS, []),
  );
  const arrow = root.querySelector('button.control');
  const row = root.querySelector('.card.select');
  assert.ok(arrow && row);
  tap(arrow);
  assert.equal(root.querySelectorAll('.menu').length, 1, 'the arrow opens the menu');
  assert.equal(arrow.getAttribute('aria-expanded'), 'true');
  tap(arrow);
  assert.equal(root.querySelectorAll('.menu').length, 0, 'and closes it');
  assert.equal(arrow.getAttribute('aria-expanded'), 'false');
  tap(row);
  assert.equal(root.querySelectorAll('.menu').length, 1, 'the row opens it too');
  tap(row);
  assert.equal(root.querySelectorAll('.menu').length, 0, 'and closes it');
  root.host.remove();
});

test('an option chosen from a select menu selects it on the entity', async () => {
  const calls: Call[] = [];
  const root = await painted(
    { type: 'custom:mnml-select-card', entity: 'select.a' },
    recorder(OPTIONS, calls),
  );
  const arrow = root.querySelector('button.control');
  assert.ok(arrow);
  tap(arrow);
  choose(root, 'Two');
  assert.deepEqual(calls, [
    {
      domain: 'select',
      service: 'select_option',
      data: { option: 'Two' },
      target: { entity_id: 'select.a' },
    },
  ]);
  root.host.remove();
});

test('a mode chosen from a climate menu sets that mode, through the hass of the moment', async () => {
  const drawn: Call[] = [];
  const now: Call[] = [];
  const states = {
    'climate.a': {
      entity_id: 'climate.a',
      state: 'heat',
      attributes: { hvac_modes: ['off', 'heat', 'cool'], friendly_name: 'AC' },
    },
  };
  const made = card();
  made.setConfig({
    type: 'custom:mnml-select-card',
    entity: 'climate.a',
    attribute: 'hvac_modes',
  } as never);
  made.hass = recorder(states, drawn) as never;
  const root = await mounted(made);
  const arrow = root.querySelector('button.control');
  assert.ok(arrow);
  tap(arrow);
  made.hass = recorder(states, now) as never;
  choose(root, 'cool');
  assert.deepEqual(drawn, [], 'not the hass the menu was drawn with');
  assert.deepEqual(now, [
    {
      domain: 'climate',
      service: 'set_hvac_mode',
      data: { hvac_mode: 'cool' },
      target: { entity_id: 'climate.a' },
    },
  ]);
  made.remove();
});

function scene(id: string, name: string): [string, unknown] {
  return [id, { entity_id: id, state: 'unknown', attributes: { friendly_name: name } }];
}

test('a scene chosen from a scenes menu turns that scene on', async () => {
  const calls: Call[] = [];
  const root = await painted(
    {
      type: 'custom:mnml-select-card',
      scenes: ['scene.read', 'scene.relax'],
      name: 'Scenes',
      icon: 'mdi:palette',
    },
    recorder(
      Object.fromEntries([scene('scene.read', 'Read'), scene('scene.relax', 'Relax')]),
      calls,
    ),
  );
  const arrow = root.querySelector('button.control');
  assert.ok(arrow);
  tap(arrow);
  choose(root, 'Relax');
  assert.deepEqual(calls, [
    { domain: 'scene', service: 'turn_on', data: undefined, target: { entity_id: 'scene.relax' } },
  ]);
  root.host.remove();
});
