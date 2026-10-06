import { css, html, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, MessageSource, MessagesCard } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { SEPARATOR, unavailableValue } from '../ha/format.ts';
import { callService, isUnavailable, run, stateOf } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { nameOf } from '../ha/names.ts';
import { UNAVAILABLE } from '../ha/rules.ts';
import { colorStyle, icon, onPress, quietly, relativeTime } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { MESSAGE_SOURCE } from './schemas.ts';
import { BASE_STYLE, CONTROL_STYLE, ROW_STYLE } from './styles.ts';

const MESSAGES_STYLE = css`
  .messages {
    display: flex;
    flex-direction: column;
    gap: var(--mnml-popup-gap, 8px);
  }
  .pill:not(.colored) {
    color: var(--secondary-text-color);
  }
  .open .name {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .body {
    margin: 0;
    padding: 4px 16px 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: var(--code-font-family, monospace);
    font-size: 12px;
    line-height: 1.45;
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

const CLOSED_ICON: MdiIcon = 'mdi:email-outline';

const OPEN_ICON: MdiIcon = 'mdi:email-open-outline';

interface Message {
  id: string;
  title: string;
  message: string;
  severity?: string;
  source?: string;
  time: string;
}

function severityColor(severity: string | undefined): Color | undefined {
  switch (severity) {
    case 'error':
      return 'red';
    case 'warning':
      return 'orange';
    case 'notice':
    case 'info':
      return 'blue';
    default:
      return undefined;
  }
}

function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'message' in value &&
    typeof value.message === 'string' &&
    (!('severity' in value) || typeof value.severity === 'string') &&
    (!('source' in value) || typeof value.source === 'string') &&
    'time' in value &&
    typeof value.time === 'string'
  );
}

function sourceName(
  hass: HomeAssistant,
  sources: MessageSource[] | undefined,
  source: string | undefined,
): string | undefined {
  if (source === undefined || source === '') {
    return undefined;
  }
  const known = sources?.find((entry) => entry.source === source);
  if (known === undefined) {
    return source;
  }
  return known.entity === undefined ? known.name : nameOf(hass, known.entity, { label: 'device' });
}

function messagesOf(stateObj: HassEntity): Message[] {
  const raw = stateObj.attributes['messages'];
  return Array.isArray(raw) ? raw.filter(isMessage) : [];
}

const SCHEMA = schema<MessagesCard>(
  { type: true, entity: true, clear: true, sources: true },
  { sources: MESSAGE_SOURCE },
);

export class MnmlMessagesCard extends MnmlCard<MessagesCard> {
  static override styles = [BASE_STYLE, ROW_STYLE, CONTROL_STYLE, MESSAGES_STYLE];

  @state() private open: ReadonlySet<string> = new Set<string>();

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: MessagesCard): void {
    requireString('entity', config.entity);
    requireString('clear', config.clear);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const { hass, config } = this;
    const stateObj = hass === undefined ? undefined : stateOf(hass, config?.entity);
    if (stateObj === undefined || isUnavailable(stateObj)) {
      return;
    }
    const ids = new Set(messagesOf(stateObj).map((entry) => entry.id));
    if ([...this.open].some((id) => !ids.has(id))) {
      this.open = new Set([...this.open].filter((id) => ids.has(id)));
    }
  }

  private toggle(id: string): void {
    const next = new Set(this.open);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.open = next;
  }

  private message(hass: HomeAssistant, config: MessagesCard, entry: Message): TemplateResult {
    const color = severityColor(entry.severity);
    const from = sourceName(hass, config.sources, entry.source);
    const expandable = entry.message !== '';
    const open = expandable && this.open.has(entry.id);
    const label = `${open ? 'Hide' : 'Show'} ${entry.title}`;
    const toggle = (): void => {
      this.toggle(entry.id);
    };
    const clear = (): void => {
      run(this, callService(hass, config.clear, 'script.turn_on', { variables: { id: entry.id } }));
    };
    return html`<div class=${classMap({ card: true, open })}>
      <div
        class=${classMap({ row: true, link: expandable })}
        @click=${expandable ? toggle : nothing}
      >
        <div
          class=${classMap({ pill: true, colored: color !== undefined })}
          style=${styleMap(colorStyle(color))}
          role=${expandable ? 'button' : nothing}
          tabindex=${expandable ? 0 : nothing}
          aria-label=${expandable ? label : nothing}
          title=${expandable ? label : nothing}
          aria-expanded=${expandable ? String(open) : nothing}
          @keydown=${expandable ? onPress(toggle) : nothing}
        >
          ${icon(open ? OPEN_ICON : CLOSED_ICON)}
        </div>
        <div class="text">
          <div class="name">${entry.title}</div>
          <div class="state">
            ${from === undefined ? nothing : html`<span>${from}</span>${SEPARATOR}`}${relativeTime(hass, entry.time)}
          </div>
        </div>
        <div class="lane">
          <button
            type="button"
            class="control"
            aria-label=${`Clear ${entry.title}`}
            title=${`Clear ${entry.title}`}
            @click=${quietly(clear)}
          >
            ${icon('mdi:close')}
          </button>
        </div>
      </div>
      ${expandable ? html`<pre class=${classMap({ body: true, hidden: !open })}>${entry.message}</pre>` : nothing}
    </div>`;
  }

  protected draw(hass: HomeAssistant, config: MessagesCard): TemplateResult | undefined {
    const stateObj = stateOf(hass, config.entity);
    if (stateObj === undefined) {
      return undefined;
    }
    if (isUnavailable(stateObj)) {
      return html`<div class="card">
        <div class="empty colored" style=${styleMap(colorStyle(UNAVAILABLE))}>
          ${unavailableValue(hass, stateObj)}
        </div>
      </div>`;
    }
    const messages = messagesOf(stateObj);
    if (messages.length === 0) {
      return html`<div class="card"><div class="empty">No notifications</div></div>`;
    }
    return html`<div class="messages">
      ${repeat(
        messages,
        (entry) => entry.id,
        (entry) => this.message(hass, config, entry),
      )}
    </div>`;
  }
}
