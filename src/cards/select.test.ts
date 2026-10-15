import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { HomeAssistant } from '../ha/hass.ts';
import { fakeHass } from '../test/hass.ts';
import type { FakeState, ServiceCall } from '../test/hass.ts';
import { configure, define, mounted } from '../test/render.ts';

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
    configure(made, { ...select, attribute: 'hvac_mode' });
  }, /attribute must be one of hvac_modes, preset_modes/);
  assert.doesNotThrow(() => {
    configure(made, { ...select, attribute: 'preset_modes' });
  });
});

test("a select over an entity takes none of the scenes form's keys", () => {
  const made = card();
  assert.throws(() => {
    configure(made, {
      type: 'custom:mnml-select-card',
      entity: 'select.a',
      active_scene: 'select.b',
    });
  }, /unknown key: active_scene/);
});

if (typeof HTMLElement.prototype.showPopover !== 'function') {
  Object.assign(HTMLElement.prototype, {
    showPopover: () => undefined,
    hidePopover: () => undefined,
  });
}

const OPTIONS = {
  'select.a': {
    entity_id: 'select.a',
    state: 'One',
    attributes: { options: ['One', 'Two'], friendly_name: 'Mode' },
  },
};

async function painted(config: unknown, hass: HomeAssistant): Promise<ShadowRoot> {
  const made = card();
  configure(made, config);
  made.hass = hass;
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
    fakeHass({ states: OPTIONS }),
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
  const calls: ServiceCall[] = [];
  const root = await painted(
    { type: 'custom:mnml-select-card', entity: 'select.a' },
    fakeHass({ states: OPTIONS, calls }),
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
  const drawn: ServiceCall[] = [];
  const now: ServiceCall[] = [];
  const states = {
    'climate.a': {
      entity_id: 'climate.a',
      state: 'heat',
      attributes: { hvac_modes: ['off', 'heat', 'cool'], friendly_name: 'AC' },
    },
  };
  const made = card();
  configure(made, {
    type: 'custom:mnml-select-card',
    entity: 'climate.a',
    attribute: 'hvac_modes',
  });
  made.hass = fakeHass({ states, calls: drawn });
  const root = await mounted(made);
  const arrow = root.querySelector('button.control');
  assert.ok(arrow);
  tap(arrow);
  made.hass = fakeHass({ states, calls: now });
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

function scene(id: string, name: string): [string, FakeState] {
  return [id, { attributes: { friendly_name: name } }];
}

test('a scene chosen from a scenes menu turns that scene on', async () => {
  const calls: ServiceCall[] = [];
  const root = await painted(
    {
      type: 'custom:mnml-select-card',
      scenes: ['scene.read', 'scene.relax'],
      name: 'Scenes',
      icon: 'mdi:palette',
    },
    fakeHass({
      states: Object.fromEntries([scene('scene.read', 'Read'), scene('scene.relax', 'Relax')]),
      calls,
    }),
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
