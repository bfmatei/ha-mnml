import assert from 'node:assert/strict';

import { render } from 'lit';
import { test } from 'vitest';

import { samples, trendLine, trendPath } from './trend.ts';

test('a day is 97 samples, each the last value before it, and nothing before the first', () => {
  const values = samples(
    [
      { at: -5, value: 20 },
      { at: 10, value: undefined },
      { at: 20, value: 22 },
    ],
    0,
    96,
  );
  assert.equal(values.length, 97);
  assert.deepEqual(
    [values[0], values[9], values[10], values[19], values[20], values[96]],
    [20, 20, undefined, undefined, 22, 22],
  );
  const late = samples([{ at: 50, value: 21 }], 0, 96);
  assert.deepEqual([late[49], late[50]], [undefined, 21]);
});

test('the line spans the day from its lowest to its highest, at least 2 tall, and breaks where a value is missing', () => {
  assert.equal(trendPath([20, 20, 20]), 'M0 50L50 50L100 50');
  assert.equal(trendPath([18, undefined, 22]), 'M0 100M100 0');
  assert.equal(trendPath([21, 21.5, undefined, 22]), 'M0 75L33.33 50M100 25');
  assert.equal(trendPath([undefined, undefined]), '');
});

test('the line is neutral, or in its colour', () => {
  const root = document.createElement('div');
  render(trendLine('M0 50L100 50', 'amber'), root);
  const line = root.querySelector('svg.trend');
  assert.ok(line);
  assert.ok(line.classList.contains('colored'));
  assert.match(line.getAttribute('style') ?? '', /--m-color:\s*var\(--amber-color\)/);
  assert.equal(line.querySelector('path')?.getAttribute('d'), 'M0 50L100 50');
  render(trendLine('M0 50L100 50', undefined), root);
  assert.equal(root.querySelector('svg.trend')?.classList.contains('colored'), false);
});
