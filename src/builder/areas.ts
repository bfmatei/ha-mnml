import type { DeviceEntry, EntityEntry, Registries } from '../ha/registries.ts';

export type Destination = { area: string; create?: never } | { create: string; area?: never };

export interface Suggestion {
  kind: 'device' | 'entity';
  id: string;
  name: string;
  to: Destination;
  by: 'name' | 'entities';
}

export interface AreaGroup {
  to: Destination;
  name: string;
  suggestions: readonly Suggestion[];
}

interface Phrase {
  words: readonly string[];
  to: Destination;
}

const SKIPPED = new Set(['person', 'zone', 'sun', 'device_tracker', 'update']);
const CLUSTER = 2;

export function wordsOf(text: string): string[] {
  return text
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');
}

export function newAreaId(name: string): string {
  return wordsOf(name).join('_');
}

const keyOf = (to: Destination): string =>
  to.area === undefined ? `+${to.create}` : `=${to.area}`;

function phraseAt(
  phrases: readonly Phrase[],
  words: readonly string[],
  at: number,
): Phrase | undefined {
  return phrases
    .filter((phrase) => phrase.words.every((word, index) => words[at + index] === word))
    .reduce<Phrase | undefined>(
      (best, phrase) =>
        best === undefined || phrase.words.length > best.words.length ? phrase : best,
      undefined,
    );
}

function foundIn(phrases: readonly Phrase[], text: string): Destination | undefined {
  const words = wordsOf(text);
  for (let at = 0; at < words.length; at += 1) {
    const phrase = phraseAt(phrases, words, at);
    if (phrase !== undefined) {
      return phrase.to;
    }
  }
  return undefined;
}

function destinationOf(
  texts: readonly string[],
  places: readonly (readonly Phrase[])[],
): Destination | undefined {
  for (const phrases of places) {
    for (const text of texts) {
      const to = foundIn(phrases, text);
      if (to !== undefined) {
        return to;
      }
    }
  }
  return undefined;
}

function phrasesOf(texts: readonly string[], to: Destination): Phrase[] {
  return texts
    .map((text) => ({ words: wordsOf(text), to }))
    .filter((each) => each.words.length > 0);
}

function entityTexts(entity: EntityEntry, registries: Registries): string[] {
  const friendly = registries.states[entity.entity_id]?.attributes['friendly_name'];
  return [
    entity.name ?? '',
    typeof friendly === 'string' ? friendly : '',
    entity.entity_id.slice(entity.entity_id.indexOf('.') + 1),
  ].filter((text) => text !== '');
}

function entityName(entity: EntityEntry, registries: Registries): string {
  const friendly = registries.states[entity.entity_id]?.attributes['friendly_name'];
  return entity.name ?? (typeof friendly === 'string' ? friendly : entity.entity_id);
}

const deviceName = (device: DeviceEntry): string => device.name_by_user ?? device.name ?? device.id;

function mostFound(found: readonly Destination[]): Destination | undefined {
  const counts = new Map<string, { to: Destination; count: number }>();
  for (const to of found) {
    const seen = counts.get(keyOf(to));
    counts.set(keyOf(to), { to, count: (seen?.count ?? 0) + 1 });
  }
  const ranked = [...counts.values()].toSorted((a, b) => b.count - a.count);
  const [first, second] = ranked;
  return first === undefined || first.count === second?.count ? undefined : first.to;
}

const isSubject = (entity: EntityEntry): boolean =>
  !entity.hidden &&
  (entity.entity_category ?? null) === null &&
  !SKIPPED.has(entity.entity_id.slice(0, entity.entity_id.indexOf('.')));

export function suggestAreas(registries: Registries, rooms: readonly string[]): Suggestion[] {
  const places = [
    Object.values(registries.areas).flatMap((area) =>
      phrasesOf([area.name, area.area_id, ...(area.aliases ?? [])], { area: area.area_id }),
    ),
    rooms.flatMap((room) => phrasesOf([room], { create: room })),
  ];
  const byDevice = new Map<string, EntityEntry[]>();
  for (const entity of Object.values(registries.entities)) {
    if (entity.device_id !== undefined && entity.device_id !== null) {
      byDevice.set(entity.device_id, [...(byDevice.get(entity.device_id) ?? []), entity]);
    }
  }
  const devices = Object.values(registries.devices).flatMap((device): Suggestion[] => {
    const own = byDevice.get(device.id) ?? [];
    if (
      (device.area_id ?? null) !== null ||
      device.entry_type === 'service' ||
      !own.some((entity) => (entity.area_id ?? null) === null)
    ) {
      return [];
    }
    const named = destinationOf([deviceName(device)], places);
    const to =
      named ??
      mostFound(
        own.flatMap((entity) => destinationOf(entityTexts(entity, registries), places) ?? []),
      );
    return to === undefined
      ? []
      : [
          {
            kind: 'device',
            id: device.id,
            name: deviceName(device),
            to,
            by: named === undefined ? 'entities' : 'name',
          },
        ];
  });
  const entities = Object.values(registries.entities).flatMap((entity): Suggestion[] => {
    const device = entity.device_id ?? undefined;
    if (
      (entity.area_id ?? null) !== null ||
      (device !== undefined && registries.devices[device] !== undefined) ||
      !isSubject(entity)
    ) {
      return [];
    }
    const to = destinationOf(entityTexts(entity, registries), places);
    return to === undefined
      ? []
      : [
          {
            kind: 'entity',
            id: entity.entity_id,
            name: entityName(entity, registries),
            to,
            by: 'name',
          },
        ];
  });
  const all = [...devices, ...entities];
  const created = new Map<string, number>();
  for (const { to } of all) {
    if (to.create !== undefined) {
      created.set(to.create, (created.get(to.create) ?? 0) + 1);
    }
  }
  return all.filter(
    ({ to }) => to.create === undefined || (created.get(to.create) ?? 0) >= CLUSTER,
  );
}

export function groupedByArea(
  suggestions: readonly Suggestion[],
  registries: Registries,
): AreaGroup[] {
  const existing = Object.values(registries.areas).flatMap((area): AreaGroup[] => {
    const inside = suggestions.filter(({ to }) => to.area === area.area_id);
    return inside.length === 0
      ? []
      : [{ to: { area: area.area_id }, name: area.name, suggestions: inside }];
  });
  const names = [
    ...new Set(suggestions.flatMap(({ to }) => (to.create === undefined ? [] : [to.create]))),
  ];
  const created = names.map((name): AreaGroup => ({
    to: { create: name },
    name,
    suggestions: suggestions.filter(({ to }) => to.create === name),
  }));
  return [...existing, ...created];
}

export const areaIdOf = (to: Destination): string => to.area ?? newAreaId(to.create);

export function placedRegistries(
  registries: Registries,
  suggestions: readonly Suggestion[],
): Registries {
  const created = suggestions.flatMap(({ to }) =>
    to.create === undefined ? [] : [{ area_id: newAreaId(to.create), name: to.create }],
  );
  const place = new Map(suggestions.map((each) => [`${each.kind}:${each.id}`, areaIdOf(each.to)]));
  return {
    ...registries,
    areas: {
      ...registries.areas,
      ...Object.fromEntries(created.map((area) => [area.area_id, area])),
    },
    devices: Object.fromEntries(
      Object.entries(registries.devices).map(([id, device]) => [
        id,
        place.has(`device:${id}`) ? { ...device, area_id: place.get(`device:${id}`) } : device,
      ]),
    ),
    entities: Object.fromEntries(
      Object.entries(registries.entities).map(([id, entity]) => [
        id,
        place.has(`entity:${id}`) ? { ...entity, area_id: place.get(`entity:${id}`) } : entity,
      ]),
    ),
  };
}
