import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import { MnmlListCard } from './list.ts';

define('mnml-list-card', MnmlListCard);

type States = Record<string, [string, string?]>;

function hassOf(states: States): unknown {
  return {
    states: Object.fromEntries(
      Object.entries(states).map(([id, [state, unit]]) => [
        id,
        {
          entity_id: id,
          state,
          attributes: unit === undefined ? {} : { unit_of_measurement: unit },
        },
      ]),
    ),
    entities: {},
    devices: {},
    locale: { language: 'en' },
    formatEntityState: (
      stateObj: { state: string; attributes: Record<string, unknown> },
      state?: string,
    ): string => {
      const unit = stateObj.attributes['unit_of_measurement'];
      return typeof unit === 'string'
        ? `${state ?? stateObj.state} ${unit}`
        : (state ?? stateObj.state);
    },
  };
}

function card(): MnmlListCard {
  const made = document.createElement('mnml-list-card');
  assert.ok(made instanceof MnmlListCard);
  return made;
}

async function mount(config: unknown, states: States): Promise<MnmlListCard> {
  const made = card();
  made.setConfig(config as never);
  made.hass = hassOf(states) as never;
  await mounted(made);
  return made;
}

async function paint(config: unknown, states: States): Promise<ShadowRoot> {
  return mounted(await mount(config, states));
}

async function update(made: MnmlListCard, states: States): Promise<ShadowRoot> {
  made.hass = hassOf(states) as never;
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

test('lowest first orders the rows by their value, a row without a number last', async () => {
  const out = await paint(BATTERIES, { ...HEALTHY, 'sensor.c': ['12', '%'] });
  assert.deepEqual(values(out), ['12 %', '45 %', '80 %']);
});

test('a folding list is folded while no row needs you, its heading kept', async () => {
  const out = await paint(BATTERIES, HEALTHY);
  assert.ok(folded(out));
  assert.equal(heading(out)?.querySelector('.chevron')?.getAttribute('aria-expanded'), 'false');
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
    card().setConfig({ ...BATTERIES, lowestfirst: true } as never);
  }, /unknown key: lowestfirst/);
});

test('a list row without an entity is an error card that names the row', () => {
  assert.throws(() => {
    card().setConfig({ ...BATTERIES, rows: [{ name: 'Lamp' }] } as never);
  }, /rows\[0\]\.entity is required/);
});

test('a summary the list does not know is an error card', () => {
  const made = card();
  assert.throws(() => {
    made.setConfig({ ...BATTERIES, summary: 'lowests' } as never);
  }, /summary must be lowest, highest or/);
  assert.throws(() => {
    made.setConfig({ ...BATTERIES, summary: { column: 0 } } as never);
  }, /summary must be lowest, highest or/);
});
