import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CAR_KEYS,
  HOME_KEYS,
  PERSON_KEYS,
  ROOM_KEYS,
  SECTION_TITLES_KEYS,
  SYSTEM_KEYS,
} from '../home/types.ts';
import { SHIPPED, readShapes } from '../templates/shipped.ts';
import { withShapes } from '../templates/slot-shapes.ts';
import { THEMES } from '../theme/model.ts';
import { buildTheme } from '../theme/theme.ts';

import { CARD_STRUCTURES } from './structure.ts';
import type { Key, Structure } from './structure.ts';
import { isMapping } from './templates.ts';
import type { SlotSpec } from './templates.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const INTEGRATION = resolve(ROOT, 'custom_components/mnml');

export const INTERFACE_FILE = resolve(ROOT, 'interface.json');

export const FORMAT = 1;

const OTHERWISE = 'otherwise';

export interface Surface {
  format: typeof FORMAT;
  cards: Record<string, Record<string, string>>;
  templates: Record<string, Record<string, string>>;
  shapes: Record<string, string>;
  theme: { names: string[]; variables: string[] };
  integration: { domain: string; options: string[]; commands: string[] };
  home: Record<string, string[]>;
}

interface Changes {
  removed: string[];
  changed: string[];
  added: string[];
}

type Entry<T> = readonly [string, T];

function byName<T>([a]: Entry<T>, [b]: Entry<T>): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

const unique = (names: readonly string[]): string[] => [...new Set(names)].toSorted();

function described(key: Key): string {
  const values = key.options ?? (key.writes === undefined ? [] : [key.writes]);
  const listed = values.length === 0 ? '' : `(${values.join('|')})`;
  const required = key.required === true ? '!' : '';
  const fallback = key.default === undefined ? '' : ` = ${JSON.stringify(key.default)}`;
  return `${key.kind}${listed}${required}${fallback}`;
}

const under = (at: string): string => (at === '' ? '' : `${at}.`);

function structurePaths(of: Structure, at: string, found: Entry<string>[]): Entry<string>[] {
  if (of.kind === 'plain') {
    return keyPaths(of.keys, under(at), found);
  }
  for (const variant of of.variants) {
    const path = `${at}<${variant.when ?? OTHERWISE}>`;
    found.push([path, of.kind]);
    keyPaths(variant.keys, `${path}.`, found);
  }
  return found;
}

function keyPaths(
  keys: Readonly<Record<string, Key>>,
  prefix: string,
  found: Entry<string>[],
): Entry<string>[] {
  for (const [name, key] of Object.entries(keys)) {
    const path = `${prefix}${name}`;
    found.push([path, described(key)]);
    if (key.of !== undefined) {
      structurePaths(key.of, key.kind === 'parts' ? `${path}[]` : path, found);
    }
  }
  return found;
}

export const cardPaths = (structure: Structure): Record<string, string> =>
  Object.fromEntries(structurePaths(structure, '', []).toSorted(byName));

function slotPaths(
  slots: Readonly<Record<string, SlotSpec>>,
  prefix: string,
  found: Entry<string>[],
): Entry<string>[] {
  for (const [name, spec] of Object.entries(slots)) {
    const path = `${prefix}${name}`;
    found.push([path, spec.required === true ? `${spec.kind}!` : spec.kind]);
    slotPaths(spec.fields ?? {}, `${path}.`, found);
  }
  return found;
}

function shapePaths(): Record<string, string> {
  const shapes = readShapes();
  const all = withShapes(
    'shapes.yaml',
    {
      card: {},
      slots: Object.fromEntries(Object.keys(shapes).map((name) => [name, { shape: name }])),
    },
    shapes,
  );
  return Object.fromEntries(slotPaths(all.slots ?? {}, '', []).toSorted(byName));
}

function themeVariables(): string[] {
  const written = Object.values(THEMES).flatMap((theme) =>
    Object.values(buildTheme(theme)).flatMap((definition) =>
      [definition, definition.modes.light, definition.modes.dark].flatMap((variables) =>
        Object.keys(variables),
      ),
    ),
  );
  return unique(written.filter((name) => name.startsWith('mnml-')));
}

export function integrationOf(constants: string, websocket: string): Surface['integration'] {
  const domain = /^DOMAIN: Final = "([^"]+)"$/m.exec(constants)?.[1];
  if (domain === undefined) {
    throw new Error('const.py names no DOMAIN');
  }
  const options = [...constants.matchAll(/^CONF_\w+: Final = "([^"]+)"$/gm)].map(
    (match) => match[1] ?? '',
  );
  const commands = [...websocket.matchAll(/vol\.Required\("type"\): f"\{DOMAIN\}\/([^"]+)"/g)].map(
    (match) => `${domain}/${match[1] ?? ''}`,
  );
  const declared = websocket.match(/@websocket_api\.websocket_command\(/g)?.length ?? 0;
  if (commands.length !== declared) {
    throw new Error(
      `websocket.py has ${declared} @websocket_api.websocket_command decorators, but ${commands.length} types written as vol.Required("type"): f"{DOMAIN}/<name>"`,
    );
  }
  return { domain, options: unique(options), commands: unique(commands) };
}

const integration = (): Surface['integration'] =>
  integrationOf(
    readFileSync(resolve(INTEGRATION, 'const.py'), 'utf8'),
    readFileSync(resolve(INTEGRATION, 'websocket.py'), 'utf8'),
  );

const HOME_TYPES: Readonly<Record<string, Readonly<Record<string, true>>>> = {
  Home: HOME_KEYS,
  Room: ROOM_KEYS,
  Person: PERSON_KEYS,
  Car: CAR_KEYS,
  System: SYSTEM_KEYS,
  SectionTitles: SECTION_TITLES_KEYS,
};

export function surface(): Surface {
  return {
    format: FORMAT,
    cards: Object.fromEntries(
      Object.entries(CARD_STRUCTURES)
        .toSorted(byName)
        .map(([type, structure]) => [type, cardPaths(structure)]),
    ),
    templates: Object.fromEntries(
      Object.entries(SHIPPED)
        .toSorted(byName)
        .map(([name, template]) => [
          name,
          Object.fromEntries(slotPaths(template.slots ?? {}, '', []).toSorted(byName)),
        ]),
    ),
    shapes: shapePaths(),
    theme: {
      names: unique(Object.values(THEMES).map((theme) => theme.name)),
      variables: themeVariables(),
    },
    integration: integration(),
    home: Object.fromEntries(
      Object.entries(HOME_TYPES)
        .toSorted(byName)
        .map(([name, keys]) => [name, unique(Object.keys(keys))]),
    ),
  };
}

const isString = (value: unknown): value is string => typeof value === 'string';

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

function isRecordOf<T>(
  value: unknown,
  item: (inner: unknown) => inner is T,
): value is Record<string, T> {
  return isMapping(value) && Object.values(value).every(item);
}

const isPaths = (value: unknown): value is Record<string, string> => isRecordOf(value, isString);

function isSurface(value: unknown): value is Surface {
  if (!isMapping(value)) {
    return false;
  }
  const { format, cards, templates, shapes, theme, integration: integrated, home } = value;
  return (
    format === FORMAT &&
    isRecordOf(cards, isPaths) &&
    isRecordOf(templates, isPaths) &&
    isPaths(shapes) &&
    isMapping(theme) &&
    isStrings(theme['names']) &&
    isStrings(theme['variables']) &&
    isMapping(integrated) &&
    isString(integrated['domain']) &&
    isStrings(integrated['options']) &&
    isStrings(integrated['commands']) &&
    isRecordOf(home, isStrings)
  );
}

export function readSurface(text: string): Surface | undefined {
  const parsed: unknown = JSON.parse(text);
  if (isMapping(parsed) && parsed['format'] !== FORMAT) {
    return undefined;
  }
  if (!isSurface(parsed)) {
    throw new Error('this is no record of the public interface');
  }
  return parsed;
}

interface Group {
  label: string;
  noun: string | undefined;
  items: ReadonlyMap<string, string>;
}

const listed = (names: readonly string[]): Map<string, string> =>
  new Map(names.map((name) => [name, '']));

function groups(of: Surface): Map<string, Group> {
  const all: Group[] = [
    ...Object.entries(of.cards).map(([type, keys]) => ({
      label: `card \`${type}\``,
      noun: 'key',
      items: new Map(Object.entries(keys)),
    })),
    ...Object.entries(of.templates).map(([name, slots]) => ({
      label: `template \`${name}\``,
      noun: 'slot',
      items: new Map(Object.entries(slots)),
    })),
    { label: 'shape', noun: undefined, items: new Map(Object.entries(of.shapes)) },
    { label: 'theme name', noun: undefined, items: listed(of.theme.names) },
    { label: 'theme variable', noun: undefined, items: listed(of.theme.variables) },
    { label: 'integration domain', noun: undefined, items: listed([of.integration.domain]) },
    { label: 'integration option', noun: undefined, items: listed(of.integration.options) },
    { label: 'websocket command', noun: undefined, items: listed(of.integration.commands) },
    ...Object.entries(of.home).map(([name, keys]) => ({
      label: `home type \`${name}\``,
      noun: 'key',
      items: listed(keys),
    })),
  ];
  return new Map(all.map((group) => [group.label, group]));
}

function line(group: Group, item: string, value: string): string {
  const named =
    group.noun === undefined
      ? `${group.label} \`${item}\``
      : `${group.label}, ${group.noun} \`${item}\``;
  return value === '' ? named : `${named} (\`${value}\`)`;
}

function gone(from: ReadonlyMap<string, Group>, to: ReadonlyMap<string, Group>): string[] {
  return [...from.values()].flatMap((group) => {
    const other = to.get(group.label);
    if (other === undefined) {
      return [group.label];
    }
    return [...group.items]
      .filter(([item]) => !other.items.has(item))
      .map(([item, value]) => line(group, item, value));
  });
}

export function compare(before: Surface, after: Surface): Changes {
  const old = groups(before);
  const now = groups(after);
  const changed = [...old.values()].flatMap((group) =>
    [...group.items].flatMap(([item, value]) => {
      const next = now.get(group.label)?.items.get(item);
      return next === undefined || next === value
        ? []
        : [`${line(group, item, '')}: \`${value}\` to \`${next}\``];
    }),
  );
  return { removed: gone(old, now), changed, added: gone(now, old) };
}

export function notes(tag: string, recorded: string | undefined, after: Surface): string {
  const title = `## Interface changes since ${tag}`;
  if (recorded === undefined) {
    return `${title}\n\n${tag} records no \`interface.json\`, so there is nothing to compare.\n`;
  }
  const before = readSurface(recorded);
  if (before === undefined) {
    return `${title}\n\nThe interface record's format changed since ${tag}, so nothing is listed: compare its \`interface.json\` with this one by hand.\n`;
  }
  const { removed, changed, added } = compare(before, after);
  const sections: Entry<readonly string[]>[] = [
    ['Removed', removed],
    ['Changed', changed],
    ['Added', added],
  ];
  const written = sections
    .filter(([, lines]) => lines.length > 0)
    .map(([heading, lines]) => `### ${heading}\n\n${lines.map((one) => `- ${one}`).join('\n')}\n`);
  return written.length === 0
    ? `${title}\n\nNone: the public interface is as ${tag} left it.\n`
    : `${title}\n\n${written.join('\n')}`;
}
