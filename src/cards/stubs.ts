import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';

type Stub = (hass: HomeAssistant) => Record<string, Value>;

const SLIDER_FOR: Readonly<Record<string, string>> = {
  light: 'brightness',
  media_player: 'volume',
  number: 'value',
  climate: 'temperature',
};

function first(hass: HomeAssistant, domains: readonly string[], fallback: string): string {
  return (
    Object.keys(hass.states).find((id) => domains.includes(id.split('.')[0] ?? '')) ?? fallback
  );
}

const domainOf = (id: string): string => id.split('.')[0] ?? '';

export const STUBS: Readonly<Record<string, Stub>> = {
  'mnml-template-card': () => ({
    template: 'section-heading',
    slots: { title: 'MNML', icon: 'mdi:shape' },
  }),
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
