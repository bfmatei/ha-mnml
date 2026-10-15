import assert from 'node:assert/strict';

import { CSSResult } from 'lit';
import { test, vi } from 'vitest';

import type { HomeAssistant } from '../ha/hass.ts';
import { fakeHass } from '../test/hass.ts';
import type { ServiceCall } from '../test/hass.ts';
import { configure, created, define, mounted, text } from '../test/render.ts';

import { MnmlListCard } from './list.ts';

define('mnml-list-card', MnmlListCard);

type States = Record<string, [string, string?]>;

function hassOf(states: States): HomeAssistant {
  return fakeHass({
    states: Object.fromEntries(
      Object.entries(states).map(([id, [state, unit]]) => [
        id,
        { state, attributes: unit === undefined ? {} : { unit_of_measurement: unit } },
      ]),
    ),
    formatEntityState: (stateObj, state) => {
      const unit = stateObj.attributes['unit_of_measurement'];
      return typeof unit === 'string'
        ? `${state ?? stateObj.state} ${unit}`
        : (state ?? stateObj.state);
    },
  });
}

const card = (): MnmlListCard => created('mnml-list-card', MnmlListCard);

async function mount(config: unknown, states: States): Promise<MnmlListCard> {
  const made = card();
  configure(made, config);
  made.hass = hassOf(states);
  await mounted(made);
  return made;
}

async function paint(config: unknown, states: States): Promise<ShadowRoot> {
  return mounted(await mount(config, states));
}

async function update(made: MnmlListCard, states: States): Promise<ShadowRoot> {
  made.hass = hassOf(states);
  return mounted(made);
}

const BATTERIES = {
  type: 'custom:mnml-list-card',
  lowest_first: true,
  fold: true,
  summary: 'lowest',
  title: 'Batteries',
  rows: [
    { entity: 'sensor.a', bar: true, low: 20, critical: 5 },
    { entity: 'sensor.b', bar: true, low: 20, critical: 5 },
    { entity: 'sensor.c', bar: true, low: 20, critical: 5 },
  ],
};

const HEALTHY: States = {
  'sensor.a': ['80', '%'],
  'sensor.b': ['45', '%'],
  'sensor.c': ['unknown'],
};

function heading(out: ShadowRoot): HTMLElement | null {
  return out.querySelector<HTMLElement>('.heading.fold');
}

function folded(out: ShadowRoot): boolean {
  return out.querySelector('.section') !== null && out.querySelector('.card.list') === null;
}

function valueCells(out: ShadowRoot, grid: string): HTMLElement[] {
  return [...(out.querySelector(grid)?.children ?? [])].filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement &&
      node.classList.contains('cell') &&
      node.classList.contains('value'),
  );
}

function values(out: ShadowRoot): string[] {
  return valueCells(out, '.grid.bars').map((node) => text(node));
}

test('rows that would read the same take their area first', async () => {
  const made = card();
  configure(made, {
    type: 'custom:mnml-list-card',
    rows: [
      { entity: 'sensor.a', label: 'device' },
      { entity: 'sensor.b', label: 'device' },
      { entity: 'sensor.c', label: 'device' },
    ],
  });
  made.hass = {
    ...hassOf({
      'sensor.a': ['1', 'W'],
      'sensor.b': ['2', 'W'],
      'sensor.c': ['3', 'W'],
    }),
    areas: {
      bedroom: { area_id: 'bedroom', name: 'Bedroom' },
      entry: { area_id: 'entry', name: 'Entry' },
    },
    entities: {
      'sensor.a': { entity_id: 'sensor.a', device_id: 'a' },
      'sensor.b': { entity_id: 'sensor.b', device_id: 'b' },
      'sensor.c': { entity_id: 'sensor.c', device_id: 'c' },
    },
    devices: {
      a: { id: 'a', name: 'AC', area_id: 'bedroom' },
      b: { id: 'b', name: 'AC', area_id: 'entry' },
      c: { id: 'c', name: 'Kettle', area_id: 'entry' },
    },
  };
  const out = await mounted(made);
  assert.deepEqual(
    [...out.querySelectorAll('.cell.label')].map((node) => text(node)),
    ['Bedroom AC', 'Entry AC', 'Kettle'],
  );
});

test('lowest first orders the rows by their value, a row without a number last', async () => {
  const out = await paint(BATTERIES, { ...HEALTHY, 'sensor.c': ['12', '%'] });
  assert.deepEqual(values(out), ['12 %', '45 %', '80 %']);
});

test('highest first orders the rows by their value the other way, and a table by its rows own entities', async () => {
  const rows = await paint(
    { ...BATTERIES, lowest_first: undefined, highest_first: true },
    { ...HEALTHY, 'sensor.c': ['12', '%'] },
  );
  assert.deepEqual(values(rows), ['80 %', '45 %', '12 %']);
  const config = {
    type: 'custom:mnml-list-card',
    highest_first: true,
    title: 'Meters',
    headers: ['Item', 'Now', 'Today'],
    rows: [
      { entity: 'sensor.p1', values: ['sensor.p1', 'sensor.t1'] },
      { entity: 'sensor.p2', values: ['sensor.p2', 'sensor.t2'] },
      { entity: 'sensor.p3', values: ['sensor.p3', 'sensor.t3'] },
    ],
  };
  const table = await paint(config, {
    'sensor.p1': ['12', 'W'],
    'sensor.t1': ['9', 'kWh'],
    'sensor.p2': ['unknown'],
    'sensor.t2': ['5', 'kWh'],
    'sensor.p3': ['300', 'W'],
    'sensor.t3': ['1', 'kWh'],
  });
  assert.deepEqual(
    valueCells(table, '.grid.table')
      .filter((node) => !node.classList.contains('header'))
      .map((node) => text(node)),
    ['300 W', '1 kWh', '12 W', '9 kWh', '—', '5 kWh'],
  );
  assert.throws(() => {
    configure(card(), { ...BATTERIES, highest_first: true });
  }, /^Error: lowest_first and highest_first do not go together$/);
});

test("a list without a title is headed with its entity's name from Home Assistant", async () => {
  const config = {
    type: 'custom:mnml-list-card',
    entity: 'person.jane',
    icon: 'mdi:account',
    rows: [{ entity: 'sensor.a', bar: true }],
  };
  const named = async (extra: object): Promise<string> => {
    const made = card();
    configure(made, { ...config, ...extra });
    const hass = hassOf({ 'sensor.a': ['80', '%'] });
    made.hass = fakeHass({
      ...hass,
      states: {
        ...hass.states,
        'person.jane': { state: 'home', attributes: { friendly_name: 'Jane' } },
      },
    });
    const out = await mounted(made);
    return text(out.querySelector('.heading [role="heading"]'));
  };
  assert.equal(await named({}), 'Jane');
  assert.equal(await named({ title: 'Batteries' }), 'Batteries', 'a title wins');
});

test('a low-only row is drawn while its value is under low, and not otherwise', async () => {
  const config = {
    ...BATTERIES,
    fold: undefined,
    rows: BATTERIES.rows.map((row) => ({ ...row, low_only: true })),
  };
  const out = await paint(config, { ...HEALTHY, 'sensor.c': ['12', '%'] });
  assert.deepEqual(values(out), ['12 %']);
});

test('a folding list is folded while no row needs you, its heading kept', async () => {
  const out = await paint(BATTERIES, HEALTHY);
  assert.ok(folded(out));
  assert.equal(heading(out)?.querySelector('.chevron')?.getAttribute('aria-expanded'), 'false');
});

test('unfolding a list scrolls it into view, and folding it does not', async () => {
  const shown = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  try {
    const out = await paint(BATTERIES, HEALTHY);
    const chevron = heading(out)?.querySelector<HTMLElement>('.chevron');
    chevron?.click();
    await vi.runAllTimersAsync();
    assert.equal(shown.mock.calls.length, 1);
    assert.equal(shown.mock.contexts[0] instanceof HTMLElement, true);
    assert.equal(
      shown.mock.contexts[0] instanceof HTMLElement &&
        shown.mock.contexts[0].classList.contains('section'),
      true,
    );
    assert.deepEqual(shown.mock.calls[0]?.[0], { block: 'nearest', behavior: 'instant' });
    heading(out)?.querySelector<HTMLElement>('.chevron')?.click();
    await vi.runAllTimersAsync();
    assert.equal(shown.mock.calls.length, 1);
  } finally {
    vi.useRealTimers();
    shown.mockRestore();
  }
});

test('it unfolds by itself while a row is orange or red', async () => {
  const painted = await Promise.all(
    ['15', '3'].map(async (level) => ({
      level,
      out: await paint(BATTERIES, { ...HEALTHY, 'sensor.b': [level, '%'] }),
    })),
  );
  for (const { level, out } of painted) {
    assert.ok(!folded(out), level);
  }
});

test('a colour that is not a warning, such as amber for on, does not unfold it', async () => {
  const config = {
    type: 'custom:mnml-list-card',
    fold: true,
    title: 'Power',
    rows: [{ entity: 'switch.outlet', color: 'amber', when: { is: ['on'] } }],
  };
  assert.ok(folded(await paint(config, { 'switch.outlet': ['on'] })));
});

test('a tap holds its choice through updates, whatever the rows say', async () => {
  const made = await mount(BATTERIES, HEALTHY);
  const out = await mounted(made);
  heading(out)?.click();
  await made.updateComplete;
  assert.ok(!folded(out), 'opened by the tap');
  await update(made, { ...HEALTHY, 'sensor.a': ['79', '%'] });
  assert.ok(!folded(out), 'still open after an update');
  heading(out)?.click();
  await update(made, { ...HEALTHY, 'sensor.b': ['3', '%'] });
  assert.ok(folded(out), 'folded by the tap, even with a critical row');
});

test('the summary is the lowest or highest value, as the row shows it', async () => {
  const lowest = await paint(BATTERIES, HEALTHY);
  assert.equal(text(heading(lowest)?.querySelector('.state')), 'Lowest 45 %');
  const highest = await paint({ ...BATTERIES, summary: 'highest' }, HEALTHY);
  assert.equal(text(heading(highest)?.querySelector('.state')), 'Highest 80 %');
});

test('a share row sums up as its share', async () => {
  const config = {
    type: 'custom:mnml-list-card',
    fold: true,
    summary: 'highest',
    title: 'Guest disks',
    rows: [
      { entity: 'sensor.used_a', bar: true, of: 'sensor.size_a' },
      { entity: 'sensor.used_b', bar: true, of: 'sensor.size_b' },
    ],
  };
  const out = await paint(config, {
    'sensor.used_a': ['2', 'GB'],
    'sensor.size_a': ['8', 'GB'],
    'sensor.used_b': ['3', 'GB'],
    'sensor.size_b': ['4', 'GB'],
  });
  assert.equal(text(heading(out)?.querySelector('.state')), 'Highest 75%');
});

test('a table sums up a column under its header, in the same unit only', async () => {
  const config = {
    type: 'custom:mnml-list-card',
    fold: true,
    summary: { sum: 1 },
    title: 'Energy',
    headers: ['Item', 'Now', 'Today', 'Total'],
    rows: [
      { entity: 'sensor.p1', values: ['sensor.p1', 'sensor.t1', 'sensor.s1'] },
      { entity: 'sensor.p2', values: ['sensor.p2', 'sensor.t2', 'sensor.s2'] },
    ],
  };
  const states: States = {
    'sensor.p1': ['12', 'W'],
    'sensor.t1': ['0.25', 'kWh'],
    'sensor.s1': ['40', 'kWh'],
    'sensor.p2': ['3', 'W'],
    'sensor.t2': ['1.1', 'kWh'],
    'sensor.s2': ['9', 'kWh'],
  };
  const same = await paint(config, states);
  assert.equal(text(heading(same)?.querySelector('.state')), 'Today 1.35 kWh');
  const mixed = await paint(config, { ...states, 'sensor.t2': ['1100', 'Wh'] });
  assert.equal(heading(mixed)?.querySelector('.state'), null, 'mixed units');
});

test('a table row with of shows its last value as a share of it, coloured past high and critical_high', async () => {
  const config = {
    type: 'custom:mnml-list-card',
    title: 'Guests',
    headers: ['Guest', 'CPU', 'Disk'],
    rows: ['a', 'b', 'c', 'd'].map((id) => ({
      entity: `sensor.${id}`,
      values: [`sensor.${id}_cpu`, `sensor.${id}_disk`],
      of: 'sensor.size',
      high: 80,
      critical_high: 90,
    })),
  };
  const states: States = {
    'sensor.a': ['on'],
    'sensor.b': ['on'],
    'sensor.c': ['on'],
    'sensor.d': ['on'],
    'sensor.size': ['10', 'GiB'],
    'sensor.a_cpu': ['4', '%'],
    'sensor.b_cpu': ['4', '%'],
    'sensor.c_cpu': ['4', '%'],
    'sensor.d_cpu': ['4', '%'],
    'sensor.a_disk': ['5', 'GiB'],
    'sensor.b_disk': ['8.5', 'GiB'],
    'sensor.c_disk': ['9.5', 'GiB'],
  };
  const out = await paint(config, states);
  const cells = valueCells(out, '.grid.table').slice(2);
  assert.deepEqual(
    cells.map((node) => text(node)),
    ['4 %', '50%', '4 %', '85%', '4 %', '95%', '4 %', '—'],
  );
  assert.deepEqual(
    cells
      .filter((_, index) => index % 2 === 1)
      .map((node) => node.style.getPropertyValue('--m-color')),
    ['', 'var(--orange-color)', 'var(--red-color)', ''],
  );
});

test('a table row with no entity for a column draws no value there, and the next stays under its own header', async () => {
  const config = {
    type: 'custom:mnml-list-card',
    title: 'Meters',
    headers: ['Item', 'Now', 'Today', 'Total'],
    rows: [{ entity: 'sensor.p1', values: ['sensor.p1', null, 'sensor.s1'] }],
  };
  const out = await paint(config, { 'sensor.p1': ['12', 'W'], 'sensor.s1': ['40', 'kWh'] });
  assert.deepEqual(
    valueCells(out, '.grid.table')
      .slice(3)
      .map((node) => text(node)),
    ['12 W', '—', '40 kWh'],
  );
});

test('a table names its count of values on its grid, and draws each row as its icon, its name, then its values in the order of the headers', async () => {
  const config = {
    type: 'custom:mnml-list-card',
    title: 'Meters',
    headers: ['Item', 'Now', 'Today', 'Total', 'Share'],
    rows: ['a', 'b'].map((id) => ({
      entity: `sensor.${id}_power`,
      of: 'sensor.usage',
      values: [
        `sensor.${id}_power`,
        `sensor.${id}_today`,
        `sensor.${id}_total`,
        `sensor.${id}_power`,
      ],
    })),
  };
  const out = await paint(config, {
    'sensor.usage': ['50', 'W'],
    'sensor.a_power': ['24', 'W'],
    'sensor.a_today': ['0.4', 'kWh'],
    'sensor.a_total': ['25.8', 'kWh'],
    'sensor.b_power': ['15', 'W'],
    'sensor.b_today': ['0.2', 'kWh'],
    'sensor.b_total': ['2.4', 'kWh'],
  });
  const grid = out.querySelector('.grid');
  assert.ok(grid);
  assert.deepEqual([...grid.classList], ['grid', 'table', 'values-4']);
  const kinds = [...grid.children].map((node) =>
    node.classList.contains('header')
      ? `header ${node.classList.contains('label') ? 'label' : 'value'}`
      : (['icon-cell', 'label', 'value'].find((kind) => node.classList.contains(kind)) ?? ''),
  );
  const row = ['icon-cell', 'label', 'value', 'value', 'value', 'value'];
  assert.deepEqual(kinds, [
    'header label',
    ...Array.from({ length: 4 }, () => 'header value'),
    ...row,
    ...row,
  ]);
  assert.deepEqual(
    [...grid.children].map((node) => text(node)),
    [
      'Item',
      'Now',
      'Today',
      'Total',
      'Share',
      '',
      'sensor.a_power',
      '24 W',
      '0.4 kWh',
      '25.8 kWh',
      '48%',
      '',
      'sensor.b_power',
      '15 W',
      '0.2 kWh',
      '2.4 kWh',
      '30%',
    ],
  );
});

function twoLines(): { values: number; below: number; rules: string }[] {
  const sheet = [MnmlListCard.styles]
    .flat()
    .filter((style) => style instanceof CSSResult)
    .map((style) => style.cssText)
    .join('\n');
  return sheet
    .split('@container')
    .slice(1)
    .map((block) => {
      const found = /^\s*\(width < (\d+)px\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/.exec(block);
      assert.ok(found, block);
      const [, below = '', rules = ''] = found;
      const values = [...rules.matchAll(/\.values-(\d+)/g)].map((match) => Number(match[1]));
      assert.ok(values.length > 0 && values.every((each) => each === values[0]), rules);
      return {
        values: values[0] ?? 0,
        below: Number(below),
        rules: rules
          .replaceAll(/\.values-\d+/g, '.values-n')
          .replaceAll(/\s+/g, ' ')
          .trim(),
      };
    });
}

test('a table takes two lines a row on a card narrower than 136 px and 64 px a value, so on a 360 px card three values keep one line and four take two', () => {
  const blocks = twoLines();
  assert.deepEqual(
    blocks.map(({ values, below }) => [values, below]),
    [1, 2, 3, 4, 5, 6].map((values) => [values, 136 + 64 * values]),
  );
  const inside = 360 - 2 * 8;
  const below = (values: number): number =>
    blocks.find((block) => block.values === values)?.below ?? 0;
  assert.ok(below(3) <= inside, 'three values keep one line');
  assert.ok(below(4) > inside, 'four values take two');
  const [first] = blocks;
  assert.ok(first);
  for (const block of blocks) {
    assert.equal(block.rules, first.rules, `${block.values} values`);
  }
  assert.match(first.rules, /\.values-n \.header\.label \{ display: none; \}/);
  assert.match(first.rules, /\.values-n \.label \{ grid-column: 2 \/ -1; \}/);
});

test('a table unfolds while one of its values is unavailable', async () => {
  const config = {
    type: 'custom:mnml-list-card',
    fold: true,
    title: 'Energy',
    headers: ['Item', 'Now'],
    rows: [{ entity: 'sensor.p1', values: ['sensor.p1'] }],
  };
  assert.ok(folded(await paint(config, { 'sensor.p1': ['12', 'W'] })));
  assert.ok(!folded(await paint(config, { 'sensor.p1': ['unavailable'] })));
});

test('a row with zero_when_empty reads a missing value as zero, uncoloured; one without stays an orange dash', async () => {
  const config = {
    type: 'custom:mnml-list-card',
    title: 'Health',
    rows: [
      { entity: 'sensor.flights', zero_when_empty: true },
      { entity: 'sensor.steps', zero_when_empty: true },
      { entity: 'sensor.energy', zero_when_empty: true },
      { entity: 'sensor.plain' },
    ],
  };
  const out = await paint(config, {
    'sensor.flights': ['unavailable', 'floors'],
    'sensor.steps': ['unknown', 'steps'],
    'sensor.energy': ['12', 'kcal'],
    'sensor.plain': ['unavailable', 'floors'],
  });
  const cells = valueCells(out, '.grid.plain');
  assert.deepEqual(
    cells.map((node) => text(node)),
    ['0 floors', '0 steps', '12 kcal', '—'],
  );
  assert.deepEqual(
    cells.map((node) => node.style.getPropertyValue('--m-color')),
    ['', '', '', 'var(--orange-color)'],
  );
});

test('a list without fold has no chevron, and no summary unless asked', async () => {
  const out = await paint(
    { type: 'custom:mnml-list-card', title: 'Host', rows: [{ entity: 'sensor.a' }] },
    HEALTHY,
  );
  assert.equal(out.querySelector('.heading.fold'), null);
  assert.equal(out.querySelector('.heading .state'), null);
});

test('a list card with a misspelled key is an error card that names it', () => {
  assert.throws(() => {
    configure(card(), { ...BATTERIES, lowestfirst: true });
  }, /unknown key: lowestfirst/);
});

test('a list row without an entity is an error card that names the row', () => {
  assert.throws(() => {
    configure(card(), { ...BATTERIES, rows: [{ name: 'Lamp' }] });
  }, /rows\[0\]\.entity is required/);
});

test('a summary the list does not know is an error card', () => {
  const made = card();
  assert.throws(() => {
    configure(made, { ...BATTERIES, summary: 'lowests' });
  }, /summary must be lowest, highest or/);
  assert.throws(() => {
    configure(made, { ...BATTERIES, summary: { column: 0 } });
  }, /summary must be lowest, highest or/);
});

test("a row's reset presses its button, through the hass of the moment", async () => {
  const drawn: ServiceCall[] = [];
  const now: ServiceCall[] = [];
  const base = hassOf({ 'sensor.filter_days': ['12', 'd'] });
  const hass = (calls: ServiceCall[]): HomeAssistant => ({
    ...fakeHass({ ...base, calls }),
    states: base.states,
  });
  const made = card();
  configure(made, {
    type: 'custom:mnml-list-card',
    rows: [{ entity: 'sensor.filter_days', reset: 'button.filter_reset' }],
  });
  made.hass = hass(drawn);
  const root = await mounted(made);
  made.hass = hass(now);
  const reset = root.querySelector<HTMLElement>('button.reset');
  assert.equal(reset?.getAttribute('aria-label'), 'Reset sensor.filter_days');
  reset?.click();
  assert.deepEqual(drawn, []);
  assert.deepEqual(now, [
    {
      domain: 'button',
      service: 'press',
      data: undefined,
      target: { entity_id: 'button.filter_reset' },
    },
  ]);
});
