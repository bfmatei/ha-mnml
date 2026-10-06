import assert from 'node:assert/strict';

import { html, render } from 'lit';
import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlCardEditor } from './card-editor.ts';
import { sectionPanel } from './panel.ts';
import { MnmlRowMenu } from './row-menu.ts';
import { MnmlWords } from './words.ts';

const nextRender = (): Promise<unknown> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

class FakeExpansion extends HTMLElement {
  header: string | undefined;
  secondary: string | undefined;
  outlined: boolean | undefined;
  expanded = false;
  measured: { body: boolean; expanded: boolean } | undefined;

  async toggle(): Promise<void> {
    const next = !this.expanded;
    this.dispatchEvent(new CustomEvent('expanded-will-change', { detail: { expanded: next } }));
    await nextRender();
    this.measured = {
      body: this.querySelector('.panel-body ha-form') !== null,
      expanded: this.expanded,
    };
    this.expanded = next;
    this.dispatchEvent(new CustomEvent('expanded-changed', { detail: { expanded: next } }));
  }
}

define('ha-expansion-panel', FakeExpansion);
define('ha-form', class extends HTMLElement {});
define('mnml-row-menu', MnmlRowMenu);
define('mnml-words', MnmlWords);
define('mnml-card-editor', MnmlCardEditor);

test("with HA's panel, the panel is HA's: outlined, its header and summary set, its body drawn on the first opening", async () => {
  const box = document.createElement('div');
  document.body.append(box);
  const folds = {
    open: new Map<string, boolean>(),
    redraw: (): void => {
      draw();
    },
  };
  const draw = (): void => {
    render(
      sectionPanel(folds, '#Lights', false, {
        icon: 'mdi:lightbulb-group',
        title: 'Lights',
        summary: '1 group, 7 scenes',
        body: () => html`<ha-form></ha-form>`,
      }),
      box,
    );
  };
  draw();
  const panel = box.querySelector('ha-expansion-panel');
  assert.ok(panel instanceof FakeExpansion);
  assert.deepEqual(
    [panel.header, panel.secondary, panel.outlined, panel.expanded],
    ['Lights', '1 group, 7 scenes', true, false],
  );
  assert.equal(panel.children[0]?.getAttribute('slot'), 'leading-icon');
  assert.equal(panel.querySelector('.panel-body'), null, 'nothing is drawn before it opens');
  await panel.toggle();
  assert.ok(panel.querySelector('.panel-body'));
  assert.equal(folds.open.get('#Lights'), true);
  await panel.toggle();
  assert.ok(panel.querySelector('.panel-body'), 'the body stays for the panel to fold away');
  assert.equal(folds.open.get('#Lights'), false);
  await panel.toggle();
  assert.equal(folds.open.get('#Lights'), true);
});

test("HA's panel opens to its content: the body is drawn before the panel measures it", async () => {
  const editor = document.createElement('mnml-card-editor');
  assert.ok(editor instanceof MnmlCardEditor);
  editor.setConfig({ type: 'custom:mnml-slider-card', entity: 'light.a', slider: 'brightness' });
  const root = await mounted(editor);
  const [, look] = root.querySelectorAll('ha-expansion-panel');
  assert.ok(look instanceof FakeExpansion);
  assert.equal(look.header, 'Look');
  assert.equal(look.querySelector('.panel-body'), null);
  await look.toggle();
  assert.deepEqual(look.measured, { body: true, expanded: false }, 'drawn, and left to HA to open');
  assert.equal(look.expanded, true);
});
