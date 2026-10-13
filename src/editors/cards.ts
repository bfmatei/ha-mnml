import type { CustomCard } from '../contract/cards.ts';
import { CARD_STRUCTURES, COLORS } from '../contract/structure.ts';
import type { Key, Structure } from '../contract/structure.ts';

import { LABELS } from './labels.ts';
import type { KindLabels, Labels } from './labels.ts';
import { SERVICES } from './lists.ts';
import type { Field, PlainShape, Shape } from './shape.ts';

const WITHOUT_FORM: ReadonlySet<string> = new Set<CustomCard['type']>([
  'custom:mnml-popups-card',
  'custom:mnml-template-card',
]);

const optionsOf = (key: Key): readonly string[] | undefined =>
  key.kind === 'color' ? COLORS : key.kind === 'service' ? SERVICES : key.options;

export function describer(
  table: Readonly<Record<string, Labels>>,
): (structure: Structure) => Shape {
  const made = new Map<Structure, Shape>();

  const fieldOf = (key: Key, where: string): Field => {
    const { kind, of } = key;
    if (kind === 'cards' || kind === 'slots') {
      throw new Error(`${where}: the editors draw no ${kind}`);
    }
    if ((kind === 'part' || kind === 'parts') && of === undefined) {
      throw new Error(`${where}: the structure gives no part`);
    }
    return {
      kind,
      required: key.required,
      default: key.default,
      options: optionsOf(key),
      domains: key.domains,
      writes: key.writes,
      withEntity:
        kind === 'rule' && of?.kind === 'plain' && Object.hasOwn(of.keys, 'entity')
          ? true
          : undefined,
      of: (kind === 'part' || kind === 'parts') && of !== undefined ? describe(of) : undefined,
    };
  };

  const plainOf = (
    id: string,
    keys: Readonly<Record<string, Key>>,
    labels: Labels,
    own: KindLabels,
  ): PlainShape => {
    const fields: Record<string, Field> = {};
    for (const [name, key] of Object.entries(keys)) {
      fields[name] = fieldOf(key, `${id}.${name}`);
    }
    return {
      kind: 'plain',
      id,
      label: own.label,
      fields,
      sections: own.sections ?? [{ title: own.label, keys: Object.keys(fields) }],
      labels: labels.keys,
      help: labels.help,
    };
  };

  const describe = (structure: Structure): Shape => {
    const known = made.get(structure);
    if (known !== undefined) {
      return known;
    }
    const { name } = structure;
    const labels = table[name];
    if (labels === undefined) {
      throw new Error(`${name} has no labels`);
    }
    if (structure.kind === 'plain') {
      const shape = plainOf(name, structure.keys, labels, labels);
      made.set(structure, shape);
      return shape;
    }
    const shape: Shape = {
      kind: structure.kind,
      id: name,
      label: labels.label,
      variants: structure.variants.map((variant) => {
        const own = variant.when === undefined ? labels.otherwise : labels.kinds?.[variant.when];
        if (own === undefined) {
          throw new Error(`${name} has no labels for the kind ${String(variant.when)}`);
        }
        const id = `${name}-${variant.when ?? 'otherwise'}`;
        return { when: variant.when, shape: plainOf(id, variant.keys, labels, own) };
      }),
    };
    made.set(structure, shape);
    return shape;
  };

  return describe;
}

const describe = describer(LABELS);

export const DESCRIPTIONS: Readonly<Record<string, Shape>> = Object.fromEntries(
  Object.entries(CARD_STRUCTURES).flatMap(([type, structure]): [string, Shape][] =>
    WITHOUT_FORM.has(type) ? [] : [[type, describe(structure)]],
  ),
);
