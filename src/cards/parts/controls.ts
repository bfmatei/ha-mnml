import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type {
  Color,
  Control,
  DismissControl,
  IndicatorControl,
  MessagesControl,
  NavControl,
  ScenesControl,
  SelectControl,
  ServiceControl,
  SliderControl,
  StatusControl,
  ToggleControl,
  TyresControl,
} from '../../contract/cards.ts';
import type { EntityId, MdiIcon, PopupHash } from '../../contract/entities.ts';
import { formatState } from '../../ha/format.ts';
import {
  callAction,
  callService,
  haptic,
  hasValue,
  isUnavailable,
  numericState,
  run,
  stateOf,
  toggleAction,
  toggleEntity,
} from '../../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';
import { messageCount } from '../../ha/message-count.ts';
import { entityName, nameOf } from '../../ha/names.ts';
import { navigate, prebuild } from '../../ha/navigation.ts';
import { partOf } from '../../ha/part.ts';
import { UNAVAILABLE, matches, shown, tint, tyreBand } from '../../ha/rules.ts';
import { colorStyle, icon, quietly, stateIcon } from '../../ha/templates.ts';
import { isTimer, timerPresets } from '../../ha/timer.ts';
import { wordsFor } from '../../words/words.ts';
import type { Host } from '../base.ts';

import { asks, confirmed, isArmed } from './confirm.ts';
import { modeChoice, openMenu, optionChoice, presetChoice, sceneChoice } from './menu.ts';
import type { Choice } from './menu.ts';
import { sliderSpec } from './slider-spec.ts';
import { openSliderOverlay } from './slider.ts';
import { tip } from './tooltip.ts';

export interface ControlContext {
  hass: HomeAssistant;
  host: Host;
}

type Action = ToggleControl | SliderControl | SelectControl | ServiceControl;

interface Look {
  title: string;
  part?: string | typeof nothing;
  spoken?: string;
  color?: Color | undefined;
  primary?: boolean | undefined;
  armed?: string | undefined;
}

function classes(look: Look, inert: boolean): ReturnType<typeof classMap> {
  return classMap({
    control: true,
    inert,
    primary: look.primary === true,
    colored: look.color !== undefined,
    armed: look.armed !== undefined,
  });
}

function pressed(
  look: Look,
  glyph: TemplateResult,
  run: (event: Event) => void,
  extra: { pressed?: boolean; menu?: true } = {},
): TemplateResult {
  return html`<button
    type="button"
    class=${classes(look, false)}
    style=${styleMap(colorStyle(look.color))}
    data-part=${look.part ?? nothing}
    aria-label=${look.spoken ?? look.title}
    ${tip(look.armed === undefined ? look.title : undefined)}
    aria-pressed=${extra.pressed === undefined ? nothing : String(extra.pressed)}
    aria-haspopup=${extra.menu ? 'menu' : nothing}
    aria-expanded=${extra.menu ? 'false' : nothing}
    @click=${quietly(run)}
  >
    ${glyph}${look.armed === undefined ? nothing : html`<span class="ask">${look.armed}</span>`}
  </button>`;
}

function inert(look: Look, glyph: TemplateResult): TemplateResult {
  return html`<div
    class=${classes(look, true)}
    style=${styleMap(colorStyle(look.color))}
    data-part=${look.part ?? nothing}
    role="img"
    aria-label=${look.spoken ?? look.title}
    ${tip(look.title)}
  >
    ${glyph}
  </div>`;
}

function anchorOf(event: Event): HTMLElement | undefined {
  const target = event.currentTarget;
  return target instanceof HTMLElement ? target : undefined;
}

function menuOpener(choice: Choice, ctx: ControlContext): (event: Event) => void {
  return (event) => {
    const anchor = anchorOf(event);
    if (anchor !== undefined) {
      openMenu(anchor, choice, ctx.host);
    }
  };
}

const AT_REST: Readonly<Record<string, string>> = {
  lock: 'locked',
  alarm_control_panel: 'disarmed',
  cover: 'closed',
};

function isOn(entityId: EntityId, stateObj: HassEntity | undefined): boolean {
  if (!hasValue(stateObj) || stateObj.state === 'off') {
    return false;
  }
  return stateObj.state !== AT_REST[entityId.split('.')[0] ?? ''];
}

function toggle(control: ToggleControl, ctx: ControlContext): TemplateResult {
  const stateObj = stateOf(ctx.hass, control.entity);
  const name = entityName(ctx.hass, control.entity);
  const action = toggleAction(ctx.hass, control.entity);
  const armed = isArmed(ctx.host, control) && asks(ctx.hass, control.confirm, control.entity);
  const words = wordsFor(ctx.hass.locale.language);
  return pressed(
    {
      title: name,
      part: partOf(control),
      spoken: armed ? words.askAbout(action, name) : undefined,
      primary: control.primary,
      color: tint(control.color, control.when, stateObj),
      armed: armed ? words.ask(action) : undefined,
    },
    stateIcon(ctx.hass, stateObj, control.icon),
    () => {
      const hass = ctx.host.hass ?? ctx.hass;
      confirmed(ctx.host, control, asks(hass, control.confirm, control.entity), () => {
        haptic('light');
        run(ctx.host, toggleEntity(hass, control.entity));
      });
    },
    { pressed: isOn(control.entity, stateObj) },
  );
}

function slider(control: SliderControl, ctx: ControlContext): TemplateResult {
  return pressed({ title: control.name, part: partOf(control) }, icon(control.icon), (event) => {
    const hass = ctx.host.hass ?? ctx.hass;
    const stateObj = stateOf(hass, control.entity);
    const spec = hasValue(stateObj)
      ? sliderSpec(hass, control.entity, stateObj, control.slider)
      : undefined;
    const surface = anchorOf(event)?.closest('.tile > .row, .card, .heading');
    const keyboard = event instanceof UIEvent && event.detail === 0;
    if (spec !== undefined && surface instanceof HTMLElement) {
      openSliderOverlay(surface, spec, control, control.color, ctx.host, keyboard);
    }
  });
}

function select(control: SelectControl, ctx: ControlContext): TemplateResult | undefined {
  const stateObj = stateOf(ctx.hass, control.entity);
  if (stateObj === undefined) {
    return undefined;
  }
  const entity = control.entity;
  const choice = isTimer(entity)
    ? presetChoice(
        ctx.hass,
        entity,
        timerPresets(ctx.hass, entity, () => {
          ctx.host.refresh();
        }),
      )
    : control.attribute === undefined
      ? optionChoice(ctx.hass, entity, stateObj)
      : modeChoice(ctx.hass, entity, stateObj, control.attribute);
  if (choice.options.length === 0) {
    return undefined;
  }
  return pressed(
    {
      title: entityName(ctx.hass, control.entity),
      part: partOf(control),
      primary: control.primary,
      color: tint(control.color, control.when, stateObj),
    },
    choice.currentIcon() ?? stateIcon(ctx.hass, stateObj),
    menuOpener(choice, ctx),
    { menu: true },
  );
}

function service(control: ServiceControl, ctx: ControlContext): TemplateResult {
  const armed = isArmed(ctx.host, control) && asks(ctx.hass, control.confirm, control.entity);
  const asked = armed ? wordsFor(ctx.hass.locale.language).ask(control.name) : undefined;
  return pressed(
    {
      title: control.name,
      part: partOf(control),
      spoken: asked,
      primary: control.primary,
      armed: asked,
    },
    icon(control.icon),
    () => {
      const hass = ctx.host.hass ?? ctx.hass;
      confirmed(ctx.host, control, asks(hass, control.confirm, control.entity), () => {
        run(ctx.host, callService(hass, control.entity, control.service));
      });
    },
  );
}

function linked(look: Look, glyph: TemplateResult, popup: PopupHash): TemplateResult {
  return html`<button
    type="button"
    class=${classes(look, false)}
    style=${styleMap(colorStyle(look.color))}
    data-part=${look.part ?? nothing}
    aria-label=${look.spoken ?? look.title}
    ${tip(look.title)}
    @pointerdown=${quietly(() => {
      prebuild(popup);
    })}
    @click=${quietly((event) => {
      navigate(popup, anchorOf(event));
    })}
  >
    ${glyph}
  </button>`;
}

function nav(control: NavControl, ctx: ControlContext): TemplateResult {
  const stateObj = stateOf(ctx.hass, control.entity);
  return linked(
    {
      title: entityName(ctx.hass, control.entity),
      part: partOf(control),
      color: tint(control.color, control.when, stateObj),
    },
    stateIcon(ctx.hass, stateObj),
    control.popup,
  );
}

function messages(control: MessagesControl, ctx: ControlContext): TemplateResult | undefined {
  const all = messageCount(ctx.host, ctx.hass)?.all ?? 0;
  if (all === 0) {
    return undefined;
  }
  return linked(
    { title: `${control.name}: ${all}`, part: partOf(control), color: control.color },
    icon(control.icon),
    control.popup,
  );
}

function dismiss(control: DismissControl, ctx: ControlContext): TemplateResult | undefined {
  if ((messageCount(ctx.host, ctx.hass)?.notifications ?? 0) === 0) {
    return undefined;
  }
  const asked = isArmed(ctx.host, control)
    ? wordsFor(ctx.hass.locale.language).ask(control.name)
    : undefined;
  return pressed(
    { title: control.name, part: partOf(control), spoken: asked, armed: asked },
    icon(control.icon),
    () => {
      confirmed(ctx.host, control, true, () => {
        run(
          ctx.host,
          callAction(ctx.host.hass ?? ctx.hass, 'persistent_notification.dismiss_all', {}),
        );
      });
    },
  );
}

function indicator(control: IndicatorControl, ctx: ControlContext): TemplateResult {
  const stateObj = stateOf(ctx.hass, control.entity);
  const name = entityName(ctx.hass, control.entity);
  const title =
    hasValue(stateObj) || isUnavailable(stateObj)
      ? `${name}: ${formatState(ctx.hass, stateObj)}`
      : name;
  return inert(
    { title, part: partOf(control), color: tint(control.color, undefined, stateObj) },
    stateIcon(ctx.hass, stateObj),
  );
}

function namesUnavailable(rule: StatusControl['rules'][number]): boolean {
  return rule.is?.some((entry) => entry.toLowerCase() === 'unavailable') === true;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

interface Wake {
  due: number;
  cancel: () => void;
}

const wakes = new WeakMap<Host, Wake>();

function wakeAt(host: Host, at: number): void {
  const due = Math.min(at, Date.now() + HOUR);
  const pending = wakes.get(host);
  if (!host.isConnected || (pending !== undefined && pending.due <= due)) {
    return;
  }
  pending?.cancel();
  const timer = setTimeout(() => {
    wake.cancel();
    host.refresh();
  }, due - Date.now());
  const wake: Wake = {
    due,
    cancel: () => {
      clearTimeout(timer);
      unregister();
      if (wakes.get(host) === wake) {
        wakes.delete(host);
      }
    },
  };
  const unregister = host.register(wake.cancel);
  wakes.set(host, wake);
}

function holds(rule: StatusControl['rules'][number], stateObj: HassEntity, host: Host): boolean {
  if (rule.below !== undefined) {
    const level = numericState(stateObj);
    return level !== undefined && level < rule.below;
  }
  if (rule.within_days !== undefined) {
    const from = Date.parse(stateObj.state) - rule.within_days * DAY;
    if (from > Date.now()) {
      wakeAt(host, from);
    }
    return from <= Date.now();
  }
  return matches(rule, stateObj.state);
}

function status(control: StatusControl, ctx: ControlContext): TemplateResult | undefined {
  const down = new Map<EntityId, string>();
  for (const rule of control.rules) {
    const lines: string[] = [];
    for (const entityId of rule.entities) {
      const stateObj = stateOf(ctx.hass, entityId);
      if (isUnavailable(stateObj) && !namesUnavailable(rule)) {
        down.set(
          entityId,
          `${nameOf(ctx.hass, entityId, rule)}: ${formatState(ctx.hass, stateObj)}`,
        );
      } else if (
        (isUnavailable(stateObj) || hasValue(stateObj)) &&
        holds(rule, stateObj, ctx.host)
      ) {
        lines.push(
          `${nameOf(ctx.hass, entityId, rule)}: ${formatState(ctx.hass, stateObj, rule.words)}`,
        );
      }
    }
    if (lines.length > 0) {
      const parts = [control.name, ...lines];
      return inert(
        {
          title: parts.join('\n'),
          part: partOf(control),
          spoken: parts.join('. '),
          color: rule.color,
        },
        icon(control.icon),
      );
    }
  }
  if (down.size > 0) {
    const parts = [control.name, ...down.values()];
    return inert(
      {
        title: parts.join('\n'),
        part: partOf(control),
        spoken: parts.join('. '),
        color: UNAVAILABLE,
      },
      icon(control.icon),
    );
  }
  return control.silent === true
    ? undefined
    : inert({ title: control.name, part: partOf(control) }, icon(control.icon));
}

function tyres(control: TyresControl, ctx: ControlContext): TemplateResult | undefined {
  const bands = new Set(
    control.tyres.map((tyre, index) =>
      tyreBand(
        numericState(stateOf(ctx.hass, tyre)),
        numericState(stateOf(ctx.hass, control.targets[index])),
        control.low_share,
        control.warn_share,
      ),
    ),
  );
  const low = bands.has('low');
  const warn = bands.has('warn');
  const off = control.tyres.map((tyre) => stateOf(ctx.hass, tyre)).find(isUnavailable);
  if (control.silent === true && !low && !warn && off === undefined) {
    return undefined;
  }
  const words = wordsFor(ctx.hass.locale.language).tyres;
  const title = low ? words.low : warn ? words.dropping : words.name;
  return inert(
    {
      title: off === undefined || low || warn ? title : `${title}: ${formatState(ctx.hass, off)}`,
      part: partOf(control),
      color: low ? 'red' : warn ? 'orange' : off === undefined ? undefined : UNAVAILABLE,
    },
    icon('mdi:car-tire-alert'),
  );
}

function unavailable(control: Action, ctx: ControlContext, stateObj: HassEntity): TemplateResult {
  const own = control.type === 'toggle' || control.type === 'select';
  const name = own ? entityName(ctx.hass, control.entity) : control.name;
  const primary = control.type !== 'slider' && control.primary;
  const glyphIcon: MdiIcon | undefined = control.type === 'toggle' ? control.icon : undefined;
  return inert(
    {
      title: `${name}: ${formatState(ctx.hass, stateObj)}`,
      part: partOf(control),
      primary,
      color: UNAVAILABLE,
    },
    own ? stateIcon(ctx.hass, stateObj, glyphIcon) : icon(control.icon),
  );
}

function scenes(control: ScenesControl, ctx: ControlContext): TemplateResult | undefined {
  const choice = sceneChoice(ctx.hass, control.scenes, control.active_scene);
  if (choice.options.length === 0) {
    return undefined;
  }
  return pressed(
    { title: control.name, part: partOf(control) },
    icon(control.icon),
    menuOpener(choice, ctx),
    { menu: true },
  );
}

const ACTIONS = new Set(['toggle', 'slider', 'select', 'service']);

function isAction(control: Control): control is Action {
  return ACTIONS.has(control.type);
}

function controlEntity(control: Control): EntityId | undefined {
  switch (control.type) {
    case 'toggle':
    case 'slider':
    case 'select':
    case 'service':
    case 'nav':
    case 'indicator':
      return control.entity;
    case 'status':
    case 'tyres':
    case 'scenes':
    case 'messages':
    case 'dismiss':
      return undefined;
  }
}

function pressable(control: Control, stateObj: HassEntity | undefined): boolean {
  return (
    control.type === 'service' &&
    control.entity.startsWith('button.') &&
    stateObj !== undefined &&
    !isUnavailable(stateObj)
  );
}

function renderControl(control: Control, ctx: ControlContext): TemplateResult | undefined {
  const entityId = controlEntity(control);
  if (!shown(ctx.hass, control.show, entityId)) {
    return undefined;
  }
  const stateObj = stateOf(ctx.hass, entityId);
  if (isAction(control) && !hasValue(stateObj) && !pressable(control, stateObj)) {
    return isUnavailable(stateObj) ? unavailable(control, ctx, stateObj) : undefined;
  }
  switch (control.type) {
    case 'toggle':
      return toggle(control, ctx);
    case 'slider':
      return slider(control, ctx);
    case 'select':
      return select(control, ctx);
    case 'service':
      return service(control, ctx);
    case 'nav':
      return nav(control, ctx);
    case 'indicator':
      return indicator(control, ctx);
    case 'status':
      return status(control, ctx);
    case 'tyres':
      return tyres(control, ctx);
    case 'scenes':
      return scenes(control, ctx);
    case 'messages':
      return messages(control, ctx);
    case 'dismiss':
      return dismiss(control, ctx);
    default:
      return undefined;
  }
}

export function controlsOf(controls: Control[] | undefined, ctx: ControlContext): TemplateResult[] {
  return (controls ?? []).flatMap((control) => renderControl(control, ctx) ?? []);
}

export function renderControls(
  controls: Control[] | undefined,
  ctx: ControlContext,
  className = 'lane',
): TemplateResult | undefined {
  const drawn = controlsOf(controls, ctx);
  return drawn.length === 0 ? undefined : html`<div class=${className}>${drawn}</div>`;
}
