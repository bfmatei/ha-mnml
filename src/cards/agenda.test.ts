import assert from 'node:assert/strict';

import { afterAll, test, vi } from 'vitest';

import { define, mounted, text } from '../test/render.ts';

import { MnmlAgendaCard } from './agenda.ts';

define('mnml-agenda-card', MnmlAgendaCard);

vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 7, 12) });

afterAll(() => {
  vi.useRealTimers();
});

interface Event {
  summary: string;
  start: { dateTime: string } | { date: string };
}

const SONARR = 'calendar.sonarr';
const RADARR = 'calendar.radarr';

const CONFIG = {
  type: 'custom:mnml-agenda-card',
  title: 'Upcoming',
  icon: 'mdi:calendar-clock',
  sources: [
    { entity: SONARR, kind: 'episodes' },
    { entity: RADARR, kind: 'movies' },
  ],
};

function at(day: number, hour: number, month = 9): { dateTime: string } {
  return { dateTime: new Date(2026, month, day, hour).toISOString() };
}

const EPISODES: Event[] = [
  { summary: 'American Hostage - S01E04 - A Taste of Indianapolis', start: at(5, 4) },
  { summary: 'Last Seen - S01E06 - The Choice', start: at(7, 7) },
  { summary: 'Dark Matter (2024) - S02E07 - The Pyramid', start: at(9, 7) },
  { summary: 'Slow Horses - S03E02 - Hello Goodbye', start: at(12, 9) },
  { summary: 'Slow Horses - S03E01 - Strange Games', start: at(12, 9) },
  { summary: 'Slow Horses - S03E03 - Negotiating with Tigers', start: at(12, 9) },
  { summary: 'South Park - S29E03 - TBA', start: at(22, 5) },
  { summary: 'A special without a number', start: at(23, 20) },
];

const MOVIES: Event[] = [
  { summary: 'The Long Walk', start: { date: '2026-10-14' } },
  { summary: 'Far Away', start: { date: '2026-12-10' } },
  { summary: 'Very Far', start: { date: '2027-12-01' } },
];

function until(days: number): string {
  const date = new Date(2026, 9, 5 + days - 1);
  return `Nothing until ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)}`;
}

interface Fake {
  calls: string[];
  states: Record<string, string>;
  failing?: string;
}

function inRange(path: string, event: Event): boolean {
  const query = new URLSearchParams(path.split('?')[1] ?? '');
  const start = new Date(query.get('start') ?? '');
  const end = new Date(query.get('end') ?? '');
  const when =
    'date' in event.start ? new Date(`${event.start.date}T00:00`) : new Date(event.start.dateTime);
  return when < end && when >= new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
}

function hassOf(fake: Fake, events: Record<string, Event[]>): unknown {
  return {
    states: Object.fromEntries(
      Object.entries(fake.states).map(([id, state]) => [
        id,
        { entity_id: id, state, attributes: {}, last_changed: state, last_updated: state },
      ]),
    ),
    entities: {
      [SONARR]: { entity_id: SONARR, device_id: 's' },
      [RADARR]: { entity_id: RADARR, device_id: 'r' },
    },
    devices: { s: { id: 's', name: 'Sonarr' }, r: { id: 'r', name: 'Radarr' } },
    locale: { language: 'en-GB' },
    formatEntityState: (stateObj: { state: string }): string => stateObj.state,
    callApi: (_method: string, path: string): Promise<unknown> => {
      fake.calls.push(path);
      const entity = path.slice('calendars/'.length).split('?')[0] ?? '';
      if (entity === fake.failing) {
        return Promise.reject(new Error('500'));
      }
      return Promise.resolve((events[entity] ?? []).filter((event) => inRange(path, event)));
    },
  };
}

function settled(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function mount(
  fake: Fake,
  events: Record<string, Event[]> = { [SONARR]: EPISODES, [RADARR]: MOVIES },
): Promise<MnmlAgendaCard> {
  const card = document.createElement('mnml-agenda-card');
  assert.ok(card instanceof MnmlAgendaCard);
  card.setConfig(CONFIG as never);
  card.hass = hassOf(fake, events) as never;
  await mounted(card);
  await settled();
  return card;
}

function leaves(node: Element): string {
  return node.children.length === 0 ? text(node) : [...node.children].map(leaves).join('');
}

function lines(card: MnmlAgendaCard): string[] {
  const out: string[] = [];
  const visit = (current: Element): void => {
    const is = (name: string): boolean => current.classList.contains(name);
    if (is('week') || is('note')) {
      out.push(text(current));
      return;
    }
    if (is('release')) {
      out.push(
        [...current.children]
          .map((child) => leaves(child))
          .filter(Boolean)
          .join(' | '),
      );
      return;
    }
    if (is('more')) {
      out.push(
        `[${[...current.children].map((child) => child.getAttribute('aria-label')).join('] [')}]`,
      );
      return;
    }
    for (const child of current.children) {
      visit(child);
    }
  };
  for (const child of card.shadowRoot?.children ?? []) {
    visit(child);
  }
  return out;
}

async function press(card: MnmlAgendaCard, label: string): Promise<void> {
  const target = [...(card.shadowRoot?.querySelectorAll<HTMLElement>('[aria-label]') ?? [])].find(
    (node) => node.getAttribute('aria-label') === label,
  );
  assert.ok(target, label);
  target.click();
  await card.updateComplete;
}

const LIVE = { [SONARR]: 'off', [RADARR]: 'off' };

test('it starts with the first week that has something, episodes split into series and code', async () => {
  const card = await mount({ calls: [], states: LIVE });
  assert.deepEqual(lines(card), [
    'This week',
    'Last SeenS01E06 • The Choice | Wed 7',
    'Dark Matter (2024)S02E07 • The Pyramid | Fri 9',
    '[Next]',
  ]);
});

test('Next adds the next week with something, skipping empty ones however far, and Back to now returns', async () => {
  const card = await mount({ calls: [], states: LIVE });
  await press(card, 'Next');
  await settled();
  assert.deepEqual(lines(card).slice(3), [
    'Next week',
    'Slow HorsesS03E01-E03 • 3 episodes | Mon 12',
    'The Long Walk | Wed 14',
    '[Next] [Back to now]',
  ]);
  await press(card, 'Next');
  await settled();
  assert.deepEqual(lines(card).slice(-4), [
    'Week of 19 Oct',
    'South ParkS29E03 • TBA | Thu 22',
    'A special without a number | Fri 23',
    '[Next] [Back to now]',
  ]);
  await press(card, 'Next');
  await settled();
  assert.deepEqual(lines(card).slice(-3), [
    'Week of 7 Dec',
    'Far Away | Thu 10',
    '[Next] [Back to now]',
  ]);
  await press(card, 'Next');
  await settled();
  assert.deepEqual(lines(card).slice(-3), [
    'Week of 29 Nov',
    'Very Far | Wed 1',
    '[Next] [Back to now]',
  ]);
  await press(card, 'Next');
  await settled();
  assert.deepEqual(lines(card).slice(-2), [until(7 * 13 * 9), '[Next] [Back to now]']);
  await press(card, 'Back to now');
  assert.deepEqual(lines(card), [
    'This week',
    'Last SeenS01E06 • The Choice | Wed 7',
    'Dark Matter (2024)S02E07 • The Pyramid | Fri 9',
    '[Next]',
  ]);
});

test('nothing in a year says until when, and Next searches the year after', async () => {
  const fake: Fake = { calls: [], states: LIVE };
  const card = await mount(fake, {
    [RADARR]: [{ summary: 'Years Away', start: { date: '2027-11-03' } }],
  });
  assert.deepEqual(lines(card), [until(7 * 13 * 4), '[Next]']);
  await press(card, 'Next');
  await settled();
  assert.deepEqual(lines(card), ['Week of 1 Nov', 'Years Away | Wed 3', '[Next] [Back to now]']);
});

test('a search through empty weeks redraws once when tapped and once when it ends, not per request', async () => {
  const fake: Fake = { calls: [], states: LIVE };
  const card = await mount(fake, {
    [RADARR]: [{ summary: 'Much Later', start: { date: '2028-09-01' } }],
  });
  const draws = vi.spyOn(card as unknown as { draw: (...args: unknown[]) => unknown }, 'draw');
  const asked = fake.calls.length;
  await press(card, 'Next');
  await settled();
  assert.equal(fake.calls.length - asked, 8, 'four stretches, two calendars each');
  assert.deepEqual(lines(card).slice(0, 2), ['Week of 28 Aug', 'Much Later | Fri 1']);
  assert.equal(draws.mock.calls.length, 2);
});

test('a calendar that fails to answer is named in orange, and the other still lists', async () => {
  const card = await mount({ calls: [], states: LIVE, failing: RADARR });
  const out = lines(card);
  assert.equal(out[0], "Couldn't read Radarr");
  assert.equal(
    card.shadowRoot
      ?.querySelector<HTMLElement>('.note.colored')
      ?.style.getPropertyValue('--m-color'),
    'var(--orange-color)',
  );
  assert.ok(out.includes('Last SeenS01E06 • The Choice | Wed 7'));
  assert.ok(!out.includes('The Long Walk | Wed 14'));
});

test('an unavailable calendar is named in orange and not asked', async () => {
  const fake: Fake = { calls: [], states: { [SONARR]: 'off', [RADARR]: 'unavailable' } };
  const card = await mount(fake);
  assert.equal(lines(card)[0], 'Radarr unavailable');
  assert.ok(fake.calls.every((call) => call.startsWith(`calendars/${SONARR}?`)));
});

test('a change of a calendar state fetches again; another update does not', async () => {
  const fake: Fake = { calls: [], states: LIVE };
  const card = await mount(fake);
  const first = fake.calls.length;
  card.hass = hassOf(fake, { [SONARR]: EPISODES, [RADARR]: MOVIES }) as never;
  await settled();
  assert.equal(fake.calls.length, first, 'the same states, no new request');
  fake.states = { [SONARR]: 'on', [RADARR]: 'off' };
  card.hass = hassOf(fake, { [SONARR]: EPISODES, [RADARR]: MOVIES }) as never;
  await settled();
  assert.equal(fake.calls.length, first * 2);
});
