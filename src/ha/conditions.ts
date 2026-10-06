import type { Condition } from '../contract/cards.ts';

import { stateOf } from './hass.ts';
import type { HomeAssistant } from './hass.ts';

function statesOf(value: string | readonly string[] | undefined): readonly string[] {
  if (value === undefined) {
    return [];
  }
  return typeof value === 'string' ? [value] : value;
}

function holds(hass: HomeAssistant, condition: Condition): boolean {
  const state = stateOf(hass, condition.entity)?.state ?? 'unavailable';
  return condition.state === undefined
    ? !statesOf(condition.state_not).includes(state)
    : statesOf(condition.state).includes(state);
}

export function visible(
  hass: HomeAssistant,
  conditions: readonly Condition[] | undefined,
): boolean {
  return (conditions ?? []).every((condition) => holds(hass, condition));
}

function isStates(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

export function isCondition(value: unknown): value is Condition {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = new Map(Object.entries(value));
  const state = record.get('state');
  const stateNot = record.get('state_not');
  return (
    record.get('condition') === 'state' &&
    typeof record.get('entity') === 'string' &&
    (state === undefined ? isStates(stateNot) : stateNot === undefined && isStates(state))
  );
}
