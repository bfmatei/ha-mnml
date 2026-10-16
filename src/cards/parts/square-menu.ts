import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { Color, Control, Item, NavControl, StateRule } from '../../contract/cards.ts';
import type { EntityId, MdiIcon, PopupHash } from '../../contract/entities.ts';
import { haptic, hasValue, run, stateOf, toggleEntity } from '../../ha/hass.ts';
import type { HomeAssistant } from '../../ha/hass.ts';
import { reduced } from '../../ha/motion.ts';
import { entityName, nameOf } from '../../ha/names.ts';
import { navigate } from '../../ha/navigation.ts';
import { shown, tint } from '../../ha/rules.ts';
import { colorStyle, icon, quietly, stateIcon } from '../../ha/templates.ts';
import { isTimer } from '../../ha/timer.ts';
import { wordsFor } from '../../words/words.ts';
import type { Host } from '../base.ts';

import { menuKeys, menuRows, modeChoice, optionChoice, sceneChoice } from './menu.ts';
import type { Choice } from './menu.ts';
import { closeButton, openOverlay } from './overlay.ts';
import { sliderSpec } from './slider-spec.ts';
import { openSliderOverlay } from './slider.ts';
import { tip } from './tooltip.ts';

const SQUARE_SLIDERS: ReadonlySet<string> = new Set(['brightness', 'color_temp', 'temperature']);

const EXPAND = 180;

interface SquareOption {
  name: string;
  icon: TemplateResult;
  open: (surface: HTMLElement, keyboard: boolean, closed: () => void) => void;
}

interface Subject {
  entity: EntityId;
  name: string;
  icon?: MdiIcon;
  color?: Color;
  when?: StateRule;
  controls?: readonly Control[];
  details?: PopupHash;
  lights?: true;
}

const redraws = new WeakMap<object, (hass: HomeAssistant, subject: Subject) => void>();

function words(host: Host): ReturnType<typeof wordsFor> {
  return wordsFor(host.hass?.locale.language ?? '');
}

function openList<V extends string>(
  surface: HTMLElement,
  choice: Choice<V>,
  label: string,
  host: Host,
  keyboard: boolean,
  closed: () => void,
): void {
  const { overlay } = openOverlay(
    surface,
    host,
    'overlay scenes',
    ({ close, schedule }) =>
      html`<div
          class="list"
          role="menu"
          aria-label=${label}
          @scroll=${schedule}
          @keydown=${(event: KeyboardEvent) => {
            const list = event.currentTarget;
            if (list instanceof HTMLElement) {
              menuKeys(event, [...list.querySelectorAll('button')], close);
            }
          }}
        >
          ${menuRows(choice, host, close)}
        </div>
        ${closeButton(words(host).close, close)}`,
    { closed },
  );
  const list = overlay.querySelector<HTMLElement>('.list');
  const rows = [...overlay.querySelectorAll<HTMLElement>('.list button')];
  const selected = rows.find((row) => row.classList.contains('selected'));
  if (list !== null && selected !== undefined) {
    const box = list.getBoundingClientRect();
    const row = selected.getBoundingClientRect();
    list.scrollTop += row.top - box.top - (list.clientHeight - row.height) / 2;
  }
  if (keyboard) {
    (selected ?? rows[0])?.focus({ preventScroll: true });
  }
}

function controlOption(hass: HomeAssistant, control: Control, host: Host): SquareOption[] {
  if (control.type === 'scenes' && shown(hass, control.show, undefined)) {
    const choice = sceneChoice(hass, control.scenes, control.active_scene);
    return choice.options.length === 0
      ? []
      : [
          {
            name: control.name,
            icon: icon(control.icon),
            open: (surface, keyboard, closed) => {
              openList(surface, choice, control.name, host, keyboard, closed);
            },
          },
        ];
  }
  if (
    control.type === 'slider' &&
    SQUARE_SLIDERS.has(control.slider) &&
    shown(hass, control.show, control.entity)
  ) {
    const stateObj = stateOf(hass, control.entity);
    const spec = hasValue(stateObj)
      ? sliderSpec(hass, control.entity, stateObj, control.slider)
      : undefined;
    return spec === undefined
      ? []
      : [
          {
            name: control.name,
            icon: icon(control.icon),
            open: (surface, keyboard, closed) => {
              openSliderOverlay(surface, spec, control, control.color, host, keyboard, closed);
            },
          },
        ];
  }
  if (control.type === 'select' && shown(hass, control.show, control.entity)) {
    const entity = control.entity;
    const stateObj = stateOf(hass, entity);
    if (isTimer(entity) || !hasValue(stateObj)) {
      return [];
    }
    const choice =
      control.attribute === undefined
        ? optionChoice(hass, entity, stateObj)
        : modeChoice(hass, entity, stateObj, control.attribute);
    const label = entityName(hass, entity);
    return choice.options.length === 0
      ? []
      : [
          {
            name: choice.options.find((option) => option.value === choice.current)?.label ?? label,
            icon: choice.currentIcon() ?? stateIcon(hass, stateObj),
            open: (surface, keyboard, closed) => {
              openList(surface, choice, label, host, keyboard, closed);
            },
          },
        ];
  }
  return [];
}

export function squareOptions(
  hass: HomeAssistant,
  controls: readonly Control[] | undefined,
  host: Host,
  details?: PopupHash,
): SquareOption[] {
  return [
    ...(controls ?? []).flatMap((control) => controlOption(hass, control, host)),
    ...(details === undefined
      ? []
      : [
          {
            name: words(host).details,
            icon: icon('mdi:dots-horizontal'),
            open: (surface: HTMLElement, _keyboard: boolean, closed: () => void) => {
              closed();
              navigate(details, surface);
            },
          },
        ]),
  ];
}

function offersOptions(controls: readonly Control[] | undefined): boolean {
  return (controls ?? []).some(
    (control) =>
      control.type === 'scenes' ||
      (control.type === 'slider' && SQUARE_SLIDERS.has(control.slider)) ||
      (control.type === 'select' && !isTimer(control.entity)),
  );
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
  lights: boolean,
  acted?: () => void,
): TemplateResult {
  const stateObj = stateOf(hass, subject.entity);
  const color = tint(subject.color, subject.when, stateObj);
  return html`<button
    type="button"
    class=${classMap({ control: true, lights, colored: color !== undefined })}
    style=${styleMap(colorStyle(color))}
    aria-label=${subject.name}
    aria-pressed=${String(hasValue(stateObj) && stateObj.state !== 'off')}
    ${tip(subject.name)}
    @click=${quietly(() => {
      haptic('light');
      run(host, toggleEntity(host.hass ?? hass, subject.entity));
      acted?.();
    })}
  >
    ${stateIcon(hass, stateObj, subject.icon)}
  </button>`;
}

interface Opened {
  key: object;
  subject: Subject;
  anchor: HTMLElement;
  host: Host;
  closed: () => void;
  keyboard: boolean;
}

function expandFrom(anchor: HTMLElement, overlay: HTMLElement): void {
  if (reduced()) {
    return;
  }
  const from = anchor.getBoundingClientRect();
  for (const button of overlay.querySelectorAll<HTMLElement>(':scope > button')) {
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

function openOptions(surface: HTMLElement, hass: HomeAssistant, opened: Opened): void {
  const { key, host, closed } = opened;
  let now = hass;
  let subject = opened.subject;
  let handed = false;
  const { overlay, redraw } = openOverlay(
    surface,
    host,
    'options',
    ({ close, schedule }) =>
      html`${powered(subject) ? powerButton(now, subject, host, false, schedule) : nothing}
      ${squareOptions(now, subject.controls, host, subject.details).map(
        (option) =>
          html`<button
            type="button"
            class="control"
            aria-label=${option.name}
            ${tip(option.name)}
            @click=${(event: Event) => {
              handed = true;
              close(true);
              option.open(surface, event instanceof UIEvent && event.detail === 0, closed);
            }}
          >
            ${option.icon}
          </button>`,
      )}`,
    {
      closed: () => {
        redraws.delete(key);
        if (!handed) {
          closed();
        }
      },
      live: true,
    },
  );
  redraws.set(key, (next, again) => {
    now = next;
    subject = again;
    redraw();
  });
  expandFrom(opened.anchor, overlay);
  if (opened.keyboard) {
    overlay.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
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
    aria-haspopup="true"
    aria-expanded="false"
    ${tip(subject.name)}
    @click=${quietly((event) => {
      const anchor = event.currentTarget;
      const surface = anchor instanceof HTMLElement ? anchor.closest('.square') : null;
      if (!(anchor instanceof HTMLElement) || !(surface instanceof HTMLElement)) {
        return;
      }
      haptic('light');
      openOptions(surface, host.hass ?? hass, {
        key,
        subject,
        anchor,
        host,
        closed: () => {
          anchor.setAttribute('aria-expanded', 'false');
        },
        keyboard: event instanceof UIEvent && event.detail === 0,
      });
      anchor.setAttribute('aria-expanded', 'true');
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
  return offersOptions(item.controls)
    ? opener(hass, item, subject, host)
    : powerButton(hass, subject, host, true);
}

export function navButton(
  hass: HomeAssistant,
  control: NavControl,
  host: Host,
): TemplateResult | undefined {
  return offersOptions(control.controls)
    ? opener(
        hass,
        control,
        {
          entity: control.entity,
          name: entityName(hass, control.entity),
          color: control.color,
          when: control.when,
          controls: control.controls,
          details: control.popup,
        },
        host,
      )
    : undefined;
}
