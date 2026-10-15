import assert from 'node:assert/strict';

import { test } from 'vitest';
import { parse } from 'yaml';

import { renderTheme } from './build.ts';
import { THEMES } from './model.ts';

for (const theme of Object.values(THEMES)) {
  test(`the ${theme.design} theme is one theme, named MNML, with a light and a dark mode`, () => {
    const parsed: unknown = parse(renderTheme(theme));
    assert.ok(parsed !== null && typeof parsed === 'object');
    assert.deepEqual(Object.keys(parsed), ['MNML']);
    const modes = (parsed as { MNML: { modes?: Record<string, unknown> } }).MNML.modes;
    assert.deepEqual(Object.keys(modes ?? {}).toSorted(), ['dark', 'light']);
  });
}

const CURRENT = [
  'ha-color-form-background',
  'ha-color-form-background-hover',
  'ha-color-form-background-disabled',
  'ha-box-shadow-s',
  'ha-box-shadow-m',
  'ha-box-shadow-l',
  'ha-section-background-color',
  'ha-switch-background-color',
  'ha-switch-border-color',
  'ha-switch-thumb-background-color',
  'ha-switch-thumb-border-color',
  'ha-checkbox-border-color',
];

for (const theme of Object.values(THEMES)) {
  test(`the ${theme.design} theme sets Home Assistant's form, shadow, section and switch tokens in both modes, and no token Home Assistant no longer reads`, () => {
    const parsed: {
      MNML: Record<string, unknown> & { modes: Record<string, Record<string, string>> };
    } = parse(renderTheme(theme));
    for (const mode of ['light', 'dark']) {
      const values = parsed.MNML.modes[mode] ?? {};
      assert.deepEqual(
        CURRENT.filter((token) => typeof values[token] !== 'string'),
        [],
        mode,
      );
      assert.equal(Object.hasOwn(values, 'mdc-text-field-disabled-line-color'), false, mode);
    }
    assert.equal(Object.hasOwn(parsed.MNML, 'primary-font-family'), false);
    assert.equal(parsed.MNML['ha-font-family-body'], theme.font);
  });
}

test('the flat theme draws the same design with an opaque card, no blur and no backdrop', () => {
  const [glass, flat] = [THEMES.glass, THEMES.flat].map(
    (theme) => parse(renderTheme(theme)) as { MNML: { modes: { dark: Record<string, string> } } },
  );
  assert.deepEqual(
    Object.keys(flat?.MNML.modes.dark ?? {}).toSorted(),
    Object.keys(glass?.MNML.modes.dark ?? {}).toSorted(),
    'the same variables, with other values',
  );
  assert.equal(flat?.MNML.modes.dark['mnml-card-backdrop-filter'], 'none');
  assert.match(glass?.MNML.modes.dark['mnml-card-backdrop-filter'] ?? '', /blur/);
  assert.match(flat?.MNML.modes.dark['mnml-card-background-color'] ?? '', /\/ 1\)$/);
});
