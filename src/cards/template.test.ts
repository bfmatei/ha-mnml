import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { ChildCard } from '../ha/card-helpers.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { sharedTemplates } from '../store/store.ts';
import { fakeHass, fakeStore } from '../test/hass.ts';
import { configure, created, define, updated } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlCardNote } from './parts/card-element.ts';
import { announced } from './parts/popup-registry.ts';
import { MnmlTemplateCard } from './template.ts';

define('mnml-template-card', MnmlTemplateCard);
define('mnml-card-note', MnmlCardNote);

class Probe extends HTMLElement {
  config: unknown;
  hass: HomeAssistant | undefined;
  setConfig(config: unknown): void {
    this.config = config;
  }
}

define('mnml-probe-card', Probe);

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

const REGISTRIES = {
  ...STORE.hass,
  areas: { living: { area_id: 'living', name: 'Living', icon: 'mdi:sofa' } },
  devices: {},
  entities: {},
};

const make = (): MnmlTemplateCard => created('mnml-template-card', MnmlTemplateCard);

function failureIn(card: MnmlTemplateCard): string {
  const note = card.shadowRoot?.firstElementChild;
  assert.ok(note instanceof MnmlCardNote, note?.localName ?? 'nothing is drawn');
  assert.equal(note.failed, true);
  return note.message;
}

await until(() => sharedTemplates(STORE.hass.connection).status === 'ready', 'the store');

test('an explicit instance expands at once, draws the card, and announces its pop-ups', async () => {
  built.length = 0;
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    slots: { title: 'Rooms', icon: 'mdi:floor-plan' },
  });
  document.body.append(card);
  card.hass = fakeHass(REGISTRIES);
  await updated(document);
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

test("an area instance expands on the registries, again only when they are replaced, and shows a discovery error as MNML's note, in the template's title and its slots' labels", async () => {
  built.length = 0;
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    area: 'living',
    slots: { icon: 'mdi:sofa' },
  });
  document.body.append(card);
  const hass = REGISTRIES;
  card.hass = fakeHass(hass);
  await updated(document);
  assert.equal(
    failureIn(card),
    'Section heading: Title is needed',
    'title is required and section-heading does not discover it',
  );
  const note = card.shadowRoot?.firstElementChild;
  card.hass = fakeHass({ ...hass, states: { 'light.a': {} } });
  await updated(document);
  assert.equal(card.shadowRoot?.firstElementChild, note, 'a state change does not expand again');
  card.hass = fakeHass({ ...hass, areas: { ...hass.areas } });
  await updated(document);
  assert.equal(
    card.shadowRoot?.firstElementChild,
    note,
    'nor does a replaced registry that changes nothing',
  );
  assert.equal(built.length, 0, "the note needs none of Home Assistant's helpers");
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

const speaking = (language: string): HomeAssistant =>
  fakeHass({ connection: STORE.hass.connection, language });

function worded(language: string): MnmlTemplateCard {
  const card = make();
  configure(card, { type: 'custom:mnml-template-card', template: 'worded', slots: {} });
  document.body.append(card);
  card.hass = speaking(language);
  return card;
}

function titles(card: MnmlTemplateCard): unknown[] {
  const drawn = card.shadowRoot?.firstElementChild;
  assert.ok(drawn instanceof Probe, drawn?.localName ?? 'nothing is drawn');
  const config = drawn.config as { title: unknown; cards: { title: unknown }[] };
  return [config.title, config.cards[0]?.title];
}

test("a template's words are those of the card's language, else its base language, else English, and follow a change of language", async () => {
  const templates = {
    worded: {
      card: {
        type: 'custom:mnml-probe-card',
        title: '[[words.lights]]',
        cards: { template: 'batteries', slots: { batteries: ['sensor.door_battery'] } },
      },
    },
  };
  await withTemplates(templates, async () => {
    const said = [
      { language: 'ro', words: ['Lumini', 'Baterii'] },
      { language: 'ro-MD', words: ['Lumini', 'Baterii'] },
      { language: 'fr', words: ['Lights', 'Batteries'] },
      { language: 'en', words: ['Lights', 'Batteries'] },
    ].map(({ language, words }) => ({ language, words, card: worded(language) }));
    await updated(document);
    for (const { language, words, card } of said) {
      assert.deepEqual(titles(card), words, language);
    }
    const [, , , english] = said;
    assert.ok(english !== undefined);
    english.card.hass = speaking('ro');
    await updated(document);
    assert.deepEqual(titles(english.card), ['Lumini', 'Baterii']);
    for (const { card } of said) {
      card.remove();
    }
  });
});

const level = (state: string): HomeAssistant =>
  fakeHass({
    ...REGISTRIES,
    states: { 'sensor.level': { entity_id: 'sensor.level', state, attributes: {} } },
  });

test("the drawn card is hidden by its visibility, judged as a pop-up judges a card, with the card's entity standing in", async () => {
  const templates = {
    gauge: {
      card: {
        type: 'custom:mnml-probe-card',
        entity: 'sensor.level',
        visibility: [{ condition: 'numeric_state', above: 40 }],
      },
    },
  };
  await withTemplates(templates, async () => {
    const card = make();
    configure(card, { type: 'custom:mnml-template-card', template: 'gauge', slots: {} });
    document.body.append(card);
    card.hass = level('30');
    await updated(document);
    assert.equal(card.hidden, true);
    card.hass = level('45');
    assert.equal(card.hidden, false);
    card.remove();
  });
});

const NAMED = {
  named: {
    slots: { name: { kind: 'text', required: true, discover: 'area.name' } },
    card: { type: 'custom:mnml-heading-card', title: '[[name]]', icon: 'mdi:sofa' },
  },
};

test('an area Home Assistant does not know is an error note that names it', async () => {
  const card = make();
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    area: 'garden',
    slots: { title: 'Garden', icon: 'mdi:flower' },
  });
  document.body.append(card);
  card.hass = fakeHass(REGISTRIES);
  await updated(document);
  await card.updateComplete;
  assert.match(failureIn(card), /section-heading: no area named garden/);
  card.remove();
});

const ON_DEVICE = {
  'on-device': {
    slots: {
      name: { kind: 'text', required: true, discover: 'area.name' },
      icon: { kind: 'icon', default: 'mdi:help', discover: 'area.icon' },
      vacuum: { kind: 'entity', required: true, discover: { domain: 'vacuum' } },
    },
    card: {
      type: 'custom:mnml-probe-card',
      entity: '[[vacuum]]',
      name: '[[name]]',
      icon: '[[icon]]',
    },
  },
};

const WITH_DEVICES = {
  ...REGISTRIES,
  areas: {
    ...REGISTRIES.areas,
    hall: { area_id: 'hall', name: 'Hall', icon: 'mdi:door' },
  },
  devices: { robot: { id: 'robot', name: 'Robot S8', area_id: 'living' } },
  entities: {
    'vacuum.robot': { entity_id: 'vacuum.robot', device_id: 'robot', platform: 'roborock' },
    'vacuum.other': { entity_id: 'vacuum.other', area_id: 'living', platform: 'roborock' },
  },
  states: {
    'vacuum.robot': { entity_id: 'vacuum.robot', state: 'docked', attributes: {} },
    'vacuum.other': { entity_id: 'vacuum.other', state: 'docked', attributes: {} },
  },
};

async function drawn(card: MnmlTemplateCard): Promise<unknown> {
  await updated(document);
  await card.updateComplete;
  const probe = card.shadowRoot?.firstElementChild;
  assert.ok(probe instanceof Probe, probe?.localName ?? 'nothing is drawn');
  return probe.config;
}

test("a card on a device discovers within that device, its name and area standing in for an area's, and a given area standing in for the device's", async () => {
  await withTemplates(ON_DEVICE, async () => {
    const card = make();
    configure(card, { type: 'custom:mnml-template-card', template: 'on-device', device: 'robot' });
    document.body.append(card);
    card.hass = fakeHass(WITH_DEVICES);
    assert.deepEqual(await drawn(card), {
      type: 'custom:mnml-probe-card',
      entity: 'vacuum.robot',
      name: 'Robot S8',
      icon: 'mdi:sofa',
    });
    configure(card, {
      type: 'custom:mnml-template-card',
      template: 'on-device',
      device: 'robot',
      area: 'hall',
    });
    assert.deepEqual(await drawn(card), {
      type: 'custom:mnml-probe-card',
      entity: 'vacuum.robot',
      name: 'Robot S8',
      icon: 'mdi:door',
    });
    card.remove();
  });
});

test('a device Home Assistant does not know is an error note that names it', async () => {
  await withTemplates(ON_DEVICE, async () => {
    const card = make();
    configure(card, { type: 'custom:mnml-template-card', template: 'on-device', device: 'gone' });
    document.body.append(card);
    card.hass = fakeHass(WITH_DEVICES);
    await updated(document);
    await card.updateComplete;
    assert.match(failureIn(card), /on-device: no device named gone/);
    card.remove();
  });
});

test('a card given an area after hass expands at once', async () => {
  built.length = 0;
  const card = make();
  card.hass = fakeHass(REGISTRIES);
  configure(card, {
    type: 'custom:mnml-template-card',
    template: 'section-heading',
    area: 'living',
    slots: { title: 'Living', icon: 'mdi:sofa' },
  });
  await updated(document);
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
    await updated(document);
    assert.deepEqual(card.getGridOptions(), { columns: 6, rows: 3 });
  });
});

test('the size of a card type is probed once', async () => {
  const made: { drawn: boolean }[] = [];
  customElements.define(
    'mnml-counted-card',
    class extends HTMLElement {
      drawn = false;

      constructor() {
        super();
        made.push(this);
      }

      setConfig(): void {
        this.drawn = true;
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
  assert.equal(made.filter((card) => !card.drawn).length, 1, 'one probe, beside the cards drawn');
});

test("an MNML card a template draws is made by its own class, without Home Assistant's helpers", async () => {
  built.length = 0;
  const helpers = window.loadCardHelpers;
  Reflect.deleteProperty(window, 'loadCardHelpers');
  try {
    await withTemplates(
      { probe: { card: { type: 'custom:mnml-probe-card', name: 'Desk' } } },
      async () => {
        const card = make();
        configure(card, { type: 'custom:mnml-template-card', template: 'probe', slots: {} });
        document.body.append(card);
        const hass = fakeHass(REGISTRIES);
        card.hass = hass;
        await updated(document);
        await card.updateComplete;
        const drawn = card.shadowRoot?.firstElementChild;
        assert.ok(drawn instanceof Probe, drawn?.localName ?? 'nothing is drawn');
        assert.deepEqual(drawn.config, { type: 'custom:mnml-probe-card', name: 'Desk' });
        assert.equal(drawn.hass, hass);
        card.remove();
      },
    );
  } finally {
    window.loadCardHelpers = helpers;
  }
  assert.equal(built.length, 0);
});

test("without Home Assistant's helpers, a Home Assistant card a template draws is a note that says how to see it", async () => {
  const helpers = window.loadCardHelpers;
  Reflect.deleteProperty(window, 'loadCardHelpers');
  try {
    await withTemplates({ native: { card: { type: 'grid', cards: [] } } }, async () => {
      const card = make();
      configure(card, { type: 'custom:mnml-template-card', template: 'native', slots: {} });
      document.body.append(card);
      await updated(document);
      await card.updateComplete;
      const note = card.shadowRoot?.firstElementChild;
      assert.ok(note instanceof MnmlCardNote, note?.localName ?? 'nothing is drawn');
      assert.equal(note.failed, false);
      assert.match(note.message, /grid card shows here once a dashboard has been opened/);
      card.remove();
    });
  } finally {
    window.loadCardHelpers = helpers;
  }
});

test('a registry change redraws the card only when its expansion changes', async () => {
  built.length = 0;
  await withTemplates(NAMED, async () => {
    const card = make();
    configure(card, { type: 'custom:mnml-template-card', template: 'named', area: 'living' });
    const hass = REGISTRIES;
    card.hass = fakeHass(hass);
    await updated(document);
    card.hass = fakeHass({ ...hass, areas: { ...hass.areas } });
    await updated(document);
    assert.deepEqual(
      built.map((config) => config['title']),
      ['Living'],
    );
    card.hass = fakeHass({ ...hass, areas: { living: { area_id: 'living', name: 'Lounge' } } });
    await updated(document);
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
    await updated(document);
    assert.equal(built.length, 0, 'it waits for the registries');
    card.hass = fakeHass({
      ...REGISTRIES,
      entities: { 'light.lamp': { entity_id: 'light.lamp', area_id: 'living' } },
    });
    await updated(document);
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
  shown.hass = fakeHass(REGISTRIES);
  const preview = make();
  preview.preview = true;
  configure(preview, room('den'));
  document.body.append(preview);
  preview.hass = fakeHass(REGISTRIES);
  await updated(document);
  const hashes = new Set(announced().map((popup) => popup.hash));
  assert.ok(hashes.has('#hall'), 'a card on the dashboard announces');
  assert.equal(hashes.has('#den'), false);
  shown.remove();
  preview.remove();
});
