import { css, html } from 'lit';
import type { TemplateResult } from 'lit';

import type { MdiIcon } from '../contract/entities.ts';
import type { Template, Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';

interface Starter {
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

const STARTERS: readonly Starter[] = [
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

export function drawStarters(
  name: string,
  hass: HomeAssistant | undefined,
  pick: (template: Template | undefined) => void,
): TemplateResult {
  return html`<div class="design-start">
    <h2>What do you want to make?</h2>
    <p class="muted">
      Pick a starting point. You change everything afterwards by clicking what you see.
    </p>
    <div class="starts">
      ${STARTERS.map(
        (start) =>
          html`<button
            type="button"
            class="start"
            @click=${() => {
              pick(start.make(name, hass));
            }}
          >
            ${icon(start.icon)}<strong>${start.label}</strong
            ><span class="muted">${start.description}</span>
          </button>`,
      )}
    </div>
    <button
      type="button"
      class="chip"
      @click=${() => {
        pick(undefined);
      }}
    >
      Start with a heading
    </button>
  </div>`;
}

export const STARTERS_STYLE = css`
  .design-start {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 24px 16px;
    max-width: 760px;
  }
  .design-start h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 500;
  }
  .design-start p {
    margin: 0;
  }
  .starts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    width: 100%;
  }
  .start {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    cursor: pointer;
  }
  .start:hover {
    border-color: var(--primary-color);
  }
  .start:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .start ha-icon {
    --mdc-icon-size: 28px;
    color: var(--primary-color);
  }
`;
