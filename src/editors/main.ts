import { MnmlCardEditor } from './card-editor.ts';
import { MnmlTemplateGallery } from './gallery.ts';
import { loadHaForm } from './ha-form.ts';
import { MnmlRelated } from './related.ts';
import { MnmlRowMenu } from './row-menu.ts';
import { MnmlTemplateCardEditor } from './template-card.ts';
import { MnmlWords } from './words.ts';

await loadHaForm();

const ELEMENTS: [string, CustomElementConstructor][] = [
  ['mnml-row-menu', MnmlRowMenu],
  ['mnml-words', MnmlWords],
  ['mnml-related', MnmlRelated],
  ['mnml-card-editor', MnmlCardEditor],
  ['mnml-template-gallery', MnmlTemplateGallery],
  ['mnml-template-card-editor', MnmlTemplateCardEditor],
];

for (const [tag, made] of ELEMENTS) {
  if (customElements.get(tag) === undefined) {
    customElements.define(tag, made);
  }
}
