import { AsyncDirective, directive } from 'lit/async-directive.js';
import type { DirectiveParameters, Part } from 'lit/async-directive.js';

import type { TimerId } from '../contract/entities.ts';

import { field } from './field.ts';
import type { HomeAssistant } from './hass.ts';

export function isTimer(entityId: string): entityId is TimerId {
  return entityId.startsWith('timer.');
}

const REMAINING = /^(?:(\d+) days?, )?(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/;

export function secondsOf(remaining: unknown): number | undefined {
  const found = typeof remaining === 'string' ? REMAINING.exec(remaining) : null;
  if (found === null) {
    return undefined;
  }
  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = found;
  return Number(days) * 86_400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function clock(seconds: number): string {
  const whole = Math.max(Math.ceil(seconds), 0);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${twoDigits(whole % 60)}`
    : `${minutes}:${twoDigits(whole % 60)}`;
}

class Countdown extends AsyncDirective {
  private until = 0;

  private tick: ReturnType<typeof setTimeout> | undefined;

  render(until: number): string {
    return clock((until - Date.now()) / 1000);
  }

  override update(_part: Part, [until]: DirectiveParameters<this>): string {
    this.until = until;
    this.schedule();
    return this.render(until);
  }

  protected override disconnected(): void {
    clearTimeout(this.tick);
    this.tick = undefined;
  }

  protected override reconnected(): void {
    this.setValue(this.render(this.until));
    this.schedule();
  }

  private schedule(): void {
    clearTimeout(this.tick);
    this.tick = undefined;
    const left = this.until - Date.now();
    if (!this.isConnected || left <= 0) {
      return;
    }
    this.tick = setTimeout(
      () => {
        this.setValue(this.render(this.until));
        this.schedule();
      },
      left % 1000 || 1000,
    );
  }
}

export const countdown = directive(Countdown);

interface Presets {
  readonly entities: object;
  readonly seconds: readonly number[];
}

const known = new Map<string, Presets>();

const waiting = new Map<string, Set<() => void>>();

function presetsOf(entry: unknown): number[] {
  const listed = field(field(field(entry, 'options'), 'timer'), 'presets');
  const seconds = Array.isArray(listed)
    ? listed
        .map((preset) => Math.floor(Number(preset)))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  return [...new Set(seconds)];
}

export function timerPresets(
  hass: HomeAssistant,
  entityId: TimerId,
  arrived: () => void,
): readonly number[] {
  const found = known.get(entityId);
  if (found !== undefined && found.entities === hass.entities) {
    return found.seconds;
  }
  const callers = waiting.get(entityId);
  if (callers !== undefined) {
    callers.add(arrived);
    return found?.seconds ?? [];
  }
  const entities = hass.entities;
  const asked = new Set([arrived]);
  waiting.set(entityId, asked);
  void hass.connection
    .sendMessagePromise<unknown>({ type: 'config/entity_registry/get', entity_id: entityId })
    .then(presetsOf, () => [])
    .then((seconds) => {
      known.set(entityId, { entities, seconds });
      waiting.delete(entityId);
      for (const caller of asked) {
        caller();
      }
    });
  return found?.seconds ?? [];
}
