import assert from 'node:assert/strict';

import { test } from 'vitest';

import { PANEL_STYLE } from './style.ts';

const rules = (): { selectors: string[]; body: string }[] =>
  [...PANEL_STYLE.cssText.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((match) => ({
    selectors: (match[1] ?? '').split(',').map((selector) => selector.trim()),
    body: match[2] ?? '',
  }));

test('the YAML and Slots tabs are padded columns, and no other tab shares their rule', () => {
  for (const tab of ['.yaml', '.slots-tab']) {
    const rule = rules().find((each) => each.selectors.includes(tab));
    assert.ok(rule, tab);
    assert.match(rule.body, /display:\s*flex/, tab);
    assert.match(rule.body, /padding:\s*16px/, tab);
    assert.match(rule.body, /flex-direction:\s*column/, tab);
    assert.deepEqual(
      rule.selectors.filter((selector) => !['.yaml', '.slots-tab'].includes(selector)),
      [],
      tab,
    );
  }
});
