import { html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { carFrom, personFrom, roomFrom, systemFrom } from '../builder/customized.ts';
import { carCard, personCard, roomCard, systemCard } from '../builder/dashboard.ts';
import { peopleIn, roomShows, systemFills } from '../builder/plan.ts';
import {
  SECTION_LOOKS,
  SYSTEM_NAMES,
  SYSTEM_TEMPLATES,
  isPlan,
  lookOf,
} from '../contract/builder.ts';
import type {
  PersonChoice,
  Plan,
  SectionKey,
  SectionLook,
  SystemChoice,
} from '../contract/builder.ts';
import type { PopupOpen, PopupOpening, TemplateCard } from '../contract/cards.ts';
import type { MdiIcon, PersonId } from '../contract/entities.ts';
import { isMapping } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';
import { discover } from '../templates/discover.ts';
import type { Registries } from '../templates/discover.ts';
import { expand, toValue } from '../templates/expand.ts';
import { rolesOf } from '../templates/roles.ts';

import { customize } from './customize.ts';
import { PANEL_STYLE } from './style.ts';

export interface PlanHost {
  save: (plan: Plan, address: string) => Promise<void>;
  leave: () => void;
}

type Device = keyof PopupOpen;

const ADDRESS = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const LONGEST = 64;
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

function registriesOf(hass: HomeAssistant | undefined): Registries {
  return {
    areas: hass?.areas ?? {},
    devices: hass?.devices ?? {},
    entities: hass?.entities ?? {},
    states: hass?.states ?? {},
  };
}

const isIcon = (value: string): value is MdiIcon => ICON.test(value);

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function asConfig(card: TemplateCard): Record<string, Value> {
  const value = toValue(card);
  return isMapping(value) ? value : {};
}

function iconButton(
  name: MdiIcon,
  label: string,
  run: () => void,
  disabled = false,
): TemplateResult {
  return html`<button
    type="button"
    class="icon-button"
    aria-label=${label}
    title=${label}
    ?disabled=${disabled}
    @click=${run}
  >
    ${icon(name)}
  </button>`;
}

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

function templatesOf(plan: Plan): { rooms: string; people: string; cars: string } {
  return {
    rooms: lookOf(plan, 'rooms').template ?? 'room',
    people: lookOf(plan, 'people').template ?? 'person',
    cars: lookOf(plan, 'garage').template ?? 'car',
  };
}

function withLook(
  plan: Plan,
  key: SectionKey,
  change: Partial<Record<keyof SectionLook, string>>,
): Plan['sections'] {
  const fallback = SECTION_LOOKS[key];
  const merged: Partial<Record<keyof SectionLook, string>> = { ...plan.sections?.[key], ...change };
  const title = merged.title;
  const icon = merged.icon === fallback.icon ? undefined : merged.icon;
  const template = merged.template === fallback.template ? undefined : merged.template;
  const look: SectionLook = {
    ...(title === undefined || title === '' ? {} : { title }),
    ...(icon === undefined || !isIcon(icon) ? {} : { icon }),
    ...(template === undefined || template === '' ? {} : { template }),
  };
  const others = Object.fromEntries(
    Object.entries(plan.sections ?? {}).filter(([section]) => section !== key),
  );
  const sections = Object.keys(look).length === 0 ? others : { ...others, [key]: look };
  return Object.keys(sections).length === 0 ? undefined : sections;
}

function withSystem(chosen: readonly SystemChoice[], choice: SystemChoice): SystemChoice[] {
  return SYSTEM_TEMPLATES.flatMap((name) =>
    name === choice.template ? [choice] : chosen.filter((each) => each.template === name),
  );
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
    if (this.fresh && (!ADDRESS.test(this.where) || this.where.length > LONGEST)) {
      return `An address is lower case letters and digits, with at least one - between them, such as dashboard-home, and at most ${LONGEST} long.`;
    }
    if (this.fresh && this.taken.has(this.where)) {
      return `/${this.where} is taken.`;
    }
    return isPlan(plan) ? undefined : 'Something in this dashboard is not what MNML keeps.';
  }

  private problemOf(template: string, config: Record<string, Value>): string | undefined {
    if (config['template'] !== template) {
      return `This card is drawn by the ${template} template: pick it again under Change.`;
    }
    const found = this.templates[template];
    if (found === undefined) {
      return `${template} is not a template MNML knows.`;
    }
    const area = typeof config['area'] === 'string' ? config['area'] : undefined;
    const slots = isMapping(config['slots']) ? config['slots'] : undefined;
    try {
      const expanded = expand(
        this.templates,
        { template, slots: slots ?? {} },
        area !== undefined || slots === undefined
          ? discover(found, area, registriesOf(this.hass))
          : {},
      );
      return expanded.missing === undefined
        ? undefined
        : `It waits for ${expanded.missing.join(', ')}.`;
    } catch (error) {
      return message(error);
    }
  }

  private edit(
    title: string,
    template: string,
    card: TemplateCard,
    apply: (config: Record<string, Value>) => void,
    also: (config: Record<string, Value>) => string | undefined = () => undefined,
  ): void {
    customize(
      this.renderRoot,
      this.hass,
      title,
      asConfig(card),
      (config) => this.problemOf(template, config) ?? also(config),
    )
      .then((config) => {
        if (config !== undefined) {
          apply(config);
        }
      })
      .catch((error: unknown) => {
        this.problem = message(error);
      });
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

  private drawLook(plan: Plan, key: SectionKey): TemplateResult {
    const fallback = SECTION_LOOKS[key];
    const given = plan.sections?.[key];
    const name = fallback.title;
    const tiles = Object.entries(rolesOf(this.templates))
      .filter(([, role]) => role === 'tile')
      .map(([template]) => template)
      .toSorted();
    const current = lookOf(plan, key).template;
    const change = (next: Partial<Record<keyof SectionLook, string>>): void => {
      const draft = this.draft;
      if (draft !== undefined) {
        this.draft = { ...draft, sections: withLook(draft, key, next) };
        this.problem = undefined;
      }
    };
    return html`<div class="plan-look">
      <input
        class="fact-input"
        aria-label=${`${name} title`}
        placeholder=${fallback.title}
        .value=${live(given?.title ?? '')}
        @input=${(event: Event) => {
          change({ title: text(event).trim() });
        }}
      />
      <input
        class="fact-input"
        aria-label=${`${name} icon`}
        placeholder=${fallback.icon}
        .value=${live(given?.icon ?? '')}
        @change=${(event: Event) => {
          change({ icon: text(event).trim() });
        }}
      />
      ${
        current === undefined
          ? nothing
          : html`<select
              class="area-picker"
              aria-label=${`${name} template`}
              .value=${live(current)}
              @change=${(event: Event) => {
                change({ template: text(event) });
              }}
            >
              ${(tiles.includes(current) ? tiles : [current, ...tiles]).map(
                (template) =>
                  html`<option value=${template} ?selected=${template === current}>
                    ${template}
                  </option>`,
              )}
            </select>`
      }
    </div>`;
  }

  private drawRooms(plan: Plan, registries: Registries): TemplateResult {
    const look = templatesOf(plan);
    const chosen = plan.rooms.filter((room) => Object.hasOwn(registries.areas, room.area));
    const others = Object.values(registries.areas).filter(
      (area) => !chosen.some((room) => room.area === area.area_id),
    );
    return html`<section class="plan-section">
      <h2>Rooms</h2>
      ${this.drawLook(plan, 'rooms')}
      <p class="muted">Each area with a light gets a room tile. Tick the ones to show, in order.</p>
      ${chosen.map(
        (room, index) => html`<div class="plan-row">
          <input
            type="checkbox"
            .checked=${live(true)}
            aria-label=${`Show ${registries.areas[room.area]?.name ?? room.area}`}
            @change=${() => {
              this.change({ rooms: plan.rooms.filter((each) => each !== room) });
            }}
          />
          ${this.drawTile(roomCard(room, look.rooms))}
          <span class="row-actions">
            ${iconButton(
              'mdi:tune-variant',
              `Customize ${registries.areas[room.area]?.name ?? room.area}`,
              () => {
                this.edit(
                  `Customize ${registries.areas[room.area]?.name ?? room.area}`,
                  look.rooms,
                  roomCard(room, look.rooms),
                  (config) => {
                    this.change({
                      rooms: chosen.map((each) => (each === room ? roomFrom(room, config) : each)),
                    });
                  },
                );
              },
            )}
            ${iconButton(
              'mdi:arrow-up',
              'Move up',
              () => {
                this.change({ rooms: moved(chosen, index, -1) });
              },
              index === 0,
            )}
            ${iconButton(
              'mdi:arrow-down',
              'Move down',
              () => {
                this.change({ rooms: moved(chosen, index, 1) });
              },
              index === chosen.length - 1,
            )}
          </span>
        </div>`,
      )}
      ${others.map((area) => {
        const shows = this.remembered(`room:${look.rooms}:${area.area_id}`, () =>
          roomShows(registries, this.templates, area.area_id, look.rooms),
        );
        return html`<div class="plan-row off">
          <input
            type="checkbox"
            .checked=${live(false)}
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
    const look = templatesOf(plan);
    const people = peopleIn(registries);
    return html`<section class="plan-section">
      <h2>People</h2>
      ${this.drawLook(plan, 'people')}
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
                    : html`${this.drawTile(personCard(choice, registries, look.people))}
                        <span class="row-actions">
                          ${iconButton(
                            'mdi:tune-variant',
                            `Customize ${typeof name === 'string' ? name : entity}`,
                            () => {
                              this.edit(
                                `Customize ${typeof name === 'string' ? name : entity}`,
                                look.people,
                                personCard(choice, registries, look.people),
                                (config) => {
                                  this.change({
                                    people: plan.people.map((each) =>
                                      each === choice
                                        ? personFrom(choice, config, registries)
                                        : each,
                                    ),
                                  });
                                },
                              );
                            },
                          )}
                        </span>`
                }
              </div>`;
            })
      }
    </section>`;
  }

  private carProblem(plan: Plan, config: Record<string, Value>, was?: string): string | undefined {
    const car = carFrom(config);
    if (car === undefined) {
      return 'A car needs a key: lower case letters, digits, - and _, such as sedan.';
    }
    return car.key !== was && plan.cars.some((each) => each.key === car.key)
      ? `Another car has the key ${car.key}.`
      : undefined;
  }

  private drawGarage(plan: Plan): TemplateResult {
    const look = templatesOf(plan);
    const blank: TemplateCard = {
      type: 'custom:mnml-template-card',
      template: look.cars,
      slots: {},
    };
    return html`<section class="plan-section">
      <h2>Garage</h2>
      ${this.drawLook(plan, 'garage')}
      ${
        plan.cars.length === 0
          ? html`<p class="muted">A car's entities are chosen when it is added.</p>`
          : nothing
      }
      ${plan.cars.map(
        (car) => html`<div class="plan-row">
          ${this.drawTile(carCard(car, look.cars))}
          <span class="row-actions">
            ${iconButton('mdi:tune-variant', `Customize ${car.key}`, () => {
              this.edit(
                `Customize ${car.key}`,
                look.cars,
                carCard(car, look.cars),
                (config) => {
                  const next = carFrom(config);
                  if (next !== undefined) {
                    this.change({ cars: plan.cars.map((each) => (each === car ? next : each)) });
                  }
                },
                (config) => this.carProblem(plan, config, car.key),
              );
            })}
            ${iconButton('mdi:delete-outline', `Remove ${car.key}`, () => {
              this.change({ cars: plan.cars.filter((each) => each !== car) });
            })}
          </span>
        </div>`,
      )}
      <div>
        <button
          type="button"
          class="action"
          @click=${() => {
            this.edit(
              'A car',
              look.cars,
              blank,
              (config) => {
                const car = carFrom(config);
                if (car !== undefined) {
                  this.change({ cars: [...plan.cars, car] });
                }
              },
              (config) => this.carProblem(plan, config),
            );
          }}
        >
          ${icon('mdi:car-side')}<span>Add a car</span>
        </button>
      </div>
    </section>`;
  }

  private drawSystemRow(plan: Plan, registries: Registries, name: string): TemplateResult {
    const choice = plan.system.find((each) => each.template === name);
    const fills =
      choice?.slots !== undefined ||
      this.remembered(`system:${name}`, () => systemFills(registries, this.templates, name));
    const label = SYSTEM_NAMES[name] ?? name;
    const keep = (from: SystemChoice) => (config: Record<string, Value>) => {
      this.change({
        system: withSystem(plan.system, systemFrom(from, config, registries, this.templates)),
      });
    };
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
                ? withSystem(plan.system, { template: name })
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
                        >MNML does not find all its entities in this home.</span
                      >`
                }
              </span>
              ${
                fills
                  ? nothing
                  : html`<button
                      type="button"
                      class="action"
                      @click=${() => {
                        this.edit(
                          label,
                          name,
                          systemCard({ template: name }, registries, this.templates),
                          keep({ template: name }),
                        );
                      }}
                    >
                      Choose its entities
                    </button>`
              }`
          : html`${this.drawTile(systemCard(choice, registries, this.templates))}
              <span class="row-actions">
                ${iconButton('mdi:tune-variant', `Customize ${label}`, () => {
                  this.edit(
                    `Customize ${label}`,
                    name,
                    systemCard(choice, registries, this.templates),
                    keep(choice),
                  );
                })}
              </span>`
      }
    </div>`;
  }

  private drawSystem(plan: Plan, registries: Registries): TemplateResult {
    return html`<section class="plan-section">
      <h2>System</h2>
      ${this.drawLook(plan, 'system')}
      ${SYSTEM_TEMPLATES.map((name) => this.drawSystemRow(plan, registries, name))}
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
