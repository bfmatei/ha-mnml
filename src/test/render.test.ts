import assert from 'node:assert/strict';

import { css, html } from 'lit';
import { test } from 'vitest';

import { styled } from './render.ts';

let earlier: ShadowRoot | undefined;

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
