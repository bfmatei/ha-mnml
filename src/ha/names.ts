import type { HassEntity, HomeAssistant } from './hass.ts';

interface Naming {
  name?: string;
  label?: 'device';
  strip?: string;
  strip_word?: string;
}

function friendlyName(stateObj: HassEntity | undefined, entityId: string): string {
  const name = stateObj?.attributes['friendly_name'];
  return typeof name === 'string' && name !== '' ? name : entityId;
}

function deviceOf(
  hass: HomeAssistant,
  entityId: string,
): HomeAssistant['devices'][string] | undefined {
  const deviceId = hass.entities[entityId]?.device_id;
  return deviceId === undefined || deviceId === null ? undefined : hass.devices[deviceId];
}

function deviceName(hass: HomeAssistant, entityId: string): string | undefined {
  const device = deviceOf(hass, entityId);
  return device?.name_by_user ?? device?.name ?? undefined;
}

export function deviceSerial(hass: HomeAssistant, entityId: string): string | undefined {
  return deviceOf(hass, entityId)?.serial_number ?? undefined;
}

export function entityName(hass: HomeAssistant, entityId: string): string {
  const friendly = friendlyName(hass.states[entityId], entityId);
  const registered = hass.entities[entityId]?.name;
  if (typeof registered === 'string' && registered !== '') {
    return registered;
  }
  const device = deviceName(hass, entityId);
  if (device !== undefined && friendly.startsWith(`${device} `)) {
    return friendly.slice(device.length + 1);
  }
  return friendly;
}

function stripped(name: string, naming: Naming): string {
  const withoutSuffix = naming.strip === undefined ? name : name.replace(naming.strip, '');
  if (naming.strip_word === undefined) {
    return withoutSuffix;
  }
  return withoutSuffix.replace(new RegExp(` ?${naming.strip_word}s?(?= |$)`, 'i'), '');
}

export function nameOf(hass: HomeAssistant, entityId: string, naming: Naming): string {
  if (naming.name !== undefined) {
    return naming.name;
  }
  const name =
    naming.label === 'device'
      ? (deviceName(hass, entityId) ?? entityName(hass, entityId))
      : entityName(hass, entityId);
  return stripped(name, naming).trim();
}

export function cardName(
  hass: HomeAssistant,
  entityId: string | undefined,
  naming: Naming,
): string {
  return entityId === undefined ? (naming.name ?? '') : nameOf(hass, entityId, naming);
}
