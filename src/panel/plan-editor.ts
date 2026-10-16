import { css, html, LitElement, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { carFrom, personFrom, roomFrom, systemFrom } from '../builder/customized.ts';
import { carCard, personCard, roomCard, systemCard } from '../builder/dashboard.ts';
import { offersIn, roomFound, shownBy } from '../builder/devices.ts';
import type { Offer } from '../builder/devices.ts';
import { partsOf, swapsFor } from '../builder/parts.ts';
import { personOf } from '../builder/person.ts';
import { areaKinds, peopleIn, roomShows, systemFills, unplaced } from '../builder/plan.ts';
import type { AreaKind, Unplaced } from '../builder/plan.ts';
import type { PopupOpen, PopupOpening, TemplateCard } from '../contract/cards.ts';
import { isIcon } from '../contract/entities.ts';
import type { MdiIcon, PersonId } from '../contract/entities.ts';
import { SECTION_LOOKS, SYSTEM_TEMPLATES, isPlan, lookOf, orderOf } from '../contract/plan.ts';
import type {
  DeviceChoice,
  Plan,
  PlanSection,
  RoomChoice,
  SectionLook,
  SystemChoice,
} from '../contract/plan.ts';
import { isMapping, slotLabel, templateTitle } from '../contract/templates.ts';
import type { Templates, Value } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import type { Registries } from '../ha/registries.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { icon } from '../ha/templates.ts';
import { discover } from '../templates/discover.ts';
import { expand, filled, toValue } from '../templates/expand.ts';
import { fillsHome } from '../templates/rank.ts';
import { rolesOf } from '../templates/roles.ts';
import type { Role } from '../templates/roles.ts';
import { templateIndex } from '../templates/stands.ts';
import type { TemplateIndex } from '../templates/stands.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

import { customize } from './customize.ts';
import { messageOf } from './message.ts';
import { DEVICES_STYLE, devicesList } from './plan-devices.ts';
import {
  movedBy,
  planChanges,
  roomName,
  templatesOf,
  tidied,
  withDeclared,
  withDevice,
  withGlances,
  sectionsWithLook,
  slotsWith,
  withOrder,
  withSystem,
  withoutDevice,
} from './plan-edits.ts';
import { PANEL_STYLE } from './style.ts';

export interface PlanHost {
  save: (plan: Plan, address: string) => Promise<void>;
  leave: () => void;
  sortAreas: () => void;
}

type Device = keyof PopupOpen;

interface Survey {
  kinds: Readonly<Record<string, AreaKind>>;
  unplaced: Unplaced;
}

interface Parting {
  readonly key: string;
  readonly name: string;
  readonly template: string;
  readonly found: () => Readonly<Record<string, Value>>;
  readonly slots: Readonly<Record<string, Value>> | undefined;
  readonly area: string | undefined;
  readonly write: (slots: Record<string, Value> | undefined) => void;
}

const ADDRESS = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const LONGEST = 64;
const DEVICES: readonly Device[] = ['phone', 'tablet', 'desktop'];
const OPENINGS: readonly PopupOpening[] = ['sheet', 'dialog', 'unfold'];

type Said = PanelWords['plan'];

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
    const value = each === device ? opening : open[each];
    if (value !== undefined) {
      next[each] = value;
    }
  }
  return next;
}

function placing(
  { devices, entities }: Unplaced,
  said: Said,
  sort: () => void,
): TemplateResult | typeof nothing {
  if (devices + entities === 0) {
    return nothing;
  }
  return html`<p class="muted">${said.unplaced(devices, entities)}</p>
    <div>
      <button type="button" class="action" @click=${sort}>
        ${icon('mdi:sofa-outline')}<span>${said.sortThem}</span>
      </button>
    </div>`;
}

function text(event: Event): string {
  const value = field(event.target, 'value');
  return typeof value === 'string' ? value : '';
}

export const PLAN_STYLE = css`
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
  .plan-parts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-inline-start: 32px;
  }
  .plan-part {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
  }
  .plan-part select {
    min-width: 0;
    max-width: 100%;
  }
  .plan-look {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .look-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 140px;
  }
  .look-field > span:first-child {
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .plan-picker {
    display: block;
    flex: 1;
    min-width: 0;
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
  @media (max-width: 600px) {
    .plan-row:has(> .plan-tile) {
      flex-wrap: wrap;
      row-gap: 4px;
    }
    .plan-tile {
      flex-basis: calc(100% - 32px);
      max-width: none;
    }
    .plan-tile + .row-actions {
      margin-inline-start: 24px;
    }
  }
`;

export class MnmlPlanEditor extends LitElement {
  static override styles = [PANEL_STYLE, PLAN_STYLE, DEVICES_STYLE];

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
  @state() private lookIcons: Partial<Record<PlanSection, string>> = {};
  @state() private problem: string | undefined;
  @state() private saving = false;
  @state() private partsOpen: string | undefined;
  private readonly found = new Map<string, boolean>();
  private readonly roomsFound = new Map<string, Record<string, Value>>();
  private survey: Survey | undefined;
  private indexed: { templates: Templates; index: TemplateIndex } | undefined;
  private offered: { chosen: readonly DeviceChoice[] | undefined; offers: Offer[] } | undefined;
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
      this.roomsFound.clear();
      this.survey = undefined;
      this.offered = undefined;
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

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('beforeunload', this.guard);
    if (customElements.get('ha-icon-picker') === undefined) {
      void customElements.whenDefined('ha-icon-picker').then(() => {
        this.requestUpdate();
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('beforeunload', this.guard);
  }

  readonly guard = (event: BeforeUnloadEvent): void => {
    if (this.dirty()) {
      event.preventDefault();
    }
  };

  dirty(): boolean {
    return this.changes() > 0 || (this.fresh && this.where !== this.address);
  }

  leave(): void {
    if (!this.dirty() || window.confirm(this.words().plan.leave)) {
      this.host?.leave();
    }
  }

  private sortAreas(): void {
    if (!this.dirty() || window.confirm(this.words().plan.leave)) {
      this.host?.sortAreas();
    }
  }

  private changes(): number {
    return this.plan === undefined || this.draft === undefined
      ? 0
      : planChanges(this.plan, this.draft);
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

  private words(): PanelWords {
    return panelWordsFor(this.hass?.locale.language);
  }

  private check(plan: Plan): string | undefined {
    const said = this.words().plan;
    if (plan.title.trim() === '') {
      return said.needsTitle;
    }
    if (!isIcon(this.iconText)) {
      return said.badIcon;
    }
    if (this.fresh && (!ADDRESS.test(this.where) || this.where.length > LONGEST)) {
      return said.badAddress(LONGEST);
    }
    if (this.fresh && this.taken.has(this.where)) {
      return said.takenAddress(this.where);
    }
    return isPlan(plan) ? undefined : said.notPlan;
  }

  private problemOf(template: string, config: Record<string, Value>): string | undefined {
    const said = this.words().plan;
    if (config['template'] !== template) {
      return said.otherTemplate(this.titleOf(template));
    }
    const found = this.templates[template];
    if (found === undefined) {
      return said.unknownTemplate(template);
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
      return expanded.missing === undefined ? undefined : said.waits(expanded.missing);
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
    const tidy = tidied(plan);
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
      inert
      .config=${config}
      .hass=${this.hass}
    ></mnml-live-card>`;
  }

  private drawDashboard(plan: Plan): TemplateResult {
    const said = this.words().plan;
    return html`<section class="plan-section">
      <h2>${said.dashboard}</h2>
      <label class="plan-field">
        <span>${said.title}</span>
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
        <span>${said.icon}</span>
        <span class="plan-icon">
          ${
            customElements.get('ha-icon-picker') === undefined && isIcon(this.iconText)
              ? icon(this.iconText)
              : nothing
          }
          ${this.iconField(said.icon, this.iconText, 'mdi:home-variant', (typed) => {
            this.iconText = typed.trim();
            this.problem = undefined;
            if (isIcon(this.iconText)) {
              this.change({ icon: this.iconText });
            }
          })}
        </span>
      </label>
      ${
        this.fresh
          ? html`<label class="plan-field">
              <span>${said.address}</span>
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
      <div class="plan-row">
        <input
          type="checkbox"
          aria-label=${said.showSquares}
          .checked=${live(plan.squares === true)}
          @change=${() => {
            this.change({ squares: plan.squares === true ? undefined : true });
          }}
        />
        <span class="plan-words">
          <span>${said.squares}</span>
          <span class="muted">${said.squaresAbout}</span>
        </span>
      </div>
    </section>`;
  }

  private fitsRooms(name: string, registries: Registries): boolean {
    return this.remembered(`fits:${name}`, () => {
      const template = this.templates[name];
      if (template === undefined) {
        return false;
      }
      const home = discover(template, undefined, registries);
      return Object.keys(registries.areas).some((area) => {
        const found = discover(template, area, registries);
        const own = Object.fromEntries(
          Object.entries(found).filter(([slot]) => !filled(home[slot])),
        );
        return fillsHome(template, own) > 0 && roomShows(registries, this.templates, area, name);
      });
    });
  }

  private tilesFor(key: PlanSection, registries: Registries): string[] {
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
    return Object.entries(this.roles())
      .filter(
        ([template, role]) =>
          role === 'tile' &&
          writes.every((slot) => Object.hasOwn(this.templates[template]?.slots ?? {}, slot)) &&
          (key !== 'rooms' || this.fitsRooms(template, registries)),
      )
      .map(([template]) => template)
      .toSorted((a, b) => this.titleOf(a).localeCompare(this.titleOf(b)));
  }

  private titleOf(name: string): string {
    return templateTitle(this.templates[name], name);
  }

  private changeLook(key: PlanSection, next: Partial<Record<keyof SectionLook, string>>): void {
    const draft = this.draft;
    if (draft === undefined) {
      return;
    }
    const sections = sectionsWithLook(draft, key, next);
    const template = next.template;
    const declared = new Set(
      Object.keys(template === undefined ? {} : (this.templates[template]?.slots ?? {})),
    );
    this.draft =
      template === undefined
        ? { ...draft, sections }
        : { ...withDeclared(draft, key, declared), sections };
    this.problem = undefined;
  }

  private iconField(
    label: string,
    value: string,
    placeholder: string,
    typed: (value: string) => void,
  ): TemplateResult {
    if (customElements.get('ha-icon-picker') !== undefined) {
      return html`<ha-icon-picker
        class="plan-picker"
        aria-label=${label}
        .hass=${this.hass}
        .value=${value}
        .placeholder=${placeholder}
        @value-changed=${(event: Event) => {
          const picked = field(field(event, 'detail'), 'value');
          typed(typeof picked === 'string' ? picked : '');
        }}
      ></ha-icon-picker>`;
    }
    return html`<input
      class="fact-input wide"
      aria-label=${label}
      placeholder=${placeholder}
      .value=${live(value)}
      @input=${(event: Event) => {
        typed(text(event));
      }}
    />`;
  }

  private drawLook(plan: Plan, key: PlanSection): TemplateResult {
    const fallback = SECTION_LOOKS[key];
    const given = plan.sections?.[key];
    const said = this.words().plan;
    const name = said.sections[key];
    const tiles = this.tilesFor(key, registriesOf(this.hass));
    const current = lookOf(plan, key).template;
    return html`<div class="plan-look">
      <label class="look-field">
        <span>${said.title}</span>
        <input
          class="fact-input"
          aria-label=${said.lookTitle(name)}
          placeholder=${fallback.title}
          .value=${live(given?.title ?? '')}
          @input=${(event: Event) => {
            this.changeLook(key, { title: text(event) });
          }}
        />
      </label>
      <label class="look-field">
        <span>${said.icon}</span>
        ${this.iconField(
          said.lookIcon(name),
          this.lookIcons[key] ?? given?.icon ?? '',
          fallback.icon,
          (typed) => {
            this.lookIcons = { ...this.lookIcons, [key]: typed };
            this.changeLook(key, { icon: typed.trim() });
          },
        )}
      </label>
      ${
        current === undefined
          ? nothing
          : html`<label class="look-field">
              <span>${said.template}</span>
              <select
                class="area-picker"
                aria-label=${said.lookTemplate(name)}
                .value=${live(current)}
                @change=${(event: Event) => {
                  this.changeLook(key, { template: text(event) });
                }}
              >
                ${(tiles.includes(current) ? tiles : [current, ...tiles]).map(
                  (template) =>
                    html`<option value=${template} ?selected=${template === current}>
                      ${this.titleOf(template)}
                    </option>`,
                )}
              </select>
            </label>`
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
    const said = this.words().plan;
    return html`<section class="plan-section">
      ${this.drawHeading(plan, 'rooms')} ${this.drawLook(plan, 'rooms')}
      <p class="muted">${said.roomsAbout}</p>
      ${chosen.map((room, index) => {
        const name = roomName(room, registries, said.aRoom);
        const parting: Parting | undefined =
          room.spelled === true
            ? undefined
            : {
                key: `room:${room.area}`,
                name,
                template: look.rooms,
                found: () => this.roomFoundOf({ area: room.area }, look.rooms, registries),
                slots: room.slots,
                area: room.area,
                write: (slots) => {
                  this.change({
                    rooms: chosen.map((each) =>
                      each === room
                        ? { area: room.area, ...(slots === undefined ? {} : { slots }) }
                        : each,
                    ),
                  });
                },
              };
        return html`<div class="plan-row">
            <input
              type="checkbox"
              .checked=${live(true)}
              aria-label=${said.show(name)}
              @change=${() => {
                this.change({ rooms: plan.rooms.filter((each) => each !== room) });
              }}
            />
            ${this.drawTile(roomCard(room, look.rooms, this.templates))}
            <span class="row-actions">
              ${iconButton('mdi:tune-variant', said.customize(name), () => {
                this.edit(
                  said.customize(name),
                  look.rooms,
                  roomCard(room, look.rooms, this.templates),
                  (config) => {
                    this.change({
                      rooms: chosen.map((each) => (each === room ? roomFrom(room, config) : each)),
                    });
                  },
                );
              })}
              ${parting === undefined ? nothing : this.partsButton(parting)}
              ${this.moves(name, index, chosen.length, (by) => {
                this.change({ rooms: movedBy(chosen, index, by) });
              })}
            </span>
          </div>
          ${parting === undefined ? nothing : this.drawParts(parting, registries)}`;
      })}
      ${others.map((area) => {
        const shows = this.remembered(`room:${look.rooms}:${area.area_id}`, () =>
          roomShows(registries, this.templates, area.area_id, look.rooms),
        );
        const kind = survey.kinds[area.area_id] ?? 'empty';
        const why =
          (kind === 'room' ? undefined : said.why[kind]) ?? (shows ? undefined : said.findsNothing);
        return html`<div class="plan-row off">
          <input
            type="checkbox"
            .checked=${live(false)}
            aria-label=${said.show(area.name)}
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
      ${placing(survey.unplaced, said, () => {
        this.sortAreas();
      })}
    </section>`;
  }

  private index(): TemplateIndex {
    if (this.indexed?.templates !== this.templates) {
      this.indexed = { templates: this.templates, index: templateIndex(this.templates) };
    }
    return this.indexed.index;
  }

  private offersOf(plan: Plan, registries: Registries): Offer[] {
    if (this.offered === undefined || this.offered.chosen !== plan.devices) {
      this.offered = {
        chosen: plan.devices,
        offers: offersIn(registries, this.index(), plan.devices),
      };
    }
    return this.offered.offers;
  }

  private roomFoundOf(
    room: RoomChoice,
    template: string,
    registries: Registries,
  ): Record<string, Value> {
    const key = `${template}:${JSON.stringify(room)}`;
    const known = this.roomsFound.get(key);
    if (known !== undefined) {
      return known;
    }
    const found = roomFound(room, template, registries, this.templates);
    this.roomsFound.set(key, found);
    return found;
  }

  private partsButton(row: Parting): TemplateResult | typeof nothing {
    const template = this.templates[row.template];
    if (template === undefined || partsOf(template).length === 0) {
      return nothing;
    }
    const label = this.words().plan.parts(row.name);
    const open = this.partsOpen === row.key;
    return html`<button
      type="button"
      class="icon-button"
      aria-label=${label}
      title=${label}
      aria-expanded=${open ? 'true' : 'false'}
      @click=${() => {
        this.partsOpen = open ? undefined : row.key;
      }}
    >
      ${icon(open ? 'mdi:eye-settings' : 'mdi:eye-settings-outline')}
    </button>`;
  }

  private drawParts(row: Parting, registries: Registries): TemplateResult | typeof nothing {
    const template = this.templates[row.template];
    if (this.partsOpen !== row.key || template === undefined) {
      return nothing;
    }
    const said = this.words().plan;
    const specs = template.slots ?? {};
    const found = row.found();
    const parts = partsOf(template).filter(
      (slot) => filled(found[slot]) || row.slots?.[slot] !== undefined,
    );
    if (parts.length === 0) {
      return html`<p class="muted plan-parts">${said.noParts}</p>`;
    }
    return html`<div class="plan-parts" role="group" aria-label=${said.parts(row.name)}>
      ${parts.map((slot) => {
        const own = row.slots?.[slot];
        const value = own === undefined ? found[slot] : own;
        const shown = filled(value);
        const label = slotLabel(slot, specs[slot]);
        return html`<span class="plan-part">
          <button
            type="button"
            class=${shown ? 'chip active' : 'chip'}
            aria-pressed=${shown ? 'true' : 'false'}
            @click=${() => {
              row.write(slotsWith(row.slots, slot, shown ? null : undefined));
            }}
          >
            ${icon(shown ? 'mdi:eye-outline' : 'mdi:eye-off-outline')}<span>${label}</span>
          </button>
          ${
            shown && specs[slot]?.kind === 'entity' && typeof value === 'string'
              ? this.drawSwap(row, slot, label, value, found[slot], registries)
              : nothing
          }
        </span>`;
      })}
    </div>`;
  }

  private drawSwap(
    row: Parting,
    slot: string,
    label: string,
    current: string,
    discovered: Value | undefined,
    registries: Registries,
  ): TemplateResult {
    const nameOf = (entity: string): string => {
      const name = registries.states[entity]?.attributes['friendly_name'];
      return typeof name === 'string' ? `${name} (${entity})` : entity;
    };
    return html`<select
      class="area-picker"
      aria-label=${this.words().plan.swap(label)}
      .value=${live(current)}
      @change=${(event: Event) => {
        const picked = text(event);
        row.write(slotsWith(row.slots, slot, picked === discovered ? undefined : picked));
      }}
    >
      ${[current, ...swapsFor(registries, current, row.area)].map(
        (entity) =>
          html`<option value=${entity} ?selected=${entity === current}>${nameOf(entity)}</option>`,
      )}
    </select>`;
  }

  private drawDevices(plan: Plan, registries: Registries): TemplateResult {
    const index = this.index();
    const offers = this.offersOf(plan, registries);
    const template = templatesOf(plan).rooms;
    const rooms = plan.rooms
      .filter((room) => room.spelled === true || Object.hasOwn(registries.areas, room.area))
      .map((room) => ({
        name: roomName(room, registries, this.words().plan.aRoom),
        found: this.roomFoundOf(room, template, registries),
      }));
    const listed = offers.map((offer) => offer.device);
    return html`<section class="plan-section">
      ${this.drawHeading(plan, 'devices')} ${this.drawLook(plan, 'devices')}
      ${devicesList({
        offers,
        chosen: plan.devices ?? [],
        areaName: (area) => registries.areas[area]?.name ?? area,
        titleOf: (name) => this.titleOf(name),
        shownBy: (offer) => {
          const [best] = offer.templates;
          const anchor = best === undefined ? undefined : index[best]?.anchor;
          return shownBy(offer.device, anchor, rooms, registries);
        },
        tile: (card) => this.drawTile(card),
        said: this.words().plan,
        pick: (choice) => {
          this.reshaped((draft) => withDevice(draft, choice, listed));
        },
        drop: (device) => {
          this.reshaped((draft) => withoutDevice(draft, device));
        },
      })}
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
    const said = this.words().plan;
    return html`<section class="plan-section">
      ${this.drawHeading(plan, 'people')} ${this.drawLook(plan, 'people')}
      ${
        people.length === 0 && chosen.length === 0
          ? html`<p class="muted">${said.noPeople}</p>`
          : nothing
      }
      ${chosen.map((choice, index) => {
        const parting: Parting | undefined =
          choice.spelled === true
            ? undefined
            : {
                key: `person:${choice.entity}`,
                name: nameOf(choice.entity),
                template: look.people,
                found: () => personOf(registries, choice.entity),
                slots: choice.slots,
                area: undefined,
                write: (slots) => {
                  this.change({
                    people: chosen.map((each) =>
                      each === choice
                        ? { entity: choice.entity, ...(slots === undefined ? {} : { slots }) }
                        : each,
                    ),
                  });
                },
              };
        return html`<div class="plan-row">
            <input
              type="checkbox"
              aria-label=${said.show(nameOf(choice.entity))}
              .checked=${live(true)}
              @change=${() => {
                this.change({ people: chosen.filter((person) => person !== choice) });
              }}
            />
            ${this.drawTile(personCard(choice, registries, look.people, this.templates))}
            <span class="row-actions">
              ${iconButton('mdi:tune-variant', said.customize(nameOf(choice.entity)), () => {
                this.edit(
                  said.customize(nameOf(choice.entity)),
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
              ${parting === undefined ? nothing : this.partsButton(parting)}
              ${this.moves(nameOf(choice.entity), index, chosen.length, (by) => {
                this.change({ people: movedBy(chosen, index, by) });
              })}
            </span>
          </div>
          ${parting === undefined ? nothing : this.drawParts(parting, registries)}`;
      })}
      ${others.map(
        (entity) =>
          html`<div class="plan-row off">
            <input
              type="checkbox"
              aria-label=${said.show(nameOf(entity))}
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
    const said = this.words().plan;
    if (car === undefined) {
      return said.carKey;
    }
    return car.key !== was && plan.cars.some((each) => each.key === car.key)
      ? said.carTaken(car.key)
      : undefined;
  }

  private drawGarage(plan: Plan): TemplateResult {
    const look = templatesOf(plan);
    const blank: TemplateCard = {
      type: 'custom:mnml-template-card',
      template: look.cars,
      slots: {},
    };
    const said = this.words().plan;
    return html`<section class="plan-section">
      ${this.drawHeading(plan, 'garage')} ${this.drawLook(plan, 'garage')}
      ${plan.cars.length === 0 ? html`<p class="muted">${said.carsAbout}</p>` : nothing}
      ${plan.cars.map(
        (car, index) =>
          html`<div class="plan-row">
            ${this.drawTile(carCard(car, look.cars, this.templates))}
            <span class="row-actions">
              ${this.moves(car.key, index, plan.cars.length, (by) => {
                this.change({ cars: movedBy(plan.cars, index, by) });
              })}
              ${iconButton('mdi:tune-variant', said.customize(car.key), () => {
                this.edit(
                  said.customize(car.key),
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
              ${iconButton('mdi:delete-outline', said.remove(car.key), () => {
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
              said.aCar,
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
          ${icon('mdi:car-side')}<span>${said.addCar}</span>
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
    const label = this.titleOf(choice.template);
    const said = this.words().plan;
    const template = this.templates[choice.template];
    const parting: Parting | undefined =
      choice.spelled === true || template === undefined
        ? undefined
        : {
            key: `system:${choice.template}`,
            name: label,
            template: choice.template,
            found: () => discover(template, undefined, registries),
            slots: choice.slots,
            area: undefined,
            write: (slots) => {
              this.change({
                system: plan.system.map((each) =>
                  each === choice
                    ? { template: choice.template, ...(slots === undefined ? {} : { slots }) }
                    : each,
                ),
              });
            },
          };
    return html`<div class="plan-row">
        <input
          type="checkbox"
          aria-label=${said.show(label)}
          .checked=${live(true)}
          @change=${() => {
            this.change({ system: plan.system.filter((each) => each !== choice) });
          }}
        />
        ${this.drawTile(systemCard(choice, registries, this.templates))}
        <span class="row-actions">
          ${iconButton('mdi:tune-variant', said.customize(label), () => {
            this.edit(
              said.customize(label),
              choice.template,
              systemCard(choice, registries, this.templates),
              this.keepSystem(plan, registries, choice),
            );
          })}
          ${parting === undefined ? nothing : this.partsButton(parting)}
          ${this.moves(label, index, plan.system.length, (by) => {
            this.change({ system: movedBy(plan.system, index, by) });
          })}
        </span>
      </div>
      ${parting === undefined ? nothing : this.drawParts(parting, registries)}`;
  }

  private drawSystemOther(plan: Plan, registries: Registries, name: string): TemplateResult {
    const fills = this.remembered(`system:${name}`, () =>
      systemFills(registries, this.templates, name),
    );
    const label = this.titleOf(name);
    const said = this.words().plan;
    return html`<div class="plan-row off">
      <input
        type="checkbox"
        aria-label=${said.show(label)}
        .checked=${live(false)}
        ?disabled=${!fills}
        @change=${() => {
          this.change({ system: withSystem(plan.system, { template: name }) });
        }}
      />
      <span class="plan-words">
        <span>${label}</span>
        ${fills ? nothing : html`<span class="muted">${said.notFound}</span>`}
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
              ${said.chooseEntities}
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
    const said = this.words().plan;
    const up = said.moveUp(label);
    const down = said.moveDown(label);
    const moving = (by: number): void => {
      move(by);
      void this.updateComplete.then(() => {
        const buttons = [...this.renderRoot.querySelectorAll('button')];
        (by < 0 ? [up, down] : [down, up])
          .map((way) =>
            buttons.find((button) => button.getAttribute('aria-label') === way && !button.disabled),
          )
          .find((button) => button !== undefined)
          ?.focus();
      });
    };
    return html`${iconButton(
      'mdi:arrow-up',
      up,
      () => {
        moving(-1);
      },
      index === 0,
    )}
    ${iconButton(
      'mdi:arrow-down',
      down,
      () => {
        moving(1);
      },
      index === count - 1,
    )}`;
  }

  private drawHeading(plan: Plan, key: PlanSection): TemplateResult {
    const order = orderOf(plan);
    const index = order.indexOf(key);
    const said = this.words().plan;
    const name = said.sections[key];
    return html`<div class="plan-heading">
      <h2>${name}</h2>
      <span class="row-actions">
        ${this.moves(said.section(name), index, order.length, (by) => {
          const draft = this.draft;
          if (draft !== undefined) {
            this.draft = withOrder(draft, movedBy(order, index, by));
            this.problem = undefined;
          }
        })}
      </span>
    </div>`;
  }

  private drawPart(plan: Plan, key: PlanSection, registries: Registries): TemplateResult {
    if (key === 'rooms') {
      return this.drawRooms(plan, registries);
    }
    if (key === 'devices') {
      return this.drawDevices(plan, registries);
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
    const said = this.words().plan;
    return html`<section class="plan-section">
      <h2>${said.glances}</h2>
      <div class="plan-row">
        <input
          type="checkbox"
          aria-label=${said.showGlances}
          .checked=${live(plan.glances !== undefined)}
          @change=${() => {
            this.reshaped((draft) => withGlances(draft, draft.glances === undefined));
          }}
        />
        <span class="plan-words">
          <span>${said.strip}</span>
          <span class="muted">${said.stripAbout}</span>
        </span>
      </div>
    </section>`;
  }

  private drawPopups(plan: Plan): TemplateResult {
    const said = this.words().plan;
    return html`<section class="plan-section">
      <h2>${said.popups}</h2>
      <p class="muted">${said.popupsAbout}</p>
      ${DEVICES.map(
        (device) =>
          html`<label class="plan-field">
            <span>${said.screens[device]}</span>
            <select
              class="area-picker"
              .value=${live(plan.open[device] ?? '')}
              @change=${(event: Event) => {
                const value = OPENINGS.find((each) => each === text(event));
                this.change({ open: withOpening(plan.open, device, value) });
              }}
            >
              <option value="" ?selected=${plan.open[device] === undefined}>
                ${said.byDefault(said.defaults[device])}
              </option>
              ${OPENINGS.map(
                (opening) =>
                  html`<option value=${opening} ?selected=${plan.open[device] === opening}>
                    ${said.openings[opening]}
                  </option>`,
              )}
            </select>
          </label>`,
      )}
      <label class="plan-field">
        <span>${said.closeAfter}</span>
        <input
          class="fact-input"
          type="number"
          min="1"
          placeholder=${said.never}
          .value=${live(plan.idle_close === undefined ? '' : String(plan.idle_close))}
          @change=${(event: Event) => {
            const seconds = Number(text(event));
            this.change({ idle_close: text(event) !== '' && seconds > 0 ? seconds : undefined });
          }}
        />
      </label>
    </section>`;
  }

  private pending(): TemplateResult | typeof nothing {
    const count = this.fresh ? 0 : this.changes();
    if (count === 0) {
      return nothing;
    }
    return html`<span class="muted" role="status">${this.words().plan.unbuilt(count)}</span>`;
  }

  protected override render(): TemplateResult {
    const plan = this.draft;
    const said = this.words().plan;
    if (plan === undefined) {
      return html`<p class="muted loading">${said.readingHome}</p>`;
    }
    const registries = registriesOf(this.hass);
    return html`<div class="library plan">
      <div class="library-head">
        <span class="plan-title">
          <button
            type="button"
            class="icon-button back"
            aria-label=${said.back}
            title=${said.back}
            @click=${() => {
              this.leave();
            }}
          >
            ${icon('mdi:arrow-left')}
          </button>
          <h1>${this.fresh ? said.fresh : said.edit(this.plan?.title ?? plan.title)}</h1>
        </span>
        <div class="library-tools">
          ${this.pending()}
          <button
            type="button"
            class="action primary"
            ?disabled=${this.saving}
            @click=${() => {
              void this.save();
            }}
          >
            ${icon(this.fresh ? 'mdi:check' : 'mdi:refresh')}<span
              >${this.fresh ? said.create : said.rebuild}</span
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
