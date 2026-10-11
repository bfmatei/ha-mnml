import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, Glance, GlancesCard } from '../contract/cards.ts';
import type { EntityId, MdiIcon, PopupHash } from '../contract/entities.ts';
import { formatState, stateLine } from '../ha/format.ts';
import { hasValue, isUnavailable, numericState, run, stateOf, toggleEntity } from '../ha/hass.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { nameOf } from '../ha/names.ts';
import { navigate, prebuild } from '../ha/navigation.ts';
import { partOf } from '../ha/part.ts';
import { active, matches, shown, tint } from '../ha/rules.ts';
import { colorStyle, icon, onPress, stateIcon } from '../ha/templates.ts';

import { MnmlCard, requireList, requireString } from './base.ts';
import { schema } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { tip } from './parts/tooltip.ts';
import { GLANCE } from './schemas.ts';
import { BASE_STYLE } from './styles.ts';

const GLANCES_STYLE = css`
  .glances {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    padding: 4px 6px;
  }
  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }
  .group.problems {
    margin-left: auto;
  }
  .group.calm + .group.problems {
    padding-left: 8px;
    border-left: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
  }
  .glance {
    display: flex;
    align-items: center;
    flex: none;
    gap: 8px;
    height: 28px;
    padding: 0 10px 0 8px;
    border-radius: 10px;
    background: var(--m-pill);
    box-shadow: var(--m-well);
    line-height: 1;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .calm .glance {
    background: color-mix(in srgb, var(--m-pill) 55%, transparent);
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
    padding-right: 8px;
  }
  .glance.quiet > ha-icon,
  .glance.quiet > ha-state-icon {
    opacity: 0.55;
  }
  .glance.link {
    cursor: pointer;
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
      margin-left: 0;
    }
    .group.calm + .group.problems {
      padding-left: 0;
      border-left: 0;
    }
    .glance {
      gap: 6px;
      padding: 0 8px 0 7px;
    }
  }
  @media (hover: hover) {
    .glance.link:hover {
      background-image: linear-gradient(var(--m-hover), var(--m-hover));
    }
  }
  .glance.link:active {
    background-image: linear-gradient(var(--m-hover), var(--m-hover));
  }
`;

const SCHEMA = schema<GlancesCard>({ type: true, items: true }, { items: GLANCE });

const COUNT_ICON: MdiIcon = 'mdi:alert-circle-outline';

const COUNT_COLOR: Color = 'orange';

interface Press {
  acts: boolean;
  click?: () => void;
  down?: () => void;
}

interface Look {
  color: Color | undefined;
  quiet?: true;
  critical?: true;
}

interface Drawn {
  problem: boolean;
  well: TemplateResult;
}

function matching(hass: HomeAssistant, item: Extract<Glance, { entities: string[] }>): string[] {
  return item.entities.filter((id) => {
    const stateObj = stateOf(hass, id);
    if (stateObj === undefined || isUnavailable(stateObj)) {
      return false;
    }
    if (item.is !== undefined && item.is.includes(stateObj.state)) {
      return true;
    }
    const level = numericState(stateObj);
    return item.below !== undefined && level !== undefined && level < item.below;
  });
}

export class MnmlGlancesCard extends MnmlCard<GlancesCard> {
  static override styles = [BASE_STYLE, GLANCES_STYLE];

  protected schema(): KeySchema {
    return SCHEMA;
  }

  protected override validate(config: GlancesCard): void {
    requireList('items', config.items);
    for (const [index, item] of config.items.entries()) {
      if (item.entities === undefined) {
        requireString(`items[${index}].entity`, item.entity);
      } else {
        requireList(`items[${index}].entities`, item.entities);
        requireString(`items[${index}].name`, item.name);
      }
    }
  }

  private press(
    hass: HomeAssistant,
    popup: PopupHash | undefined,
    toggle: EntityId | undefined,
  ): Press {
    if (toggle !== undefined) {
      return {
        acts: true,
        click: () => {
          run(this, toggleEntity(hass, toggle));
        },
      };
    }
    if (popup !== undefined) {
      return {
        acts: true,
        click: () => {
          navigate(popup, this);
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
    title: string | undefined,
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
        link: acts,
      })}
      style=${styleMap(colorStyle(look.color))}
      data-part=${part}
      ${tip(title)}
      role=${acts ? 'button' : nothing}
      tabindex=${acts ? '0' : nothing}
      @pointerdown=${down ?? nothing}
      @click=${click ?? nothing}
      @keydown=${click === undefined ? nothing : onPress(click)}
    >
      ${content}
    </div>`;
  }

  private one(hass: HomeAssistant, item: Extract<Glance, { entity: string }>): Drawn {
    const stateObj = stateOf(hass, item.entity);
    const on = active(item.when, stateObj);
    const somebody = item.people?.some((id) => stateOf(hass, id)?.state === 'home');
    const conflict =
      item.people !== undefined && stateObj !== undefined && hasValue(stateObj)
        ? (somebody === true && on) || (somebody !== true && !on)
        : false;
    const alerting =
      item.alert !== undefined && stateObj !== undefined && matches(item.alert, stateObj.state);
    const color: Color | undefined =
      conflict || alerting ? 'red' : tint(item.color, item.when, stateObj);
    const quiet = item.quiet === true && !on && !conflict;
    const name = item.name ?? nameOf(hass, item.entity, {});
    const value = stateObj === undefined ? undefined : formatState(hass, stateObj);
    const why = conflict
      ? somebody === true
        ? ' with somebody home'
        : ' with everybody away'
      : '';
    return {
      problem: item.show !== undefined,
      well: this.well(
        { color, ...(quiet ? { quiet } : {}) },
        value === undefined || item.name === undefined ? name : `${name}: ${value}${why}`,
        this.press(hass, item.popup, item.toggle === true ? item.entity : undefined),
        html`${stateIcon(hass, stateObj, item.icon)}${
          quiet || item.bare === true
            ? nothing
            : html`<span class="state">${stateLine(hass, item.entity, item.state ?? [{}])}</span>`
        }`,
        partOf(item),
      ),
    };
  }

  private tally(
    hass: HomeAssistant,
    item: Extract<Glance, { entities: string[] }>,
  ): Drawn | undefined {
    const levels = item.entities.map((id) => numericState(stateOf(hass, id)) ?? 0);
    const total = levels.reduce((sum, level) => sum + level, 0);
    if (total <= 0) {
      return undefined;
    }
    const limit = item.critical;
    const critical = limit !== undefined && (levels[0] ?? 0) >= limit;
    const lines = item.entities.flatMap((id, index) => {
      const stateObj = stateOf(hass, id);
      return stateObj === undefined || (levels[index] ?? 0) <= 0
        ? []
        : [`${nameOf(hass, id, { label: 'device' })}: ${formatState(hass, stateObj)}`];
    });
    return {
      problem: true,
      well: this.well(
        {
          color: critical ? 'red' : (item.color ?? COUNT_COLOR),
          ...(critical ? { critical } : {}),
        },
        [item.name, ...lines].join('\n'),
        this.press(hass, item.popup, undefined),
        html`${icon(item.icon ?? COUNT_ICON)}<span class="state">${total}</span>`,
        partOf(item),
      ),
    };
  }

  private count(
    hass: HomeAssistant,
    item: Extract<Glance, { entities: string[] }>,
  ): Drawn | undefined {
    if (item.sum === true) {
      return this.tally(hass, item);
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
    const lines = found.flatMap((id) => {
      const stateObj = stateOf(hass, id);
      return stateObj === undefined
        ? []
        : [`${nameOf(hass, id, { label: 'device' })}: ${formatState(hass, stateObj)}`];
    });
    return {
      problem: true,
      well: this.well(
        {
          color: critical ? 'red' : (item.color ?? COUNT_COLOR),
          ...(critical ? { critical } : {}),
        },
        [item.name, ...lines].join('\n'),
        this.press(hass, item.popup, undefined),
        html`${icon(item.icon ?? COUNT_ICON)}<span class="state">${found.length}</span>`,
        partOf(item),
      ),
    };
  }

  protected draw(hass: HomeAssistant, config: GlancesCard): TemplateResult | undefined {
    const drawn = config.items.flatMap((item) => {
      if (item.entities !== undefined) {
        return this.count(hass, item) ?? [];
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
