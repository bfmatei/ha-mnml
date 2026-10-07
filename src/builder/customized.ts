import type { CarChoice, PersonChoice, RoomChoice, SystemChoice } from '../contract/builder.ts';
import { isMapping } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';
import { overridesOf } from '../editors/fill.ts';
import { discover } from '../templates/discover.ts';
import type { Registries } from '../templates/discover.ts';

import { personOf } from './person.ts';

const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function slotsIn(config: Record<string, Value>): Record<string, Value> | undefined {
  const slots = config['slots'];
  return isMapping(slots) ? slots : undefined;
}

function kept<T extends object>(
  choice: T,
  slots: Record<string, Value> | undefined,
): T & { slots?: Record<string, Value> } {
  return slots === undefined || Object.keys(slots).length === 0 ? choice : { ...choice, slots };
}

export function roomFrom(room: RoomChoice, config: Record<string, Value>): RoomChoice {
  const area = config['area'];
  return kept(
    { area: typeof area === 'string' && area !== '' ? area : room.area },
    slotsIn(config),
  );
}

export function personFrom(
  person: PersonChoice,
  config: Record<string, Value>,
  registries: Registries,
): PersonChoice {
  return kept(
    { entity: person.entity },
    overridesOf(personOf(registries, person.entity), slotsIn(config) ?? {}),
  );
}

export function systemFrom(
  choice: SystemChoice,
  config: Record<string, Value>,
  registries: Registries,
  templates: Templates,
): SystemChoice {
  const slots = slotsIn(config);
  const template = templates[choice.template];
  if (slots === undefined || template === undefined) {
    return { template: choice.template };
  }
  return kept(
    { template: choice.template },
    overridesOf(discover(template, undefined, registries), slots),
  );
}

export function carFrom(config: Record<string, Value>): CarChoice | undefined {
  const slots = slotsIn(config) ?? {};
  const key = slots['key'];
  if (typeof key !== 'string' || !NAME.test(key)) {
    return undefined;
  }
  return {
    key,
    slots: Object.fromEntries(Object.entries(slots).filter(([name]) => name !== 'key')),
  };
}
