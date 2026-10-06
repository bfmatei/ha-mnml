import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { SceneId } from '../../contract/entities.ts';

import { sceneChoice } from './menu.ts';

type Hass = Parameters<typeof sceneChoice>[0];

const SCENES: SceneId[] = ['scene.a_read', 'scene.a_relax'];

function scene(entityId: string, name: string): unknown {
  return { entity_id: entityId, state: 'unknown', attributes: { friendly_name: `Lights ${name}` } };
}

function hassWith(active: string): Hass {
  const hass = {
    states: {
      'scene.a_read': scene('scene.a_read', 'Read'),
      'scene.a_relax': scene('scene.a_relax', 'Relax'),
      'select.a_scene': {
        entity_id: 'select.a_scene',
        state: active,
        attributes: { options: ['Read', 'Relax'] },
      },
    },
    entities: {
      'scene.a_read': { entity_id: 'scene.a_read', device_id: 'd1' },
      'scene.a_relax': { entity_id: 'scene.a_relax', device_id: 'd1' },
    },
    devices: { d1: { id: 'd1', name: 'Lights', name_by_user: null } },
    locale: { language: 'en' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
  };
  return hass as unknown as Hass;
}

test('the scenes menu checks the scene its active-scene select names, and nothing else', () => {
  assert.equal(sceneChoice(hassWith('Relax'), SCENES, 'select.a_scene').current, 'scene.a_relax');
  assert.equal(sceneChoice(hassWith('unknown'), SCENES, 'select.a_scene').current, undefined);
  assert.equal(sceneChoice(hassWith('Nightlight'), SCENES, 'select.a_scene').current, undefined);
  assert.equal(sceneChoice(hassWith('Relax'), SCENES).current, undefined);
});
