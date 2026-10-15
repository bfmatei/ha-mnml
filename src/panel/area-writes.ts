import type { Suggestion } from '../builder/areas.ts';
import { field } from '../ha/field.ts';
import type { Registries } from '../ha/registries.ts';

import type { Call } from './building.ts';
import { messageOf } from './message.ts';

interface Previous {
  id: string;
  area: string | null;
}

export interface AreaUndo {
  created: readonly string[];
  devices: readonly Previous[];
  entities: readonly Previous[];
}

export interface Assigned {
  undo: AreaUndo;
  failure: string | undefined;
}

const firstFailure = (results: readonly PromiseSettledResult<unknown>[]): string | undefined => {
  const failed = results.find((result) => result.status === 'rejected');
  return failed === undefined ? undefined : messageOf(failed.reason);
};

export function isEmptyUndo(undo: AreaUndo): boolean {
  return undo.created.length === 0 && undo.devices.length === 0 && undo.entities.length === 0;
}

function earliest(before: readonly Previous[], after: readonly Previous[]): Previous[] {
  const known = new Set(before.map(({ id }) => id));
  return [...before, ...after.filter(({ id }) => !known.has(id))];
}

export function joinedUndo(first: AreaUndo | undefined, then: AreaUndo): AreaUndo {
  return first === undefined
    ? then
    : {
        created: [...first.created, ...then.created],
        devices: earliest(first.devices, then.devices),
        entities: earliest(first.entities, then.entities),
      };
}

export async function assignAreas(
  call: Call,
  suggestions: readonly Suggestion[],
  registries: Registries,
): Promise<Assigned> {
  const names = [...new Set(suggestions.flatMap(({ to }) => to.create ?? []))];
  const made = await Promise.allSettled(
    names.map(async (name): Promise<[string, string]> => {
      const id = field(await call({ type: 'config/area_registry/create', name }), 'area_id');
      if (typeof id !== 'string') {
        throw new TypeError(`Home Assistant made ${name} without an id.`);
      }
      return [name, id];
    }),
  );
  const ids = new Map(
    made.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
  );
  const created = [...ids.values()];
  const failure = firstFailure(made);
  if (failure !== undefined) {
    return { undo: { created, devices: [], entities: [] }, failure };
  }
  const placed = await Promise.allSettled(
    suggestions.map(async (each): Promise<Suggestion> => {
      const area_id = each.to.area ?? ids.get(each.to.create);
      await (each.kind === 'device'
        ? call({ type: 'config/device_registry/update', device_id: each.id, area_id })
        : call({ type: 'config/entity_registry/update', entity_id: each.id, area_id }));
      return each;
    }),
  );
  const done = placed.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const previous = (kind: Suggestion['kind']): Previous[] =>
    done
      .filter((each) => each.kind === kind)
      .map(({ id }) => ({
        id,
        area:
          (kind === 'device'
            ? registries.devices[id]?.area_id
            : registries.entities[id]?.area_id) ?? null,
      }));
  return {
    undo: { created, devices: previous('device'), entities: previous('entity') },
    failure: firstFailure(placed),
  };
}

export async function undoAreas(call: Call, undo: AreaUndo): Promise<string | undefined> {
  const restored = await Promise.allSettled([
    ...undo.devices.map(({ id, area }) =>
      call({ type: 'config/device_registry/update', device_id: id, area_id: area }),
    ),
    ...undo.entities.map(({ id, area }) =>
      call({ type: 'config/entity_registry/update', entity_id: id, area_id: area }),
    ),
  ]);
  const failure = firstFailure(restored);
  if (failure !== undefined) {
    return failure;
  }
  return firstFailure(
    await Promise.allSettled(
      undo.created.map((area_id) => call({ type: 'config/area_registry/delete', area_id })),
    ),
  );
}
