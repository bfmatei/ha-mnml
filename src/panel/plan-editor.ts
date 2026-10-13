import { css, html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { carFrom, personFrom, roomFrom, systemFrom } from '../builder/customized.ts';
import { carCard, personCard, roomCard, systemCard } from '../builder/dashboard.ts';
import { personOf } from '../builder/person.ts';
import { areaKinds, peopleIn, roomShows, systemFills, unplaced } from '../builder/plan.ts';
import type { AreaKind } from '../builder/plan.ts';
import {
  SECTION_LOOKS,
  SYSTEM_NAMES,
  SYSTEM_TEMPLATES,
  isPlan,
  lookOf,
  orderOf,
} from '../contract/builder.ts';
import type {
  Plan,
  RoomChoice,
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
import { registriesOf } from '../ha/registries.ts';
import { icon } from '../ha/templates.ts';
import { discover } from '../templates/discover.ts';
import type { Registries } from '../templates/discover.ts';
import { expand, toValue } from '../templates/expand.ts';
import { rolesOf } from '../templates/roles.ts';
import type { Role } from '../templates/roles.ts';

import { customize } from './customize.ts';
import { messageOf } from './message.ts';
import {
  isIcon,
  movedBy,
  templatesOf,
  trimmed,
  withDeclared,
  withGlances,
  withLook,
  withOrder,
  withSystem,
} from './plan-edits.ts';
import { PANEL_STYLE } from './style.ts';

export interface PlanHost {
  save: (plan: Plan, address: string) => Promise<void>;
  leave: () => void;
}

type Device = keyof PopupOpen;

interface Survey {
  kinds: Readonly<Record<string, AreaKind>>;
  unplaced: number;
}

const ADDRESS = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const LONGEST = 64;
const DEVICES: readonly { device: Device; label: string; otherwise: string }[] = [
  { device: 'phone', label: 'On a phone', otherwise: 'a sheet' },
  { device: 'tablet', label: 'On a tablet', otherwise: 'a dialog' },
  { device: 'desktop', label: 'On a computer', otherwise: 'a dialog' },
];
const WHY: Readonly<Record<AreaKind, string | undefined>> = {
  room: undefined,
  phones: 'Only phones and trackers.',
  system: 'Only system devices.',
  empty: 'Nothing in this area: its devices are in no area or elsewhere.',
};
const DEVICES_PAGE = '/config/devices/dashboard';
const OPENINGS: readonly { opening: PopupOpening; label: string }[] = [
  { opening: 'sheet', label: 'A sheet from the bottom' },
  { opening: 'dialog', label: 'A dialog in the middle' },
  { opening: 'unfold', label: 'Unfolded from its tile' },
];

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

function roomName(room: RoomChoice, registries: Registries): string {
  if (room.spelled === true) {
    const name = room.slots['name'];
    return typeof name === 'string' ? name : 'A room';
  }
  return registries.areas[room.area]?.name ?? room.area;
}

function placing(count: number): TemplateResult | typeof nothing {
  if (count === 0) {
    return nothing;
  }
  const [have, them] = count === 1 ? ['1 device has', 'it'] : [`${count} devices have`, 'them'];
  return html`<p class="muted">
    ${have} no area, so no room shows ${them}.
    <a href=${DEVICES_PAGE}>Give ${them} an area in Home Assistant</a>
  </p>`;
}

function text(event: Event): string {
  const value = field(event.target, 'value');
  return typeof value === 'string' ? value : '';
}

const PLAN_STYLE = css`
  .plan-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .plan-title h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 400;
  }
  .plan-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    background: var(--card-background-color);
  }
  .plan-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .plan-section h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }
  .plan-section p {
    margin: 0;
  }
  .plan-section a {
    color: var(--primary-color);
  }
  .plan-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
  }
  .plan-row input[type='checkbox'] {
    width: 20px;
    height: 20px;
    margin: 0;
    flex: none;
    accent-color: var(--primary-color);
  }
  .plan-tile {
    flex: 1;
    min-width: 0;
    max-width: 420px;
  }
  .plan-words {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  .plan-row.off .plan-words > span:first-child {
    color: var(--secondary-text-color);
  }
  .plan-look {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .plan-look .fact-input {
    flex: 1;
    min-width: 140px;
  }
  .plan-field {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .plan-field > span:first-child {
    width: 120px;
    color: var(--secondary-text-color);
  }
  .plan-icon {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 200px;
  }
`;

export class MnmlPlanEditor extends LitElement {
  static override styles = [PANEL_STYLE, PLAN_STYLE];

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
  @state() private lookIcons: Partial<Record<SectionKey, string>> = {};
  @state() private problem: string | undefined;
  @state() private saving = false;
  private readonly found = new Map<string, boolean>();
  private survey: Survey | undefined;
  private known: { templates: Templates | undefined; roles: Readonly<Record<string, Role>> } = {
    templates: undefined,
    roles: {},
  };
  private seen: readonly unknown[] = [];
  private drafted = '';

  protected override willUpdate(changed: PropertyValues<this>): void {
    const now = [this.templates, this.hass?.areas, this.hass?.devices, this.hass?.entities];
    if (now.some((each, index) => each !== this.seen[index])) {
      this.seen = now;
      this.found.clear();
      this.survey = undefined;
    }
    if (this.plan !== undefined && (this.draft === undefined || this.address !== this.drafted)) {
      this.drafted = this.address;
      this.draft = structuredClone(this.plan);
      this.iconText = this.plan.icon;
      this.lookIcons = {};
    }
    if (changed.has('address')) {
      this.where = this.address;
    }
  }

  private roles(): Readonly<Record<string, Role>> {
    if (this.known.templates !== this.templates) {
      this.known = { templates: this.templates, roles: rolesOf(this.templates) };
    }
    return this.known.roles;
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

  private surveyOf(registries: Registries): Survey {
    this.survey ??= { kinds: areaKinds(registries), unplaced: unplaced(registries) };
    return this.survey;
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
      return messageOf(error);
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
        this.problem = messageOf(error);
      });
  }

  private async save(): Promise<void> {
    const plan = this.draft;
    const host = this.host;
    if (plan === undefined || host === undefined) {
      return;
    }
    const sections = trimmed(plan.sections);
    const { sections: _looks, ...rest } = plan;
    const tidy: Plan = {
      ...rest,
      title: plan.title.trim(),
      ...(sections === undefined ? {} : { sections }),
    };
    this.problem = this.check(tidy);
    if (this.problem !== undefined) {
      return;
    }
    this.saving = true;
    try {
      await host.save(tidy, this.where);
    } catch (error) {
      this.problem = messageOf(error);
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
    const registries = registriesOf(this.hass);
    const writes =
      key === 'people'
        ? [
            ...new Set(
              peopleIn(registries).flatMap((entity) => Object.keys(personOf(registries, entity))),
            ),
          ]
        : key === 'garage'
          ? ['key']
          : [];
    const tiles = Object.entries(this.roles())
      .filter(
        ([template, role]) =>
          role === 'tile' &&
          writes.every((slot) => Object.hasOwn(this.templates[template]?.slots ?? {}, slot)),
      )
      .map(([template]) => template)
      .toSorted();
    const current = lookOf(plan, key).template;
    const change = (next: Partial<Record<keyof SectionLook, string>>): void => {
      const draft = this.draft;
      if (draft === undefined) {
        return;
      }
      const sections = withLook(draft, key, next);
      const template = next.template;
      const declared = new Set(
        Object.keys(template === undefined ? {} : (this.templates[template]?.slots ?? {})),
      );
      this.draft =
        template === undefined
          ? { ...draft, sections }
          : { ...withDeclared(draft, key, declared), sections };
      this.problem = undefined;
    };
    return html`<div class="plan-look">
      <input
        class="fact-input"
        aria-label=${`${name} title`}
        placeholder=${fallback.title}
        .value=${live(given?.title ?? '')}
        @input=${(event: Event) => {
          change({ title: text(event) });
        }}
      />
      <input
        class="fact-input"
        aria-label=${`${name} icon`}
        placeholder=${fallback.icon}
        .value=${live(this.lookIcons[key] ?? given?.icon ?? '')}
        @input=${(event: Event) => {
          const typed = text(event);
          this.lookIcons = { ...this.lookIcons, [key]: typed };
          change({ icon: typed.trim() });
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
    const chosen = plan.rooms.filter(
      (room) => room.spelled === true || Object.hasOwn(registries.areas, room.area),
    );
    const others = Object.values(registries.areas).filter(
      (area) => !chosen.some((room) => room.area === area.area_id),
    );
    const survey = this.surveyOf(registries);
    return html`<section class="plan-section">
      ${this.drawHeading(plan, 'rooms')} ${this.drawLook(plan, 'rooms')}
      <p class="muted">
        Each area that holds something a room shows gets a room. Tick the ones to show, in order.
      </p>
      ${chosen.map((room, index) => {
        const name = roomName(room, registries);
        return html`<div class="plan-row">
          <input
            type="checkbox"
            .checked=${live(true)}
            aria-label=${`Show ${name}`}
            @change=${() => {
              this.change({ rooms: plan.rooms.filter((each) => each !== room) });
            }}
          />
          ${this.drawTile(roomCard(room, look.rooms, this.templates))}
          <span class="row-actions">
            ${iconButton('mdi:tune-variant', `Customize ${name}`, () => {
              this.edit(
                `Customize ${name}`,
                look.rooms,
                roomCard(room, look.rooms, this.templates),
                (config) => {
                  this.change({
                    rooms: chosen.map((each) => (each === room ? roomFrom(room, config) : each)),
                  });
                },
              );
            })}
            ${this.moves(name, index, chosen.length, (by) => {
              this.change({ rooms: movedBy(chosen, index, by) });
            })}
          </span>
        </div>`;
      })}
      ${others.map((area) => {
        const shows = this.remembered(`room:${look.rooms}:${area.area_id}`, () =>
          roomShows(registries, this.templates, area.area_id, look.rooms),
        );
        const why =
          WHY[survey.kinds[area.area_id] ?? 'empty'] ??
          (shows ? undefined : 'Its template finds nothing to show here.');
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
            ${why === undefined ? nothing : html`<span class="muted">${why}</span>`}
          </span>
        </div>`;
      })}
      ${placing(survey.unplaced)}
    </section>`;
  }

  private drawPeople(plan: Plan, registries: Registries): TemplateResult {
    const look = templatesOf(plan);
    const people = peopleIn(registries);
    const nameOf = (entity: PersonId): string => {
      const name = registries.states[entity]?.attributes['friendly_name'];
      return typeof name === 'string' ? name : entity;
    };
    const chosen = plan.people;
    const others = people.filter((entity) => !chosen.some((person) => person.entity === entity));
    return html`<section class="plan-section">
      ${this.drawHeading(plan, 'people')} ${this.drawLook(plan, 'people')}
      ${
        people.length === 0 && chosen.length === 0
          ? html`<p class="muted">Home Assistant has no people yet.</p>`
          : nothing
      }
      ${chosen.map(
        (choice, index) =>
          html`<div class="plan-row">
            <input
              type="checkbox"
              aria-label=${`Show ${nameOf(choice.entity)}`}
              .checked=${live(true)}
              @change=${() => {
                this.change({ people: chosen.filter((person) => person !== choice) });
              }}
            />
            ${this.drawTile(personCard(choice, registries, look.people, this.templates))}
            <span class="row-actions">
              ${iconButton('mdi:tune-variant', `Customize ${nameOf(choice.entity)}`, () => {
                this.edit(
                  `Customize ${nameOf(choice.entity)}`,
                  look.people,
                  personCard(choice, registries, look.people, this.templates),
                  (config) => {
                    this.change({
                      people: chosen.map((each) =>
                        each === choice ? personFrom(choice, config, registries) : each,
                      ),
                    });
                  },
                );
              })}
              ${this.moves(nameOf(choice.entity), index, chosen.length, (by) => {
                this.change({ people: movedBy(chosen, index, by) });
              })}
            </span>
          </div>`,
      )}
      ${others.map(
        (entity) =>
          html`<div class="plan-row off">
            <input
              type="checkbox"
              aria-label=${`Show ${nameOf(entity)}`}
              .checked=${live(false)}
              @change=${() => {
                this.change({ people: [...chosen, { entity }] });
              }}
            />
            <span class="plan-words">${nameOf(entity)}</span>
          </div>`,
      )}
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
      ${this.drawHeading(plan, 'garage')} ${this.drawLook(plan, 'garage')}
      ${
        plan.cars.length === 0
          ? html`<p class="muted">A car's entities are chosen when it is added.</p>`
          : nothing
      }
      ${plan.cars.map(
        (car, index) =>
          html`<div class="plan-row">
            ${this.drawTile(carCard(car, look.cars, this.templates))}
            <span class="row-actions">
              ${this.moves(car.key, index, plan.cars.length, (by) => {
                this.change({ cars: movedBy(plan.cars, index, by) });
              })}
              ${iconButton('mdi:tune-variant', `Customize ${car.key}`, () => {
                this.edit(
                  `Customize ${car.key}`,
                  look.cars,
                  carCard(car, look.cars, this.templates),
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

  private keepSystem(plan: Plan, registries: Registries, from: SystemChoice) {
    return (config: Record<string, Value>): void => {
      this.change({
        system: withSystem(plan.system, systemFrom(from, config, registries, this.templates)),
      });
    };
  }

  private drawSystemChosen(
    plan: Plan,
    registries: Registries,
    choice: SystemChoice,
    index: number,
  ): TemplateResult {
    const label = SYSTEM_NAMES[choice.template] ?? choice.template;
    return html`<div class="plan-row">
      <input
        type="checkbox"
        aria-label=${`Show ${label}`}
        .checked=${live(true)}
        @change=${() => {
          this.change({ system: plan.system.filter((each) => each !== choice) });
        }}
      />
      ${this.drawTile(systemCard(choice, registries, this.templates))}
      <span class="row-actions">
        ${iconButton('mdi:tune-variant', `Customize ${label}`, () => {
          this.edit(
            `Customize ${label}`,
            choice.template,
            systemCard(choice, registries, this.templates),
            this.keepSystem(plan, registries, choice),
          );
        })}
        ${this.moves(label, index, plan.system.length, (by) => {
          this.change({ system: movedBy(plan.system, index, by) });
        })}
      </span>
    </div>`;
  }

  private drawSystemOther(plan: Plan, registries: Registries, name: string): TemplateResult {
    const fills = this.remembered(`system:${name}`, () =>
      systemFills(registries, this.templates, name),
    );
    const label = SYSTEM_NAMES[name] ?? name;
    return html`<div class="plan-row off">
      <input
        type="checkbox"
        aria-label=${`Show ${label}`}
        .checked=${live(false)}
        ?disabled=${!fills}
        @change=${() => {
          this.change({ system: withSystem(plan.system, { template: name }) });
        }}
      />
      <span class="plan-words">
        <span>${label}</span>
        ${
          fills
            ? nothing
            : html`<span class="muted">MNML does not find its entities in this home.</span>`
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
                  this.keepSystem(plan, registries, { template: name }),
                );
              }}
            >
              Choose its entities
            </button>`
      }
    </div>`;
  }

  private drawSystem(plan: Plan, registries: Registries): TemplateResult {
    const others = SYSTEM_TEMPLATES.filter(
      (name) => !plan.system.some((choice) => choice.template === name),
    );
    return html`<section class="plan-section">
      ${this.drawHeading(plan, 'system')} ${this.drawLook(plan, 'system')}
      ${plan.system.map((choice, index) => this.drawSystemChosen(plan, registries, choice, index))}
      ${others.map((name) => this.drawSystemOther(plan, registries, name))}
    </section>`;
  }

  private moves(
    label: string,
    index: number,
    count: number,
    move: (by: number) => void,
  ): TemplateResult {
    const moving = (by: number): void => {
      move(by);
      void this.updateComplete.then(() => {
        const ways = by < 0 ? ['up', 'down'] : ['down', 'up'];
        ways
          .map((way) =>
            this.renderRoot.querySelector<HTMLButtonElement>(
              `button[aria-label="Move ${label} ${way}"]`,
            ),
          )
          .find((button) => button !== null && !button.disabled)
          ?.focus();
      });
    };
    return html`${iconButton(
      'mdi:arrow-up',
      `Move ${label} up`,
      () => {
        moving(-1);
      },
      index === 0,
    )}
    ${iconButton(
      'mdi:arrow-down',
      `Move ${label} down`,
      () => {
        moving(1);
      },
      index === count - 1,
    )}`;
  }

  private drawHeading(plan: Plan, key: SectionKey): TemplateResult {
    const order = orderOf(plan);
    const index = order.indexOf(key);
    const name = SECTION_LOOKS[key].title;
    return html`<div class="plan-heading">
      <h2>${name}</h2>
      <span class="row-actions">
        ${this.moves(`the ${name} section`, index, order.length, (by) => {
          const draft = this.draft;
          if (draft !== undefined) {
            this.draft = withOrder(draft, movedBy(order, index, by));
            this.problem = undefined;
          }
        })}
      </span>
    </div>`;
  }

  private drawPart(plan: Plan, key: SectionKey, registries: Registries): TemplateResult {
    if (key === 'rooms') {
      return this.drawRooms(plan, registries);
    }
    if (key === 'people') {
      return this.drawPeople(plan, registries);
    }
    return key === 'garage' ? this.drawGarage(plan) : this.drawSystem(plan, registries);
  }

  private reshaped(edit: (draft: Plan) => Plan): void {
    if (this.draft !== undefined) {
      this.draft = edit(this.draft);
      this.problem = undefined;
    }
  }

  private drawGlances(plan: Plan): TemplateResult {
    return html`<section class="plan-section">
      <h2>Glances</h2>
      <div class="plan-row">
        <input
          type="checkbox"
          aria-label="Show the Glances strip"
          .checked=${live(plan.glances !== undefined)}
          @change=${() => {
            this.reshaped((draft) => withGlances(draft, draft.glances === undefined));
          }}
        />
        <span class="plan-words">
          <span>The Glances strip</span>
          <span class="muted"
            >One line across the top: the weather, the alarm, and whatever needs you.</span
          >
        </span>
      </div>
    </section>`;
  }

  private drawPopups(plan: Plan): TemplateResult {
    return html`<section class="plan-section">
      <h2>Pop-ups</h2>
      <p class="muted">How a tile's pop-up opens on each screen.</p>
      ${DEVICES.map(
        ({ device, label, otherwise }) =>
          html`<label class="plan-field">
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
      ${this.drawDashboard(plan)}
      ${orderOf(plan).map((key) => this.drawPart(plan, key, registries))} ${this.drawGlances(plan)}
      ${this.drawPopups(plan)}
    </div>`;
  }
}
