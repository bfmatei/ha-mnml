import { css, html, nothing, render } from 'lit';
import type { TemplateResult } from 'lit';

import type { ModeAttribute } from '../../contract/cards.ts';
import type { EntityId, MdiIcon, SceneId, SelectId } from '../../contract/entities.ts';
import { formatAttribute } from '../../ha/format.ts';
import {
  callService,
  hasValue,
  listAttribute,
  run,
  stateOf,
  stringAttribute,
} from '../../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';
import { entityName } from '../../ha/names.ts';
import { attributeIcon, icon, stateIcon } from '../../ha/templates.ts';
import type { Host } from '../base.ts';

import { dismissable } from './overlay.ts';

export const MENU_STYLE = css`
  .menu {
    position: fixed;
    inset: auto;
    margin: 0;
    border: 0;
    padding: 6px;
    min-width: 168px;
    overflow: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    border-radius: 14px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.3);
    font: inherit;
    font-size: 13px;
    animation: mnml-rise 140ms ease-out;
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }
  .menu button:hover {
    background: var(--m-pill);
  }
  .menu button.selected {
    color: var(--primary-color);
    font-weight: 600;
  }
  .menu button ha-icon,
  .menu button ha-attribute-icon,
  .menu button ha-state-icon {
    --mdc-icon-size: 20px;
    flex: none;
  }
  @media (forced-colors: active) {
    .menu {
      border: 1px solid CanvasText;
    }
  }
`;

const HVAC_ICONS: Record<string, MdiIcon> = {
  off: 'mdi:power',
  heat: 'mdi:fire',
  cool: 'mdi:snowflake',
  heat_cool: 'mdi:sun-snowflake-variant',
  auto: 'mdi:thermostat-auto',
  dry: 'mdi:water-percent',
  fan_only: 'mdi:fan',
};

const GAP = 6;
const EDGE = 8;
const ROW = 36;
const PADDING = 12;
const MIN_ROWS = 3;

const SWING_WITH_ICON = new Set(['off', 'on', 'vertical', 'horizontal', 'both']);

const SINGULAR = {
  hvac_modes: 'hvac_mode',
  preset_modes: 'preset_mode',
  fan_modes: 'fan_mode',
  swing_modes: 'swing_mode',
  swing_horizontal_modes: 'swing_horizontal_mode',
} as const satisfies Record<ModeAttribute, string>;

export const MODE_ATTRIBUTES = Object.keys(SINGULAR);

interface Option<V extends string> {
  value: V;
  label: string;
  icon?: TemplateResult;
}

export interface Choice<V extends string = string> {
  options: Option<V>[];
  current: string | undefined;
  currentIcon(): TemplateResult | undefined;
  select(value: V): Promise<unknown>;
}

export function modeChoice(
  hass: HomeAssistant,
  entity: EntityId,
  stateObj: HassEntity,
  attribute: ModeAttribute,
): Choice {
  const single = SINGULAR[attribute];
  const current = attribute === 'hvac_modes' ? stateObj.state : stringAttribute(stateObj, single);
  const label = (value: string): string =>
    attribute === 'hvac_modes'
      ? hass.formatEntityState(stateObj, value)
      : formatAttribute(hass, stateObj, single, value);
  const modeIcon = (value: string): TemplateResult | undefined => {
    switch (attribute) {
      case 'hvac_modes': {
        const name = HVAC_ICONS[value];
        return name === undefined ? undefined : icon(name);
      }
      case 'preset_modes':
        return attributeIcon(hass, stateObj, single, value);
      case 'swing_modes':
        return SWING_WITH_ICON.has(value)
          ? attributeIcon(hass, stateObj, single, value)
          : undefined;
      default:
        return undefined;
    }
  };
  return {
    options: listAttribute(stateObj, attribute).map((value) => ({
      value,
      label: label(value),
      icon: modeIcon(value),
    })),
    current,
    currentIcon: () => (current === undefined ? undefined : modeIcon(current)),
    select: (value) => callService(hass, entity, `climate.set_${single}`, { [single]: value }),
  };
}

export function optionChoice(hass: HomeAssistant, entity: EntityId, stateObj: HassEntity): Choice {
  return {
    options: listAttribute(stateObj, 'options').map((value) => ({
      value,
      label: hass.formatEntityState(stateObj, value),
    })),
    current: stateObj.state,
    currentIcon: () => undefined,
    select: (value) => callService(hass, entity, 'select.select_option', { option: value }),
  };
}

export function sceneChoice(
  hass: HomeAssistant,
  scenes: SceneId[],
  active?: SelectId,
): Choice<SceneId> {
  const options = scenes.map((entity) => ({
    value: entity,
    label: entityName(hass, entity),
    icon: stateIcon(hass, stateOf(hass, entity)),
  }));
  const activeState = stateOf(hass, active);
  return {
    options,
    current: hasValue(activeState)
      ? options.find((option) => option.label === activeState.state)?.value
      : undefined,
    currentIcon: () => undefined,
    select: (value) => callService(hass, value, 'scene.turn_on'),
  };
}

function step(items: HTMLElement[], from: number, key: string): number | undefined {
  const last = items.length - 1;
  switch (key) {
    case 'ArrowDown':
      return from >= last ? 0 : from + 1;
    case 'ArrowUp':
      return from <= 0 ? last : from - 1;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return undefined;
  }
}

export function openMenu(anchor: HTMLElement, choice: Choice, host: Host): void {
  const container = anchor.getRootNode();
  if (!(container instanceof ShadowRoot)) {
    return;
  }
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.popover = 'manual';
  menu.setAttribute('role', 'menu');
  let items: HTMLElement[] = [];
  const close = dismissable(menu, host, {
    scroll: true,
    keys: (event) => {
      if (event.key === 'Tab') {
        close(true);
        return;
      }
      const focused = event.composedPath()[0];
      const from = items.findIndex((item) => item === focused);
      const next = step(items, from, event.key);
      if (next !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        items[next]?.focus();
      }
    },
    closed: (refocus) => {
      anchor.setAttribute('aria-expanded', 'false');
      if (refocus) {
        anchor.focus({ preventScroll: true });
      }
    },
  });
  const radio = choice.current !== undefined;
  const pick = (value: string): void => {
    run(host, choice.select(value));
    close(true);
  };
  render(
    choice.options.map((option) => {
      const selected = option.value === choice.current;
      return html`<button
        type="button"
        class=${selected ? 'selected' : ''}
        role=${radio ? 'menuitemradio' : 'menuitem'}
        aria-checked=${radio ? String(selected) : nothing}
        @click=${(event: Event) => {
          event.stopPropagation();
          pick(option.value);
        }}
      >
        ${option.icon ?? nothing}<span>${option.label}</span>
      </button>`;
    }),
    menu,
  );
  items = [...menu.querySelectorAll('button')];
  container.append(menu);
  menu.showPopover();
  anchor.setAttribute('aria-expanded', 'true');
  const selected = items.find((item) => item.classList.contains('selected'));
  (selected ?? items[0])?.focus({ preventScroll: true });
  const inset = (name: string): number =>
    Number.parseFloat(getComputedStyle(menu).getPropertyValue(name)) || 0;
  const rect = anchor.getBoundingClientRect();
  const top = inset('--safe-top') + EDGE;
  const bottom = inset('--safe-bottom') + EDGE;
  const under = window.innerHeight - bottom - rect.bottom - GAP;
  const over = rect.top - top - GAP;
  const downwards = under >= over;
  const room = Math.min(downwards ? under : over, window.innerHeight / 2);
  const rows = Math.max(MIN_ROWS, Math.floor((room - PADDING) / ROW));
  menu.style.maxHeight = `${rows * ROW + PADDING}px`;
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  menu.style.left = `${Math.max(EDGE, Math.min(rect.right - width, window.innerWidth - width - EDGE))}px`;
  menu.style.top = `${downwards ? rect.bottom + GAP : rect.top - height - GAP}px`;
  if (selected !== undefined) {
    menu.scrollTop = selected.offsetTop - (menu.clientHeight - selected.offsetHeight) / 2;
  }
}
