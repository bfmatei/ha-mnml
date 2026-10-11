import type { MdiIcon } from '../contract/entities.ts';
import type { Template, Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';

export interface Starter {
  label: string;
  description: string;
  icon: MdiIcon;
  make: (name: string, hass: HomeAssistant | undefined) => Template;
}

function sample(hass: HomeAssistant | undefined, domain: string, deviceClass?: string): string {
  const states = hass?.states ?? {};
  const found = Object.keys(states).find((id) => {
    if (!id.startsWith(`${domain}.`)) {
      return false;
    }
    const wanted: unknown = states[id]?.attributes['device_class'];
    return deviceClass === undefined || wanted === deviceClass;
  });
  return (
    found ?? Object.keys(states).find((id) => id.startsWith(`${domain}.`)) ?? `${domain}.example`
  );
}

export const STARTERS: readonly Starter[] = [
  {
    label: 'A tile',
    description:
      'A name and an icon, a few values and chips, and a pop-up that opens when it is tapped.',
    icon: 'mdi:card-outline',
    make: (name, hass) => ({
      card: {
        type: 'custom:mnml-tile-card',
        name: 'My tile',
        icon: 'mdi:home-outline',
        popup: `#${name}`,
        state: [
          { id: 'temperature', entity: sample(hass, 'sensor', 'temperature'), icon: true },
          { id: 'humidity', entity: sample(hass, 'sensor', 'humidity'), icon: true },
        ],
        chips: [
          {
            id: 'door',
            type: 'indicator',
            entity: sample(hass, 'binary_sensor', 'door'),
            color: 'orange',
          },
        ],
      },
      popups: [
        {
          id: 'popup',
          hash: `#${name}`,
          cards: [
            {
              id: 'header',
              type: 'custom:mnml-header-card',
              name: 'My tile',
              icon: 'mdi:home-outline',
            },
          ],
        },
      ],
    }),
  },
  {
    label: 'A list',
    description:
      'A heading and one row for each thing you want to see: a value, a battery, a status.',
    icon: 'mdi:format-list-bulleted',
    make: (_name, hass) => ({
      card: {
        type: 'custom:mnml-list-card',
        title: 'My list',
        icon: 'mdi:format-list-bulleted',
        rows: [
          { id: 'first', entity: sample(hass, 'sensor', 'temperature') },
          { id: 'second', entity: sample(hass, 'sensor', 'humidity') },
        ],
      },
    }),
  },
  {
    label: 'A strip of statuses',
    description:
      'One line across the dashboard for what matters at a glance: the weather, the alarm.',
    icon: 'mdi:dots-horizontal-circle-outline',
    make: (_name, hass) => ({
      card: {
        type: 'custom:mnml-glances-card',
        items: [{ id: 'weather', entity: sample(hass, 'weather') }],
      },
    }),
  },
  {
    label: 'A pop-up',
    description:
      'A sheet that opens over the dashboard, with a header and the cards you put in it.',
    icon: 'mdi:window-maximize',
    make: (name, hass) => {
      const cards: Value[] = [
        {
          id: 'header',
          type: 'custom:mnml-header-card',
          name: 'My pop-up',
          icon: 'mdi:star-outline',
        },
        {
          id: 'list',
          type: 'custom:mnml-list-card',
          title: 'Things to see',
          icon: 'mdi:format-list-bulleted',
          rows: [{ id: 'first', entity: sample(hass, 'sensor', 'temperature') }],
        },
      ];
      return { card: { hash: `#${name}`, cards } };
    },
  },
];
