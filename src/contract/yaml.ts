import { Document, visit } from 'yaml';

const YAML_1_1_BOOLEANS = /^(?:yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF)$/;
const YAML_1_1_SEXAGESIMALS = /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+(?:\.[0-9_]*)?$/;

export function toYaml(value: unknown): string {
  const doc = new Document(value, { aliasDuplicateObjects: false });
  visit(doc, {
    Scalar(_key, node) {
      if (typeof node.value !== 'string') {
        return;
      }
      if (YAML_1_1_BOOLEANS.test(node.value) || YAML_1_1_SEXAGESIMALS.test(node.value)) {
        node.type = 'QUOTE_SINGLE';
      }
    },
  });
  return doc.toString({ lineWidth: 0, singleQuote: true });
}
