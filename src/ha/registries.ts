import type { Registries } from '../templates/discover.ts';

import type { HomeAssistant } from './hass.ts';

export function registriesOf(hass: HomeAssistant | undefined): Registries {
  return {
    areas: hass?.areas ?? {},
    devices: hass?.devices ?? {},
    entities: hass?.entities ?? {},
    states: hass?.states ?? {},
  };
}
