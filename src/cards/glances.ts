import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, Glance, GlancesCard } from '../contract/cards.ts';
import type { MdiIcon, PopupHash } from '../contract/entities.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import type { Structure } from '../contract/structure.ts';
import { decimals, formatState, stateLine } from '../ha/format.ts';
import {
  haptic,
  hasValue,
  isUnavailable,
  numericState,
  run,
  stateOf,
  toggleAction,
  toggleEntity,
} from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { messageCount } from '../ha/message-count.ts';
import { distinctNames, nameOf } from '../ha/names.ts';
import { navigate, prebuild } from '../ha/navigation.ts';
import { partOf } from '../ha/part.ts';
import { active, holds, matches, shown, tint } from '../ha/rules.ts';
import { colorStyle, icon, onPress, stateIcon } from '../ha/templates.ts';
import { wordsFor } from '../words/words.ts';

import { MnmlCard } from './base.ts';
import { asks, confirmed, isArmed } from './parts/confirm.ts';
import { tip } from './parts/tooltip.ts';
import { BASE_STYLE } from './styles.ts';

const GLANCES_STYLE = css`
  .glances {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }
  .glances.card {
    overflow: visible;
    background: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    box-shadow: none;
  }
  .glances.card::after {
    content: none;
  }
  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }
  .group.problems {
    margin-inline-start: auto;
  }
  .glance {
    display: flex;
    align-items: center;
    flex: none;
    gap: 8px;
    height: 28px;
    padding-block: 0;
    padding-inline: 8px 10px;
    border-radius: 10px;
    background: var(--m-pill);
    box-shadow: var(--m-well);
    line-height: 1;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .calm .glance {
    background: color-mix(in srgb, var(--m-pill) 80%, transparent);
    box-shadow: none;
    color: var(--secondary-text-color);
  }
  .calm .glance.colored {
    color: var(--primary-text-color);
  }
  .calm .glance.colored,
  .problems .glance.colored {
    background: color-mix(in srgb, var(--m-color) 16%, var(--m-pill));
  }
  .problems .glance {
    font-weight: 600;
  }
  .glance.colored {
    box-shadow: var(--m-well);
  }
  .glance.quiet {
    padding-inline-end: 8px;
  }
  .glance.quiet > ha-icon,
  .glance.quiet > ha-state-icon {
    opacity: 0.55;
  }
  .glance.link {
    cursor: pointer;
  }
  .glance.armed {
    color: var(--primary-text-color);
    font-weight: 600;
  }
  .glance > ha-icon,
  .glance > ha-state-icon {
    display: flex;
    --mdc-icon-size: 16px;
  }
  .glance.colored > ha-icon,
  .glance.colored > ha-state-icon {
    color: var(--m-color);
  }
  .glance .state {
    display: flex;
    align-items: center;
    gap: 3px;
    font-variant-numeric: tabular-nums;
  }
  .glance .state > span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .glance .state ha-state-icon {
    display: inline-flex;
    line-height: 0;
    --mdc-icon-size: 16px;
  }
  .glance.critical {
    animation: glance-in 1200ms ease-out 1;
  }
  @keyframes glance-in {
    from {
      opacity: 0.35;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .glance.critical {
      animation: none;
    }
  }
  @media (max-width: 480px) {
    .glances,
    .group {
      justify-content: center;
    }
    .group.problems {
      margin-inline-start: 0;
    }
    .glance {
      gap: 6px;
      padding-inline: 7px 8px;
    }
  }
  .glance.link:active::before {
    opacity: 1;
  }
`;

const COUNT_ICON: MdiIcon = 'mdi:alert-circle-outline';

const COUNT_COLOR: Color = 'orange';

const NOT_WITH_TOTAL = ['color', 'is', 'not', 'below', 'sum', 'critical'] as const;

interface Press {
  acts: boolean;
  click?: (event: Event) => void;
  down?: () => void;
}

interface Look {
  color: Color | undefined;
  quiet?: true;
  critical?: true;
  armed?: true;
}

type One = Extract<Glance, { entity: string }>;

type Count = Extract<Glance, { entities: string[] }>;

type Messages = Extract<Glance, { messages: true }>;

interface Drawn {
  problem: boolean;
  well: TemplateResult;
}

function matching(hass: HomeAssistant, item: Count): string[] {
  return item.entities.filter((id) => {
    const stateObj = stateOf(hass, id);
    if (stateObj === undefined || isUnavailable(stateObj)) {
      return false;
    }
    if ((item.is !== undefined || item.not !== undefined) && matches(item, stateObj.state)) {
      return true;
    }
    const level = numericState(stateObj);
    return item.below !== undefined && level !== undefined && level < item.below;
  });
}

function deviceNames(hass: HomeAssistant, ids: readonly string[]): Map<string, string> {
  const names = distinctNames(
    hass,
    ids.map((entity) => ({ entity, label: 'device' })),
  );
  return new Map(ids.map((id, index) => [id, names[index] ?? id]));
}

function warning(item: Count, critical: boolean): Look {
  return {
    color: critical ? 'red' : (item.color ?? COUNT_COLOR),
    ...(critical ? { critical } : {}),
  };
}

export class MnmlGlancesCard extends MnmlCard<GlancesCard> {
  static override styles = [BASE_STYLE, GLANCES_STYLE];

  protected structure(): Structure {
    return CARD_STRUCTURES['custom:mnml-glances-card'];
  }

  protected override validate(config: GlancesCard): void {
    for (const [index, item] of config.items.entries()) {
      if (item.confirm !== undefined && item.toggle !== true) {
        throw new Error(`items[${index}].confirm needs toggle: true`);
      }
      const clash = NOT_WITH_TOTAL.find((key) => item.total === true && item[key] !== undefined);
      if (clash !== undefined) {
        throw new Error(`items[${index}].${clash} does not go with total`);
      }
    }
  }

  private press(hass: HomeAssistant, popup: PopupHash | undefined, toggle: One | undefined): Press {
    if (toggle !== undefined) {
      return {
        acts: true,
        click: () => {
          const now = this.hass ?? hass;
          confirmed(this, toggle, asks(now, toggle.confirm, toggle.entity), () => {
            haptic('light');
            run(this, toggleEntity(now, toggle.entity));
          });
        },
      };
    }
    if (popup !== undefined) {
      return {
        acts: true,
        click: (event) => {
          navigate(popup, event.currentTarget instanceof Element ? event.currentTarget : this);
        },
        down: () => {
          prebuild(popup);
        },
      };
    }
    return { acts: false };
  }

  private well(
    look: Look,
    title: string,
    spoken: string,
    press: Press,
    content: TemplateResult,
    part: string | typeof nothing,
  ): TemplateResult {
    const { acts, click, down } = press;
    return html`<div
      class=${classMap({
        glance: true,
        colored: look.color !== undefined,
        quiet: look.quiet === true,
        critical: look.critical === true,
        armed: look.armed === true,
        link: acts,
      })}
      style=${styleMap(colorStyle(look.color))}
      data-part=${part}
      ${tip(title)}
      role=${acts ? 'button' : nothing}
      tabindex=${acts ? '0' : nothing}
      aria-label=${acts ? spoken : nothing}
      @pointerdown=${down ?? nothing}
      @click=${click ?? nothing}
      @keydown=${
        click === undefined
          ? nothing
          : (event: KeyboardEvent) => {
              onPress(() => {
                click(event);
              })(event);
            }
      }
    >
      ${content}
    </div>`;
  }

  private one(hass: HomeAssistant, item: One): Drawn {
    const stateObj = stateOf(hass, item.entity);
    const on = active(item.when, stateObj);
    const somebody = item.people?.some((id) => stateOf(hass, id)?.state === 'home');
    const conflict =
      item.people !== undefined && stateObj !== undefined && hasValue(stateObj)
        ? (somebody === true && on) || (somebody !== true && !on)
        : false;
    const alerting =
      item.alert !== undefined && stateObj !== undefined && holds(item.alert, stateObj);
    const color: Color | undefined =
      conflict || alerting ? 'red' : tint(item.color, item.when, stateObj);
    const toggles = item.toggle === true;
    const armed = toggles && isArmed(this, item) && asks(hass, item.confirm, item.entity);
    const quiet = item.quiet === true && !on && !conflict && !armed;
    const name = item.name ?? nameOf(hass, item.entity, {});
    const value = stateObj === undefined ? undefined : formatState(hass, stateObj);
    const words = wordsFor(hass.locale.language);
    const line = `${name}: ${value ?? ''}`;
    const said =
      value === undefined
        ? name
        : !conflict
          ? line
          : somebody === true
            ? words.glances.somebodyHome(line)
            : words.glances.everybodyAway(line);
    const action = toggleAction(hass, item.entity);
    const look: Look = { color, ...(quiet ? { quiet } : {}), ...(armed ? { armed } : {}) };
    return {
      problem: item.show !== undefined && item.calm !== true,
      well: this.well(
        look,
        armed ? '' : item.name === undefined ? name : said,
        armed ? words.askAbout(action, name) : said,
        this.press(hass, item.popup, toggles ? item : undefined),
        html`${stateIcon(hass, stateObj, item.icon)}${
          armed
            ? html`<span class="state">${words.ask(action)}</span>`
            : quiet || item.bare === true
              ? nothing
              : html`<span class="state">${stateLine(hass, item.entity, item.state ?? [{}])}</span>`
        }`,
        partOf(item),
      ),
    };
  }

  private counter(
    hass: HomeAssistant,
    item: Count,
    look: Look,
    lines: string[],
    value: string | number,
    symbol: TemplateResult,
  ): Drawn {
    return {
      problem: item.total !== true,
      well: this.well(
        look,
        [item.name, ...lines].join('\n'),
        [item.name, ...lines].join('. '),
        this.press(hass, item.popup, undefined),
        html`${symbol}<span class="state">${value}</span>`,
        partOf(item),
      ),
    };
  }

  private tally(hass: HomeAssistant, item: Count): Drawn | undefined {
    const levels = item.entities.map((id) => numericState(stateOf(hass, id)) ?? 0);
    const total = levels.reduce((sum, level) => sum + level, 0);
    if (total <= 0) {
      return undefined;
    }
    const limit = item.critical;
    const critical = limit !== undefined && (levels[0] ?? 0) >= limit;
    const names = deviceNames(hass, item.entities);
    const lines = item.entities.flatMap((id, index) => {
      const stateObj = stateOf(hass, id);
      return stateObj === undefined || (levels[index] ?? 0) <= 0
        ? []
        : [`${names.get(id) ?? id}: ${formatState(hass, stateObj)}`];
    });
    const symbol = icon(item.icon ?? COUNT_ICON);
    return this.counter(hass, item, warning(item, critical), lines, total, symbol);
  }

  private total(hass: HomeAssistant, item: Count): Drawn | undefined {
    const read = item.entities.flatMap((id) => {
      const stateObj = stateOf(hass, id);
      const level = numericState(stateObj);
      return stateObj === undefined || level === undefined ? [] : [{ id, stateObj, level }];
    });
    const [first] = read;
    if (first === undefined) {
      return undefined;
    }
    const unit = 'unit_of_measurement';
    const counted = read.filter(
      ({ stateObj }) => stateObj.attributes[unit] === first.stateObj.attributes[unit],
    );
    const sum = counted.reduce((acc, { level }) => acc + level, 0);
    const places = Math.max(...counted.map(({ stateObj }) => decimals(stateObj.state)));
    const value = hass.formatEntityState(first.stateObj, sum.toFixed(places));
    const names = deviceNames(hass, item.entities);
    const lines = counted.map(
      ({ id, stateObj }) => `${names.get(id) ?? id}: ${formatState(hass, stateObj)}`,
    );
    const symbol = stateIcon(hass, first.stateObj, item.icon);
    return this.counter(hass, item, { color: undefined }, lines, value, symbol);
  }

  private count(hass: HomeAssistant, item: Count): Drawn | undefined {
    if (item.sum === true) {
      return this.tally(hass, item);
    }
    if (item.total === true) {
      return this.total(hass, item);
    }
    const found = matching(hass, item);
    if (found.length === 0) {
      return undefined;
    }
    const limit = item.critical;
    const critical =
      limit !== undefined &&
      found.some((id) => {
        const level = numericState(stateOf(hass, id));
        return level !== undefined && level < limit;
      });
    const names = deviceNames(hass, item.entities);
    const lines = found.flatMap((id) => {
      const stateObj = stateOf(hass, id);
      return stateObj === undefined
        ? []
        : [`${names.get(id) ?? id}: ${formatState(hass, stateObj)}`];
    });
    const symbol = icon(item.icon ?? COUNT_ICON);
    return this.counter(hass, item, warning(item, critical), lines, found.length, symbol);
  }

  private messages(hass: HomeAssistant, item: Messages): Drawn | undefined {
    const all = messageCount(this, hass)?.all ?? 0;
    if (all === 0) {
      return undefined;
    }
    return {
      problem: true,
      well: this.well(
        { color: item.color ?? COUNT_COLOR },
        item.name,
        `${item.name}: ${all}`,
        this.press(hass, item.popup, undefined),
        html`${icon(item.icon ?? COUNT_ICON)}<span class="state">${all}</span>`,
        partOf(item),
      ),
    };
  }

  protected draw(hass: HomeAssistant, config: GlancesCard): TemplateResult | undefined {
    const drawn = config.items.flatMap((item) => {
      if (item.messages === true) {
        return this.messages(hass, item) ?? [];
      }
      if (item.entities !== undefined) {
        return shown(hass, item.show, item.entities[0]) ? (this.count(hass, item) ?? []) : [];
      }
      return shown(hass, item.show, item.entity) ? this.one(hass, item) : [];
    });
    if (drawn.length === 0) {
      return undefined;
    }
    const calm = drawn.filter((one) => !one.problem).map((one) => one.well);
    const problems = drawn.filter((one) => one.problem).map((one) => one.well);
    return html`<div class="card glances">
      ${calm.length === 0 ? nothing : html`<div class="group calm">${calm}</div>`}
      ${problems.length === 0 ? nothing : html`<div class="group problems">${problems}</div>`}
    </div>`;
  }
}
