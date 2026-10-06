import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { ClientFields, ClientsCard } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { ipv4, subnetRange } from '../contract/subnet.ts';
import { DASH, unavailableValue } from '../ha/format.ts';
import { hasValue, isUnavailable, stateOf } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { UNAVAILABLE } from '../ha/rules.ts';
import { colorStyle } from '../ha/templates.ts';

import { MnmlCard, requireList, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { SECTION_STYLE, section } from './parts/section.ts';
import type { Fold } from './parts/section.ts';
import { CLIENT_NETWORK } from './schemas.ts';
import { BASE_STYLE, HEADING_STYLE } from './styles.ts';

const CLIENTS_STYLE = css`
  .clients {
    display: flex;
    flex-direction: column;
    gap: var(--mnml-popup-gap, 8px);
  }
  .list {
    padding: 6px 8px;
  }
  .row {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    column-gap: 10px;
    align-items: center;
    min-height: 40px;
    padding: 0 8px;
  }
  .row > ha-icon {
    color: var(--secondary-text-color);
    --mdc-icon-size: 20px;
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name,
  .fqdn {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fqdn {
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .ip {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: var(--secondary-text-color);
  }
  .empty {
    padding: 16px;
    color: var(--secondary-text-color);
  }
  .empty.colored {
    color: var(--m-color);
  }
`;

interface Connection {
  icon: MdiIcon;
  label: string;
}

const CONNECTIONS: Record<string, Connection> = {
  WIRELESS: { icon: 'mdi:wifi', label: 'Wi-Fi' },
  WIRED: { icon: 'mdi:ethernet', label: 'Ethernet' },
};

const OTHER = 'Other';

const OTHER_ICON: MdiIcon = 'mdi:help-network-outline';

const OTHER_CONNECTION: Connection = { icon: OTHER_ICON, label: 'Other connection' };

const NAME_SOURCES = new Set(['rDNS', 'etc/hosts']);

const CLIENTS_ICON: MdiIcon = 'mdi:lan-connect';

interface Client {
  type: string;
  name: string;
  ipAddress: string;
}

interface Name {
  ip: string;
  name: string;
  source: string;
}

interface Placed {
  client: Client;
  address: number;
}

const DEFAULT_FIELDS: Required<ClientFields> = {
  name: 'name',
  ip_address: 'ipAddress',
  type: 'type',
};

function text(record: object, key: string): string {
  const value: unknown = Object.hasOwn(record, key) ? Reflect.get(record, key) : undefined;
  return typeof value === 'string' ? value : '';
}

function isName(value: unknown): value is Name {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ip' in value &&
    typeof value.ip === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'source' in value &&
    typeof value.source === 'string'
  );
}

function listOf(stateObj: HassEntity | undefined, attribute: string): unknown[] {
  const raw = stateObj?.attributes[attribute];
  return Array.isArray(raw) ? raw : [];
}

function clientsOf(stateObj: HassEntity, config: ClientsCard): Client[] {
  const fields = { ...DEFAULT_FIELDS, ...config.fields };
  return listOf(stateObj, config.attribute ?? 'data')
    .filter((value): value is object => typeof value === 'object' && value !== null)
    .map((record) => ({
      type: text(record, fields.type),
      name: text(record, fields.name),
      ipAddress: text(record, fields.ip_address),
    }));
}

function row(placed: Placed, names: Map<string, string>): TemplateResult {
  const { client } = placed;
  const fqdn = names.get(client.ipAddress);
  const connection = CONNECTIONS[client.type] ?? OTHER_CONNECTION;
  return html`<div class="row">
    <ha-icon .icon=${connection.icon} role="img" aria-label=${connection.label}></ha-icon>
    <div class="who">
      <span class="name">${client.name || fqdn || client.ipAddress || DASH}</span>
      ${fqdn !== undefined && client.name !== '' ? html`<span class="fqdn">${fqdn}</span>` : nothing}
    </div>
    <span class="ip">${client.ipAddress || DASH}</span>
  </div>`;
}

function group(
  placed: Placed[],
  names: Map<string, string>,
  title: string,
  iconName: MdiIcon,
  fold?: Fold,
): TemplateResult {
  const sorted = [...placed].sort((a, b) => a.address - b.address);
  const card = html`<div class="card">
    <div class="list">${sorted.map((entry) => row(entry, names))}</div>
  </div>`;
  const count = sorted.length;
  return section(
    card,
    title,
    iconName,
    {
      text: String(count),
      label: `${count} ${count === 1 ? 'client' : 'clients'}`,
    },
    fold,
  );
}

const SCHEMA = schema<ClientsCard>(
  {
    type: true,
    entity: true,
    attribute: true,
    fields: true,
    names: true,
    networks: true,
    fold: true,
  },
  {
    networks: CLIENT_NETWORK,
    fields: schema<ClientFields>({ name: true, ip_address: true, type: true }),
  },
);

export class MnmlClientsCard extends MnmlCard<ClientsCard> {
  static override styles = [BASE_STYLE, HEADING_STYLE, SECTION_STYLE, CLIENTS_STYLE];

  @state() private choices: ReadonlyMap<string, boolean> = new Map();

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: ClientsCard): void {
    requireString('entity', config.entity);
    requireList('networks', config.networks);
    for (const network of config.networks) {
      if (subnetRange(network.subnet) === undefined) {
        throw new Error(`${network.name}: subnet ${network.subnet} is not an IPv4 range`);
      }
    }
  }

  protected draw(hass: HomeAssistant, config: ClientsCard): TemplateResult | undefined {
    const stateObj = stateOf(hass, config.entity);
    if (stateObj === undefined) {
      return undefined;
    }
    if (isUnavailable(stateObj)) {
      const card = html`<div class="card">
        <div class="empty colored" style=${styleMap(colorStyle(UNAVAILABLE))}>
          ${unavailableValue(hass, stateObj)}
        </div>
      </div>`;
      return section(card, 'Clients', CLIENTS_ICON);
    }
    if (!hasValue(stateObj) || !Array.isArray(stateObj.attributes[config.attribute ?? 'data'])) {
      return undefined;
    }
    const clients = clientsOf(stateObj, config);
    if (clients.length === 0) {
      return html`<div class="card"><div class="empty">No clients</div></div>`;
    }
    const names = new Map(
      listOf(stateOf(hass, config.names), 'auto_clients')
        .filter(isName)
        .filter((entry) => NAME_SOURCES.has(entry.source) && entry.name.includes('.'))
        .map((entry) => [entry.ip, entry.name]),
    );
    const ranges = config.networks.map((network) => subnetRange(network.subnet));
    const groups = config.networks.map((): Placed[] => []);
    const other: Placed[] = [];
    for (const client of clients) {
      const address = ipv4(client.ipAddress);
      if (address === undefined) {
        other.push({ client, address: Number.POSITIVE_INFINITY });
        continue;
      }
      const at = ranges.findIndex(
        (range) =>
          range !== undefined && address >= range.start && address < range.start + range.size,
      );
      (groups[at] ?? other).push({ client, address });
    }
    const fold = (title: string, open: boolean): Fold | undefined =>
      config.fold
        ? {
            open: this.choices.get(title) ?? open,
            chosen: (choice: boolean): void => {
              this.choices = new Map([...this.choices, [title, choice]]);
            },
          }
        : undefined;
    return html`<div class="clients">
      ${config.networks.map((network, index) => {
        const placed = groups[index] ?? [];
        return placed.length > 0
          ? group(placed, names, network.name, network.icon, fold(network.name, false))
          : nothing;
      })}${other.length > 0 ? group(other, names, OTHER, OTHER_ICON, fold(OTHER, true)) : nothing}
    </div>`;
  }
}
