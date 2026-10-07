import { html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { carCard, personCard, roomCard, systemCard } from '../builder/dashboard.ts';
import { peopleIn, roomShows, systemFills } from '../builder/plan.ts';
import { SYSTEM_TEMPLATES, isPlan } from '../contract/builder.ts';
import type { PersonChoice, Plan } from '../contract/builder.ts';
import type { PopupOpen, PopupOpening } from '../contract/cards.ts';
import type { MdiIcon, PersonId } from '../contract/entities.ts';
import type { Templates } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import type { Registries } from '../templates/discover.ts';

import { PANEL_STYLE } from './style.ts';

export interface PlanHost {
  save: (plan: Plan, address: string) => Promise<void>;
  leave: () => void;
}

type Device = keyof PopupOpen;

const ADDRESS = /^[a-z0-9_]+(?:-[a-z0-9_]+)+$/;
const ICON = /^mdi:[a-z0-9-]+$/;
const DEVICES: readonly { device: Device; label: string; otherwise: string }[] = [
  { device: 'phone', label: 'On a phone', otherwise: 'a sheet' },
  { device: 'tablet', label: 'On a tablet', otherwise: 'a dialog' },
  { device: 'desktop', label: 'On a computer', otherwise: 'a dialog' },
];
const OPENINGS: readonly { opening: PopupOpening; label: string }[] = [
  { opening: 'sheet', label: 'A sheet from the bottom' },
  { opening: 'dialog', label: 'A dialog in the middle' },
  { opening: 'unfold', label: 'Unfolded from its tile' },
];
const SYSTEM_NAMES: Readonly<Record<string, string>> = {
  'home-assistant': 'Home Assistant',
  'proxmox-server': 'Proxmox VE server',
  'unifi-network': 'UniFi network',
  adguard: 'AdGuard Home',
  'media-server': 'Media server',
};

function registriesOf(hass: HomeAssistant | undefined): Registries {
  return {
    areas: hass?.areas ?? {},
    devices: hass?.devices ?? {},
    entities: hass?.entities ?? {},
    states: hass?.states ?? {},
  };
}

const isIcon = (value: string): value is MdiIcon => ICON.test(value);

function withOpening(
  open: PopupOpen,
  device: Device,
  opening: PopupOpening | undefined,
): PopupOpen {
  const next: PopupOpen = {};
  for (const each of DEVICES) {
    const value = each.device === device ? opening : open[each.device];
    if (value !== undefined) {
      next[each.device] = value;
    }
  }
  return next;
}

function text(event: Event): string {
  const value = field(event.target, 'value');
  return typeof value === 'string' ? value : '';
}

function moved<T>(list: readonly T[], from: number, by: number): T[] {
  const to = from + by;
  if (to < 0 || to >= list.length) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) {
    next.splice(to, 0, item);
  }
  return next;
}

function withPerson(
  chosen: readonly PersonChoice[],
  entity: PersonId,
  order: readonly PersonId[],
): PersonChoice[] {
  return order.flatMap((each) => {
    const kept = chosen.find((person) => person.entity === each);
    return kept === undefined ? (each === entity ? [{ entity }] : []) : [kept];
  });
}

export class MnmlPlanEditor extends LitElement {
  static override styles = PANEL_STYLE;

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) templates: Templates = {};
  @property({ attribute: false }) plan: Plan | undefined;
  @property({ attribute: false }) address = '';
  @property({ attribute: false }) fresh = false;
  @property({ attribute: false }) taken: ReadonlySet<string> = new Set();
  @property({ attribute: false }) host: PlanHost | undefined;
  @state() private draft: Plan | undefined;
  @state() private where = '';
  @state() private iconText = '';
  @state() private problem: string | undefined;
  @state() private saving = false;
  private readonly found = new Map<string, boolean>();
  private seen: readonly unknown[] = [];

  protected override willUpdate(changed: PropertyValues<this>): void {
    const now = [this.templates, this.hass?.areas, this.hass?.devices, this.hass?.entities];
    if (now.some((each, index) => each !== this.seen[index])) {
      this.seen = now;
      this.found.clear();
    }
    if (changed.has('plan') && this.plan !== undefined) {
      this.draft = structuredClone(this.plan);
      this.iconText = this.plan.icon;
      this.problem = undefined;
    }
    if (changed.has('address')) {
      this.where = this.address;
    }
  }

  private remembered(key: string, find: () => boolean): boolean {
    const known = this.found.get(key);
    if (known !== undefined) {
      return known;
    }
    const value = find();
    this.found.set(key, value);
    return value;
  }

  private change(next: Partial<Plan>): void {
    if (this.draft !== undefined) {
      this.draft = { ...this.draft, ...next };
      this.problem = undefined;
    }
  }

  private check(plan: Plan): string | undefined {
    if (plan.title.trim() === '') {
      return 'A dashboard needs a title.';
    }
    if (!isIcon(this.iconText)) {
      return 'An icon is mdi: and its name, such as mdi:home-variant.';
    }
    if (this.fresh && !ADDRESS.test(this.where)) {
      return 'An address is lower case letters, digits and _, with at least one - between them, such as dashboard-home.';
    }
    if (this.fresh && this.taken.has(this.where)) {
      return `/${this.where} is taken.`;
    }
    return isPlan(plan) ? undefined : 'Something in this dashboard is not what MNML keeps.';
  }

  private async save(): Promise<void> {
    const plan = this.draft;
    const host = this.host;
    if (plan === undefined || host === undefined) {
      return;
    }
    const tidy = { ...plan, title: plan.title.trim() };
    this.problem = this.check(tidy);
    if (this.problem !== undefined) {
      return;
    }
    this.saving = true;
    try {
      await host.save(tidy, this.where);
    } catch (error) {
      this.problem = error instanceof Error ? error.message : String(error);
    } finally {
      this.saving = false;
    }
  }

  private drawTile(config: object): TemplateResult {
    return html`<mnml-live-card
      class="plan-tile"
      .config=${config}
      .hass=${this.hass}
    ></mnml-live-card>`;
  }

  private drawDashboard(plan: Plan): TemplateResult {
    return html`<section class="plan-section">
      <h2>Dashboard</h2>
      <label class="plan-field">
        <span>Title</span>
        <span class="plan-icon">
          <input
            class="fact-input wide"
            .value=${live(plan.title)}
            @input=${(event: Event) => {
              this.change({ title: text(event) });
            }}
          />
        </span>
      </label>
      <label class="plan-field">
        <span>Icon</span>
        <span class="plan-icon">
          ${isIcon(this.iconText) ? icon(this.iconText) : nothing}
          <input
            class="fact-input wide"
            .value=${live(this.iconText)}
            @input=${(event: Event) => {
              this.iconText = text(event).trim();
              this.problem = undefined;
              if (isIcon(this.iconText)) {
                this.change({ icon: this.iconText });
              }
            }}
          />
        </span>
      </label>
      ${
        this.fresh
          ? html`<label class="plan-field">
              <span>Address</span>
              <span class="plan-icon">
                <span class="muted">/</span>
                <input
                  class="fact-input wide"
                  .value=${live(this.where)}
                  @input=${(event: Event) => {
                    this.where = text(event);
                    this.problem = undefined;
                  }}
                />
              </span>
            </label>`
          : nothing
      }
    </section>`;
  }

  private drawRooms(plan: Plan, registries: Registries): TemplateResult {
    const chosen = plan.rooms.filter((room) => Object.hasOwn(registries.areas, room.area));
    const others = Object.values(registries.areas).filter(
      (area) => !chosen.some((room) => room.area === area.area_id),
    );
    return html`<section class="plan-section">
      <h2>Rooms</h2>
      <p class="muted">Each area with a light gets a room tile. Tick the ones to show, in order.</p>
      ${chosen.map(
        (room, index) => html`<div class="plan-row">
          <input
            type="checkbox"
            checked
            aria-label=${`Show ${registries.areas[room.area]?.name ?? room.area}`}
            @change=${() => {
              this.change({ rooms: plan.rooms.filter((each) => each !== room) });
            }}
          />
          ${this.drawTile(roomCard(room))}
          <span class="row-actions">
            <button
              type="button"
              class="icon-button"
              aria-label="Move up"
              title="Move up"
              ?disabled=${index === 0}
              @click=${() => {
                this.change({ rooms: moved(chosen, index, -1) });
              }}
            >
              ${icon('mdi:arrow-up')}
            </button>
            <button
              type="button"
              class="icon-button"
              aria-label="Move down"
              title="Move down"
              ?disabled=${index === chosen.length - 1}
              @click=${() => {
                this.change({ rooms: moved(chosen, index, 1) });
              }}
            >
              ${icon('mdi:arrow-down')}
            </button>
          </span>
        </div>`,
      )}
      ${others.map((area) => {
        const shows = this.remembered(`room:${area.area_id}`, () =>
          roomShows(registries, this.templates, area.area_id),
        );
        return html`<div class="plan-row off">
          <input
            type="checkbox"
            aria-label=${`Show ${area.name}`}
            ?disabled=${!shows}
            @change=${() => {
              this.change({ rooms: [...chosen, { area: area.area_id }] });
            }}
          />
          <span class="plan-words">
            <span>${area.name}</span>
            ${shows ? nothing : html`<span class="muted">A room tile needs a light here.</span>`}
          </span>
        </div>`;
      })}
    </section>`;
  }

  private drawPeople(plan: Plan, registries: Registries): TemplateResult {
    const people = peopleIn(registries);
    return html`<section class="plan-section">
      <h2>People</h2>
      ${
        people.length === 0
          ? html`<p class="muted">Home Assistant has no people yet.</p>`
          : people.map((entity) => {
              const choice = plan.people.find((person) => person.entity === entity);
              const name = registries.states[entity]?.attributes['friendly_name'];
              return html`<div class=${choice === undefined ? 'plan-row off' : 'plan-row'}>
                <input
                  type="checkbox"
                  aria-label=${`Show ${typeof name === 'string' ? name : entity}`}
                  .checked=${live(choice !== undefined)}
                  @change=${() => {
                    this.change({
                      people:
                        choice === undefined
                          ? withPerson(plan.people, entity, people)
                          : plan.people.filter((person) => person !== choice),
                    });
                  }}
                />
                ${
                  choice === undefined
                    ? html`<span class="plan-words"
                        >${typeof name === 'string' ? name : entity}</span
                      >`
                    : this.drawTile(personCard(choice, registries))
                }
              </div>`;
            })
      }
    </section>`;
  }

  private drawGarage(plan: Plan): TemplateResult | typeof nothing {
    if (plan.cars.length === 0) {
      return nothing;
    }
    return html`<section class="plan-section">
      <h2>Garage</h2>
      ${plan.cars.map(
        (car) => html`<div class="plan-row">
          ${this.drawTile(carCard(car))}
          <span class="row-actions">
            <button
              type="button"
              class="icon-button"
              aria-label=${`Remove ${car.key}`}
              title=${`Remove ${car.key}`}
              @click=${() => {
                this.change({ cars: plan.cars.filter((each) => each !== car) });
              }}
            >
              ${icon('mdi:delete-outline')}
            </button>
          </span>
        </div>`,
      )}
    </section>`;
  }

  private drawSystem(plan: Plan, registries: Registries): TemplateResult {
    return html`<section class="plan-section">
      <h2>System</h2>
      ${SYSTEM_TEMPLATES.map((name) => {
        const choice = plan.system.find((each) => each.template === name);
        const fills =
          choice?.slots !== undefined ||
          this.remembered(`system:${name}`, () => systemFills(registries, this.templates, name));
        const label = SYSTEM_NAMES[name] ?? name;
        return html`<div class=${choice === undefined ? 'plan-row off' : 'plan-row'}>
          <input
            type="checkbox"
            aria-label=${`Show ${label}`}
            .checked=${live(choice !== undefined)}
            ?disabled=${!fills && choice === undefined}
            @change=${() => {
              this.change({
                system:
                  choice === undefined
                    ? SYSTEM_TEMPLATES.flatMap((each) =>
                        each === name
                          ? [{ template: name }]
                          : plan.system.filter((kept) => kept.template === each),
                      )
                    : plan.system.filter((each) => each !== choice),
              });
            }}
          />
          ${
            choice === undefined
              ? html`<span class="plan-words">
                  <span>${label}</span>
                  ${
                    fills
                      ? nothing
                      : html`<span class="muted"
                          >MNML does not find its entities in this home.</span
                        >`
                  }
                </span>`
              : this.drawTile(systemCard(choice, registries, this.templates))
          }
        </div>`;
      })}
    </section>`;
  }

  private drawPopups(plan: Plan): TemplateResult {
    return html`<section class="plan-section">
      <h2>Pop-ups</h2>
      <p class="muted">How a tile's pop-up opens on each screen.</p>
      ${DEVICES.map(
        ({ device, label, otherwise }) => html`<label class="plan-field">
          <span>${label}</span>
          <select
            class="area-picker"
            .value=${live(plan.open[device] ?? '')}
            @change=${(event: Event) => {
              const value = OPENINGS.find((each) => each.opening === text(event))?.opening;
              this.change({ open: withOpening(plan.open, device, value) });
            }}
          >
            <option value="" ?selected=${plan.open[device] === undefined}>
              The default, ${otherwise}
            </option>
            ${OPENINGS.map(
              ({ opening, label: words }) =>
                html`<option value=${opening} ?selected=${plan.open[device] === opening}>
                  ${words}
                </option>`,
            )}
          </select>
        </label>`,
      )}
    </section>`;
  }

  protected override render(): TemplateResult {
    const plan = this.draft;
    if (plan === undefined) {
      return html`<p class="muted loading">Reading the home...</p>`;
    }
    const registries = registriesOf(this.hass);
    return html`<div class="library plan">
      <div class="library-head">
        <span class="plan-title">
          <button
            type="button"
            class="icon-button"
            aria-label="Back to the dashboards"
            title="Back to the dashboards"
            @click=${() => this.host?.leave()}
          >
            ${icon('mdi:arrow-left')}
          </button>
          <h1>${this.fresh ? 'A new dashboard' : `Edit ${this.plan?.title ?? plan.title}`}</h1>
        </span>
        <div class="library-tools">
          <button
            type="button"
            class="action primary"
            ?disabled=${this.saving}
            @click=${() => {
              void this.save();
            }}
          >
            ${icon(this.fresh ? 'mdi:check' : 'mdi:refresh')}<span
              >${this.fresh ? 'Create' : 'Rebuild'}</span
            >
          </button>
        </div>
      </div>
      ${this.problem === undefined ? nothing : html`<p class="problem-line">${this.problem}</p>`}
      ${this.drawDashboard(plan)} ${this.drawRooms(plan, registries)}
      ${this.drawPeople(plan, registries)} ${this.drawGarage(plan)}
      ${this.drawSystem(plan, registries)} ${this.drawPopups(plan)}
    </div>`;
  }
}
