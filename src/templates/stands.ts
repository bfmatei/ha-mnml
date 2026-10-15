import type { TemplateCard } from '../contract/cards.ts';
import type { MdiIcon } from '../contract/entities.ts';
import { CONTROL } from '../contract/structure.ts';
import { isMapping, templateIcon, templateTitle } from '../contract/templates.ts';
import type {
  Filter,
  Kind,
  Rule,
  SlotSpec,
  Template,
  Templates,
  Value,
} from '../contract/templates.ts';
import type { Registries } from '../ha/registries.ts';

import { areaOf, byDeviceName, deviceName, indexOf } from './entity-index.ts';
import { matches } from './filters.ts';
import { byFit, fitOf } from './rank.ts';
import type { Fit } from './rank.ts';

export interface Standing {
  readonly title: string;
  readonly icon: MdiIcon;
  readonly anchor?: readonly Filter[];
  readonly slots: Readonly<Record<string, SlotSpec>>;
}

export type TemplateIndex = Readonly<Record<string, Standing>>;

interface Placed {
  readonly template: string;
  readonly fit: Fit;
}

export interface Suggestion {
  readonly config: TemplateCard;
  readonly label: string;
}

const ROOM = 'room';
const CARD = 'custom:mnml-template-card';

export function drawsCard(template: Template): boolean {
  const card = template.card;
  const type = isMapping(card) ? card['type'] : undefined;
  return (
    typeof type === 'string' &&
    !type.includes('[[') &&
    !CONTROL.variants.some((variant) => variant.when === type)
  );
}

function anchorsIn(kind: Kind, rule: Rule | undefined): Filter[] {
  if (rule === undefined || typeof rule === 'string') {
    return [];
  }
  if (Array.isArray(rule)) {
    return rule.flatMap((each) => anchorsIn(kind, each));
  }
  if ('per' in rule || rule.scope !== undefined) {
    return [];
  }
  if ('fields' in rule) {
    return kind === 'object' && rule.device !== undefined ? [rule.device].flat() : [];
  }
  return kind === 'entity' ? [rule] : [];
}

export function anchorOf(template: Template | undefined): Filter[] | undefined {
  if (template === undefined || !drawsCard(template)) {
    return undefined;
  }
  const required = Object.values(template.slots ?? {}).filter((spec) => spec.required === true);
  if (required.some((spec) => spec.discover === undefined)) {
    return undefined;
  }
  for (const spec of required) {
    const anchor = anchorsIn(spec.kind, spec.discover);
    if (anchor.length > 0) {
      return anchor;
    }
  }
  return undefined;
}

function stripped(spec: SlotSpec): SlotSpec {
  return {
    kind: spec.kind,
    ...(spec.required === true ? { required: true } : {}),
    ...(spec.discover === undefined ? {} : { discover: spec.discover }),
    ...(spec.fields === undefined
      ? {}
      : {
          fields: Object.fromEntries(
            Object.entries(spec.fields).map(([field, inner]) => [field, stripped(inner)]),
          ),
        }),
  };
}

export function templateIndex(templates: Templates): TemplateIndex {
  return Object.fromEntries(
    Object.entries(templates).flatMap(([name, template]): [string, Standing][] => {
      const anchor = anchorOf(template);
      if (anchor === undefined && name !== ROOM) {
        return [];
      }
      const slots = Object.fromEntries(
        Object.entries(template.slots ?? {}).flatMap(([slot, spec]) =>
          spec.discover === undefined && spec.required !== true ? [] : [[slot, stripped(spec)]],
        ),
      );
      const title = templateTitle(template, name);
      const icon = templateIcon(template);
      return [
        [name, anchor === undefined ? { title, icon, slots } : { title, icon, anchor, slots }],
      ];
    }),
  );
}

const asTemplate = (standing: Standing): Template => ({ slots: { ...standing.slots }, card: null });

function anchored(anchor: readonly Filter[], device: string, registries: Registries): boolean {
  return (indexOf(registries).devices.get(device) ?? []).some((entry) =>
    anchor.some((filter) => matches(entry, filter, registries)),
  );
}

export function cardsFor(index: TemplateIndex, device: string, registries: Registries): Placed[] {
  return Object.entries(index)
    .flatMap(([template, standing]): Placed[] => {
      if (standing.anchor === undefined || !anchored(standing.anchor, device, registries)) {
        return [];
      }
      const fit = fitOf(asTemplate(standing), { device }, registries);
      return fit.complete ? [{ template, fit }] : [];
    })
    .toSorted(
      (a, b) =>
        byFit(a.fit, b.fit) ||
        (index[a.template]?.title ?? '').localeCompare(index[b.template]?.title ?? ''),
    );
}

export function devicesFor(index: TemplateIndex, name: string, registries: Registries): Fit[] {
  const standing = index[name];
  const anchor = standing?.anchor;
  if (standing === undefined || anchor === undefined) {
    return [];
  }
  const byName = byDeviceName(registries);
  return Object.keys(registries.devices)
    .filter((device) => anchored(anchor, device, registries))
    .map((device) => fitOf(asTemplate(standing), { device }, registries))
    .filter((fit) => fit.complete)
    .toSorted((a, b) => byFit(a, b) || byName(a.scope.device ?? '', b.scope.device ?? ''));
}

const holds = (value: Value | undefined, id: string): boolean =>
  value === id ||
  (Array.isArray(value)
    ? value.some((each) => holds(each, id))
    : isMapping(value) && Object.values(value).some((each) => holds(each, id)));

export function suggestionsFor(
  index: TemplateIndex,
  entityId: string,
  registries: Registries,
): Suggestion[] {
  const entry = registries.entities[entityId];
  if (entry === undefined) {
    return [];
  }
  const device =
    typeof entry.device_id === 'string' && Object.hasOwn(registries.devices, entry.device_id)
      ? entry.device_id
      : undefined;
  const own =
    device === undefined
      ? []
      : cardsFor(index, device, registries)
          .filter(({ fit }) => holds(fit.found, entityId))
          .map(({ template }): Suggestion => ({
            config: { type: CARD, template, device },
            label: `${deviceName(device, registries)}: ${index[template]?.title ?? template}`,
          }));
  const area = areaOf(entry, registries);
  const room = index[ROOM];
  const fit =
    area === undefined || room === undefined
      ? undefined
      : fitOf(asTemplate(room), { area }, registries);
  const placed =
    area !== undefined &&
    room !== undefined &&
    fit?.complete === true &&
    fit.count > 0 &&
    holds(fit.found, entityId);
  return placed
    ? [
        ...own,
        {
          config: { type: CARD, template: ROOM, area },
          label: `${registries.areas[area]?.name ?? area}: ${room.title}`,
        },
      ]
    : own;
}
