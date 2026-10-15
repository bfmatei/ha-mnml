import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { SceneId } from '../../contract/entities.ts';
import type { HomeAssistant } from '../../ha/hass.ts';
import { fakeHass } from '../../test/hass.ts';
import type { FakeState } from '../../test/hass.ts';

import { openMenu, sceneChoice } from './menu.ts';
import type { Choice } from './menu.ts';

const SCENES: SceneId[] = ['scene.a_read', 'scene.a_relax'];

function scene(name: string): FakeState {
  return { attributes: { friendly_name: `Lights ${name}` } };
}

function hassWith(active: string): HomeAssistant {
  return fakeHass({
    states: {
      'scene.a_read': scene('Read'),
      'scene.a_relax': scene('Relax'),
      'select.a_scene': { state: active, attributes: { options: ['Read', 'Relax'] } },
    },
    entities: {
      'scene.a_read': { entity_id: 'scene.a_read', device_id: 'd1' },
      'scene.a_relax': { entity_id: 'scene.a_relax', device_id: 'd1' },
    },
    devices: { d1: { id: 'd1', name: 'Lights', name_by_user: null } },
  });
}

if (typeof HTMLElement.prototype.showPopover !== 'function') {
  Object.assign(HTMLElement.prototype, {
    showPopover: () => undefined,
    hidePopover: () => undefined,
  });
}

function placed(direction: 'ltr' | 'rtl'): string {
  document.documentElement.setAttribute('dir', direction);
  const card = document.createElement('div');
  document.body.append(card);
  const anchor = document.createElement('button');
  card.attachShadow({ mode: 'open' }).append(anchor);
  anchor.getBoundingClientRect = () => DOMRect.fromRect({ x: 100, y: 20, width: 40, height: 40 });
  const host = {
    hass: undefined,
    hold: () => () => {},
    register: () => () => {},
    notify: () => {},
    refresh: () => {},
    isConnected: true,
  };
  const choice: Choice = {
    options: [{ value: 'a', label: 'A' }],
    current: undefined,
    currentIcon: () => undefined,
    select: () => Promise.resolve(),
  };
  try {
    openMenu(anchor, choice, host);
    const menu = card.shadowRoot?.querySelector<HTMLElement>('.menu');
    return menu?.style.left ?? '';
  } finally {
    card.remove();
    document.documentElement.removeAttribute('dir');
  }
}

test("a menu hangs from its anchor's end edge: the right one read left to right, the left one read right to left", () => {
  assert.equal(placed('ltr'), '140px');
  assert.equal(placed('rtl'), '100px');
});

test('the scenes menu checks the scene its active-scene select names, and nothing else', () => {
  assert.equal(sceneChoice(hassWith('Relax'), SCENES, 'select.a_scene').current, 'scene.a_relax');
  assert.equal(sceneChoice(hassWith('unknown'), SCENES, 'select.a_scene').current, undefined);
  assert.equal(sceneChoice(hassWith('Nightlight'), SCENES, 'select.a_scene').current, undefined);
  assert.equal(sceneChoice(hassWith('Relax'), SCENES).current, undefined);
});
