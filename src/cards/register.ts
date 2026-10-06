import { MnmlAgendaCard } from './agenda.ts';
import { MnmlButtonCard } from './button.ts';
import { MnmlCarPlanCard } from './car-plan.ts';
import { MnmlClientsCard } from './clients.ts';
import { editorOf } from './edit.ts';
import { MnmlEntityCard } from './entity.ts';
import { MnmlHeaderCard } from './header.ts';
import { MnmlHeadingCard } from './heading.ts';
import { MnmlListCard } from './list.ts';
import { MnmlMediaCard } from './media.ts';
import { MnmlMessagesCard } from './messages.ts';
import { MnmlSlider } from './parts/slider.ts';
import { MnmlPopupsCard } from './popups.ts';
import { MnmlSelectCard } from './select.ts';
import { MnmlSliderCard } from './slider.ts';
import { STUBS } from './stubs.ts';
import { MnmlTemplateCard } from './template.ts';
import { MnmlTileCard } from './tile.ts';

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview: boolean;
  documentationURL: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

const DOCS = 'https://github.com/bfmatei/ha-mnml/blob/main/docs/keys.md';
const CARD_EDITOR = 'mnml-card-editor';

interface Entry {
  tag: string;
  card: CustomElementConstructor;
  name: string;
  description: string;
  preview: boolean;
  editor: string | undefined;
}

const CARDS: readonly Entry[] = [
  {
    tag: 'mnml-template-card',
    card: MnmlTemplateCard,
    name: 'MNML Template',
    description: 'A template from MNML or the dashboard, filled by area or by hand',
    preview: true,
    editor: 'mnml-template-card-editor',
  },
  {
    tag: 'mnml-heading-card',
    card: MnmlHeadingCard,
    name: 'MNML Heading',
    description: 'A section heading',
    preview: true,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-list-card',
    card: MnmlListCard,
    name: 'MNML List',
    description: 'Rows of entities with values, bars or a table',
    preview: true,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-agenda-card',
    card: MnmlAgendaCard,
    name: 'MNML Agenda',
    description: 'Upcoming calendar events, listed by week',
    preview: false,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-messages-card',
    card: MnmlMessagesCard,
    name: 'MNML Messages',
    description: 'Messages with their time, each clearable',
    preview: false,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-clients-card',
    card: MnmlClientsCard,
    name: 'MNML Clients',
    description: 'Connected clients grouped by network',
    preview: false,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-button-card',
    card: MnmlButtonCard,
    name: 'MNML Button',
    description: 'A button that calls a service',
    preview: true,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-select-card',
    card: MnmlSelectCard,
    name: 'MNML Select',
    description: 'A dropdown over a select entity or a climate mode',
    preview: true,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-slider-card',
    card: MnmlSliderCard,
    name: 'MNML Slider',
    description: 'A slider over a light, a climate unit or a number',
    preview: true,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-entity-card',
    card: MnmlEntityCard,
    name: 'MNML Entity',
    description: 'An entity with its state line and controls',
    preview: true,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-header-card',
    card: MnmlHeaderCard,
    name: 'MNML Header',
    description: 'A pop-up header with close and back buttons',
    preview: false,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-tile-card',
    card: MnmlTileCard,
    name: 'MNML Tile',
    description: 'A room or car tile with status chips and an item',
    preview: false,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-media-card',
    card: MnmlMediaCard,
    name: 'MNML Media',
    description: 'A media player with transport controls',
    preview: true,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-car-plan-card',
    card: MnmlCarPlanCard,
    name: 'MNML Car plan',
    description: 'A car seen from above with its openings and tyres',
    preview: false,
    editor: CARD_EDITOR,
  },
  {
    tag: 'mnml-popups-card',
    card: MnmlPopupsCard,
    name: 'MNML Pop-ups',
    description: 'Every pop-up of the dashboard, routed by the URL hash',
    preview: false,
    editor: undefined,
  },
];

if (customElements.get('mnml-slider') === undefined) {
  customElements.define('mnml-slider', MnmlSlider);
}

window.customCards ??= [];
for (const entry of CARDS) {
  if (customElements.get(entry.tag) === undefined) {
    const editor = entry.editor;
    Object.assign(entry.card, {
      getStubConfig: STUBS[entry.tag],
      ...(editor === undefined ? {} : { getConfigElement: editorOf(editor) }),
    });
    customElements.define(entry.tag, entry.card);
    window.customCards.push({
      type: entry.tag,
      name: entry.name,
      description: entry.description,
      preview: entry.preview,
      documentationURL: `${DOCS}#${entry.tag}`,
    });
  }
}
