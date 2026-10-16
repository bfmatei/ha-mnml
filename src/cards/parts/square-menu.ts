import { html, nothing, render } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type {
  Color,
  Control,
  Item,
  NavControl,
  SelectControl,
  SliderControl,
  StateRule,
} from '../../contract/cards.ts';
import type { EntityId, MdiIcon } from '../../contract/entities.ts';
import { rightToLeft } from '../../ha/direction.ts';
import { haptic, hasValue, run, stateOf, toggleEntity } from '../../ha/hass.ts';
import type { HomeAssistant } from '../../ha/hass.ts';
import { reduced } from '../../ha/motion.ts';
import { entityName, nameOf } from '../../ha/names.ts';
import { shown, tint } from '../../ha/rules.ts';
import { colorStyle, icon, quietly, stateIcon } from '../../ha/templates.ts';
import { isTimer } from '../../ha/timer.ts';
import { wordsFor } from '../../words/words.ts';
import type { Host } from '../base.ts';

import { modeChoice, optionChoice, sceneChoice } from './menu.ts';
import type { Choice } from './menu.ts';
import { dismissable } from './overlay.ts';
import { sliderSpec } from './slider-spec.ts';
import type { SliderSpec } from './slider-spec.ts';
import { MnmlSlider } from './slider.ts';
import { tip } from './tooltip.ts';

const SQUARE_SLIDERS: ReadonlySet<string> = new Set([
  'brightness',
  'color_temp',
  'hue',
  'temperature',
]);

const EXPAND = 180;
const PAD = 4;

interface Subject {
  entity: EntityId;
  name: string;
  icon?: MdiIcon;
  color?: Color;
  when?: StateRule;
  controls?: readonly Control[];
  lights?: true;
}

type Part =
  | {
      control: SliderControl;
      name: string;
      label: string;
      icon: TemplateResult;
      spec: SliderSpec;
      choice?: never;
      off?: never;
    }
  | {
      control: Control;
      name: string;
      label: string;
      icon: TemplateResult;
      spec?: never;
      choice: Choice;
      off?: never;
    }
  | {
      control: Control;
      name: string;
      label: string;
      icon: TemplateResult;
      spec?: never;
      choice?: never;
      off: true;
    };

const redraws = new WeakMap<object, (hass: HomeAssistant, subject: Subject) => void>();
const menus = new WeakMap<object, (refocus?: boolean) => void>();

function sliderOf(hass: HomeAssistant, control: SliderControl): Part[] {
  if (!SQUARE_SLIDERS.has(control.slider)) {
    return [];
  }
  const stateObj = stateOf(hass, control.entity);
  const spec =
    hasValue(stateObj) && shown(hass, control.show, control.entity)
      ? sliderSpec(hass, control.entity, stateObj, control.slider)
      : undefined;
  const look = { control, name: control.name, label: control.name, icon: icon(control.icon) };
  return [spec === undefined ? { ...look, off: true } : { ...look, spec }];
}

function selectOf(hass: HomeAssistant, control: SelectControl): Part[] {
  if (isTimer(control.entity)) {
    return [];
  }
  const label = control.name ?? entityName(hass, control.entity);
  const stateObj = stateOf(hass, control.entity);
  const own = stateIcon(hass, stateObj, control.icon);
  if (!hasValue(stateObj)) {
    return [{ control, name: label, label, icon: own, off: true }];
  }
  const choice =
    control.attribute === undefined
      ? optionChoice(hass, control.entity, stateObj)
      : modeChoice(hass, control.entity, stateObj, control.attribute);
  if (choice.options.length === 0) {
    return [];
  }
  const current = choice.options.find((option) => option.value === choice.current)?.label;
  const look = {
    control,
    name:
      current === undefined ? label : control.name === undefined ? current : `${label}: ${current}`,
    label,
    icon: choice.currentIcon() ?? own,
  };
  return [shown(hass, control.show, control.entity) ? { ...look, choice } : { ...look, off: true }];
}

function partOf(hass: HomeAssistant, control: Control): Part[] {
  if (control.type === 'slider') {
    return sliderOf(hass, control);
  }
  if (control.type === 'select') {
    return selectOf(hass, control);
  }
  if (control.type === 'scenes') {
    const choice = sceneChoice(hass, control.scenes, control.active_scene);
    const look = { control, name: control.name, label: control.name, icon: icon(control.icon) };
    if (choice.options.length === 0) {
      return [];
    }
    return [shown(hass, control.show, undefined) ? { ...look, choice } : { ...look, off: true }];
  }
  return [];
}

function partsOf(hass: HomeAssistant, controls: readonly Control[] | undefined): Part[] {
  return (controls ?? []).flatMap((control) => partOf(hass, control));
}

function powered(subject: Subject): boolean {
  return (
    subject.lights === true ||
    (subject.controls ?? []).some(
      (control) => control.type === 'toggle' && control.entity === subject.entity,
    )
  );
}

function powerButton(
  hass: HomeAssistant,
  subject: Subject,
  host: Host,
  className: string,
): TemplateResult {
  const stateObj = stateOf(hass, subject.entity);
  const color = tint(subject.color, subject.when, stateObj);
  return html`<button
    type="button"
    class=${classMap({ control: true, [className]: true, colored: color !== undefined })}
    style=${styleMap(colorStyle(color))}
    aria-label=${subject.name}
    aria-pressed=${String(hasValue(stateObj) && stateObj.state !== 'off')}
    ${tip(subject.name)}
    @click=${quietly(() => {
      haptic('light');
      run(host, toggleEntity(host.hass ?? hass, subject.entity));
    })}
  >
    ${stateIcon(hass, stateObj, subject.icon)}
  </button>`;
}

function rows(part: Part, choice: Choice, host: Host): TemplateResult {
  const marks = choice.current !== undefined;
  return html`<div class="rows" role="group" aria-label=${part.label}>
    ${choice.options.map((option) => {
      const selected = option.value === choice.current;
      return html`<button
        type="button"
        class=${classMap({ selected })}
        aria-pressed=${marks ? String(selected) : nothing}
        @click=${quietly(() => {
          haptic('selection');
          run(host, choice.select(option.value, host.hass));
        })}
      >
        ${option.icon ?? nothing}<span>${option.label}</span>
      </button>`;
    })}
  </div>`;
}

interface Actions {
  pick: (part: Part, keyboard: boolean) => void;
  back: (keyboard: boolean) => void;
}

function keyed(event: Event): boolean {
  return event instanceof UIEvent && event.detail === 0;
}

function arranged(subject: Subject, parts: readonly Part[]): Part[] {
  if (powered(subject)) {
    return [...parts];
  }
  const lead =
    parts.find(
      (part) => part.control.type === 'select' && part.control.entity === subject.entity,
    ) ?? parts[0];
  return lead === undefined ? [] : [lead, ...parts.filter((part) => part !== lead)];
}

function optionButton(
  hass: HomeAssistant,
  subject: Subject,
  part: Part,
  lead: boolean,
  actions: Actions,
): TemplateResult {
  const stateObj = stateOf(hass, subject.entity);
  const color = lead ? tint(subject.color, subject.when, stateObj) : undefined;
  const name = lead ? `${subject.name}: ${part.name}` : part.name;
  return html`<button
    type="button"
    class=${classMap({
      control: true,
      option: true,
      lead,
      off: part.off === true,
      colored: color !== undefined,
    })}
    style=${styleMap(colorStyle(color))}
    aria-label=${name}
    aria-disabled=${part.off ? 'true' : nothing}
    ${tip(name)}
    @click=${quietly((event) => {
      if (part.off) {
        return;
      }
      haptic('selection');
      actions.pick(part, keyed(event));
    })}
  >
    ${lead ? stateIcon(hass, stateObj, subject.icon) : part.icon}
  </button>`;
}

function options(
  hass: HomeAssistant,
  subject: Subject,
  parts: readonly Part[],
  host: Host,
  actions: Actions,
): TemplateResult {
  const ordered = arranged(subject, parts);
  const lead = powered(subject) ? undefined : ordered[0];
  return html`${lead === undefined ? powerButton(hass, subject, host, 'power') : nothing}
  ${ordered.map((part) => optionButton(hass, subject, part, part === lead, actions))}`;
}

function whole(
  subject: Subject,
  part: Part,
  host: Host,
  actions: Actions,
  arrow: MdiIcon,
): TemplateResult {
  const back = wordsFor(host.hass?.locale.language ?? '').back;
  return html`<div class="head">
      <button
        type="button"
        class="control back"
        aria-label=${back}
        ${tip(back)}
        @click=${quietly((event) => {
          actions.back(keyed(event));
        })}
      >
        ${icon(arrow)}
      </button>
      <span class="title">${part.choice === undefined ? subject.name : part.label}</span>
    </div>
    ${
      part.spec !== undefined
        ? html`<mnml-slider
            .spec=${part.spec}
            .label=${part.control}
            .color=${part.control.color}
            .owner=${host}
          ></mnml-slider>`
        : part.choice !== undefined
          ? rows(part, part.choice, host)
          : nothing
    }`;
}

interface Opened {
  key: object;
  subject: Subject;
  anchor: HTMLElement;
  square: HTMLElement;
  host: Host;
  keyboard: boolean;
}

function expandFrom(anchor: HTMLElement, node: HTMLElement): void {
  if (reduced()) {
    return;
  }
  const from = anchor.getBoundingClientRect();
  for (const button of node.querySelectorAll<HTMLElement>('.option:not(.lead)')) {
    const to = button.getBoundingClientRect();
    const x = from.left + from.width / 2 - (to.left + to.width / 2);
    const y = from.top + from.height / 2 - (to.top + to.height / 2);
    button.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.6)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: EXPAND, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
  }
}

function focus(target: HTMLElement | null | undefined): void {
  if (target instanceof MnmlSlider) {
    void target.updateComplete.then(() => {
      if (target.isConnected) {
        target.focus();
      }
    });
    return;
  }
  target?.focus({ preventScroll: true });
}

function showSelected(node: HTMLElement): void {
  const list = node.querySelector<HTMLElement>('.rows');
  const selected = list?.querySelector<HTMLElement>('.selected');
  if (list !== null && list !== undefined && selected !== null && selected !== undefined) {
    const box = list.getBoundingClientRect();
    const row = selected.getBoundingClientRect();
    list.scrollTop += row.top - box.top - (list.clientHeight - row.height) / 2;
  }
}

function openMenu(hass: HomeAssistant, opened: Opened): void {
  const { key, anchor, square, host } = opened;
  let now = hass;
  let subject = opened.subject;
  let view: Control | undefined;
  const arrow: MdiIcon = rightToLeft(anchor) ? 'mdi:arrow-right' : 'mdi:arrow-left';
  const node = document.createElement('div');
  node.className = 'square-menu';
  node.setAttribute('role', 'group');
  node.setAttribute('aria-label', subject.name);
  const close = dismissable(node, host, {
    live: true,
    closed: (refocus) => {
      menus.delete(key);
      redraws.delete(key);
      anchor.setAttribute('aria-expanded', 'false');
      if (refocus) {
        anchor.focus({ preventScroll: true });
      }
    },
  });
  menus.set(key, close);
  const draw = (): void => {
    const parts = partsOf(now, subject.controls);
    const part = parts.find((each) => each.control === view && each.off === undefined);
    view = part?.control;
    node.classList.toggle('whole', part !== undefined);
    render(
      part === undefined
        ? options(now, subject, parts, host, actions)
        : whole(subject, part, host, actions, arrow),
      node,
    );
  };
  const actions: Actions = {
    pick: (part, keyboard) => {
      view = part.control;
      draw();
      showSelected(node);
      if (keyboard) {
        focus(
          node.querySelector<HTMLElement>('mnml-slider') ??
            node.querySelector<HTMLElement>('.rows > .selected') ??
            node.querySelector<HTMLElement>('.rows > button') ??
            node.querySelector<HTMLElement>('.back'),
        );
      }
    },
    back: (keyboard) => {
      const from = view;
      view = undefined;
      draw();
      if (keyboard) {
        const index = arranged(subject, partsOf(now, subject.controls)).findIndex(
          (each) => each.control === from,
        );
        focus(node.querySelectorAll<HTMLElement>('.option')[index] ?? node.querySelector('button'));
      }
    },
  };
  redraws.set(key, (next, again) => {
    now = next;
    subject = again;
    draw();
  });
  node.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  const box = square.getBoundingClientRect();
  const button = anchor.getBoundingClientRect();
  const foot = button.top + button.height / 2 + anchor.offsetHeight / 2;
  node.style.setProperty('--m-from', `${box.bottom - foot - PAD}px`);
  draw();
  square.append(node);
  anchor.setAttribute('aria-expanded', 'true');
  expandFrom(anchor, node);
  if (opened.keyboard) {
    focus(node.querySelector<HTMLElement>('button'));
  }
}

function opener(hass: HomeAssistant, key: object, subject: Subject, host: Host): TemplateResult {
  redraws.get(key)?.(hass, subject);
  const stateObj = stateOf(hass, subject.entity);
  const color = tint(subject.color, subject.when, stateObj);
  return html`<button
    type="button"
    class=${classMap({ control: true, lights: subject.lights === true, colored: color !== undefined })}
    style=${styleMap(colorStyle(color))}
    aria-label=${subject.name}
    aria-expanded="false"
    ${tip(subject.name)}
    @click=${quietly((event) => {
      const open = menus.get(key);
      if (open !== undefined) {
        open(true);
        return;
      }
      const anchor = event.currentTarget;
      const square = anchor instanceof HTMLElement ? anchor.closest('.square') : null;
      if (!(anchor instanceof HTMLElement) || !(square instanceof HTMLElement)) {
        return;
      }
      haptic('light');
      openMenu(host.hass ?? hass, {
        key,
        subject,
        anchor,
        square,
        host,
        keyboard: keyed(event),
      });
    })}
  >
    ${stateIcon(hass, stateObj, subject.icon)}
  </button>`;
}

export function lightsButton(hass: HomeAssistant, item: Item, host: Host): TemplateResult {
  const subject: Subject = {
    entity: item.entity,
    name: nameOf(hass, item.entity, item),
    icon: item.icon,
    color: item.color,
    when: item.when,
    controls: item.controls,
    lights: true,
  };
  return partsOf(hass, item.controls).length > 0
    ? opener(hass, item, subject, host)
    : powerButton(hass, subject, host, 'lights');
}

export function navButton(
  hass: HomeAssistant,
  control: NavControl,
  host: Host,
): TemplateResult | undefined {
  return partsOf(hass, control.controls).length > 0
    ? opener(
        hass,
        control,
        {
          entity: control.entity,
          name: entityName(hass, control.entity),
          color: control.color,
          when: control.when,
          controls: control.controls,
        },
        host,
      )
    : undefined;
}
