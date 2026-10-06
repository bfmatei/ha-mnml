import { LitElement, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';

import type { Condition, Popup, TemplateCard } from '../contract/cards.ts';
import { isMapping } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import { isCondition, visible } from '../ha/conditions.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { knownShared, onShared, resolvedTemplates, sharedTemplates } from '../store/store.ts';
import type { SharedState } from '../store/store.ts';
import { discover } from '../templates/discover.ts';
import { expand, toValue } from '../templates/expand.ts';
import type { Expanded } from '../templates/expand.ts';
import { SHAPES } from '../templates/families.ts';

import { requireString } from './base.ts';
import { requireKnownKeys, schema } from './keys.ts';
import { announce, checkPopups, withdraw } from './parts/popup-registry.ts';

const SCHEMA = schema<TemplateCard>({ type: true, template: true, area: true, slots: true });

function checked(template: string, popups: readonly Value[]): Popup[] {
  try {
    return checkPopups(popups);
  } catch (error) {
    throw new Error(`${template}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

function templates(shared: SharedState): Templates {
  return resolvedTemplates(shared, SHIPPED_TEMPLATES.templates());
}

const UNSIZED = { columns: 12, rows: 'auto' };
const SIZES = new Map<string, Record<string, unknown>>();

function defaultSize(card: Value): Record<string, unknown> {
  const type = isMapping(card) ? card['type'] : undefined;
  const tag =
    typeof type === 'string' && type.startsWith('custom:')
      ? type.slice('custom:'.length)
      : undefined;
  const known = tag === undefined ? UNSIZED : SIZES.get(tag);
  if (known !== undefined || tag === undefined) {
    return known ?? UNSIZED;
  }
  const Card = customElements.get(tag);
  if (Card === undefined) {
    return UNSIZED;
  }
  const probe = new Card();
  const options =
    'getGridOptions' in probe && typeof probe.getGridOptions === 'function'
      ? probe.getGridOptions()
      : undefined;
  const size = isMapping(options) ? options : UNSIZED;
  SIZES.set(tag, size);
  return size;
}

function literal(value: Value): boolean {
  return !JSON.stringify(value).includes('[[');
}

function same(a: Expanded, b: Expanded): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function discovers(config: TemplateCard): boolean {
  return config.area !== undefined || config.slots === undefined;
}

export class MnmlTemplateCard extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    [hidden] {
      display: none;
    }
  `;

  preview = false;
  @state() private child: ChildCard | undefined;
  private config: TemplateCard | undefined;
  private current: HomeAssistant | undefined;
  private expanded: Expanded | undefined;
  private popups: Popup[] = [];
  private seen: readonly unknown[] = [];
  private basis: SharedState | undefined;
  private loaded: Templates | undefined;
  private failing = false;
  private stopShared: (() => void) | undefined;
  private drawn: Value | undefined;
  private readonly sharedChanged = (): void => {
    this.refresh(this.current);
    this.place();
  };

  setConfig(config: TemplateCard): void {
    requireKnownKeys(config, SCHEMA);
    requireString('template', config.template);
    this.config = config;
    this.seen = [];
    this.basis = undefined;
    this.loaded = undefined;
    this.drawn = undefined;
    this.expanded = undefined;
    this.popups = [];
    const shared = knownShared();
    if (!discovers(config) && shared.status === 'ready') {
      const loaded = SHIPPED_TEMPLATES.templates();
      const expanded = expand(
        templates(shared),
        { template: config.template, slots: config.slots ?? {} },
        {},
        SHIPPED_TEMPLATES.later(),
      );
      if (expanded.missing === undefined) {
        this.popups = checked(config.template, expanded.popups);
        this.expanded = expanded;
        this.basis = shared;
        this.loaded = loaded;
      } else if (SHIPPED_TEMPLATES.failure(expanded.missing) === undefined) {
        this.wait(expanded.missing);
      } else {
        this.refresh(this.current);
      }
    } else {
      this.refresh(this.current);
    }
    this.announce();
    this.place();
  }

  get hass(): HomeAssistant | undefined {
    return this.current;
  }

  set hass(hass: HomeAssistant | undefined) {
    this.current = hass;
    this.refresh(hass);
    this.place();
  }

  getCardSize(): number | Promise<number> {
    return this.child?.getCardSize?.() ?? 1;
  }

  getGridOptions(): Record<string, unknown> {
    const name = this.config?.template;
    const card =
      this.expanded?.card ??
      (name === undefined
        ? null
        : (templates(knownShared())[name]?.card ??
          (Object.hasOwn(SHAPES, name) ? SHAPES[name] : undefined))) ??
      null;
    const grid = isMapping(card) ? card['grid_options'] : undefined;
    const own = isMapping(grid) && literal(grid) ? grid : {};
    const drawn: unknown = this.child?.getGridOptions?.();
    return { ...(isMapping(drawn) ? drawn : defaultSize(card)), ...own };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.stopShared ??= onShared(this.sharedChanged);
    this.sharedChanged();
    this.announce();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    withdraw(this);
    this.stopShared?.();
    this.stopShared = undefined;
  }

  protected override render(): ChildCard | typeof nothing {
    return this.child ?? nothing;
  }

  private wait(missing: readonly string[]): void {
    void SHIPPED_TEMPLATES.need(missing).then(() => {
      this.loaded = undefined;
      this.sharedChanged();
    });
  }

  private refresh(hass: HomeAssistant | undefined): void {
    const shared = hass === undefined ? knownShared() : sharedTemplates(hass.connection);
    const config = this.config;
    if (
      config === undefined ||
      shared.status === 'waiting' ||
      (hass === undefined && discovers(config))
    ) {
      return;
    }
    const loaded = SHIPPED_TEMPLATES.templates();
    const registries = hass === undefined ? [] : [hass.areas, hass.devices, hass.entities];
    const unchanged =
      shared === this.basis &&
      loaded === this.loaded &&
      (!discovers(config) || registries.every((registry, index) => registry === this.seen[index]));
    if (unchanged) {
      return;
    }
    this.basis = shared;
    this.loaded = loaded;
    this.seen = registries;
    this.failing = false;
    const { expanded, popups } = this.expandIn(config, hass, shared);
    if (this.failing) {
      this.loaded = undefined;
    }
    if (expanded.missing !== undefined) {
      this.wait(expanded.missing);
      return;
    }
    if (this.expanded !== undefined && same(expanded, this.expanded)) {
      return;
    }
    this.expanded = expanded;
    this.popups = popups;
    this.announce();
  }

  private expandIn(
    config: TemplateCard,
    hass: HomeAssistant | undefined,
    shared: SharedState,
  ): { expanded: Expanded; popups: Popup[] } {
    try {
      if (shared.status === 'failed') {
        throw new Error(shared.error);
      }
      const all = templates(shared);
      const slots = config.slots ?? {};
      const later = SHIPPED_TEMPLATES.later();
      if (hass === undefined || !discovers(config)) {
        return this.complete(config, expand(all, { template: config.template, slots }, {}, later));
      }
      const template = all[config.template];
      const area = config.area;
      if (area !== undefined && !Object.hasOwn(hass.areas, area)) {
        throw new Error(`${config.template}: no area named ${area}`);
      }
      const found =
        template === undefined
          ? {}
          : discover(template, area, {
              areas: hass.areas,
              devices: hass.devices,
              entities: hass.entities,
              states: hass.states,
            });
      return this.complete(config, expand(all, { template: config.template, slots }, found, later));
    } catch (error) {
      return {
        expanded: {
          card: {
            type: 'error',
            error: error instanceof Error ? error.message : String(error),
            origConfig: toValue(config),
          },
          popups: [],
        },
        popups: [],
      };
    }
  }

  private complete(
    config: TemplateCard,
    expanded: Expanded,
  ): { expanded: Expanded; popups: Popup[] } {
    if (expanded.missing === undefined) {
      return { expanded, popups: checked(config.template, expanded.popups) };
    }
    const failure = SHIPPED_TEMPLATES.failure(expanded.missing);
    if (failure !== undefined) {
      this.failing = true;
      throw new Error(failure);
    }
    return { expanded, popups: [] };
  }

  private announce(): void {
    if (this.isConnected && this.expanded !== undefined && !this.preview) {
      announce(this, this.popups);
    }
  }

  private place(): void {
    const expanded = this.expanded;
    if (expanded === undefined) {
      return;
    }
    if (this.drawn !== expanded.card) {
      void this.draw(expanded.card);
    }
    const hass = this.current;
    if (hass !== undefined && this.child !== undefined) {
      this.child.hass = hass;
      const visibility = isMapping(expanded.card) ? expanded.card['visibility'] : undefined;
      const conditions: Condition[] = [];
      let judged = true;
      for (const item of Array.isArray(visibility) ? visibility : []) {
        if (isCondition(item)) {
          conditions.push(item);
        } else {
          judged = false;
        }
      }
      this.hidden = judged ? !visible(hass, conditions) : false;
    }
  }

  private async draw(card: Value): Promise<void> {
    this.drawn = card;
    const helpers = await window.loadCardHelpers?.();
    if (helpers === undefined || this.drawn !== card) {
      return;
    }
    if (!isMapping(card)) {
      return;
    }
    this.child = helpers.createCardElement(card);
    this.place();
  }
}
