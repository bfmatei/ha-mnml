import type { Section } from './shape.ts';

export interface KindLabels {
  readonly label: string;
  readonly sections?: readonly Section[];
}

export interface Labels extends KindLabels {
  readonly keys?: Readonly<Record<string, string>>;
  readonly help?: Readonly<Record<string, string>>;
  readonly kinds?: Readonly<Record<string, KindLabels>>;
  readonly otherwise?: KindLabels;
}

export const LABELS: Readonly<Record<string, Labels>> = {
  state: {
    label: 'State line',
    kinds: {
      text: { label: 'Text' },
      attribute: { label: 'Attribute' },
      minutes: { label: 'Minutes' },
      relative: { label: 'Relative time' },
      serial: { label: 'Serial' },
      name: { label: 'Name' },
    },
    otherwise: { label: 'Value' },
  },
  control: {
    label: 'Control',
    kinds: {
      toggle: { label: 'Toggle' },
      slider: { label: 'Slider' },
      select: { label: 'Select' },
      service: { label: 'Service' },
      nav: { label: 'Pop-up' },
      indicator: { label: 'Indicator' },
      status: { label: 'Status' },
      tyres: { label: 'Tyres' },
      scenes: { label: 'Scenes' },
    },
  },
  'status-rule': { label: 'Rule' },
  item: { label: 'Item' },
  glance: {
    label: 'Glance',
    kinds: { entities: { label: 'A count' } },
    otherwise: { label: 'An entity' },
  },
  row: { label: 'Row' },
  'agenda-source': { label: 'Calendar' },
  'message-source': {
    label: 'Source',
    kinds: { entity: { label: 'By entity' } },
    otherwise: { label: 'By name' },
  },
  'client-network': { label: 'Network' },
  'client-fields': { label: 'Fields', keys: { ip_address: 'IP address' } },
  heading: {
    label: 'Heading',
    sections: [
      { title: 'Heading', keys: ['title', 'icon'] },
      { title: 'State', keys: ['state'] },
      { title: 'Controls', keys: ['controls'] },
    ],
  },
  glances: {
    label: 'Glances',
    sections: [{ title: 'Items', keys: ['items'] }],
  },
  list: {
    label: 'List',
    sections: [
      { title: 'Heading', keys: ['title', 'icon', 'headers'] },
      { title: 'Rows', keys: ['rows'] },
      { title: 'Order and summary', keys: ['lowest_first', 'fold', 'summary'] },
    ],
  },
  agenda: {
    label: 'Agenda',
    sections: [
      { title: 'Heading', keys: ['title', 'icon'] },
      { title: 'Calendars', keys: ['sources'] },
    ],
  },
  messages: {
    label: 'Messages',
    sections: [
      { title: 'Messages', keys: ['entity', 'clear'] },
      { title: 'Sources', keys: ['sources'] },
    ],
  },
  clients: {
    label: 'Clients',
    sections: [
      { title: 'Clients', keys: ['entity', 'attribute', 'fields', 'names'] },
      { title: 'Networks', keys: ['networks', 'fold'] },
    ],
  },
  report: {
    label: 'Report',
    sections: [
      { title: 'Report', keys: ['entity', 'colors'] },
      { title: 'Heading', keys: ['title', 'icon'] },
    ],
  },
  weather: { label: 'Weather' },
  button: { label: 'Button' },
  select: {
    label: 'Select',
    kinds: {
      scenes: {
        label: 'Scenes',
        sections: [
          { title: 'Scenes', keys: ['scenes', 'active_scene'] },
          { title: 'Look', keys: ['name', 'icon'] },
        ],
      },
    },
    otherwise: {
      label: 'An entity',
      sections: [
        { title: 'Entity', keys: ['entity', 'attribute'] },
        { title: 'Look', keys: ['name', 'icon'] },
      ],
    },
  },
  slider: {
    label: 'Slider',
    sections: [
      { title: 'Entity', keys: ['entity', 'slider', 'turn_on'] },
      { title: 'Look', keys: ['name', 'icon', 'color'] },
    ],
  },
  entity: {
    label: 'Entity',
    sections: [
      { title: 'Entity', keys: ['entity', 'name', 'label', 'strip_word', 'icon', 'popup'] },
      { title: 'Colour', keys: ['color', 'when'] },
      { title: 'State', keys: ['state'] },
      { title: 'Controls', keys: ['controls'] },
      { title: 'More entities', keys: ['items'] },
    ],
  },
  header: {
    label: 'Header',
    kinds: {
      name: {
        label: 'A name and icon',
        sections: [
          { title: 'Subject', keys: ['entity', 'name', 'icon', 'back'] },
          { title: 'Colour', keys: ['color', 'when'] },
          { title: 'State', keys: ['state'] },
          { title: 'Controls', keys: ['controls'] },
        ],
      },
    },
    otherwise: {
      label: 'An entity',
      sections: [
        { title: 'Subject', keys: ['entity', 'label', 'icon', 'back'] },
        { title: 'Colour', keys: ['color', 'when'] },
        { title: 'State', keys: ['state'] },
        { title: 'Controls', keys: ['controls'] },
      ],
    },
  },
  tile: {
    label: 'Tile',
    kinds: {
      name: {
        label: 'A name and icon',
        sections: [
          { title: 'Subject', keys: ['entity', 'name', 'icon', 'popup'] },
          { title: 'State', keys: ['state'] },
          { title: 'Chips', keys: ['chips'] },
          { title: 'Item', keys: ['item'] },
        ],
      },
    },
    otherwise: {
      label: 'An entity',
      sections: [
        { title: 'Subject', keys: ['entity', 'label', 'icon', 'popup'] },
        { title: 'State', keys: ['state'] },
        { title: 'Chips', keys: ['chips'] },
        { title: 'Item', keys: ['item'] },
      ],
    },
  },
  media: { label: 'Media' },
  'car-plan': {
    label: 'Car plan',
    sections: [
      { title: 'Heading', keys: ['title', 'icon'] },
      {
        title: 'Openings',
        keys: ['doors', 'hood', 'tailgate', 'windows', 'sunroof', 'open_states', 'half_states'],
      },
      { title: 'Tyres', keys: ['tyres', 'tyre_targets', 'tyre_low_share', 'tyre_warn_share'] },
    ],
  },
};
