import { isMapping } from '../contract/templates.ts';
import type { SlotSpec, Template, Templates, Value } from '../contract/templates.ts';
import type { HassConnection, HomeAssistant } from '../ha/hass.ts';
import type { Registries } from '../ha/registries.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { onShared, resolvedTemplates, sharedTemplates } from '../store/store.ts';
import type { SharedState } from '../store/store.ts';
import { filled } from '../templates/expand.ts';
import { OWNER } from '../templates/families.ts';
import { bestFit } from '../templates/rank.ts';
import type { Fit, Scope } from '../templates/rank.ts';
import { rolesOf } from '../templates/roles.ts';

type Stub = (hass: HomeAssistant) => Record<string, Value>;

const TEMPLATE_CARD = 'custom:mnml-template-card';
const FIRST_TILE = 'room';
const WAIT = 5000;

export const placeOf = (template: Template, registries: Registries): Fit | undefined =>
  bestFit(
    template,
    [{}, ...Object.keys(registries.areas).map((area): Scope => ({ area }))],
    registries,
  );

function foreign(spec: SlotSpec, value: Value, states: Readonly<Record<string, unknown>>): boolean {
  switch (spec.kind) {
    case 'entity': {
      return typeof value === 'string' && !Object.hasOwn(states, value);
    }
    case 'entities': {
      return (
        Array.isArray(value) &&
        value.some((id) => typeof id === 'string' && !Object.hasOwn(states, id))
      );
    }
    case 'object': {
      return (
        isMapping(value) &&
        Object.entries(spec.fields ?? {}).some(([key, inner]) => {
          const held = value[key];
          return held !== undefined && foreign(inner, held, states);
        })
      );
    }
    case 'objects': {
      return (
        Array.isArray(value) &&
        value.some((item) => foreign({ ...spec, kind: 'object' }, item, states))
      );
    }
    case 'text':
    case 'texts':
    case 'number':
    case 'icon':
    case 'flag': {
      return false;
    }
  }
}

export function startOf(
  name: string,
  template: Template,
  hass: HomeAssistant | undefined,
): Record<string, Value> {
  const place = hass === undefined ? undefined : placeOf(template, registriesOf(hass));
  if (place === undefined) {
    const states = hass?.states ?? {};
    const slots = template.slots ?? {};
    const usable = Object.entries(template.example ?? {}).filter(([slot, value]) => {
      const spec = slots[slot];
      return spec !== undefined && !foreign(spec, value, states);
    });
    return { type: TEMPLATE_CARD, template: name, slots: Object.fromEntries(usable) };
  }
  return place.scope.area === undefined
    ? { type: TEMPLATE_CARD, template: name }
    : { type: TEMPLATE_CARD, template: name, area: place.scope.area };
}

export function previewOf(
  name: string,
  template: Template,
  hass: HomeAssistant | undefined,
): Record<string, Value> {
  const place = hass === undefined ? undefined : placeOf(template, registriesOf(hass));
  const example = template.example ?? {};
  if (place === undefined) {
    return template.example === undefined
      ? { type: TEMPLATE_CARD, template: name }
      : { type: TEMPLATE_CARD, template: name, slots: example };
  }
  const lent = Object.fromEntries(
    Object.entries(template.slots ?? {}).flatMap(([slot, spec]) => {
      const value = example[slot];
      return spec.required === true && !filled(place.found[slot]) && value !== undefined
        ? [[slot, value]]
        : [];
    }),
  );
  const lends = Object.keys(lent).length > 0;
  const area = place.scope.area;
  if (area === undefined) {
    return lends
      ? { type: TEMPLATE_CARD, template: name, slots: { ...place.found, ...lent } }
      : { type: TEMPLATE_CARD, template: name };
  }
  return lends
    ? { type: TEMPLATE_CARD, template: name, area, slots: lent }
    : { type: TEMPLATE_CARD, template: name, area };
}

export function templateStub(templates: Templates, hass: HomeAssistant): Record<string, Value> {
  const roles = rolesOf(templates);
  const tiles = Object.keys(templates)
    .filter((name) => roles[name] === 'tile')
    .toSorted((a, b) => Number(b === FIRST_TILE) - Number(a === FIRST_TILE) || a.localeCompare(b));
  const registries = registriesOf(hass);
  for (const name of tiles) {
    const template = templates[name];
    const place = template === undefined ? undefined : placeOf(template, registries);
    const area = place?.scope.area;
    if (place?.complete === true) {
      return area === undefined ? { template: name } : { template: name, area };
    }
  }
  return { template: '' };
}

function settled(connection: HassConnection): Promise<SharedState> {
  const now = sharedTemplates(connection);
  if (now.status !== 'waiting') {
    return Promise.resolve(now);
  }
  return new Promise((resolve) => {
    const done = (state: SharedState): void => {
      stop();
      clearTimeout(timer);
      resolve(state);
    };
    const stop = onShared(() => {
      const next = sharedTemplates(connection);
      if (next.status !== 'waiting') {
        done(next);
      }
    });
    const timer = setTimeout(() => {
      done(sharedTemplates(connection));
    }, WAIT);
  });
}

export async function templateCardStub(hass: HomeAssistant): Promise<Record<string, Value>> {
  const names = Object.keys(OWNER);
  await SHIPPED_TEMPLATES.need(names);
  const shared = await settled(hass.connection);
  return templateStub(resolvedTemplates(shared, SHIPPED_TEMPLATES.templates()), hass);
}

const SLIDER_FOR: Readonly<Record<string, string>> = {
  light: 'brightness',
  media_player: 'volume',
  number: 'value',
  climate: 'temperature',
  cover: 'position',
  fan: 'percentage',
  humidifier: 'humidity',
};

function first(hass: HomeAssistant, domains: readonly string[], fallback: string): string {
  return (
    Object.keys(hass.states).find((id) => domains.includes(id.split('.')[0] ?? '')) ?? fallback
  );
}

const domainOf = (id: string): string => id.split('.')[0] ?? '';

export const STUBS: Readonly<Record<string, Stub>> = {
  'mnml-heading-card': () => ({ title: 'Heading', icon: 'mdi:home' }),
  'mnml-list-card': (hass) => ({ rows: [{ entity: first(hass, ['sensor'], 'sensor.example') }] }),
  'mnml-agenda-card': (hass) => ({
    sources: [{ entity: first(hass, ['calendar'], 'calendar.example'), kind: 'episodes' }],
  }),
  'mnml-messages-card': (hass) => ({
    entity: first(hass, ['sensor'], 'sensor.example'),
    clear: first(hass, ['script'], 'script.example'),
  }),
  'mnml-clients-card': (hass) => ({
    entity: first(hass, ['sensor'], 'sensor.example'),
    networks: [{ name: 'Home', icon: 'mdi:lan', subnet: '192.168.1.0/24' }],
  }),
  'mnml-glances-card': (hass) => ({
    items: [{ entity: first(hass, ['weather', 'light'], 'light.example') }],
  }),
  'mnml-weather-card': (hass) => ({ entity: first(hass, ['weather'], 'weather.example') }),
  'mnml-report-card': (hass) => ({ entity: first(hass, ['sensor'], 'sensor.example') }),
  'mnml-button-card': (hass) => ({
    entity: first(hass, ['button'], 'button.example'),
    service: 'button.press',
  }),
  'mnml-select-card': (hass): Record<string, Value> => {
    const id = first(hass, ['select', 'climate'], 'select.example');
    return domainOf(id) === 'climate' ? { entity: id, attribute: 'hvac_modes' } : { entity: id };
  },
  'mnml-slider-card': (hass) => {
    const id = first(hass, Object.keys(SLIDER_FOR), 'light.example');
    return { entity: id, slider: SLIDER_FOR[domainOf(id)] ?? 'brightness' };
  },
  'mnml-entity-card': (hass) => ({
    entity: first(hass, ['light', 'switch', 'sensor'], 'light.example'),
  }),
  'mnml-header-card': () => ({ name: 'Pop-up', icon: 'mdi:home' }),
  'mnml-tile-card': () => ({ name: 'Room', icon: 'mdi:sofa', popup: '#room' }),
  'mnml-media-card': (hass) => ({ entity: first(hass, ['media_player'], 'media_player.example') }),
  'mnml-car-plan-card': () => ({
    doors: [
      'binary_sensor.front_left_door',
      'binary_sensor.front_right_door',
      'binary_sensor.rear_left_door',
      'binary_sensor.rear_right_door',
    ],
    hood: 'binary_sensor.hood',
    tailgate: 'binary_sensor.tailgate',
    windows: [
      'sensor.front_left_window',
      'sensor.front_right_window',
      'sensor.rear_left_window',
      'sensor.rear_right_window',
    ],
    tyres: [
      'sensor.front_left_tyre',
      'sensor.front_right_tyre',
      'sensor.rear_left_tyre',
      'sensor.rear_right_tyre',
    ],
    tyre_targets: [
      'sensor.front_left_target',
      'sensor.front_right_target',
      'sensor.rear_left_target',
      'sensor.rear_right_target',
    ],
    tyre_low_share: 0.8,
    tyre_warn_share: 0.9,
  }),
  'mnml-popups-card': () => ({ width: '560px' }),
};
