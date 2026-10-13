import { LitElement, css, html } from 'lit';
import type { CSSResultGroup, PropertyValues, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

import { field } from '../ha/field.ts';

export interface Related {
  readonly entities: ReadonlySet<string>;
  readonly devices: ReadonlySet<string>;
  readonly areas: ReadonlySet<string>;
}

const CONTEXT = 'related';

const KINDS = ['entities', 'devices', 'areas'] as const;

const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id));

const changedFrom = (value: Related | undefined, old: Related | undefined): boolean =>
  value === undefined || old === undefined
    ? value !== old
    : KINDS.some((kind) => !sameIds(value[kind], old[kind]));

export class MnmlRelated extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: contents;
    }
  `;

  @property({ attribute: false, hasChanged: changedFrom }) related: Related | undefined;
  private readonly told = new Map<unknown, () => void>();

  constructor() {
    super();
    this.addEventListener('context-request', this.requested);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('related')) {
      for (const [callback, dispose] of this.told) {
        this.tell(callback, dispose);
      }
    }
  }

  protected override render(): TemplateResult {
    return html`<slot></slot>`;
  }

  private readonly requested = (event: Event): void => {
    const callback = field(event, 'callback');
    if (
      field(event, 'context') !== CONTEXT ||
      typeof callback !== 'function' ||
      this.related === undefined
    ) {
      return;
    }
    event.stopPropagation();
    if (field(event, 'subscribe') !== true) {
      this.tell(callback, undefined);
      return;
    }
    const known = this.told.get(callback);
    const dispose =
      known ??
      ((): void => {
        if (this.told.get(callback) === dispose) {
          this.told.delete(callback);
        }
      });
    this.told.set(callback, dispose);
    this.tell(callback, dispose);
  };

  private tell(callback: unknown, dispose: (() => void) | undefined): void {
    if (typeof callback === 'function') {
      Reflect.apply(callback, undefined, [this.related, dispose]);
    }
  }
}
