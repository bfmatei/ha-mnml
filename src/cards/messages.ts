import { css, html, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, MessageSource, MessagesCard } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import { SEPARATOR, unavailableValue } from '../ha/format.ts';
import { callAction, callService, isUnavailable, run, stateOf } from '../ha/hass.ts';
import type { HassConnection, HassEntity, HomeAssistant } from '../ha/hass.ts';
import { messageCount } from '../ha/message-count.ts';
import { notificationFeed, repairFeed, repairMessage } from '../ha/messages.ts';
import type { Message, Repair } from '../ha/messages.ts';
import { nameOf } from '../ha/names.ts';
import { UNAVAILABLE } from '../ha/rules.ts';
import { colorStyle, icon, onPress, quietly, relativeTime } from '../ha/templates.ts';
import { wordsFor } from '../words/words.ts';

import { MnmlCard } from './base.ts';
import { linkTo } from './parts/item.ts';
import { tip } from './parts/tooltip.ts';
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

function severityColor(severity: string | undefined): Color | undefined {
  switch (severity) {
    case 'critical':
    case 'error':
      return 'red';
    case 'warning':
      return 'orange';
    case 'notice':
    case 'info':
      return 'blue';
    case undefined:
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

type Row = Extract<MessagesCard, { popup: string }>;

function messagesOf(stateObj: HassEntity): Message[] {
  const raw = stateObj.attributes['messages'];
  return Array.isArray(raw) ? raw.filter(isMessage) : [];
}

export class MnmlMessagesCard extends MnmlCard<MessagesCard> {
  static override styles = [BASE_STYLE, ROW_STYLE, CONTROL_STYLE, MESSAGES_STYLE];

  @state() private open: ReadonlySet<string> = new Set<string>();

  @state() private notified: readonly Message[] | undefined;

  @state() private repaired: readonly Repair[] | undefined;

  private feed: { connection: HassConnection; stop: () => void } | undefined;

  protected structure(): Structure {
    return CARD_STRUCTURES['custom:mnml-messages-card'];
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const { hass, config } = this;
    if (hass === undefined || config === undefined) {
      return;
    }
    this.listen(hass, config);
    const listed = this.listed(hass, config);
    if (listed === undefined) {
      return;
    }
    const ids = new Set(listed.map((entry) => entry.id));
    if ([...this.open].some((id) => !ids.has(id))) {
      this.open = new Set([...this.open].filter((id) => ids.has(id)));
    }
  }

  private listen(hass: HomeAssistant, config: MessagesCard): void {
    if (!this.isConnected || this.feed?.connection === hass.connection) {
      return;
    }
    this.end();
    const stop =
      config.notifications === true
        ? notificationFeed(hass.connection, (messages) => {
            this.notified = messages;
          })
        : config.repairs === true && hass.user?.is_admin === true
          ? repairFeed(hass, (repairs) => {
              this.repaired = repairs;
            })
          : undefined;
    if (stop === undefined) {
      return;
    }
    const release = this.register(() => {
      this.end();
    });
    this.feed = {
      connection: hass.connection,
      stop: () => {
        release();
        stop();
      },
    };
  }

  private end(): void {
    const feed = this.feed;
    this.feed = undefined;
    this.notified = undefined;
    this.repaired = undefined;
    feed?.stop();
  }

  private listed(hass: HomeAssistant, config: MessagesCard): readonly Message[] | undefined {
    if (config.notifications === true) {
      return this.notified;
    }
    if (config.repairs === true) {
      return this.repaired?.map((repair) => repairMessage(hass, repair));
    }
    const stateObj = stateOf(hass, config.entity);
    return stateObj === undefined || isUnavailable(stateObj) ? undefined : messagesOf(stateObj);
  }

  private clearing(
    config: MessagesCard,
    entry: Message,
  ): ((now: HomeAssistant) => Promise<unknown>) | undefined {
    if (config.notifications === true) {
      return (now) =>
        callAction(now, 'persistent_notification.dismiss', { notification_id: entry.id });
    }
    const script = config.clear;
    if (script === undefined) {
      return undefined;
    }
    return (now) => callService(now, script, 'script.turn_on', { variables: { id: entry.id } });
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
    const words = wordsFor(hass.locale.language);
    const label = open ? words.hide(entry.title) : words.show(entry.title);
    const cleared = words.clear(entry.title);
    const toggle = (): void => {
      this.toggle(entry.id);
    };
    const clearing = this.clearing(config, entry);
    const clear = (): void => {
      if (clearing !== undefined) {
        run(this, clearing(this.hass ?? hass));
      }
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
          ${tip(expandable ? label : undefined)}
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
        ${
          clearing === undefined
            ? nothing
            : html`<div class="lane">
                <button
                  type="button"
                  class="control"
                  aria-label=${cleared}
                  ${tip(cleared)}
                  @click=${quietly(clear)}
                >
                  ${icon('mdi:close')}
                </button>
              </div>`
        }
      </div>
      ${expandable ? html`<pre class=${classMap({ body: true, hidden: !open })}>${entry.message}</pre>` : nothing}
    </div>`;
  }

  private summary(hass: HomeAssistant, config: Row): TemplateResult | undefined {
    const all = messageCount(this, hass)?.all;
    if (all === undefined) {
      return undefined;
    }
    const color = all > 0 ? config.color : undefined;
    const link = linkTo(config.popup);
    const said = `${config.name}: ${all}`;
    return html`<div class="card">
      <div class="row link" @pointerdown=${link.pointerdown} @click=${link.click}>
        <div
          class=${classMap({ pill: true, link: true, colored: color !== undefined })}
          style=${styleMap(colorStyle(color))}
          role="button"
          tabindex="0"
          aria-label=${said}
          @keydown=${link.keydown}
        >
          ${icon(config.icon)}
        </div>
        <div class="text">
          <div class="name">${config.name}</div>
          <div class="state">${all === 0 ? wordsFor(hass.locale.language).messages.none : all}</div>
        </div>
      </div>
    </div>`;
  }

  protected draw(hass: HomeAssistant, config: MessagesCard): TemplateResult | undefined {
    if (config.popup !== undefined) {
      return this.summary(hass, config);
    }
    if (config.notifications !== true && config.repairs !== true) {
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
    }
    const listed = this.listed(hass, config);
    if (listed === undefined) {
      return undefined;
    }
    if (listed.length === 0) {
      const words = wordsFor(hass.locale.language).messages;
      return html`<div class="card">
        <div class="empty">
          ${config.repairs === true ? words.noRepairs : words.noNotifications}
        </div>
      </div>`;
    }
    return html`<div class="messages">
      ${repeat(
        listed,
        (entry) => entry.id,
        (entry) => this.message(hass, config, entry),
      )}
    </div>`;
  }
}
