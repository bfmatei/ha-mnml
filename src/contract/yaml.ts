import { Document, parse, visit } from 'yaml';

const MERGE = 'tag:yaml.org,2002:merge';
const YAML_1_1_SPECIALS = new Set(['=', '<<']);

function readsAsString(text: string): boolean {
  try {
    return typeof parse(text, { logLevel: 'error' }) === 'string';
  } catch {
    return false;
  }
}

export function toYaml(value: unknown): string {
  const doc = new Document(value, {
    version: '1.1',
    aliasDuplicateObjects: false,
    customTags: (tags) =>
      tags.filter((tag) => (typeof tag === 'string' ? tag !== 'merge' : tag.tag !== MERGE)),
  });
  visit(doc, {
    Scalar(_key, node) {
      if (
        typeof node.value === 'string' &&
        (YAML_1_1_SPECIALS.has(node.value) || !readsAsString(node.value))
      ) {
        node.type = 'QUOTE_SINGLE';
      }
    },
  });
  return doc.toString({ lineWidth: 0, singleQuote: true });
}
