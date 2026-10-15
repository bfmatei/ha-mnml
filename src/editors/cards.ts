import type { CustomCard } from '../contract/cards.ts';
import { CARD_STRUCTURES, COLORS } from '../contract/structure.ts';
import type { Key, Structure } from '../contract/structure.ts';
import { EDITORS_EN } from '../words/panel/editors-en.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';

import type { Field, PlainForm, Form } from './form.ts';
import { iconFor } from './icons.ts';
import { labelsOf } from './labels.ts';
import type { KindLabels, Labels } from './labels.ts';
import { SERVICES } from './lists.ts';

const WITHOUT_FORM: ReadonlySet<string> = new Set<CustomCard['type']>([
  'custom:mnml-popups-card',
  'custom:mnml-template-card',
]);

const optionsOf = (key: Key): readonly string[] | undefined =>
  key.kind === 'color' ? COLORS : key.kind === 'service' ? SERVICES : key.options;

export function describer(
  table: Readonly<Record<string, Labels>>,
  keyLabels: Readonly<Record<string, string>>,
  english: Readonly<Record<string, Labels>> = table,
): (structure: Structure) => Form {
  const made = new Map<Structure, Form>();

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
      holes: key.holes,
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
    named: string,
  ): PlainForm => {
    const fields: Record<string, Field> = {};
    for (const [name, key] of Object.entries(keys)) {
      fields[name] = fieldOf(key, `${id}.${name}`);
    }
    return {
      kind: 'plain',
      id,
      label: own.label,
      fields,
      sections: own.sections ?? [
        { title: own.label, icon: iconFor(named), keys: Object.keys(fields) },
      ],
      labels: keyLabels,
      help: labels.help,
    };
  };

  const describe = (structure: Structure): Form => {
    const known = made.get(structure);
    if (known !== undefined) {
      return known;
    }
    const { name } = structure;
    const labels = table[name];
    if (labels === undefined) {
      throw new Error(`${name} has no labels`);
    }
    const same = english[name] ?? labels;
    if (structure.kind === 'plain') {
      const form = plainOf(name, structure.keys, labels, labels, same.label);
      made.set(structure, form);
      return form;
    }
    const form: Form = {
      kind: structure.kind,
      id: name,
      label: labels.label,
      variants: structure.variants.map((variant) => {
        const [own, named] =
          variant.when === undefined
            ? [labels.otherwise, same.otherwise]
            : [labels.kinds?.[variant.when], same.kinds?.[variant.when]];
        if (own === undefined) {
          throw new Error(`${name} has no labels for the kind ${String(variant.when)}`);
        }
        const id = `${name}-${variant.when ?? 'otherwise'}`;
        return {
          when: variant.when,
          form: plainOf(id, variant.keys, labels, own, (named ?? own).label),
        };
      }),
    };
    made.set(structure, form);
    return form;
  };

  return describe;
}

const described = new WeakMap<EditorWords, Readonly<Record<string, Form>>>();

export function descriptionsFor(words: EditorWords): Readonly<Record<string, Form>> {
  const known = described.get(words);
  if (known !== undefined) {
    return known;
  }
  const describe = describer(labelsOf(words), words.keys, labelsOf(EDITORS_EN));
  const descriptions = Object.fromEntries(
    Object.entries(CARD_STRUCTURES).flatMap(([type, structure]): [string, Form][] =>
      WITHOUT_FORM.has(type) ? [] : [[type, describe(structure)]],
    ),
  );
  described.set(words, descriptions);
  return descriptions;
}

export const DESCRIPTIONS: Readonly<Record<string, Form>> = descriptionsFor(EDITORS_EN);
