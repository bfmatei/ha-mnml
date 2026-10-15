import assert from 'node:assert/strict';

import { afterEach, test } from 'vitest';

import { define, text } from '../../test/render.ts';

import { MnmlCardNote, cardOf } from './card-element.ts';

define('mnml-card-note', MnmlCardNote);

class Probe extends HTMLElement {
  config: unknown;
  setConfig(config: unknown): void {
    if (typeof config === 'object' && config !== null && Reflect.get(config, 'name') === '') {
      throw new Error('name is required');
    }
    this.config = config;
  }
}

define('mnml-probe-card', Probe);

afterEach(() => {
  Reflect.deleteProperty(window, 'loadCardHelpers');
});

async function noteOf(config: object): Promise<string> {
  const card = await cardOf(config);
  assert.ok(card instanceof MnmlCardNote, card.localName);
  document.body.append(card);
  await card.updateComplete;
  const words = text(card.shadowRoot);
  card.remove();
  return words;
}

test("an MNML card is drawn by itself, with its configuration, without Home Assistant's helpers", async () => {
  const card = await cardOf({ type: 'custom:mnml-probe-card', name: 'Desk' });
  assert.ok(card instanceof Probe);
  assert.deepEqual(card.config, { type: 'custom:mnml-probe-card', name: 'Desk' });
});

test('an MNML card that refuses its configuration is a note with the reason', async () => {
  assert.match(await noteOf({ type: 'custom:mnml-probe-card', name: '' }), /name is required/);
});

test("a Home Assistant card is made by Home Assistant's helpers when the page has them", async () => {
  const made: object[] = [];
  window.loadCardHelpers = () =>
    Promise.resolve({
      createCardElement(config: object): HTMLElement {
        made.push(config);
        return document.createElement('div');
      },
    });
  const card = await cardOf({ type: 'entities', entities: [] });
  assert.equal(card.localName, 'div');
  assert.deepEqual(made, [{ type: 'entities', entities: [] }]);
});

test('without the helpers, a Home Assistant card is a note that says how to see it', async () => {
  assert.match(
    await noteOf({ type: 'entities', entities: [] }),
    /Home Assistant's entities card shows here once a dashboard has been opened in this tab/,
  );
});

test("an error card is a note with the error, whether or not the page has Home Assistant's helpers", async () => {
  assert.match(
    await noteOf({ type: 'error', error: 'room: no area named attic' }),
    /no area named attic/,
  );
});

test('an MNML card this page did not load is a note that names it', async () => {
  assert.match(await noteOf({ type: 'custom:mnml-gone-card' }), /mnml-gone-card is not loaded/);
});
