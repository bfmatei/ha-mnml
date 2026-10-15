import { css, html } from 'lit';
import type { TemplateResult } from 'lit';

import type { MdiIcon } from '../contract/entities.ts';
import type { Template, Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

type Said = PanelWords['starters'];

interface Starter {
  kind: keyof Said['kinds'];
  icon: MdiIcon;
  make: (name: string, hass: HomeAssistant | undefined, said: Said) => Template;
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
    kind: 'tile',
    icon: 'mdi:card-outline',
    make: (name, hass, said) => ({
      card: {
        type: 'custom:mnml-tile-card',
        name: said.myTile,
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
              name: said.myTile,
              icon: 'mdi:home-outline',
            },
          ],
        },
      ],
    }),
  },
  {
    kind: 'list',
    icon: 'mdi:format-list-bulleted',
    make: (_name, hass, said) => ({
      card: {
        type: 'custom:mnml-list-card',
        title: said.myList,
        icon: 'mdi:format-list-bulleted',
        rows: [
          { id: 'first', entity: sample(hass, 'sensor', 'temperature') },
          { id: 'second', entity: sample(hass, 'sensor', 'humidity') },
        ],
      },
    }),
  },
  {
    kind: 'strip',
    icon: 'mdi:dots-horizontal-circle-outline',
    make: (_name, hass) => ({
      card: {
        type: 'custom:mnml-glances-card',
        items: [{ id: 'weather', entity: sample(hass, 'weather') }],
      },
    }),
  },
  {
    kind: 'popup',
    icon: 'mdi:window-maximize',
    make: (name, hass, said) => {
      const cards: Value[] = [
        {
          id: 'header',
          type: 'custom:mnml-header-card',
          name: said.myPopup,
          icon: 'mdi:star-outline',
        },
        {
          id: 'list',
          type: 'custom:mnml-list-card',
          title: said.toSee,
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
  const said = panelWordsFor(hass?.locale.language).starters;
  return html`<div class="design-start">
    <h2>${said.heading}</h2>
    <p class="muted">${said.about}</p>
    <div class="starts">
      ${STARTERS.map(
        (start) =>
          html`<button
            type="button"
            class="start"
            @click=${() => {
              pick(start.make(name, hass, said));
            }}
          >
            ${icon(start.icon)}<strong>${said.kinds[start.kind].label}</strong
            ><span class="muted">${said.kinds[start.kind].about}</span>
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
      ${said.plain}
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
