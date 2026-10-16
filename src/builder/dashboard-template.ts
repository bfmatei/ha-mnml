import { parse } from 'yaml';

import type { PopupOpen, PopupOpening } from '../contract/cards.ts';
import { isIcon } from '../contract/entities.ts';
import { SECTION_LOOKS, isOrder, lookOf } from '../contract/plan.ts';
import type {
  Plan,
  DashboardTemplate,
  DashboardTemplateSection,
  SectionKey,
} from '../contract/plan.ts';
import { isMapping, isStorable, isTemplate, sameValue } from '../contract/templates.ts';
import type { Template, Templates, Value } from '../contract/templates.ts';
import { toYaml } from '../contract/yaml.ts';
import { namesIn } from '../templates/roles.ts';

const KEYS: readonly SectionKey[] = ['rooms', 'people', 'garage', 'system'];
const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const OPENINGS: readonly PopupOpening[] = ['sheet', 'dialog', 'unfold'];
const DEVICES = ['phone', 'tablet', 'desktop'] as const;

const isName = (value: unknown): value is string => typeof value === 'string' && NAME.test(value);
const isOpening = (value: unknown): value is PopupOpening =>
  OPENINGS.some((opening) => opening === value);

function needed(roots: readonly string[], templates: Templates): string[] {
  const seen = new Set<string>();
  const waiting = [...roots];
  for (let name = waiting.pop(); name !== undefined; name = waiting.pop()) {
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    const template = templates[name];
    if (template !== undefined) {
      const inner = new Set<string>();
      namesIn(template.card, inner);
      namesIn(template.popups, inner);
      waiting.push(...inner);
    }
  }
  return [...seen].toSorted();
}

export function dashboardTemplateOf(
  plan: Plan,
  templates: Templates,
  shipped: Templates,
): DashboardTemplate {
  const present: Record<SectionKey, boolean> = {
    rooms: plan.rooms.length > 0,
    people: plan.people.length > 0,
    garage: plan.cars.length > 0,
    system: plan.system.length > 0,
  };
  const sections: Partial<Record<SectionKey, DashboardTemplateSection>> = {};
  for (const key of KEYS) {
    if (!present[key] && plan.sections?.[key] === undefined) {
      continue;
    }
    sections[key] =
      key === 'system'
        ? { ...plan.sections?.[key], templates: plan.system.map((choice) => choice.template) }
        : { ...plan.sections?.[key] };
  }
  const roots = [
    'section-heading',
    ...KEYS.flatMap((key) => {
      const template = lookOf(plan, key).template;
      return sections[key] === undefined || template === undefined ? [] : [template];
    }),
    ...plan.system.map((choice) => choice.template),
  ];
  const bundled = Object.fromEntries(
    needed(roots, templates).flatMap((name) => {
      const template = templates[name];
      const original = shipped[name];
      return template === undefined || (original !== undefined && sameValue(original, template))
        ? []
        : [[name, template]];
    }),
  );
  return {
    title: plan.title,
    icon: plan.icon,
    ...(plan.glances === undefined ? {} : { glances: true }),
    open: plan.open,
    ...(plan.squares === true ? { squares: true } : {}),
    sections,
    ...(plan.order === undefined ? {} : { order: [...plan.order] }),
    templates: bundled,
  };
}

export function dashboardTemplateText(dashboardTemplate: DashboardTemplate): string {
  return toYaml({ mnml_dashboard: dashboardTemplate });
}

function refuse(problem: string): never {
  throw new Error(problem);
}

function openOf(value: Value | undefined): PopupOpen {
  if (value === undefined) {
    return {};
  }
  if (!isMapping(value)) {
    return refuse("The dashboard template's open is not a mapping of screens to openings.");
  }
  const open: PopupOpen = {};
  for (const [device, opening] of Object.entries(value)) {
    const known = DEVICES.find((each) => each === device);
    if (known === undefined || !isOpening(opening)) {
      return refuse(`${device}: ${JSON.stringify(opening)} is not how a pop-up opens.`);
    }
    open[known] = opening;
  }
  return open;
}

function sectionOf(key: SectionKey, value: Value): DashboardTemplateSection {
  if (value === null) {
    return {};
  }
  if (!isMapping(value)) {
    return refuse(`The ${key} section is not a mapping.`);
  }
  const { title, icon, template, templates } = value;
  if (title !== undefined && (typeof title !== 'string' || title === '')) {
    return refuse(`The ${key} section's title is not a text.`);
  }
  if (icon !== undefined && !isIcon(icon)) {
    return refuse(`The ${key} section's icon is not mdi: and a name.`);
  }
  if (template !== undefined && (key === 'system' || !isName(template))) {
    return refuse(`The ${key} section's template is not a template's name.`);
  }
  if (
    templates !== undefined &&
    (key !== 'system' || !Array.isArray(templates) || !templates.every(isName))
  ) {
    return refuse(`The ${key} section's templates are not a list of templates' names.`);
  }
  return {
    ...(title === undefined ? {} : { title }),
    ...(icon === undefined ? {} : { icon }),
    ...(template === undefined ? {} : { template }),
    ...(Array.isArray(templates) ? { templates: templates.filter(isName) } : {}),
  };
}

export function readDashboardTemplate(text: string, shipped: Templates): DashboardTemplate {
  let parsed: unknown;
  try {
    parsed = parse(text);
  } catch {
    return refuse('This is not YAML.');
  }
  if (!isMapping(parsed)) {
    return refuse('This is not a dashboard template: it has no mnml_dashboard:.');
  }
  const inner = parsed['mnml_dashboard'];
  if (inner === undefined) {
    if (Array.isArray(parsed['views'])) {
      return refuse("This is a dashboard's configuration, not a dashboard template.");
    }
    const values = Object.values(parsed);
    if (isMapping(parsed['mnml_templates']) || (values.length > 0 && values.every(isTemplate))) {
      return refuse('This is a set of templates, which the Templates tab imports.');
    }
    return refuse('This is not a dashboard template: it has no mnml_dashboard:.');
  }
  if (!isMapping(inner)) {
    return refuse('mnml_dashboard: is not a mapping.');
  }
  const { title, icon, sections, templates } = inner;
  if (typeof title !== 'string' || title === '') {
    return refuse('The dashboard template has no title.');
  }
  if (!isIcon(icon)) {
    return refuse("The dashboard template's icon is not mdi: and a name.");
  }
  const bundled: Record<string, Template> = {};
  if (templates !== undefined) {
    if (!isMapping(templates)) {
      return refuse("The dashboard template's templates are not a mapping of names.");
    }
    for (const [name, template] of Object.entries(templates)) {
      if (!isName(name) || !isStorable(template, shipped[name] !== undefined)) {
        return refuse(`${name} in the dashboard template is not a template.`);
      }
      bundled[name] = template;
    }
  }
  const read: Partial<Record<SectionKey, DashboardTemplateSection>> = {};
  if (sections !== undefined && !isMapping(sections)) {
    return refuse("The dashboard template's sections are not a mapping.");
  }
  for (const [key, value] of Object.entries(sections ?? {})) {
    const known = KEYS.find((each) => each === key);
    if (known === undefined) {
      return refuse(`${key} is not a section: the sections are rooms, people, garage and system.`);
    }
    read[known] = sectionOf(known, value);
  }
  const roots = KEYS.flatMap((key) => {
    const section = read[key];
    const template = section?.template ?? SECTION_LOOKS[key].template;
    return section === undefined
      ? []
      : [...(template === undefined ? [] : [template]), ...(section.templates ?? [])];
  });
  for (const name of needed(roots, { ...shipped, ...bundled })) {
    if (bundled[name] === undefined && shipped[name] === undefined) {
      return refuse(`${name} is neither shipped nor in the dashboard template.`);
    }
  }
  const order = inner['order'];
  if (order !== undefined && !isOrder(order)) {
    return refuse("The dashboard template's order is not the sections, each once.");
  }
  const glances = inner['glances'];
  if (glances !== undefined && glances !== true) {
    return refuse("The dashboard template's glances is true, for the Glances strip, or left out.");
  }
  const squares = inner['squares'];
  if (squares !== undefined && squares !== true) {
    return refuse("The dashboard template's squares is true, for square tiles, or left out.");
  }
  return {
    title,
    icon,
    ...(glances === undefined ? {} : { glances }),
    open: openOf(inner['open']),
    ...(squares === undefined ? {} : { squares }),
    sections: read,
    ...(order === undefined ? {} : { order }),
    templates: bundled,
  };
}

function renamedValue(value: Value, renames: Readonly<Record<string, string>>): Value {
  if (Array.isArray(value)) {
    return value.map((item) => renamedValue(item, renames));
  }
  if (!isMapping(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      key === 'template' && typeof inner === 'string'
        ? (renames[inner] ?? inner)
        : renamedValue(inner, renames),
    ]),
  );
}

export function renamedDashboardTemplate(
  dashboardTemplate: DashboardTemplate,
  renames: Readonly<Record<string, string>>,
): DashboardTemplate {
  const name = (old: string): string => renames[old] ?? old;
  const sections: Partial<Record<SectionKey, DashboardTemplateSection>> = {};
  for (const key of KEYS) {
    const section = dashboardTemplate.sections[key];
    if (section !== undefined) {
      const template = section.template ?? SECTION_LOOKS[key].template;
      sections[key] = {
        ...section,
        ...(template === undefined || name(template) === template
          ? {}
          : { template: name(template) }),
        ...(section.templates === undefined ? {} : { templates: section.templates.map(name) }),
      };
    }
  }
  const templates = Object.fromEntries(
    Object.entries(dashboardTemplate.templates).flatMap(([old, template]) => {
      const card = renamedValue(template.card, renames);
      const popups = template.popups?.map((popup) => renamedValue(popup, renames));
      return [[name(old), { ...template, card, ...(popups === undefined ? {} : { popups }) }]];
    }),
  );
  return { ...dashboardTemplate, sections, templates };
}
