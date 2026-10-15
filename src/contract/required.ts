import { isEntityId, isService } from './entities.ts';
import { COLORS, chooseVariant } from './structure.ts';
import type { Key, Structure } from './structure.ts';
import { isMapping } from './templates.ts';
import type { Value } from './templates.ts';

const CORNERS = 4;

const at = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

const isText = (value: unknown): value is string => typeof value === 'string';

const isTexts = (value: unknown): boolean => Array.isArray(value) && value.every(isText);

const isNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);

const isCard = (value: unknown): boolean => isMapping(value) && isText(value['type']);

const missing = (value: unknown): boolean => value === undefined || value === null || value === '';

function entityOf(value: unknown, domains: readonly string[] | undefined): boolean {
  return (
    isEntityId(value) && (domains === undefined || domains.includes(value.split('.')[0] ?? ''))
  );
}

const anEntity = (domains: readonly string[] | undefined): string =>
  domains === undefined ? 'an entity' : `an entity of ${domains.join(' or ')}`;

function entityProblems(value: readonly unknown[], spec: Key, where: string): string[] {
  return value.flatMap((item, index) =>
    (item === null && spec.holes === true) || entityOf(item, spec.domains)
      ? []
      : [`${where}[${index}] must be ${anEntity(spec.domains)}`],
  );
}

function wordsFit(value: unknown, options: readonly string[] | undefined): boolean {
  return (
    isMapping(value) &&
    Object.values(value).every(
      (word) => isText(word) && (options === undefined || options.includes(word)),
    )
  );
}

function isSummary(value: unknown): boolean {
  return (
    value === 'lowest' ||
    value === 'highest' ||
    (isMapping(value) && Object.keys(value).length === 1 && isNumber(value['sum']))
  );
}

function inner(spec: Key, value: unknown, where: string): string[] {
  return spec.of === undefined ? [] : problemsOf(spec.of, value, where);
}

function kindProblems(spec: Key, value: unknown, where: string): string[] {
  const not = (what: string): string[] => [`${where} must be ${what}`];
  switch (spec.kind) {
    case 'text':
      return isText(value) ? [] : not('a text');
    case 'icon':
      return isText(value) ? [] : not('an icon');
    case 'texts': {
      const options = spec.options;
      if (options === undefined) {
        return isTexts(value) ? [] : not('a list of texts');
      }
      return Array.isArray(value) && value.every((item) => isText(item) && options.includes(item))
        ? []
        : not(`a list of ${options.join(', ')}`);
    }
    case 'number':
    case 'share':
      return isNumber(value) ? [] : not('a number');
    case 'flag':
      return value === (spec.writes ?? true) ? [] : not(spec.writes ?? 'true');
    case 'choice':
    case 'color': {
      const options = spec.kind === 'color' ? COLORS : (spec.options ?? []);
      return isText(value) && options.includes(value) ? [] : not(`one of ${options.join(', ')}`);
    }
    case 'service':
      return isService(value) ? [] : not('a service, such as light.turn_on');
    case 'entity':
      return entityOf(value, spec.domains) ? [] : not(anEntity(spec.domains));
    case 'entities':
      return Array.isArray(value) ? entityProblems(value, spec, where) : not('a list');
    case 'corners':
      return Array.isArray(value) && value.length === CORNERS
        ? entityProblems(value, spec, where)
        : [`${where} must list ${CORNERS} entities`];
    case 'popup':
      return isText(value) && value.startsWith('#') ? [] : not("a pop-up hash, such as '#kitchen'");
    case 'words':
      return wordsFit(value, spec.options)
        ? []
        : spec.options === undefined
          ? [`${where} must map states to words`]
          : [`${where} must map to one of ${spec.options.join(', ')}`];
    case 'summary':
      return isSummary(value) ? [] : not('lowest, highest or { sum: <column> }');
    case 'rule':
    case 'part':
      return isMapping(value) ? inner(spec, value, where) : not('a mapping');
    case 'parts':
      return Array.isArray(value)
        ? value.flatMap((item, index) =>
            isMapping(item)
              ? inner(spec, item, `${where}[${index}]`)
              : [`${where}[${index}] must be a mapping`],
          )
        : not('a list');
    case 'cards':
      return Array.isArray(value) && value.every(isCard)
        ? []
        : not('a list of cards, each with a type');
    case 'slots':
      return isMapping(value) ? [] : not('a mapping');
  }
}

function keyProblems(spec: Key, value: Value | undefined, where: string): string[] {
  if (spec.required === true && missing(value)) {
    return [`${where} is required`];
  }
  return value === undefined ? [] : kindProblems(spec, value, where);
}

export function problemsOf(structure: Structure, value: unknown, path = ''): string[] {
  if (!isMapping(value)) {
    return [`${path === '' ? 'the card' : path} must be a mapping`];
  }
  if (structure.kind === 'plain') {
    return keysProblems(structure.keys, value, path);
  }
  const chosen = chooseVariant(structure, (key) => Object.hasOwn(value, key), value['type']);
  if (chosen === undefined) {
    const kinds = structure.variants.flatMap((variant) => variant.when ?? []).join(', ');
    return [`${at(path, 'type')} must be one of ${kinds}`];
  }
  return keysProblems(chosen.keys, value, path);
}

function keysProblems(
  keys: Readonly<Record<string, Key>>,
  value: Readonly<Record<string, Value>>,
  path: string,
): string[] {
  return Object.entries(keys).flatMap(([key, spec]) =>
    keyProblems(spec, value[key], at(path, key)),
  );
}

export function requireStructure(structure: Structure, value: unknown): void {
  const found = problemsOf(structure, value);
  if (found.length > 0) {
    throw new Error(found.join('; '));
  }
}
