import type { Filter } from '../contract/templates.ts';
import type { EntityEntry, Registries } from '../ha/registries.ts';

import { deviceOf, indexOf } from './entity-index.ts';

type Wanted = Required<Filter>;

type Spoken = Exclude<keyof Wanted, 'domain'>;

interface Predicate<V> {
  holds: (wanted: V, entry: EntityEntry, registries: Registries) => boolean;
  why: (wanted: V, entry: EntityEntry, registries: Registries) => readonly string[];
}

interface Phrased<V> extends Predicate<V> {
  words: string;
  shown: (wanted: V) => string;
}

const NOUNS = {
  device_class: 'device class',
  translation_key: 'translation key',
  unit: 'unit',
  state_class: 'state class',
} as const;

const plain = (wanted: string): string => wanted;

const category = (value: string): string => (value === 'none' ? 'primary' : value);

const scalar = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : undefined;

function scalarMatches(actual: unknown, wanted: unknown): boolean {
  const given = scalar(wanted);
  if (given === undefined) {
    return false;
  }
  return typeof actual === 'number'
    ? given.trim() !== '' && Number(given) === actual
    : scalar(actual) === given;
}

function has(actual: unknown, wanted: unknown): boolean {
  return Array.isArray(actual)
    ? actual.some((item: unknown) => scalarMatches(item, wanted))
    : scalarMatches(actual, wanted);
}

function said(actual: unknown): string | undefined {
  if (!Array.isArray(actual)) {
    return scalar(actual);
  }
  return actual.length === 0
    ? 'none'
    : actual.map((item: unknown) => scalar(item) ?? '?').join(', ');
}

const attributesOf = (
  entry: EntityEntry,
  registries: Registries,
): Readonly<Record<string, unknown>> | undefined => registries.states[entry.entity_id]?.attributes;

function attribute(entry: EntityEntry, registries: Registries, key: string): string | undefined {
  const value = attributesOf(entry, registries)?.[key];
  return typeof value === 'string' ? value : undefined;
}

const friendly = (entry: EntityEntry, registries: Registries): string =>
  attribute(entry, registries, 'friendly_name') ?? entry.entity_id;

const wordsOf = (text: string): string[] => text.toLowerCase().split(/\s+/).filter(Boolean);

const domainOf = (entry: EntityEntry): string =>
  entry.entity_id.split('.', 1)[0] ?? entry.entity_id;

const containing = (actual: string | null | undefined, wanted: string): boolean =>
  (actual ?? '').toLowerCase().includes(wanted.toLowerCase());

function fromIntegration(entry: EntityEntry, integration: string, registries: Registries): boolean {
  const device = entry.device_id;
  return device === undefined || device === null
    ? entry.platform === integration
    : indexOf(registries).platforms.get(device)?.has(integration) === true;
}

function reading(key: string, noun: string): Predicate<string> {
  return {
    holds: (wanted, entry, registries) => attribute(entry, registries, key) === wanted,
    why: (wanted, entry, registries) => {
      const actual = attribute(entry, registries, key);
      return [actual === undefined ? `has no ${noun}` : `has ${noun} ${actual}, not ${wanted}`];
    },
  };
}

const DOMAIN: Predicate<string> = {
  holds: (wanted, entry) => entry.entity_id.startsWith(`${wanted}.`),
  why: (wanted, entry) => [`is in the domain ${domainOf(entry)}, not ${wanted}`],
};

const WORDED: { [K in Spoken]: Phrased<Wanted[K]> } = {
  device_class: {
    words: `with ${NOUNS.device_class}`,
    shown: plain,
    ...reading('device_class', NOUNS.device_class),
  },
  platform: {
    words: 'from the integration',
    shown: plain,
    holds: (wanted, entry) => entry.platform === wanted,
    why: (wanted, entry) => [`is from the integration ${entry.platform ?? 'none'}, not ${wanted}`],
  },
  translation_key: {
    words: `with ${NOUNS.translation_key}`,
    shown: plain,
    holds: (wanted, entry) => entry.translation_key === wanted,
    why: (wanted, entry) => [
      `has ${NOUNS.translation_key} ${entry.translation_key ?? 'none'}, not ${wanted}`,
    ],
  },
  entity_category: {
    words: 'in the category',
    shown: category,
    holds: (wanted, entry) => (entry.entity_category ?? 'none') === wanted,
    why: (wanted, entry) => [
      `is in the category ${category(entry.entity_category ?? 'none')}, not ${category(wanted)}`,
    ],
  },
  unit: {
    words: `with ${NOUNS.unit}`,
    shown: plain,
    ...reading('unit_of_measurement', NOUNS.unit),
  },
  state_class: {
    words: `with ${NOUNS.state_class}`,
    shown: plain,
    ...reading('state_class', NOUNS.state_class),
  },
  attribute: {
    words: 'with attribute',
    shown: (wanted) =>
      Object.entries(wanted)
        .map(([name, value]) => `${name} ${value}`)
        .join(' and '),
    holds: (wanted, entry, registries) =>
      Object.entries(wanted).every(([name, value]) =>
        has(attributesOf(entry, registries)?.[name], value),
      ),
    why: (wanted, entry, registries) =>
      Object.entries(wanted).flatMap(([name, value]) => {
        const actual = attributesOf(entry, registries)?.[name];
        const told = said(actual);
        if (told === undefined) {
          return [`has no attribute ${name}`];
        }
        return has(actual, value)
          ? []
          : [`has ${name} ${told}, ${Array.isArray(actual) ? 'without' : 'not'} ${value}`];
      }),
  },
  name: {
    words: 'named like',
    shown: (wanted) => `"${wanted}"`,
    holds: (wanted, entry, registries) => {
      const text = friendly(entry, registries).toLowerCase();
      return wordsOf(wanted).every((word) => text.includes(word));
    },
    why: (_wanted, entry, registries) => [`is named "${friendly(entry, registries)}"`],
  },
  manufacturer: {
    words: 'made by',
    shown: plain,
    holds: (wanted, entry, registries) =>
      containing(deviceOf(entry, registries)?.manufacturer, wanted),
    why: (wanted, entry, registries) => [
      `is made by ${deviceOf(entry, registries)?.manufacturer ?? 'nobody known'}, not ${wanted}`,
    ],
  },
  model: {
    words: 'of model',
    shown: plain,
    holds: (wanted, entry, registries) => containing(deviceOf(entry, registries)?.model, wanted),
    why: (wanted, entry, registries) => [
      `is of model ${deviceOf(entry, registries)?.model ?? 'unknown'}, not ${wanted}`,
    ],
  },
  entry_type: {
    words: 'on a device of type',
    shown: plain,
    holds: (wanted, entry, registries) =>
      (deviceOf(entry, registries)?.entry_type ?? 'none') === wanted,
    why: (wanted, entry, registries) => [
      `is on a device of type ${deviceOf(entry, registries)?.entry_type ?? 'none'}, not ${wanted}`,
    ],
  },
  integration: {
    words: 'on a device of the integration',
    shown: plain,
    holds: (wanted, entry, registries) => fromIntegration(entry, wanted, registries),
    why: (wanted) => [`is not on a device of the integration ${wanted}`],
  },
  label: {
    words: 'labelled',
    shown: plain,
    holds: (wanted, entry, registries) =>
      entry.labels?.includes(wanted) === true ||
      deviceOf(entry, registries)?.labels?.includes(wanted) === true,
    why: (wanted) => [`lacks the label ${wanted}`],
  },
  exclude: {
    words: 'but not',
    shown: (wanted) => spoken(wanted),
    holds: (wanted, entry, registries) => !matches(entry, wanted, registries),
    why: (wanted) => [`is excluded: it is ${spoken(wanted)}`],
  },
};

const isSpoken = (key: string): key is Spoken => Object.hasOwn(WORDED, key);

const SPOKEN: readonly Spoken[] = Object.keys(WORDED).filter(isSpoken);

export const TEXT_FILTERS = SPOKEN.filter(
  (key): key is Exclude<Spoken, 'attribute' | 'exclude'> =>
    key !== 'attribute' && key !== 'exclude',
);

export function filterWords(key: Spoken): string {
  return WORDED[key].words;
}

function holdsOn<K extends Spoken>(
  key: K,
  filter: Partial<Wanted>,
  entry: EntityEntry,
  registries: Registries,
): boolean {
  const wanted = filter[key];
  return wanted === undefined || WORDED[key].holds(wanted, entry, registries);
}

function whyOn<K extends Spoken>(
  key: K,
  filter: Partial<Wanted>,
  entry: EntityEntry,
  registries: Registries,
): readonly string[] {
  const wanted = filter[key];
  return wanted === undefined || WORDED[key].holds(wanted, entry, registries)
    ? []
    : WORDED[key].why(wanted, entry, registries);
}

function phraseOn<K extends Spoken>(key: K, filter: Partial<Wanted>): string[] {
  const wanted = filter[key];
  return wanted === undefined ? [] : [`${WORDED[key].words} ${WORDED[key].shown(wanted)}`];
}

export function matches(entry: EntityEntry, filter: Filter, registries: Registries): boolean {
  return (
    (filter.domain === undefined || DOMAIN.holds(filter.domain, entry, registries)) &&
    SPOKEN.every((key) => holdsOn(key, filter, entry, registries))
  );
}

export function whyNot(entry: EntityEntry, filter: Filter, registries: Registries): string[] {
  return [
    ...(filter.domain === undefined || DOMAIN.holds(filter.domain, entry, registries)
      ? []
      : DOMAIN.why(filter.domain, entry, registries)),
    ...SPOKEN.flatMap((key) => whyOn(key, filter, entry, registries)),
  ];
}

function phrases(filter: Filter): string[] {
  return SPOKEN.flatMap((key) => phraseOn(key, filter));
}

function spoken(filter: Filter): string {
  return filter.domain === undefined ? phrases(filter).join(', ') : describe(filter);
}

export function describe(filter: Filter): string {
  return [filter.domain ?? 'any entity', phrases(filter).join(', ')]
    .filter((part) => part !== '')
    .join(' ');
}
