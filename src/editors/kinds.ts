import type {
  AgendaSource,
  ClientFields,
  ClientNetwork,
  Control,
  Item,
  ListRow,
  MessageSource,
  Problems,
  StateItem,
} from '../contract/cards.ts';

import { AGENDA_KINDS, MODE_ATTRIBUTES, SLIDER_KINDS } from './lists.ts';
import {
  choice,
  color,
  corners,
  entities,
  entity,
  flag,
  icon,
  marked,
  need,
  number,
  parts,
  plain,
  popup,
  rule,
  service,
  share,
  tagged,
  text,
  texts,
  words,
} from './shape.ts';

export const STATE_ITEM = marked(
  'state',
  'State line',
  {
    text: plain<Extract<StateItem, { text: string }>>('state-text', 'Text', {
      text: need(text()),
      when: rule(true),
    }),
    attribute: plain<Extract<StateItem, { attribute: string }>>('state-attribute', 'Attribute', {
      entity: entity(),
      attribute: need(text()),
      icon: flag(),
      when: rule(true),
    }),
    minutes: plain<Extract<StateItem, { minutes: true }>>('state-minutes', 'Minutes', {
      entity: entity(),
      minutes: need(flag()),
      icon: flag(),
      when: rule(true),
    }),
    serial: plain<Extract<StateItem, { serial: true }>>('state-serial', 'Serial', {
      entity: entity(),
      serial: need(flag()),
      when: rule(true),
    }),
    name: plain<Extract<StateItem, { name: true }>>('state-name', 'Name', {
      entity: entity(),
      name: need(flag()),
      when: rule(true),
    }),
  },
  plain<
    Extract<
      StateItem,
      { text?: never; attribute?: never; minutes?: never; serial?: never; name?: never }
    >
  >('state-value', 'Value', { entity: entity(), icon: flag(), when: rule(true) }),
);

const STATUS_RULE = plain<Extract<Control, { type: 'status' }>['rules'][number]>(
  'status-rule',
  'Rule',
  {
    entities: need(entities()),
    label: flag('device'),
    words: words(),
    color: need(color()),
    is: texts(),
    not: texts(),
  },
);

export const CONTROL = tagged<Control>('control', 'Control', {
  toggle: plain<Extract<Control, { type: 'toggle' }>>('control-toggle', 'Toggle', {
    entity: need(entity()),
    icon: icon(),
    primary: flag(),
    color: color(),
    when: rule(),
    show: rule(true),
  }),
  slider: plain<Extract<Control, { type: 'slider' }>>('control-slider', 'Slider', {
    entity: need(entity()),
    slider: need(choice(SLIDER_KINDS)),
    name: need(text()),
    icon: need(icon()),
    color: color(),
    show: rule(true),
  }),
  select: plain<Extract<Control, { type: 'select' }>>('control-select', 'Select', {
    entity: need(entity(['select', 'climate'])),
    attribute: choice(MODE_ATTRIBUTES),
    primary: flag(),
    color: color(),
    when: rule(),
    show: rule(true),
  }),
  service: plain<Extract<Control, { type: 'service' }>>('control-service', 'Service', {
    entity: need(entity()),
    service: need(service()),
    name: need(text()),
    icon: need(icon()),
    primary: flag(),
    show: rule(true),
  }),
  nav: plain<Extract<Control, { type: 'nav' }>>('control-nav', 'Pop-up', {
    entity: need(entity()),
    popup: need(popup()),
    color: color(),
    when: rule(),
    show: rule(true),
  }),
  indicator: plain<Extract<Control, { type: 'indicator' }>>('control-indicator', 'Indicator', {
    entity: need(entity()),
    color: need(color()),
    show: rule(true),
  }),
  status: plain<Extract<Control, { type: 'status' }>>('control-status', 'Status', {
    name: need(text()),
    icon: need(icon()),
    rules: need(parts(STATUS_RULE)),
    show: rule(true),
  }),
  tyres: plain<Extract<Control, { type: 'tyres' }>>('control-tyres', 'Tyres', {
    tyres: need(corners(['sensor'])),
    targets: need(corners(['sensor'])),
    low_share: need(share()),
    warn_share: need(share()),
    show: rule(true),
  }),
  scenes: plain<Extract<Control, { type: 'scenes' }>>('control-scenes', 'Scenes', {
    scenes: need(entities(['scene'])),
    active_scene: entity(['select']),
    name: need(text()),
    icon: need(icon()),
    show: rule(true),
  }),
});

export const ITEM = plain<Item>('item', 'Item', {
  entity: need(entity()),
  name: text(),
  label: flag('device'),
  strip_word: text(),
  icon: icon(),
  popup: popup(),
  color: color(),
  when: rule(),
  state: parts(STATE_ITEM),
  controls: parts(CONTROL),
});

export const LIST_ROW = plain<ListRow>('row', 'Row', {
  entity: need(entity()),
  name: text(),
  label: flag('device'),
  strip: text(),
  words: words(),
  relative: flag(),
  zero_when_empty: flag(),
  flag: flag(),
  bar: flag(),
  of: entity(),
  low: number(),
  critical: number(),
  high: number(),
  critical_high: number(),
  values: entities(),
  reset: entity(['button']),
  color: color(),
  when: rule(),
  show: rule(true),
});

export const AGENDA_SOURCE = plain<AgendaSource>('agenda-source', 'Calendar', {
  entity: need(entity(['calendar'])),
  kind: need(choice(AGENDA_KINDS)),
});

export const MESSAGE_SOURCE = marked(
  'message-source',
  'Source',
  {
    entity: plain<Extract<MessageSource, { entity: string }>>('message-entity', 'By entity', {
      source: need(text()),
      entity: need(entity()),
    }),
  },
  plain<Extract<MessageSource, { name: string }>>('message-name', 'By name', {
    source: need(text()),
    name: need(text()),
  }),
);

export const CLIENT_NETWORK = plain<ClientNetwork>('client-network', 'Network', {
  name: need(text()),
  icon: need(icon()),
  subnet: need(text()),
});

export const CLIENT_FIELDS = plain<ClientFields>('client-fields', 'Fields', {
  name: text(),
  ip_address: text(),
  type: text(),
});

export const PROBLEMS = plain<Problems>('problems', 'Problems', {
  leaks: entities(['binary_sensor']),
  batteries: entities(['sensor']),
});
