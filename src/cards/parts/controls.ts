import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type {
  Color,
  Control,
  IndicatorControl,
  NavControl,
  ScenesControl,
  SelectControl,
  ServiceControl,
  SliderControl,
  StatusControl,
  ToggleControl,
  TyresControl,
} from '../../contract/cards.ts';
import type { EntityId, MdiIcon } from '../../contract/entities.ts';
import { formatState } from '../../ha/format.ts';
import {
  callService,
  hasValue,
  isUnavailable,
  numericState,
  run,
  stateOf,
  toggleEntity,
} from '../../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../../ha/hass.ts';
import { entityName, nameOf } from '../../ha/names.ts';
import { navigate, prebuild } from '../../ha/navigation.ts';
import { UNAVAILABLE, active, matches, shown, tint, tyreBand } from '../../ha/rules.ts';
import { colorStyle, icon, quietly, stateIcon } from '../../ha/templates.ts';
import { requireList, requireOneOf } from '../base.ts';
import type { Host } from '../base.ts';

import { modeChoice, openMenu, optionChoice, sceneChoice } from './menu.ts';
import type { Choice } from './menu.ts';
import { openSliderOverlay, sliderSpec } from './slider.ts';

export interface ControlContext {
  hass: HomeAssistant;
  host: Host;
}

type Action = ToggleControl | SliderControl | SelectControl | ServiceControl;

interface Look {
  title: string;
  spoken?: string;
  color?: Color | undefined;
  primary?: boolean | undefined;
}

function classes(look: Look, inert: boolean): ReturnType<typeof classMap> {
  return classMap({
    control: true,
    inert,
    primary: look.primary === true,
    colored: look.color !== undefined,
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
    aria-label=${look.spoken ?? look.title}
    title=${look.title}
    aria-pressed=${extra.pressed === undefined ? nothing : String(extra.pressed)}
    aria-haspopup=${extra.menu ? 'menu' : nothing}
    aria-expanded=${extra.menu ? 'false' : nothing}
    @click=${quietly(run)}
  >
    ${glyph}
  </button>`;
}

function inert(look: Look, glyph: TemplateResult): TemplateResult {
  return html`<div
    class=${classes(look, true)}
    style=${styleMap(colorStyle(look.color))}
    role="img"
    aria-label=${look.spoken ?? look.title}
    title=${look.title}
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

function toggle(control: ToggleControl, ctx: ControlContext): TemplateResult {
  const stateObj = stateOf(ctx.hass, control.entity);
  return pressed(
    {
      title: entityName(ctx.hass, control.entity),
      primary: control.primary,
      color: tint(control.color, control.when, stateObj),
    },
    stateIcon(ctx.hass, stateObj, control.icon),
    () => {
      const hass = ctx.host.hass ?? ctx.hass;
      run(ctx.host, toggleEntity(hass, control.entity));
    },
    { pressed: active(control.when, stateObj) },
  );
}

function slider(control: SliderControl, ctx: ControlContext): TemplateResult {
  return pressed({ title: control.name }, icon(control.icon), (event) => {
    const hass = ctx.host.hass ?? ctx.hass;
    const stateObj = stateOf(hass, control.entity);
    const spec = hasValue(stateObj)
      ? sliderSpec(hass, control.entity, stateObj, control.slider)
      : undefined;
    const surface = anchorOf(event)?.closest('.card, .heading');
    if (spec !== undefined && surface instanceof HTMLElement) {
      openSliderOverlay(surface, spec, control, control.color, ctx.host);
    }
  });
}

function select(control: SelectControl, ctx: ControlContext): TemplateResult | undefined {
  const stateObj = stateOf(ctx.hass, control.entity);
  if (stateObj === undefined) {
    return undefined;
  }
  const choice =
    control.attribute === undefined
      ? optionChoice(ctx.hass, control.entity, stateObj)
      : modeChoice(ctx.hass, control.entity, stateObj, control.attribute);
  if (choice.options.length === 0) {
    return undefined;
  }
  return pressed(
    {
      title: entityName(ctx.hass, control.entity),
      primary: control.primary,
      color: tint(control.color, control.when, stateObj),
    },
    choice.currentIcon() ?? stateIcon(ctx.hass, stateObj),
    menuOpener(choice, ctx),
    { menu: true },
  );
}

function service(control: ServiceControl, ctx: ControlContext): TemplateResult {
  return pressed({ title: control.name, primary: control.primary }, icon(control.icon), () => {
    const hass = ctx.host.hass ?? ctx.hass;
    run(ctx.host, callService(hass, control.entity, control.service));
  });
}

function nav(control: NavControl, ctx: ControlContext): TemplateResult {
  const stateObj = stateOf(ctx.hass, control.entity);
  const title = entityName(ctx.hass, control.entity);
  return html`<button
    type="button"
    class=${classes({ title, color: tint(control.color, control.when, stateObj) }, false)}
    style=${styleMap(colorStyle(tint(control.color, control.when, stateObj)))}
    aria-label=${title}
    title=${title}
    @pointerdown=${quietly(() => {
      prebuild(control.popup);
    })}
    @click=${quietly(() => {
      navigate(control.popup);
    })}
  >
    ${stateIcon(ctx.hass, stateObj)}
  </button>`;
}

function indicator(control: IndicatorControl, ctx: ControlContext): TemplateResult {
  const stateObj = stateOf(ctx.hass, control.entity);
  const name = entityName(ctx.hass, control.entity);
  const title =
    hasValue(stateObj) || isUnavailable(stateObj)
      ? `${name}: ${formatState(ctx.hass, stateObj)}`
      : name;
  return inert(
    { title, color: tint(control.color, undefined, stateObj) },
    stateIcon(ctx.hass, stateObj),
  );
}

function status(control: StatusControl, ctx: ControlContext): TemplateResult {
  const down = new Map<EntityId, string>();
  for (const rule of control.rules) {
    const lines: string[] = [];
    for (const entityId of rule.entities) {
      const stateObj = stateOf(ctx.hass, entityId);
      if (isUnavailable(stateObj)) {
        down.set(
          entityId,
          `${nameOf(ctx.hass, entityId, rule)}: ${formatState(ctx.hass, stateObj)}`,
        );
      } else if (hasValue(stateObj) && matches(rule, stateObj.state)) {
        lines.push(
          `${nameOf(ctx.hass, entityId, rule)}: ${formatState(ctx.hass, stateObj, rule.words)}`,
        );
      }
    }
    if (lines.length > 0) {
      const parts = [control.name, ...lines];
      return inert(
        { title: parts.join('\n'), spoken: parts.join('. '), color: rule.color },
        icon(control.icon),
      );
    }
  }
  if (down.size > 0) {
    const parts = [control.name, ...down.values()];
    return inert(
      { title: parts.join('\n'), spoken: parts.join('. '), color: UNAVAILABLE },
      icon(control.icon),
    );
  }
  return inert({ title: control.name }, icon(control.icon));
}

function tyres(control: TyresControl, ctx: ControlContext): TemplateResult {
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
  const title = low ? 'Tyre pressure low' : warn ? 'Tyre pressure dropping' : 'Tyres';
  return inert(
    {
      title: off === undefined || low || warn ? title : `${title}: ${formatState(ctx.hass, off)}`,
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
    { title: `${name}: ${formatState(ctx.hass, stateObj)}`, primary, color: UNAVAILABLE },
    own ? stateIcon(ctx.hass, stateObj, glyphIcon) : icon(control.icon),
  );
}

function scenes(control: ScenesControl, ctx: ControlContext): TemplateResult | undefined {
  const choice = sceneChoice(ctx.hass, control.scenes, control.active_scene);
  if (choice.options.length === 0) {
    return undefined;
  }
  return pressed({ title: control.name }, icon(control.icon), menuOpener(choice, ctx), {
    menu: true,
  });
}

const ACTIONS = new Set(['toggle', 'slider', 'select', 'service']);

function isAction(control: Control): control is Action {
  return ACTIONS.has(control.type);
}

function controlEntity(control: Control): EntityId | undefined {
  switch (control.type) {
    case 'status':
    case 'tyres':
    case 'scenes':
      return undefined;
    default:
      return control.entity;
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
    default:
      return undefined;
  }
}

const CONTROL_TYPES = Object.keys({
  toggle: true,
  slider: true,
  select: true,
  service: true,
  nav: true,
  indicator: true,
  status: true,
  tyres: true,
  scenes: true,
} satisfies Record<Control['type'], true>);

export function requireControls(name: string, controls: readonly Control[] | undefined): void {
  for (const [index, control] of (controls ?? []).entries()) {
    requireOneOf(`${name}[${index}].type`, control.type, CONTROL_TYPES);
    if (control.type === 'status') {
      requireList(`${name}[${index}].rules`, control.rules);
      for (const [at, rule] of control.rules.entries()) {
        requireList(`${name}[${index}].rules[${at}].entities`, rule.entities);
      }
    }
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
