import { css, html, LitElement, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { areaIdOf, groupedByArea, placedRegistries, suggestAreas } from '../builder/areas.ts';
import type { AreaGroup, Suggestion } from '../builder/areas.ts';
import { roomCard } from '../builder/dashboard.ts';
import { unplaced } from '../builder/plan.ts';
import { field } from '../ha/field.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import type { Registries } from '../ha/registries.ts';
import { registriesOf } from '../ha/snapshot.ts';
import { icon } from '../ha/templates.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import type { PanelWords } from '../words/panel/en.ts';
import { panelWordsFor } from '../words/panel/words.ts';

import { messageOf } from './message.ts';
import { PLAN_STYLE } from './plan-editor.ts';
import { PANEL_STYLE } from './style.ts';

export interface AreasHost {
  assign: (chosen: readonly Suggestion[]) => Promise<boolean>;
  undo: () => Promise<boolean>;
  leave: () => void;
}

interface Found {
  registries: Pick<Registries, 'areas' | 'devices' | 'entities'>;
  language: string | undefined;
  groups: readonly AreaGroup[];
  held: ReadonlyMap<string, number>;
}

type Said = PanelWords['areas'];

const SHOWN = 6;
const DEVICES_PAGE = '/config/devices/dashboard';

const keyOf = ({ kind, id }: Suggestion): string => `${kind}:${id}`;

const AREAS_STYLE = css`
  .library > p {
    margin: 0;
  }
  .library a {
    color: var(--primary-color);
  }
`;

function heldBy(registries: Registries): Map<string, number> {
  const held = new Map<string, number>();
  for (const { device_id } of Object.values(registries.entities)) {
    if (device_id !== undefined && device_id !== null) {
      held.set(device_id, (held.get(device_id) ?? 0) + 1);
    }
  }
  return held;
}

export class MnmlAreas extends LitElement {
  static override styles = [PANEL_STYLE, PLAN_STYLE, AREAS_STYLE];

  @property({ attribute: false }) hass: HomeAssistant | undefined;
  @property({ attribute: false }) host: AreasHost | undefined;
  @property({ attribute: false }) undoable = false;
  @state() private unticked: ReadonlySet<string> = new Set();
  @state() private opened: ReadonlySet<string> = new Set();
  @state() private busy = false;
  @state() private notice: string | undefined;
  @state() private problem: string | undefined;
  private found: Found | undefined;

  private words(): PanelWords {
    return panelWordsFor(this.hass?.locale.language);
  }

  private foundIn(registries: Registries): Found {
    const language = this.hass?.locale.language;
    const known = this.found;
    if (
      known?.registries.areas === registries.areas &&
      known.registries.devices === registries.devices &&
      known.registries.entities === registries.entities &&
      known.language === language
    ) {
      return known;
    }
    const rooms = [...new Set([...this.words().areas.rooms, ...PANEL_EN.areas.rooms])];
    this.found = {
      registries,
      language,
      groups: groupedByArea(suggestAreas(registries, rooms), registries),
      held: heldBy(registries),
    };
    return this.found;
  }

  private tick(subjects: readonly Suggestion[], event: Event): void {
    const on = field(event.target, 'checked') === true;
    const next = new Set(this.unticked);
    for (const each of subjects) {
      if (on) {
        next.delete(keyOf(each));
      } else {
        next.add(keyOf(each));
      }
    }
    this.unticked = next;
  }

  private async assign(chosen: readonly Suggestion[]): Promise<void> {
    const host = this.host;
    if (host === undefined) {
      return;
    }
    const said = this.words().areas;
    this.busy = true;
    this.problem = undefined;
    this.notice = undefined;
    try {
      if (await host.assign(chosen)) {
        const devices = chosen.filter(({ kind }) => kind === 'device').length;
        const made = new Set(chosen.flatMap(({ to }) => to.create ?? [])).size;
        this.notice = said.assigned(devices, chosen.length - devices, made);
      }
    } catch (error) {
      this.problem = messageOf(error);
    } finally {
      this.busy = false;
    }
  }

  private async undo(): Promise<void> {
    const host = this.host;
    if (host === undefined) {
      return;
    }
    this.busy = true;
    this.problem = undefined;
    this.notice = undefined;
    try {
      if (await host.undo()) {
        this.notice = this.words().areas.undone;
      }
    } catch (error) {
      this.problem = messageOf(error);
    } finally {
      this.busy = false;
    }
  }

  private drawSubject(
    each: Suggestion,
    held: ReadonlyMap<string, number>,
    said: Said,
  ): TemplateResult {
    const what = each.kind === 'device' ? said.device(held.get(each.id) ?? 0) : each.id;
    return html`<div class="plan-row">
      <input
        type="checkbox"
        .checked=${live(!this.unticked.has(keyOf(each)))}
        aria-label=${each.name}
        @change=${(event: Event) => {
          this.tick([each], event);
        }}
      />
      <span class="plan-words">
        <span>${each.name}</span>
        <span class="muted"
          >${said.line(what, each.by === 'name' ? said.byName : said.byEntities)}</span
        >
      </span>
    </div>`;
  }

  private drawGroup(
    group: AreaGroup,
    found: Found,
    preview: HomeAssistant | undefined,
    said: Said,
  ): TemplateResult {
    const area = areaIdOf(group.to);
    const all = group.suggestions;
    const ticked = all.filter((each) => !this.unticked.has(keyOf(each))).length;
    const open = this.opened.has(area) || all.length <= SHOWN + 1;
    return html`<section class="plan-section">
      <div class="plan-heading">
        <h2>${group.name}</h2>
        ${group.to.create === undefined ? nothing : html`<span class="badge">${said.newArea}</span>`}
      </div>
      ${
        ticked === 0
          ? nothing
          : html`<mnml-live-card
              class="plan-tile"
              inert
              aria-label=${said.preview(group.name)}
              .config=${roomCard({ area })}
              .hass=${preview}
            ></mnml-live-card>`
      }
      <div class="plan-row">
        <input
          type="checkbox"
          .checked=${live(ticked === all.length)}
          .indeterminate=${ticked > 0 && ticked < all.length}
          aria-label=${said.tickAll(group.name)}
          @change=${(event: Event) => {
            this.tick(all, event);
          }}
        />
        <span class="plan-words"><span>${said.tickAll(group.name)}</span></span>
      </div>
      ${(open ? all : all.slice(0, SHOWN)).map((each) => this.drawSubject(each, found.held, said))}
      ${
        open
          ? nothing
          : html`<div>
              <button
                type="button"
                class="action"
                @click=${() => {
                  this.opened = new Set([...this.opened, area]);
                }}
              >
                ${said.more(all.length - SHOWN)}
              </button>
            </div>`
      }
    </section>`;
  }

  protected override render(): TemplateResult {
    const words = this.words();
    const said = words.areas;
    const registries = registriesOf(this.hass);
    const found = this.foundIn(registries);
    const chosen = found.groups
      .flatMap(({ suggestions }) => suggestions)
      .filter((each) => !this.unticked.has(keyOf(each)));
    const left = unplaced(registries);
    const placed = placedRegistries(registries, chosen);
    const preview =
      this.hass === undefined
        ? undefined
        : { ...this.hass, areas: placed.areas, devices: placed.devices, entities: placed.entities };
    return html`<div class="library plan">
      <div class="library-head">
        <span class="plan-title">
          <button
            type="button"
            class="icon-button back"
            aria-label=${said.back}
            title=${said.back}
            @click=${() => {
              this.host?.leave();
            }}
          >
            ${icon('mdi:arrow-left')}
          </button>
          <h1>${said.title}</h1>
        </span>
        <div class="library-tools">
          ${
            this.undoable
              ? html`<button
                  type="button"
                  class="action"
                  ?disabled=${this.busy}
                  @click=${() => {
                    void this.undo();
                  }}
                >
                  ${icon('mdi:undo')}<span>${said.undo}</span>
                </button>`
              : nothing
          }
          ${
            found.groups.length === 0
              ? nothing
              : html`<button
                  type="button"
                  class="action primary"
                  ?disabled=${this.busy || chosen.length === 0}
                  @click=${() => {
                    void this.assign(chosen);
                  }}
                >
                  ${icon('mdi:check')}<span>${said.assign(chosen.length)}</span>
                </button>`
          }
        </div>
      </div>
      ${this.problem === undefined ? nothing : html`<p class="problem-line">${this.problem}</p>`}
      ${this.notice === undefined ? nothing : html`<p>${this.notice}</p>`}
      <p class="muted">${said.intro}</p>
      ${
        left.devices + left.entities === 0
          ? nothing
          : html`<p class="muted">${words.plan.unplaced(left.devices, left.entities)}</p>`
      }
      ${found.groups.length === 0 ? html`<p class="muted">${said.none}</p>` : nothing}
      ${found.groups.map((group) => this.drawGroup(group, found, preview, said))}
      <p><a href=${DEVICES_PAGE}>${said.devicesPage}</a></p>
    </div>`;
  }
}
