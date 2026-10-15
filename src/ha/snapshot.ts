import { knownEnergy } from './energy.ts';
import type { HomeAssistant } from './hass.ts';
import type { Registries } from './registries.ts';

export function registriesOf(hass: HomeAssistant | undefined): Registries {
  const energy = knownEnergy(hass?.connection);
  return {
    areas: hass?.areas ?? {},
    devices: hass?.devices ?? {},
    entities: hass?.entities ?? {},
    states: hass?.states ?? {},
    ...(energy === undefined ? {} : { energy }),
  };
}
