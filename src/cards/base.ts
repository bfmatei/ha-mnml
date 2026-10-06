import { LitElement, nothing } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';

import type { HomeAssistant } from '../ha/hass.ts';

import { requireKnownKeys } from './keys.ts';
import type { KeySchema } from './keys.ts';
import { BASE_STYLE } from './styles.ts';

const ENTITY_ID = /^[a-z_]+\.[a-z0-9_]+$/;

function collectEntityIds(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    if (ENTITY_ID.test(value)) {
      into.add(value);
    }
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
  hold(): () => void;
  register(teardown: () => void): () => void;
  notify(message: string): void;
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
      next.some((stateObj, index) => stateObj !== this.snapshot[index]);
    if (changed) {
      this.snapshot = next;
      this.requestUpdate();
    }
  }

  setConfig(config: C): void {
    requireKnownKeys(config, this.schema());
    this.validate(config);
    this.releaseAll();
    this.config = config;
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

  protected abstract schema(): KeySchema;

  protected abstract draw(hass: HomeAssistant, config: C): TemplateResult | undefined;

  protected refresh(): void {
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

export function requireList(name: string, value: unknown, length?: number): void {
  if (!Array.isArray(value) || (length !== undefined && value.length !== length)) {
    throw new Error(
      length === undefined ? `${name} must be a list` : `${name} must list ${length} entities`,
    );
  }
}

export function requireString(name: string, value: unknown): void {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${name} is required`);
  }
}

export function requireNumber(name: string, value: unknown): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
}

export function requireOneOf(name: string, value: unknown, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${name} must be one of ${allowed.join(', ')}`);
  }
}
