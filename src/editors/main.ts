import { MnmlCardEditor } from './card-editor.ts';
import { loadHaForm } from './ha-form.ts';
import { MnmlRowMenu } from './row-menu.ts';
import { MnmlTemplateCardEditor } from './template-card.ts';
import { MnmlWords } from './words.ts';

await loadHaForm();

const ELEMENTS: [string, CustomElementConstructor][] = [
  ['mnml-row-menu', MnmlRowMenu],
  ['mnml-words', MnmlWords],
  ['mnml-card-editor', MnmlCardEditor],
  ['mnml-template-card-editor', MnmlTemplateCardEditor],
];

for (const [tag, made] of ELEMENTS) {
  if (customElements.get(tag) === undefined) {
    customElements.define(tag, made);
  }
}
