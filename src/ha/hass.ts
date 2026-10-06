import type { EntityId, ServiceName } from '../contract/entities.ts';
import type { AreaEntry } from '../templates/discover.ts';

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Readonly<Record<string, unknown>>;
  last_changed: string;
  last_updated: string;
}

interface EntityRegistryEntry {
  entity_id: string;
  name?: string | null;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string;
  translation_key?: string | null;
  entity_category?: string | null;
  hidden?: boolean;
  display_precision?: number;
}

interface DeviceRegistryEntry {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  serial_number?: string | null;
}

interface ServiceTarget {
  entity_id: string | string[];
}

export interface HassConnection {
  sendMessagePromise<T>(message: { type: string } & Record<string, unknown>): Promise<T>;
  subscribeEvents(
    callback: (event: { data: unknown }) => void,
    eventType: string,
  ): Promise<() => Promise<void>>;
  subscribeMessage<T>(
    callback: (message: T) => void,
    message: { type: string } & Record<string, unknown>,
    options?: { resubscribe?: boolean },
  ): Promise<() => Promise<void>>;
  addEventListener(type: 'ready', listener: () => void): void;
}

export interface HomeAssistant {
  states: Readonly<Record<string, HassEntity>>;
  areas: Readonly<Record<string, AreaEntry>>;
  entities: Readonly<Record<string, EntityRegistryEntry>>;
  devices: Readonly<Record<string, DeviceRegistryEntry>>;
  locale: { language: string };
  formatEntityState(stateObj: HassEntity, state?: string): string;
  formatEntityAttributeValue(stateObj: HassEntity, attribute: string, value?: unknown): string;
  callApi(method: 'GET', path: string): Promise<unknown>;
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: ServiceTarget,
  ): Promise<unknown>;
  connection: HassConnection;
  user?: { is_admin: boolean };
}

const NO_VALUE = new Set(['', 'unknown', 'unavailable', 'none']);

export function stateOf(hass: HomeAssistant, entityId: string | undefined): HassEntity | undefined {
  return entityId === undefined ? undefined : hass.states[entityId];
}

function domainOf(entityId: string): string {
  return entityId.split('.')[0] ?? '';
}

export function hasValue(stateObj: HassEntity | undefined): stateObj is HassEntity {
  return stateObj !== undefined && !NO_VALUE.has(stateObj.state);
}

export function isUnavailable(
  stateObj: HassEntity | undefined,
): stateObj is HassEntity & { state: 'unavailable' } {
  return stateObj !== undefined && stateObj.state === 'unavailable';
}

export function isOn(stateObj: HassEntity | undefined): stateObj is HassEntity {
  return stateObj !== undefined && stateObj.state === 'on';
}

export function numberAttribute(
  stateObj: HassEntity | undefined,
  name: string,
): number | undefined {
  const value = stateObj?.attributes[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function stringAttribute(
  stateObj: HassEntity | undefined,
  name: string,
): string | undefined {
  const value = stateObj?.attributes[name];
  return typeof value === 'string' ? value : undefined;
}

export function listAttribute(stateObj: HassEntity | undefined, name: string): string[] {
  const value = stateObj?.attributes[name];
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

export function numericState(stateObj: HassEntity | undefined): number | undefined {
  if (!hasValue(stateObj)) {
    return undefined;
  }
  const value = Number(stateObj.state);
  return Number.isFinite(value) ? value : undefined;
}

export function callService(
  hass: HomeAssistant,
  entityId: EntityId,
  service: ServiceName,
  data?: Record<string, unknown>,
): Promise<unknown> {
  const [domain, name] = service.split('.');
  return hass.callService(domain ?? '', name ?? '', data, { entity_id: entityId });
}

interface Notifier {
  notify(message: string): void;
}

export function settled(host: Notifier, action: Promise<unknown>): Promise<void> {
  return action.then(
    () => undefined,
    (error: unknown) => {
      host.notify(error instanceof Error ? error.message : String(error));
    },
  );
}

export function run(host: Notifier, action: Promise<unknown>): void {
  void settled(host, action);
}

export function toggleEntity(hass: HomeAssistant, entityId: EntityId): Promise<unknown> {
  const stateObj = stateOf(hass, entityId);
  switch (domainOf(entityId)) {
    case 'lock':
      return callService(
        hass,
        entityId,
        stateObj?.state === 'locked' ? 'lock.unlock' : 'lock.lock',
      );
    case 'climate':
      return callService(
        hass,
        entityId,
        stateObj?.state === 'off' ? 'climate.turn_on' : 'climate.turn_off',
      );
    default:
      return callService(hass, entityId, 'homeassistant.toggle');
  }
}
