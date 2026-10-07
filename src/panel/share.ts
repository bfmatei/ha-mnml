import { SYSTEM_NAMES, SYSTEM_TEMPLATES } from '../contract/builder.ts';
import type { Plan, Recipe } from '../contract/builder.ts';

import { settleImport } from './transfer.ts';
import type { Choice, Incoming } from './transfer.ts';

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function joined(words: readonly string[]): string {
  return words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}

export function summary(plan: Plan): string {
  const parts = [
    { count: plan.rooms.length, one: 'room', many: 'rooms' },
    { count: plan.people.length, one: 'person', many: 'people' },
    { count: plan.cars.length, one: 'car', many: 'cars' },
    { count: plan.system.length, one: 'system card', many: 'system cards' },
  ].filter((part) => part.count > 0);
  return parts.length === 0
    ? 'nothing but its pop-ups yet'
    : parts.map((part) => plural(part.count, part.one, part.many)).join(', ');
}

export function previewOf(recipe: Recipe, plan: Plan): string {
  const said = [`Here it makes ${summary(plan)}.`];
  if (recipe.sections.rooms !== undefined && plan.rooms.length === 0) {
    said.push('Its rooms template draws in no area here, so there is no room.');
  }
  const system = recipe.sections.system;
  const listed = system === undefined ? [] : (system.templates ?? SYSTEM_TEMPLATES);
  const missing = listed
    .filter((name) => !plan.system.some((choice) => choice.template === name))
    .map((name) => SYSTEM_NAMES[name] ?? name);
  if (missing.length > 0) {
    said.push(
      `${joined(missing)} ${missing.length === 1 ? 'needs its' : 'need their'} entities: Choose its entities picks them in the builder.`,
    );
  }
  return said.join(' ');
}

export function settled(
  plan: readonly Incoming[],
  choices: Readonly<Record<string, Choice>>,
  taken: ReadonlySet<string>,
): { save: Incoming[]; renames: Record<string, string> } {
  const used = new Set(taken);
  const save: Incoming[] = [];
  const renames: Record<string, string> = {};
  for (const incoming of plan) {
    const [kept] = settleImport([incoming], choices, used);
    if (kept === undefined) {
      continue;
    }
    used.add(kept.name);
    save.push(kept);
    if (kept.name !== incoming.name) {
      renames[incoming.name] = kept.name;
    }
  }
  return { save, renames };
}
