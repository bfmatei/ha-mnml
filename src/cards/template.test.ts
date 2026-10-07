import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { TemplateCard } from '../contract/cards.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import type { HassConnection, HomeAssistant } from '../ha/hass.ts';
import { sharedTemplates } from '../store/store.ts';
import { fakeStore } from '../test/fake-hass.ts';
import { define } from '../test/render.ts';

import { announced } from './parts/popup-registry.ts';
import { MnmlTemplateCard } from './template.ts';

define('mnml-template-card', MnmlTemplateCard);

const STORE = fakeStore();
STORE.kept = {};

const built: Record<string, unknown>[] = [];
window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement(config: object): ChildCard {
      built.push(config as Record<string, unknown>);
      const element: ChildCard = document.createElement('div');
      if ('type' in config && config.type === 'grid') {
        Object.assign(element, { getGridOptions: () => ({ columns: 6, rows: 3 }) });
      }
      return element;
    },
  });

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const REGISTRIES = {
  ...STORE.hass,
  areas: { living: { area_id: 'living', name: 'Living', icon: 'mdi:sofa' } },
  devices: {},
  entities: {},
};

function hassOf(hass: object): HomeAssistant {
  return hass as HomeAssistant;
}

function make(): MnmlTemplateCard {
  const made = document.createElement('mnml-template-card');
  assert.ok(made instanceof MnmlTemplateCard);
  return made;
}

function configure(card: MnmlTemplateCard, config: unknown): void {
  card.setConfig(config as TemplateCard);
}

sharedTemplates(STORE.hass.connection as unknown as HassConnection);
await settle();

test('an explicit instance expands at once, draws the card, and announces its pop-ups', async () => {
  built.length = 0;
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    slots: { title: 'Rooms', icon: 'mdi:floor-plan' },
  });
  document.body.append(card);
  card.hass = hassOf({ states: {}, ...REGISTRIES });
  await settle();
  assert.equal(built[0]?.['type'], 'custom:mnml-heading-card');
  assert.deepEqual(card.getGridOptions(), { columns: 'full', rows: 'auto' });
  await card.updateComplete;
  assert.equal(card.shadowRoot?.firstElementChild?.localName, 'div', 'the drawn card is placed');
  card.remove();
});

test('a configuration mistake is thrown, so Home Assistant shows an error card', () => {
  const card = make();
  assert.throws(() => {
    configure(card, {
      type: 'custom:mnml-template-card',
      template: 'section-heading',
      slots: { icon: 'mdi:floor-plan' },
    });
  }, /section-heading: the slot title is required/);
  assert.throws(() => {
    configure(card, { type: 'custom:mnml-template-card', templat: 'x' });
  }, /unknown key: templat/);
});

test('an area instance expands on the registries, again only when they are replaced, and shows a discovery error as a card', async () => {
  built.length = 0;
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    area: 'living',
    slots: { icon: 'mdi:sofa' },
  });
  document.body.append(card);
  const hass = { states: {}, ...REGISTRIES };
  card.hass = hassOf(hass);
  await settle();
  assert.equal(built.length, 1);
  assert.equal(
    built[0]?.['type'],
    'error',
    'title is required and section-heading does not discover it',
  );
  assert.match(String(built[0]?.['error']), /section-heading: the slot title is required/);
  card.hass = hassOf({ ...hass, states: { 'light.a': {} } });
  await settle();
  assert.equal(built.length, 1, 'a state change does not expand again');
  card.hass = hassOf({ ...hass, areas: { ...hass.areas } });
  await settle();
  assert.equal(built.length, 1, 'nor does a replaced registry that changes nothing');
  card.remove();
});

test('pop-ups are withdrawn when the card leaves the page', () => {
  assert.deepEqual(announced(), []);
});

async function withTemplates(
  templates: Record<string, unknown>,
  run: () => Promise<void> | void,
): Promise<void> {
  STORE.keep(
    Object.fromEntries(
      Object.entries(templates).map(([name, template]) => [name, { kind: 'own', template }]),
    ),
  );
  try {
    await run();
  } finally {
    STORE.keep({});
  }
}

test('a template whose pop-up the shell would refuse is an error naming the template and the place', async () => {
  const templates = {
    odd: {
      card: { type: 'custom:mnml-heading-card', title: 'Odd', icon: 'mdi:help' },
      popups: [{ hash: '#odd', cards: [{ type: 'map', visibility: [{ condition: 'screen' }] }] }],
    },
  };
  await withTemplates(templates, () => {
    const card = make();
    assert.throws(() => {
      configure(card, { type: 'custom:mnml-template-card', template: 'odd', slots: {} });
    }, /odd: popups\[0\]\.cards\[0\]\.visibility\[0\]/);
  });
});

const NAMED = {
  named: {
    slots: { name: { kind: 'text', required: true, discover: 'area.name' } },
    card: { type: 'custom:mnml-heading-card', title: '[[name]]', icon: 'mdi:sofa' },
  },
};

test('an area Home Assistant does not know is an error card that names it', async () => {
  built.length = 0;
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    area: 'garden',
    slots: { title: 'Garden', icon: 'mdi:flower' },
  });
  card.hass = hassOf({ states: {}, ...REGISTRIES });
  await settle();
  assert.equal(built[0]?.['type'], 'error');
  assert.match(String(built[0]?.['error']), /section-heading: no area named garden/);
});

test('a card given an area after hass expands at once', async () => {
  built.length = 0;
  const card = make();
  card.hass = hassOf({ states: {}, ...REGISTRIES });
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    area: 'living',
    slots: { title: 'Living', icon: 'mdi:sofa' },
  });
  await settle();
  assert.equal(built[0]?.['type'], 'custom:mnml-heading-card');
});

test("before its area is discovered, the card's size is the template's own card's", () => {
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    area: 'living',
    slots: { title: 'Living', icon: 'mdi:sofa' },
  });
  assert.deepEqual(card.getGridOptions(), { columns: 'full', rows: 'auto' });
});

test("once drawn, the size is the drawn card's own, native cards too", async () => {
  built.length = 0;
  await withTemplates({ native: { card: { type: 'grid', cards: [] } } }, async () => {
    const card = make();
    configure(card, { type: 'custom:mnml-template-card', template: 'native', slots: {} });
    assert.deepEqual(card.getGridOptions(), { columns: 12, rows: 'auto' });
    await settle();
    assert.deepEqual(card.getGridOptions(), { columns: 6, rows: 3 });
  });
});

test('the size of a card type is probed once', async () => {
  let made = 0;
  customElements.define(
    'mnml-counted-card',
    class extends HTMLElement {
      constructor() {
        super();
        made += 1;
      }

      getGridOptions(): Record<string, unknown> {
        return { columns: 4, rows: 1 };
      }
    },
  );
  await withTemplates({ counted: { card: { type: 'custom:mnml-counted-card' } } }, () => {
    for (let index = 0; index < 3; index += 1) {
      const card = make();
      configure(card, { type: 'custom:mnml-template-card', template: 'counted' });
      assert.deepEqual(card.getGridOptions(), { columns: 4, rows: 1 });
      assert.deepEqual(card.getGridOptions(), { columns: 4, rows: 1 });
    }
  });
  assert.equal(made, 1);
});

test('a registry change redraws the card only when its expansion changes', async () => {
  built.length = 0;
  await withTemplates(NAMED, async () => {
    const card = make();
    configure(card, { type: 'custom:mnml-template-card', template: 'named', area: 'living' });
    const hass = { states: {}, ...REGISTRIES };
    card.hass = hassOf(hass);
    await settle();
    card.hass = hassOf({ ...hass, areas: { ...hass.areas } });
    await settle();
    assert.deepEqual(
      built.map((config) => config['title']),
      ['Living'],
    );
    card.hass = hassOf({ ...hass, areas: { living: { area_id: 'living', name: 'Lounge' } } });
    await settle();
    assert.deepEqual(
      built.map((config) => config['title']),
      ['Living', 'Lounge'],
    );
  });
});

test('an instance with neither area nor slots discovers in the whole home', async () => {
  built.length = 0;
  const templates = {
    everywhere: {
      slots: {
        areas: {
          kind: 'objects',
          fields: { name: { kind: 'text' }, lights: { kind: 'entities' } },
          discover: {
            per: 'area',
            scope: 'all',
            fields: { name: 'area.name', lights: { domain: 'light' } },
          },
        },
      },
      card: { type: 'custom:mnml-heading-card', title: '[[areas.0.name]]', icon: 'mdi:home' },
    },
  };
  await withTemplates(templates, async () => {
    const card = make();
    configure(card, { type: 'custom:mnml-template-card', template: 'everywhere' });
    await settle();
    assert.equal(built.length, 0, 'it waits for the registries');
    card.hass = hassOf({
      states: {},
      ...REGISTRIES,
      entities: { 'light.lamp': { entity_id: 'light.lamp', area_id: 'living' } },
    });
    await settle();
    assert.equal(built[0]?.['title'], 'Living');
  });
});

const room = (key: string): Record<string, unknown> => ({
  type: 'custom:mnml-template-card',
  template: 'room',
  slots: { key, name: key, lights: { group: `light.${key}` } },
});

test("a template card in Home Assistant's editor preview does not announce its pop-ups", async () => {
  const shown = make();
  configure(shown, room('hall'));
  document.body.append(shown);
  shown.hass = hassOf({ states: {}, ...REGISTRIES });
  const preview = make();
  preview.preview = true;
  configure(preview, room('den'));
  document.body.append(preview);
  preview.hass = hassOf({ states: {}, ...REGISTRIES });
  await settle();
  await settle();
  await settle();
  await settle();
  await settle();
  await settle();
  const hashes = new Set(announced().map((popup) => popup.hash));
  assert.ok(hashes.has('#hall'), 'a card on the dashboard announces');
  assert.equal(hashes.has('#den'), false);
  shown.remove();
  preview.remove();
});
