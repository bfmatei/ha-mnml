import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlCardEditor, hashesOf } from './card-editor.ts';
import { MnmlRowMenu } from './row-menu.ts';
import { MnmlWords } from './words.ts';

class FakeForm extends HTMLElement {
  hass: unknown;
  data: unknown;
  schema: unknown;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(document.createElement('input'));
  }
}

define('ha-form', FakeForm);
define('mnml-row-menu', MnmlRowMenu);
define('mnml-words', MnmlWords);
define('mnml-card-editor', MnmlCardEditor);

const SLIDER = { type: 'custom:mnml-slider-card', entity: 'light.a', slider: 'brightness' };

interface Opened {
  readonly editor: MnmlCardEditor;
  readonly root: ShadowRoot;
  readonly dispatched: unknown[];
}

function made(): MnmlCardEditor {
  const editor = document.createElement('mnml-card-editor');
  assert.ok(editor instanceof MnmlCardEditor);
  return editor;
}

async function open(config: unknown): Promise<Opened> {
  const editor = made();
  const dispatched: unknown[] = [];
  editor.addEventListener('config-changed', (event) => {
    dispatched.push(event instanceof CustomEvent ? event.detail : undefined);
  });
  editor.setConfig(config);
  const root = await mounted(editor);
  return { editor, root, dispatched };
}

const form = (root: ShadowRoot): FakeForm | undefined => {
  const found = root.querySelector('ha-form');
  return found instanceof FakeForm ? found : undefined;
};

const fire = (target: Element | undefined, value: unknown): void => {
  assert.ok(target, 'there is a form');
  target.dispatchEvent(new CustomEvent('value-changed', { detail: { value } }));
};

test('a change fires config-changed with the whole card, cleaned', async () => {
  const { root, dispatched } = await open(SLIDER);
  fire(form(root), { entity: 'light.b', slider: 'brightness', turn_on: false });
  assert.deepEqual(dispatched.at(-1), {
    config: { type: 'custom:mnml-slider-card', entity: 'light.b', slider: 'brightness' },
  });
});

test('the echo of its own change does not redraw, so the field typed in keeps its place', async () => {
  const { editor, root, dispatched } = await open(SLIDER);
  const before = form(root);
  const box = before?.shadowRoot?.querySelector('input');
  assert.ok(box);
  box.focus();
  fire(before, { entity: 'light.b', slider: 'brightness' });
  await editor.updateComplete;
  const echoed = dispatched.at(-1);
  assert.ok(typeof echoed === 'object' && echoed !== null && 'config' in echoed);
  editor.setConfig(structuredClone(echoed.config));
  await editor.updateComplete;
  assert.equal(form(root), before);
  assert.equal(root.activeElement, before, 'the focus stays in the form');
});

test('a new configuration from the YAML tab redraws', async () => {
  const { editor, root } = await open(SLIDER);
  editor.setConfig({ ...SLIDER, entity: 'light.c' });
  await editor.updateComplete;
  assert.deepEqual(form(root)?.data, { entity: 'light.c', slider: 'brightness' });
});

test('hass reaches every form without a redraw', async () => {
  const { editor, root } = await open(SLIDER);
  const before = form(root);
  editor.hass = { states: {} } as never;
  const latest = { states: {} } as never;
  editor.hass = latest;
  await editor.updateComplete;
  assert.equal(form(root), before);
  assert.equal(form(root)?.hass, latest);
});

test('a control just added, still empty, survives the echo', async () => {
  const { editor } = await open({
    type: 'custom:mnml-heading-card',
    title: 'Hall',
    icon: 'mdi:door',
    controls: [{ type: 'toggle', entity: '' }],
  });
  editor.setConfig({
    type: 'custom:mnml-heading-card',
    title: '',
    icon: '',
    controls: [{ type: 'slider' }],
  });
  await editor.updateComplete;
});

test('a card the editor cannot hold is refused with the reason, so Home Assistant opens YAML', () => {
  assert.throws(() => {
    made().setConfig({ ...SLIDER, tap_action: {} });
  }, /tap_action is not a key the editor knows/);
  assert.throws(() => {
    made().setConfig({ type: 'custom:mnml-popups-card', width: '560px' });
  }, /has no visual editor/);
});

test("the pop-up picker offers the hashes of the dashboard's pop-ups", () => {
  assert.deepEqual(
    hashesOf({
      config: {
        views: [
          {
            sections: [
              {
                cards: [
                  {
                    type: 'custom:mnml-popups-card',
                    width: '560px',
                    popups: [
                      { hash: '#living', cards: [] },
                      { hash: '#kitchen', cards: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    }),
    ['#living', '#kitchen'],
  );
});

test('the context Home Assistant hands every card editor does not break it', async () => {
  const editor = made();
  Object.assign(editor, { context: {} });
  editor.setConfig(SLIDER);
  const root = await mounted(editor);
  assert.ok(form(root));
});

test('the hashes come from the dashboard configuration as Home Assistant hands it, views at the top', () => {
  assert.deepEqual(
    hashesOf({
      views: [
        {
          cards: [
            {
              type: 'custom:mnml-popups-card',
              width: '560px',
              popups: [{ hash: '#living', cards: [] }],
            },
          ],
        },
      ],
    }),
    ['#living'],
  );
});

test("the dashboard's pop-ups reach the pop-up picker", async () => {
  const { editor, root } = await open({
    type: 'custom:mnml-tile-card',
    name: 'Hall',
    icon: 'mdi:door',
    popup: '#hall',
  });
  editor.lovelace = {
    config: {
      views: [{ cards: [{ type: 'custom:mnml-popups-card', popups: [{ hash: '#living' }] }] }],
    },
  };
  await editor.updateComplete;
  const schemas = [...root.querySelectorAll('ha-form')].map((each) =>
    JSON.stringify(each instanceof FakeForm ? each.schema : undefined),
  );
  assert.ok(schemas.some((schema) => schema.includes('#living')));
});
