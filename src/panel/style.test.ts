import assert from 'node:assert/strict';

import { html } from 'lit';
import { test } from 'vitest';

import { styled } from '../test/render.ts';

import { PANEL_STYLE } from './style.ts';

test('the YAML and Slots tabs are padded columns', () => {
  const root = styled(
    [PANEL_STYLE],
    html`<div class="yaml"></div>
      <div class="slots-tab"></div>`,
  );
  for (const tab of ['.yaml', '.slots-tab']) {
    const node = root.querySelector(tab);
    assert.ok(node, tab);
    const style = getComputedStyle(node);
    assert.equal(style.display, 'flex', tab);
    assert.equal(style.flexDirection, 'column', tab);
    assert.equal(style.padding, '16px', tab);
  }
});
