import assert from 'node:assert/strict';

import { css, html } from 'lit';
import { test } from 'vitest';

import { countCalls, drawn, press, styled } from './render.ts';

let earlier: ShadowRoot | undefined;

test('press() clicks the button with the label or the text it is given', () => {
  const pressed: string[] = [];
  const box = drawn(
    html`<button aria-label="Close" @click=${() => pressed.push('close')}>×</button
      ><button @click=${() => pressed.push('save')}>Save</button>`,
  );
  press(box, 'Close');
  press(box, 'Save');
  assert.deepEqual(pressed, ['close', 'save']);
  assert.throws(() => {
    press(box, 'Delete');
  }, /Delete/);
});

test('a dialog shown modally is open, and showing one that is not in the page fails as it does in a browser', () => {
  const dialog = document.createElement('dialog');
  assert.throws(() => {
    dialog.showModal();
  }, /not in a Document/);
  document.body.append(dialog);
  dialog.showModal();
  assert.equal(dialog.open, true);
  dialog.close();
  assert.equal(dialog.open, false);
  dialog.remove();
});

test('styled() renders a template under the styles it is given', () => {
  earlier = styled(
    [
      css`
        .painted {
          color: rgb(255, 0, 0);
        }
      `,
    ],
    html`<p class="painted">red</p>`,
  );
  const painted = earlier.querySelector('.painted');
  assert.ok(painted);
  assert.equal(getComputedStyle(painted).color, 'rgb(255, 0, 0)');
});

test('a styled() host is gone after its test, so its styles reach no later one', () => {
  assert.equal(earlier?.host.isConnected, false);
  const root = styled([], html`<p class="painted">plain</p>`);
  const painted = root.querySelector('.painted');
  assert.ok(painted);
  assert.notEqual(getComputedStyle(painted).color, 'rgb(255, 0, 0)');
});

test('countCalls() counts each call of a method, which still does its work on its object', () => {
  const lamp = {
    lit: 0,
    light(by: number): number {
      this.lit += by;
      return this.lit;
    },
  };
  const calls = countCalls(lamp, 'light');
  assert.equal(calls.count, 0);
  assert.equal(lamp.light(2), 2);
  assert.equal(lamp.light(3), 5);
  assert.equal(calls.count, 2);
  assert.throws(() => countCalls(lamp, 'lit'), /lit is a method/);
});
