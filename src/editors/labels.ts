import { EDITORS_EN } from '../words/panel/editors-en.ts';
import type { EditorWords } from '../words/panel/editors-en.ts';

import type { Section } from './form.ts';
import { iconFor } from './icons.ts';

export interface KindLabels {
  readonly label: string;
  readonly sections?: readonly Section[];
}

export interface Labels extends KindLabels {
  readonly help?: Readonly<Record<string, string>>;
  readonly kinds?: Readonly<Record<string, KindLabels>>;
  readonly otherwise?: KindLabels;
}

type SectionName = keyof EditorWords['sections'];

const LAYOUTS = {
  heading: [
    ['heading', ['title', 'icon']],
    ['state', ['state']],
    ['controls', ['controls']],
  ],
  glances: [['items', ['items']]],
  list: [
    ['heading', ['title', 'entity', 'icon', 'headers']],
    ['rows', ['rows']],
    ['order', ['lowest_first', 'highest_first', 'fold', 'summary']],
  ],
  agenda: [
    ['heading', ['title', 'icon']],
    ['calendars', ['sources']],
  ],
  sensorMessages: [
    ['messages', ['entity', 'clear']],
    ['sources', ['sources']],
  ],
  clients: [
    ['clients', ['entity', 'attribute', 'fields', 'names']],
    ['networks', ['networks', 'fold']],
  ],
  report: [
    ['report', ['entity', 'colors']],
    ['heading', ['title', 'icon']],
  ],
  scenes: [
    ['scenes', ['scenes', 'active_scene']],
    ['look', ['name', 'icon']],
  ],
  selectEntity: [
    ['entity', ['entity', 'attribute']],
    ['look', ['name', 'icon']],
  ],
  slider: [
    ['entity', ['entity', 'slider', 'turn_on']],
    ['look', ['name', 'icon', 'color']],
  ],
  entity: [
    ['entity', ['entity', 'name', 'label', 'strip_word', 'icon', 'popup']],
    ['colour', ['color', 'when']],
    ['state', ['state']],
    ['controls', ['controls']],
    ['more', ['items']],
  ],
  namedHeader: [
    ['subject', ['entity', 'name', 'icon', 'back']],
    ['colour', ['color', 'when']],
    ['state', ['state', 'messages']],
    ['controls', ['controls']],
  ],
  entityHeader: [
    ['subject', ['entity', 'label', 'icon', 'back']],
    ['colour', ['color', 'when']],
    ['state', ['state', 'messages']],
    ['controls', ['controls']],
  ],
  namedTile: [
    ['subject', ['entity', 'name', 'icon', 'popup']],
    ['state', ['state']],
    ['look', ['square', 'trend']],
    ['chips', ['chips']],
    ['item', ['item']],
  ],
  entityTile: [
    ['subject', ['entity', 'label', 'icon', 'popup']],
    ['state', ['state']],
    ['look', ['square', 'trend']],
    ['chips', ['chips']],
    ['item', ['item']],
  ],
  carPlan: [
    ['heading', ['title', 'icon']],
    ['openings', ['doors', 'hood', 'tailgate', 'windows', 'sunroof', 'open_states', 'half_states']],
    ['tyres', ['tyres', 'tyre_targets', 'tyre_low_share', 'tyre_warn_share']],
  ],
} satisfies Record<string, readonly (readonly [SectionName, readonly string[]])[]>;

const made = new WeakMap<EditorWords, Readonly<Record<string, Labels>>>();

export function labelsOf(words: EditorWords): Readonly<Record<string, Labels>> {
  const known = made.get(words);
  if (known !== undefined) {
    return known;
  }
  const { cards, kinds } = words;
  const laid = (layout: keyof typeof LAYOUTS): readonly Section[] =>
    LAYOUTS[layout].map(([name, keys]) => ({
      title: words.sections[name],
      icon: iconFor(EDITORS_EN.sections[name]),
      keys,
    }));
  const labels: Readonly<Record<string, Labels>> = {
    state: {
      label: cards.state,
      kinds: {
        text: { label: kinds.state.text },
        attribute: { label: kinds.state.attribute },
        minutes: { label: kinds.state.minutes },
        relative: { label: kinds.state.relative },
        since: { label: kinds.state.since },
        remaining: { label: kinds.state.remaining },
        serial: { label: kinds.state.serial },
        name: { label: kinds.state.name },
      },
      otherwise: { label: kinds.state.otherwise },
    },
    control: {
      label: cards.control,
      kinds: Object.fromEntries(
        Object.entries(kinds.control).map(([kind, label]) => [kind, { label }]),
      ),
    },
    'square-control': {
      label: cards['square-control'],
      kinds: {
        toggle: { label: kinds.control.toggle },
        slider: { label: kinds.control.slider },
        select: { label: kinds.control.select },
        scenes: { label: kinds.control.scenes },
      },
    },
    'status-rule': { label: cards['status-rule'] },
    item: { label: cards.item },
    glance: {
      label: cards.glance,
      kinds: {
        entities: { label: kinds.glance.entities },
        messages: { label: kinds.glance.messages },
      },
      otherwise: { label: kinds.glance.otherwise },
    },
    row: { label: cards.row },
    trend: { label: cards.trend },
    'agenda-source': { label: cards['agenda-source'] },
    'message-source': {
      label: cards['message-source'],
      kinds: { entity: { label: kinds['message-source'].entity } },
      otherwise: { label: kinds['message-source'].otherwise },
    },
    'client-network': { label: cards['client-network'] },
    'client-fields': { label: cards['client-fields'] },
    heading: { label: cards.heading, sections: laid('heading') },
    glances: { label: cards.glances, sections: laid('glances') },
    list: { label: cards.list, sections: laid('list') },
    agenda: { label: cards.agenda, sections: laid('agenda') },
    messages: {
      label: cards.messages,
      kinds: {
        notifications: { label: kinds.messages.notifications },
        repairs: { label: kinds.messages.repairs },
        popup: { label: kinds.messages.popup },
      },
      otherwise: { label: kinds.messages.otherwise, sections: laid('sensorMessages') },
    },
    clients: { label: cards.clients, sections: laid('clients') },
    report: { label: cards.report, sections: laid('report') },
    weather: { label: cards.weather },
    button: { label: cards.button },
    select: {
      label: cards.select,
      kinds: { scenes: { label: kinds.select.scenes, sections: laid('scenes') } },
      otherwise: { label: kinds.select.otherwise, sections: laid('selectEntity') },
    },
    slider: { label: cards.slider, sections: laid('slider') },
    entity: { label: cards.entity, sections: laid('entity') },
    header: {
      label: cards.header,
      kinds: { name: { label: kinds.header.name, sections: laid('namedHeader') } },
      otherwise: { label: kinds.header.otherwise, sections: laid('entityHeader') },
    },
    tile: {
      label: cards.tile,
      kinds: { name: { label: kinds.tile.name, sections: laid('namedTile') } },
      otherwise: { label: kinds.tile.otherwise, sections: laid('entityTile') },
    },
    media: { label: cards.media },
    'car-plan': { label: cards['car-plan'], sections: laid('carPlan') },
  };
  made.set(words, labels);
  return labels;
}
