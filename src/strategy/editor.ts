import { LitElement, css, html } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { OPENING_WORDS, SCREEN_WORDS } from '../builder/openings.ts';
import { defaultPlan, peopleIn } from '../builder/plan.ts';
import { BASE_STYLE, CONTROL_STYLE, SELECT_STYLE } from '../cards/styles.ts';
import type { PopupScreen } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { SYSTEM_TEMPLATES } from '../contract/plan.ts';
import type { Plan } from '../contract/plan.ts';
import { isMapping, templateTitle } from '../contract/templates.ts';
import type { Templates } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { entityName } from '../ha/names.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { icon } from '../ha/templates.ts';

import { homeTemplates } from './strategy.ts';

type Config = Readonly<Record<string, unknown>>;

interface Part {
  key: 'rooms' | 'people' | 'system';
  title: string;
  noun: string;
  field: 'area' | 'entity' | 'template';
}

const PARTS: readonly Part[] = [
  { key: 'rooms', title: 'Rooms', noun: 'the rooms', field: 'area' },
  { key: 'people', title: 'People', noun: 'the people', field: 'entity' },
  { key: 'system', title: 'System', noun: 'the system cards', field: 'template' },
];

const STYLE = css`
  :host {
    display: block;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    color: var(--primary-text-color);
  }
  .name {
    flex: 1;
    min-width: 0;
  }
  .off .name,
  .muted {
    color: var(--secondary-text-color);
  }
  .muted {
    margin: 0;
    font-size: 13px;
  }
  .control[disabled] {
    visibility: hidden;
  }
`;

function without(config: Config, key: string): Config {
  return Object.fromEntries(Object.entries(config).filter(([at]) => at !== key));
}

function moved(list: readonly unknown[], index: number, by: number): unknown[] {
  const target = index + by;
  return list.map((item, at) => (at === index ? list[target] : at === target ? list[index] : item));
}

function openingOf(open: unknown, screen: PopupScreen): string {
  const opening = isMapping(open) ? open[screen] : undefined;
  return typeof opening === 'string' ? opening : '';
}

function chosen(event: Event): string {
  return event.target instanceof HTMLSelectElement ? event.target.value : '';
}

export class MnmlStrategyEditor extends LitElement {
  static override styles: CSSResultGroup = [BASE_STYLE, CONTROL_STYLE, SELECT_STYLE, STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @state() private config: Config = {};
  @state() private templates: Templates | undefined;
  @state() private found: Plan | undefined;
  @state() private problem: string | undefined;
  private asked = false;

  setConfig(config: unknown): void {
    this.config = isMapping(config) ? config : {};
  }

  protected override willUpdate(): void {
    const hass = this.hass;
    if (hass === undefined || this.asked) {
      return;
    }
    this.asked = true;
    void homeTemplates(hass).then(
      (templates) => {
        this.templates = templates;
        this.found = defaultPlan(registriesOf(hass), templates);
      },
      (error: unknown) => {
        this.problem = error instanceof Error ? error.message : String(error);
      },
    );
  }

  protected override render(): TemplateResult {
    const found = this.found;
    if (found === undefined) {
      return html`<p class="muted">${this.problem ?? 'Finding what the home has...'}</p>`;
    }
    return html`${PARTS.map((part) => this.drawPart(part, found))}${this.drawGlances()}${this.drawSquares()}${this.drawOpen(found)}`;
  }

  private change(next: Config): void {
    this.config = next;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: next },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private idOf(part: Part, choice: unknown): string | undefined {
    const id = isMapping(choice) ? choice[part.field] : undefined;
    return typeof id === 'string' ? id : undefined;
  }

  private nameOf(part: Part, id: string): string {
    const hass = this.hass;
    if (part.key === 'rooms') {
      return hass?.areas[id]?.name ?? id;
    }
    if (part.key === 'people') {
      return hass === undefined ? id : entityName(hass, id);
    }
    return templateTitle(this.templates?.[id], id);
  }

  private choiceName(part: Part, choice: unknown): string {
    const id = this.idOf(part, choice);
    if (id !== undefined) {
      return this.nameOf(part, id);
    }
    const slots = isMapping(choice) ? choice['slots'] : undefined;
    const name = isMapping(slots) ? slots['name'] : undefined;
    return `${typeof name === 'string' ? name : 'One'}, spelled in YAML`;
  }

  private optionsOf(part: Part): string[] {
    const hass = this.hass;
    if (part.key === 'rooms') {
      return Object.keys(hass?.areas ?? {});
    }
    return part.key === 'people' ? peopleIn(registriesOf(hass)) : [...SYSTEM_TEMPLATES];
  }

  private drawPart(part: Part, found: Plan): TemplateResult {
    const given = this.config[part.key];
    const list: readonly unknown[] | undefined = Array.isArray(given) ? given : undefined;
    const label = `Choose ${part.noun}`;
    const finds: readonly unknown[] = found[part.key];
    const names = finds.map((choice) => this.choiceName(part, choice));
    return html`<section>
      <h3>${part.title}</h3>
      <label class="row">
        <input
          type="checkbox"
          aria-label=${label}
          .checked=${live(list !== undefined)}
          @change=${() => {
            this.change(
              list === undefined
                ? { ...this.config, [part.key]: found[part.key] }
                : without(this.config, part.key),
            );
          }}
        />
        <span class="name">${label}</span>
      </label>
      ${
        list === undefined
          ? html`<p class="muted">
              ${names.length === 0 ? 'MNML finds none here.' : `MNML finds them: ${names.join(', ')}`}
            </p>`
          : this.drawChosen(part, list)
      }
    </section>`;
  }

  private drawChosen(part: Part, list: readonly unknown[]): TemplateResult {
    const ids = new Set(list.map((choice) => this.idOf(part, choice)));
    const others = this.optionsOf(part).filter((id) => !ids.has(id));
    const set = (next: unknown[]): void => {
      this.change({ ...this.config, [part.key]: next });
    };
    return html`${list.map((choice, index) => {
      const name = this.choiceName(part, choice);
      return html`<div class="row">
        <input
          type="checkbox"
          aria-label=${`Show ${name}`}
          .checked=${live(true)}
          @change=${() => {
            set(list.filter((_, at) => at !== index));
          }}
        />
        <span class="name">${name}</span>
        ${this.move(`Move ${name} up`, 'mdi:arrow-up', index > 0, () => {
          set(moved(list, index, -1));
        })}
        ${this.move(`Move ${name} down`, 'mdi:arrow-down', index < list.length - 1, () => {
          set(moved(list, index, 1));
        })}
      </div>`;
    })}
    ${others.map((id) => {
      const name = this.nameOf(part, id);
      return html`<div class="row off">
        <input
          type="checkbox"
          aria-label=${`Show ${name}`}
          .checked=${live(false)}
          @change=${() => {
            set([...list, { [part.field]: id }]);
          }}
        />
        <span class="name">${name}</span>
      </div>`;
    })}`;
  }

  private move(label: string, glyph: MdiIcon, can: boolean, act: () => void): TemplateResult {
    return html`<button
      type="button"
      class="control"
      aria-label=${label}
      ?disabled=${!can}
      @click=${act}
    >
      ${icon(glyph)}
    </button>`;
  }

  private drawGlances(): TemplateResult {
    const on = this.config['glances'] !== undefined;
    return html`<section>
      <h3>Glances</h3>
      <label class="row">
        <input
          type="checkbox"
          aria-label="Show the Glances strip"
          .checked=${live(on)}
          @change=${() => {
            this.change(on ? without(this.config, 'glances') : { ...this.config, glances: {} });
          }}
        />
        <span class="name">The Glances strip, on top</span>
      </label>
    </section>`;
  }

  private drawSquares(): TemplateResult {
    const on = this.config['squares'] === true;
    return html`<section>
      <h3>Squares</h3>
      <label class="row">
        <input
          type="checkbox"
          aria-label="Draw the tiles as squares"
          .checked=${live(on)}
          @change=${() => {
            this.change(on ? without(this.config, 'squares') : { ...this.config, squares: true });
          }}
        />
        <span class="name">Square tiles, large for the rooms</span>
      </label>
    </section>`;
  }

  private drawOpen(found: Plan): TemplateResult {
    const open: unknown = this.config['open'] ?? found.open;
    const opened = (screen: PopupScreen, opening: string): Config =>
      Object.fromEntries(
        SCREEN_WORDS.flatMap(({ screen: each }) => {
          const value = each === screen ? opening : openingOf(open, each);
          return value === '' ? [] : [[each, value]];
        }),
      );
    return html`<section>
      <h3>Pop-ups</h3>
      <p class="muted">How a tile's pop-up opens on each screen.</p>
      ${SCREEN_WORDS.map(
        ({ screen, label, otherwise }) =>
          html`<label class="row">
            <span class="name">${label}</span>
            <select
              aria-label=${label}
              .value=${live(openingOf(open, screen))}
              @change=${(event: Event) => {
                this.change({ ...this.config, open: opened(screen, chosen(event)) });
              }}
            >
              <option value="" ?selected=${openingOf(open, screen) === ''}>
                The default, ${otherwise}
              </option>
              ${OPENING_WORDS.map(
                ({ opening, label: words }) =>
                  html`<option value=${opening} ?selected=${openingOf(open, screen) === opening}>
                    ${words}
                  </option>`,
              )}
            </select>
          </label>`,
      )}
    </section>`;
  }
}
