import { LitElement, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';

import type { Popup, TemplateCard } from '../contract/cards.ts';
import { CARD_STRUCTURES } from '../contract/structure.ts';
import { isMapping, sameValue, templateTitle } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';
import type { ChildCard } from '../ha/card-helpers.ts';
import { Judge } from '../ha/conditions.ts';
import { energyPrefs } from '../ha/energy.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { knownShared, onShared, resolvedTemplates, sharedTemplates } from '../store/store.ts';
import type { SharedState } from '../store/store.ts';
import { discover } from '../templates/discover.ts';
import { expand, TemplateError } from '../templates/expand.ts';
import type { Expanded } from '../templates/expand.ts';
import { SIZES } from '../templates/families.ts';
import type { Words } from '../words/en.ts';
import { wordsFor } from '../words/words.ts';

import { requireCard } from './keys.ts';
import { cardOf } from './parts/card-element.ts';
import { announce, checkPopups, withdraw } from './parts/popup-registry.ts';

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

function failureOf(error: unknown, name: string, shared: SharedState): string {
  if (error instanceof TemplateError) {
    return `${templateTitle(templates(shared)[name], name)}: ${error.said}`;
  }
  return error instanceof Error ? error.message : String(error);
}

const UNSIZED = { columns: 12, rows: 'auto' };
const PROBED = new Map<string, Record<string, unknown>>();

function defaultSize(card: Value): Record<string, unknown> {
  const type = isMapping(card) ? card['type'] : undefined;
  const tag =
    typeof type === 'string' && type.startsWith('custom:')
      ? type.slice('custom:'.length)
      : undefined;
  const known = tag === undefined ? UNSIZED : PROBED.get(tag);
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
  PROBED.set(tag, size);
  return size;
}

function literal(value: Value): boolean {
  return !JSON.stringify(value).includes('[[');
}

function discovers(config: TemplateCard): boolean {
  return config.area !== undefined || config.device !== undefined || config.slots === undefined;
}

function wordsOf(hass: HomeAssistant | undefined): Words['templates'] {
  return wordsFor(hass?.locale.language ?? '').templates;
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
  private words: Words['templates'] | undefined;
  private failing = false;
  private stopShared: (() => void) | undefined;
  private drawn: Value | undefined;
  private energyOf: unknown;
  private readonly judge = new Judge(() => {
    this.rejudge();
  });

  private readonly sharedChanged = (): void => {
    this.refresh(this.current);
    this.place();
  };

  setConfig(config: TemplateCard): void {
    requireCard(config, CARD_STRUCTURES['custom:mnml-template-card']);
    this.config = config;
    this.seen = [];
    this.basis = undefined;
    this.loaded = undefined;
    this.words = undefined;
    this.drawn = undefined;
    this.expanded = undefined;
    this.popups = [];
    const shared = knownShared();
    if (!discovers(config) && shared.status === 'ready') {
      const loaded = SHIPPED_TEMPLATES.templates();
      const words = wordsOf(this.current);
      const expanded = expand(
        templates(shared),
        { template: config.template, slots: config.slots ?? {} },
        {},
        SHIPPED_TEMPLATES.later(),
        undefined,
        words,
      );
      if (expanded.missing === undefined) {
        this.popups = checked(config.template, expanded.popups);
        this.expanded = expanded;
        this.basis = shared;
        this.loaded = loaded;
        this.words = words;
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
          (Object.hasOwn(SIZES, name) ? SIZES[name] : undefined))) ??
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
    this.judge.close();
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
    const words = wordsOf(hass);
    const registries = hass === undefined ? [] : [hass.areas, hass.devices, hass.entities];
    const unchanged =
      shared === this.basis &&
      loaded === this.loaded &&
      words === this.words &&
      (!discovers(config) || registries.every((registry, index) => registry === this.seen[index]));
    if (unchanged) {
      return;
    }
    this.basis = shared;
    this.loaded = loaded;
    this.words = words;
    this.seen = registries;
    this.failing = false;
    const { expanded, popups } = this.expandIn(config, hass, shared, words);
    if (this.failing) {
      this.loaded = undefined;
    }
    if (expanded.missing !== undefined) {
      this.wait(expanded.missing);
      return;
    }
    if (this.expanded !== undefined && sameValue(expanded, this.expanded)) {
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
    words: Words['templates'],
  ): { expanded: Expanded; popups: Popup[] } {
    try {
      if (shared.status === 'failed') {
        throw new Error(shared.error);
      }
      const all = templates(shared);
      const instance = { template: config.template, slots: config.slots ?? {} };
      const later = SHIPPED_TEMPLATES.later();
      if (hass === undefined || !discovers(config)) {
        return this.complete(config, expand(all, instance, {}, later, undefined, words));
      }
      const template = all[config.template];
      const { area, device } = config;
      if (device !== undefined && !Object.hasOwn(hass.devices, device)) {
        throw new Error(`${config.template}: no device named ${device}`);
      }
      if (area !== undefined && !Object.hasOwn(hass.areas, area)) {
        throw new Error(`${config.template}: no area named ${area}`);
      }
      this.askEnergy(hass);
      const found =
        template === undefined ? {} : discover(template, area, registriesOf(hass), device);
      return this.complete(config, expand(all, instance, found, later, undefined, words));
    } catch (error) {
      return {
        expanded: {
          card: {
            type: 'error',
            error: failureOf(error, config.template, shared),
          },
          popups: [],
        },
        popups: [],
      };
    }
  }

  private askEnergy(hass: HomeAssistant): void {
    if (this.energyOf === hass.connection) {
      return;
    }
    this.energyOf = hass.connection;
    void energyPrefs(hass.connection).then((prefs) => {
      if (prefs !== undefined && this.energyOf === hass.connection) {
        this.seen = [];
        this.sharedChanged();
      }
    });
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
      this.rejudge();
    }
  }

  private rejudge(): void {
    const hass = this.current;
    const card = this.expanded?.card;
    if (hass === undefined || !isMapping(card)) {
      return;
    }
    this.hidden = !this.judge.shown(card['visibility'], hass, card['entity']);
  }

  private async draw(card: Value): Promise<void> {
    this.drawn = card;
    if (!isMapping(card)) {
      return;
    }
    const child = await cardOf(card);
    if (this.drawn !== card) {
      return;
    }
    this.child = child;
    this.place();
  }
}
