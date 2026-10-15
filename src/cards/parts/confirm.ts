import type { StateRule } from '../../contract/cards.ts';
import type { EntityId } from '../../contract/entities.ts';
import { stateOf } from '../../ha/hass.ts';
import type { HomeAssistant } from '../../ha/hass.ts';
import { holds } from '../../ha/rules.ts';
import type { Host } from '../base.ts';

const ARMED_FOR = 3000;

const armed = new WeakMap<Host, Map<object, () => void>>();

export function asks(
  hass: HomeAssistant,
  rule: StateRule | undefined,
  entityId: EntityId,
): boolean {
  return rule !== undefined && holds(rule, stateOf(hass, entityId));
}

export function isArmed(host: Host, what: object): boolean {
  return armed.get(host)?.has(what) === true;
}

function arm(host: Host, what: object): void {
  const mine = armed.get(host) ?? new Map<object, () => void>();
  armed.set(host, mine);
  const timer = setTimeout(() => {
    cancel();
    host.refresh();
  }, ARMED_FOR);
  const cancel = (): void => {
    clearTimeout(timer);
    unregister();
    mine.delete(what);
  };
  const unregister = host.register(cancel);
  mine.set(what, cancel);
  host.refresh();
}

export function confirmed(host: Host, what: object, asked: boolean, act: () => void): void {
  const cancel = armed.get(host)?.get(what);
  if (asked && cancel === undefined) {
    arm(host, what);
    return;
  }
  if (cancel !== undefined) {
    cancel();
    host.refresh();
  }
  act();
}
