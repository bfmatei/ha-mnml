import type { Color, EntityRule, StateRule } from '../contract/cards.ts';

import { hasValue, isUnavailable, stateOf } from './hass.ts';
import type { HassEntity, HomeAssistant } from './hass.ts';

const ON: StateRule = { is: ['on'] };

export const UNAVAILABLE: Color = 'orange';

export function active(when: StateRule | undefined, stateObj: HassEntity | undefined): boolean {
  return hasValue(stateObj) && matches(when ?? ON, stateObj.state);
}

export function tint(
  color: Color | undefined,
  when: StateRule | undefined,
  stateObj: HassEntity | undefined,
): Color | undefined {
  if (isUnavailable(stateObj)) {
    return UNAVAILABLE;
  }
  return active(when, stateObj) ? color : undefined;
}

const NUMBER = /^-?\d+(?:\.\d+)?$/;

export function normalise(state: string): string {
  return NUMBER.test(state) ? String(Number(state)) : state.toLowerCase().replaceAll('-', '');
}

export function matches(rule: StateRule | undefined, state: string | undefined): boolean {
  if (rule === undefined) {
    return true;
  }
  const value = normalise(state ?? 'unavailable');
  if (rule.is !== undefined && !rule.is.some((entry) => normalise(entry) === value)) {
    return false;
  }
  return rule.not === undefined || !rule.not.some((entry) => normalise(entry) === value);
}

export function tyreBand(
  current: number | undefined,
  target: number | undefined,
  low: number,
  warn: number,
): 'low' | 'warn' | undefined {
  if (current === undefined || current <= 0 || target === undefined) {
    return undefined;
  }
  if (current < target * low) {
    return 'low';
  }
  return current < target * warn ? 'warn' : undefined;
}

export function shown(
  hass: HomeAssistant,
  rule: EntityRule | undefined,
  entityId: string | undefined,
): boolean {
  return rule === undefined || matches(rule, stateOf(hass, rule.entity ?? entityId)?.state);
}
