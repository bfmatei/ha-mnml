import { LitElement, nothing } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';

import { isEntityId } from '../contract/entities.ts';
import type { Structure } from '../contract/structure.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { partName } from '../ha/part.ts';

import { requireCard } from './keys.ts';
import { BASE_STYLE } from './styles.ts';

function collectEntityIds(value: unknown, into: Set<string>): void {
  if (isEntityId(value)) {
    into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectEntityIds(item, into);
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key !== 'service') {
        collectEntityIds(item, into);
      }
    }
  }
}

export interface Host {
  readonly hass: HomeAssistant | undefined;
  readonly isConnected: boolean;
  hold(): () => void;
  register(teardown: () => void): () => void;
  notify(message: string): void;
  refresh(): void;
}

export abstract class MnmlCard<C extends { type: string }> extends LitElement implements Host {
  static override styles: CSSResultGroup = BASE_STYLE;

  protected config: C | undefined;
  protected readonly columns: number = 12;
  private current: HomeAssistant | undefined;
  private watched: string[] = [];
  private snapshot: unknown[] = [];
  private holds = 0;
  private generation = 0;
  private empty = false;
  private readonly teardowns = new Set<() => void>();

  get hass(): HomeAssistant | undefined {
    return this.current;
  }

  set hass(hass: HomeAssistant | undefined) {
    const previous = this.current;
    this.current = hass;
    if (hass === undefined) {
      return;
    }
    const next = this.watched.map((id) => hass.states[id]);
    const changed =
      previous === undefined ||
      previous.entities !== hass.entities ||
      previous.devices !== hass.devices ||
      previous.locale !== hass.locale ||
      previous.localize !== hass.localize ||
      previous.formatEntityState !== hass.formatEntityState ||
      previous.formatEntityAttributeName !== hass.formatEntityAttributeName ||
      previous.formatEntityAttributeValue !== hass.formatEntityAttributeValue ||
      previous.config !== hass.config ||
      next.some((stateObj, index) => stateObj !== this.snapshot[index]);
    if (changed) {
      this.snapshot = next;
      this.requestUpdate();
    }
  }

  setConfig(config: C): void {
    requireCard(config, this.structure());
    this.validate(config);
    this.releaseAll();
    this.config = config;
    const part = partName(config);
    if (part !== undefined) {
      this.dataset['part'] = part;
    } else {
      delete this.dataset['part'];
    }
    const ids = new Set<string>();
    collectEntityIds(config, ids);
    this.watched = [...ids];
    this.snapshot = [];
    this.requestUpdate();
  }

  hold(): () => void {
    const issued = this.generation;
    this.holds += 1;
    let released = false;
    return () => {
      if (released || issued !== this.generation) {
        return;
      }
      released = true;
      this.holds -= 1;
      if (this.holds === 0) {
        this.snapshot = [];
        this.requestUpdate();
      }
    };
  }

  register(teardown: () => void): () => void {
    this.teardowns.add(teardown);
    return () => {
      this.teardowns.delete(teardown);
    };
  }

  notify(message: string): void {
    this.dispatchEvent(
      new CustomEvent('hass-notification', {
        bubbles: true,
        composed: true,
        detail: { message },
      }),
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAll();
  }

  getCardSize(): number {
    return 1;
  }

  getGridOptions(): { columns: number; rows: 'auto' } {
    return { columns: this.columns, rows: 'auto' };
  }

  protected validate(_config: C): void {}

  protected abstract structure(): Structure;

  protected abstract draw(hass: HomeAssistant, config: C): TemplateResult | undefined;

  refresh(): void {
    this.requestUpdate();
  }

  protected override shouldUpdate(): boolean {
    return this.holds === 0;
  }

  protected override render(): TemplateResult | typeof nothing {
    const { config, current } = this;
    if (config === undefined || current === undefined) {
      this.empty = true;
      return nothing;
    }
    const drawn = this.draw(current, config);
    this.empty = drawn === undefined;
    return drawn ?? nothing;
  }

  protected override updated(): void {
    this.style.display = this.empty ? 'none' : '';
  }

  private releaseAll(): void {
    this.generation += 1;
    const pending = [...this.teardowns];
    this.teardowns.clear();
    for (const teardown of pending) {
      teardown();
    }
    this.holds = 0;
    this.snapshot = [];
    this.requestUpdate();
  }
}
