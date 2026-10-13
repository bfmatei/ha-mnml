import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';

import type { WeatherCard } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { formatAttribute } from '../ha/format.ts';
import { stateOf } from '../ha/hass.ts';
import type { HassEntity, HomeAssistant } from '../ha/hass.ts';
import { icon } from '../ha/templates.ts';

import { MnmlCard, requireString } from './base.ts';
import type { KeySchema } from './keys.ts';
import { SECTION_STYLE, section } from './parts/section.ts';
import { WEATHER_CARD } from './schemas.ts';
import { BASE_STYLE, HEADING_STYLE } from './styles.ts';

const WEATHER_STYLE = css`
  .weather {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 12px;
  }
  .now {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .now > ha-icon {
    --mdc-icon-size: 48px;
    flex: none;
  }
  .now .temperature {
    font-size: 32px;
    font-weight: 600;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .now .condition {
    color: var(--secondary-text-color);
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }
  .fact {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    column-gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border-radius: 10px;
    background: var(--m-pill);
    box-shadow: var(--m-well);
  }
  .fact > ha-icon {
    --mdc-icon-size: 18px;
    grid-row: span 2;
    color: var(--secondary-text-color);
  }
  .fact .label {
    font-size: 11px;
    color: var(--secondary-text-color);
  }
  .fact .value {
    font-variant-numeric: tabular-nums;
  }
  .forecast {
    display: flex;
    flex-direction: column;
  }
  .step {
    display: grid;
    grid-template-columns: minmax(64px, 96px) 24px minmax(0, 1fr) auto;
    column-gap: 10px;
    align-items: center;
    min-height: 40px;
    padding: 2px 4px;
  }
  .step > ha-icon {
    --mdc-icon-size: 22px;
  }
  .step .when {
    color: var(--secondary-text-color);
  }
  .step .rain {
    font-size: 12px;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
  }
  .step .range {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    font-variant-numeric: tabular-nums;
  }
  .step .range .low {
    color: var(--secondary-text-color);
  }
`;

const DEFAULT_TITLE = 'Weather';

const DEFAULT_ICON: MdiIcon = 'mdi:weather-partly-cloudy';

const FALLBACK_ICON: MdiIcon = 'mdi:weather-cloudy';

type Kind = 'daily' | 'twice_daily' | 'hourly';

const STEPS: Readonly<Record<Kind, number>> = { daily: 7, twice_daily: 8, hourly: 8 };

const FEATURES: readonly (readonly [Kind, number])[] = [
  ['daily', 1],
  ['twice_daily', 4],
  ['hourly', 2],
];

const CONDITIONS: Readonly<Record<string, MdiIcon>> = {
  'clear-night': 'mdi:weather-night',
  cloudy: 'mdi:weather-cloudy',
  exceptional: 'mdi:alert-circle-outline',
  fog: 'mdi:weather-fog',
  hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning',
  'lightning-rainy': 'mdi:weather-lightning-rainy',
  partlycloudy: 'mdi:weather-partly-cloudy',
  pouring: 'mdi:weather-pouring',
  rainy: 'mdi:weather-rainy',
  snowy: 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy',
  sunny: 'mdi:weather-sunny',
  windy: 'mdi:weather-windy',
  'windy-variant': 'mdi:weather-windy-variant',
};

interface Fact {
  attribute: string;
  label: string;
  icon: MdiIcon;
}

const FACTS: readonly Fact[] = [
  { attribute: 'apparent_temperature', label: 'Feels like', icon: 'mdi:thermometer' },
  { attribute: 'humidity', label: 'Humidity', icon: 'mdi:water-percent' },
  { attribute: 'wind_speed', label: 'Wind', icon: 'mdi:weather-windy' },
  { attribute: 'pressure', label: 'Pressure', icon: 'mdi:gauge' },
  { attribute: 'uv_index', label: 'UV index', icon: 'mdi:white-balance-sunny' },
  { attribute: 'dew_point', label: 'Dew point', icon: 'mdi:water-thermometer-outline' },
  { attribute: 'cloud_coverage', label: 'Clouds', icon: 'mdi:cloud-outline' },
  { attribute: 'visibility', label: 'Visibility', icon: 'mdi:eye-outline' },
];

interface Step {
  at: Date;
  condition: string | undefined;
  high: number | undefined;
  low: number | undefined;
  rain: number | undefined;
}

const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function stepOf(raw: unknown): Step | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const at = new Date(String(Reflect.get(raw, 'datetime')));
  if (Number.isNaN(at.getTime())) {
    return undefined;
  }
  const condition: unknown = Reflect.get(raw, 'condition');
  return {
    at,
    condition: typeof condition === 'string' ? condition : undefined,
    high: number(Reflect.get(raw, 'temperature')),
    low: number(Reflect.get(raw, 'templow')),
    rain: number(Reflect.get(raw, 'precipitation_probability')),
  };
}

function whenOf(language: string, step: Step, kind: Kind): string {
  if (kind === 'hourly') {
    return new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }).format(
      step.at,
    );
  }
  if (step.at.toDateString() === new Date().toDateString()) {
    return 'Today';
  }
  return new Intl.DateTimeFormat(language, { weekday: 'long' }).format(step.at);
}

function featureOf(stateObj: HassEntity | undefined): Kind | undefined {
  const features = stateObj?.attributes['supported_features'];
  if (typeof features !== 'number') {
    return undefined;
  }
  return FEATURES.find(([, bit]) => (features & bit) !== 0)?.[0];
}

export class MnmlWeatherCard extends MnmlCard<WeatherCard> {
  static override styles = [BASE_STYLE, HEADING_STYLE, SECTION_STYLE, WEATHER_STYLE];

  @state() private steps: Step[] = [];
  private subscribed = '';
  private unfollow: (() => void) | undefined;

  protected schema(): KeySchema {
    return WEATHER_CARD;
  }

  protected override validate(config: WeatherCard): void {
    requireString('entity', config.entity);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.subscribed = '';
    this.requestUpdate();
  }

  private follow(hass: HomeAssistant, config: WeatherCard, kind: Kind): void {
    const key = `${config.entity}/${kind}`;
    if (key === this.subscribed) {
      return;
    }
    this.unfollow?.();
    this.subscribed = key;
    this.steps = [];
    let live = true;
    const stop = hass.connection.subscribeMessage<{ forecast?: unknown[] | null }>(
      (message) => {
        if (live) {
          const list = message.forecast ?? [];
          this.steps = list.flatMap((raw) => stepOf(raw) ?? []);
        }
      },
      { type: 'weather/subscribe_forecast', forecast_type: kind, entity_id: config.entity },
    );
    const end = (): void => {
      if (!live) {
        return;
      }
      live = false;
      if (this.unfollow === unfollow) {
        this.unfollow = undefined;
      }
      void stop.then(
        (off) => off(),
        () => undefined,
      );
    };
    const release = this.register(() => {
      this.subscribed = '';
      end();
    });
    const unfollow = (): void => {
      release();
      end();
    };
    this.unfollow = unfollow;
    void stop.catch(() => {
      release();
    });
  }

  protected draw(hass: HomeAssistant, config: WeatherCard): TemplateResult | undefined {
    const stateObj = stateOf(hass, config.entity);
    if (stateObj === undefined) {
      return undefined;
    }
    const kind = featureOf(stateObj);
    if (kind !== undefined && this.isConnected) {
      this.follow(hass, config, kind);
    }
    const language = hass.locale.language;
    const temperature = formatAttribute(hass, stateObj, 'temperature');
    const facts = FACTS.flatMap((fact) => {
      const value = formatAttribute(hass, stateObj, fact.attribute);
      return value === ''
        ? []
        : [
            html`<div class="fact">
              ${icon(fact.icon)}<span class="label">${fact.label}</span
              ><span class="value">${value}</span>
            </div>`,
          ];
    });
    const steps = kind === undefined ? [] : this.steps.slice(0, STEPS[kind]);
    return section(
      html`<div class="card weather">
        <div class="now">
          ${icon(CONDITIONS[stateObj.state] ?? FALLBACK_ICON)}
          <div>
            <div class="temperature">${temperature}</div>
            <div class="condition">${hass.formatEntityState(stateObj)}</div>
          </div>
        </div>
        ${facts.length === 0 ? nothing : html`<div class="facts">${facts}</div>`}
        ${
          steps.length === 0
            ? nothing
            : html`<div class="forecast">
                ${steps.map(
                  (step) =>
                    html`<div class="step">
                      <span class="when">${whenOf(language, step, kind ?? 'daily')}</span>
                      ${icon(CONDITIONS[step.condition ?? ''] ?? FALLBACK_ICON)}
                      <span class="rain"
                        >${step.rain === undefined ? '' : `${Math.round(step.rain)}%`}</span
                      >
                      <span class="range">
                        ${step.low === undefined ? nothing : html`<span class="low">${formatAttribute(hass, stateObj, 'temperature', step.low)}</span>`}
                        <span class="high"
                          >${step.high === undefined ? '' : formatAttribute(hass, stateObj, 'temperature', step.high)}</span
                        >
                      </span>
                    </div>`,
                )}
              </div>`
        }
      </div>`,
      config.title ?? DEFAULT_TITLE,
      DEFAULT_ICON,
    );
  }
}
