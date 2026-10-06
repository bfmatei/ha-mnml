import type {
  AgendaCard,
  ButtonCard,
  CarPlanCard,
  ClientsCard,
  EntityCard,
  HeaderCard,
  HeadingCard,
  ListCard,
  MediaCard,
  MessagesCard,
  SelectCard,
  SliderCard,
  TileCard,
} from '../contract/cards.ts';

import {
  AGENDA_SOURCE,
  CLIENT_FIELDS,
  CLIENT_NETWORK,
  CONTROL,
  ITEM,
  LIST_ROW,
  MESSAGE_SOURCE,
  PROBLEMS,
  STATE_ITEM,
} from './kinds.ts';
import { MODE_ATTRIBUTES, SLIDER_KINDS } from './lists.ts';
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
  part,
  parts,
  plain,
  popup,
  rule,
  service,
  share,
  summary,
  text,
  textOr,
  texts,
} from './shape.ts';
import type { Shape } from './shape.ts';

const HEADING = plain<HeadingCard>(
  'heading',
  'Heading',
  { title: need(text()), icon: need(icon()), state: parts(STATE_ITEM), controls: parts(CONTROL) },
  [
    { title: 'Heading', keys: ['title', 'icon'] },
    { title: 'State', keys: ['state'] },
    { title: 'Controls', keys: ['controls'] },
  ],
);

const LIST = plain<ListCard>(
  'list',
  'List',
  {
    lowest_first: flag(),
    fold: flag(),
    summary: summary(),
    title: text(),
    icon: icon(),
    headers: texts(),
    rows: need(parts(LIST_ROW)),
  },
  [
    { title: 'Heading', keys: ['title', 'icon', 'headers'] },
    { title: 'Rows', keys: ['rows'] },
    { title: 'Order and summary', keys: ['lowest_first', 'fold', 'summary'] },
  ],
);

const AGENDA = plain<AgendaCard>(
  'agenda',
  'Agenda',
  { title: text(), icon: icon(), sources: need(parts(AGENDA_SOURCE)) },
  [
    { title: 'Heading', keys: ['title', 'icon'] },
    { title: 'Calendars', keys: ['sources'] },
  ],
);

const MESSAGES = plain<MessagesCard>(
  'messages',
  'Messages',
  {
    entity: need(entity(['sensor'])),
    clear: need(entity(['script'])),
    sources: parts(MESSAGE_SOURCE),
  },
  [
    { title: 'Messages', keys: ['entity', 'clear'] },
    { title: 'Sources', keys: ['sources'] },
  ],
);

const CLIENTS = plain<ClientsCard>(
  'clients',
  'Clients',
  {
    entity: need(entity(['sensor'])),
    attribute: textOr('data'),
    fields: part(CLIENT_FIELDS),
    names: entity(['sensor']),
    networks: need(parts(CLIENT_NETWORK)),
    fold: flag(),
  },
  [
    { title: 'Clients', keys: ['entity', 'attribute', 'fields', 'names'] },
    { title: 'Networks', keys: ['networks', 'fold'] },
  ],
);

const BUTTON = plain<ButtonCard>('button', 'Button', {
  entity: need(entity(['button'])),
  service: need(service()),
});

const SELECT = marked(
  'select',
  'Select',
  {
    scenes: plain<Extract<SelectCard, { scenes: unknown[] }>>(
      'select-scenes',
      'Scenes',
      {
        scenes: need(entities(['scene'])),
        active_scene: entity(['select']),
        name: need(text()),
        icon: need(icon()),
      },
      [
        { title: 'Scenes', keys: ['scenes', 'active_scene'] },
        { title: 'Look', keys: ['name', 'icon'] },
      ],
    ),
  },
  plain<Extract<SelectCard, { scenes?: never }>>(
    'select-entity',
    'An entity',
    {
      entity: need(entity(['select', 'climate'])),
      attribute: choice(MODE_ATTRIBUTES),
      name: text(),
      icon: icon(),
    },
    [
      { title: 'Entity', keys: ['entity', 'attribute'] },
      { title: 'Look', keys: ['name', 'icon'] },
    ],
  ),
);

const SLIDER = plain<SliderCard>(
  'slider',
  'Slider',
  {
    entity: need(entity()),
    slider: need(choice(SLIDER_KINDS)),
    name: text(),
    icon: icon(),
    color: color(),
    turn_on: flag(),
  },
  [
    { title: 'Entity', keys: ['entity', 'slider', 'turn_on'] },
    { title: 'Look', keys: ['name', 'icon', 'color'] },
  ],
);

const ENTITY = plain<EntityCard>(
  'entity',
  'Entity',
  {
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
    items: parts(ITEM),
  },
  [
    { title: 'Entity', keys: ['entity', 'name', 'label', 'strip_word', 'icon', 'popup'] },
    { title: 'Colour', keys: ['color', 'when'] },
    { title: 'State', keys: ['state'] },
    { title: 'Controls', keys: ['controls'] },
    { title: 'More entities', keys: ['items'] },
  ],
);

const HEADER = marked(
  'header',
  'Header',
  {
    name: plain<Extract<HeaderCard, { name: string }>>(
      'header-named',
      'A name and icon',
      {
        entity: entity(),
        name: need(text()),
        icon: need(icon()),
        back: flag(),
        color: color(),
        when: rule(),
        state: parts(STATE_ITEM),
        controls: parts(CONTROL),
      },
      [
        { title: 'Subject', keys: ['entity', 'name', 'icon', 'back'] },
        { title: 'Colour', keys: ['color', 'when'] },
        { title: 'State', keys: ['state'] },
        { title: 'Controls', keys: ['controls'] },
      ],
    ),
  },
  plain<Extract<HeaderCard, { name?: never }>>(
    'header-entity',
    'An entity',
    {
      entity: need(entity()),
      label: flag('device'),
      icon: icon(),
      back: flag(),
      color: color(),
      when: rule(),
      state: parts(STATE_ITEM),
      controls: parts(CONTROL),
    },
    [
      { title: 'Subject', keys: ['entity', 'label', 'icon', 'back'] },
      { title: 'Colour', keys: ['color', 'when'] },
      { title: 'State', keys: ['state'] },
      { title: 'Controls', keys: ['controls'] },
    ],
  ),
);

const TILE = marked(
  'tile',
  'Tile',
  {
    name: plain<Extract<TileCard, { name: string }>>(
      'tile-named',
      'A name and icon',
      {
        entity: entity(),
        name: need(text()),
        icon: need(icon()),
        popup: need(popup()),
        state: parts(STATE_ITEM),
        chips: parts(CONTROL),
        item: part(ITEM),
        problems: part(PROBLEMS),
      },
      [
        { title: 'Subject', keys: ['entity', 'name', 'icon', 'popup'] },
        { title: 'State', keys: ['state'] },
        { title: 'Chips', keys: ['chips'] },
        { title: 'Item', keys: ['item'] },
        { title: 'Problems', keys: ['problems'] },
      ],
    ),
  },
  plain<Extract<TileCard, { name?: never }>>(
    'tile-entity',
    'An entity',
    {
      entity: need(entity()),
      label: flag('device'),
      icon: icon(),
      popup: need(popup()),
      state: parts(STATE_ITEM),
      chips: parts(CONTROL),
      item: part(ITEM),
      problems: part(PROBLEMS),
    },
    [
      { title: 'Subject', keys: ['entity', 'label', 'icon', 'popup'] },
      { title: 'State', keys: ['state'] },
      { title: 'Chips', keys: ['chips'] },
      { title: 'Item', keys: ['item'] },
      { title: 'Problems', keys: ['problems'] },
    ],
  ),
);

const MEDIA = plain<MediaCard>('media', 'Media', {
  entity: need(entity(['media_player'])),
  popup: popup(),
});

const CAR_PLAN = plain<CarPlanCard>(
  'car-plan',
  'Car plan',
  {
    title: text(),
    icon: icon(),
    doors: need(corners(['binary_sensor'])),
    hood: need(entity(['binary_sensor'])),
    tailgate: need(entity(['binary_sensor'])),
    windows: need(corners(['sensor'])),
    sunroof: entity(['sensor']),
    open_states: texts(['on', 'open']),
    half_states: texts(['intermediate']),
    tyres: need(corners(['sensor'])),
    tyre_targets: need(corners(['sensor'])),
    tyre_low_share: need(share()),
    tyre_warn_share: need(share()),
  },
  [
    { title: 'Heading', keys: ['title', 'icon'] },
    {
      title: 'Openings',
      keys: ['doors', 'hood', 'tailgate', 'windows', 'sunroof', 'open_states', 'half_states'],
    },
    { title: 'Tyres', keys: ['tyres', 'tyre_targets', 'tyre_low_share', 'tyre_warn_share'] },
  ],
);

export const DESCRIPTIONS: Readonly<Record<string, Shape>> = {
  'custom:mnml-heading-card': HEADING,
  'custom:mnml-list-card': LIST,
  'custom:mnml-agenda-card': AGENDA,
  'custom:mnml-messages-card': MESSAGES,
  'custom:mnml-clients-card': CLIENTS,
  'custom:mnml-button-card': BUTTON,
  'custom:mnml-select-card': SELECT,
  'custom:mnml-slider-card': SLIDER,
  'custom:mnml-entity-card': ENTITY,
  'custom:mnml-header-card': HEADER,
  'custom:mnml-tile-card': TILE,
  'custom:mnml-media-card': MEDIA,
  'custom:mnml-car-plan-card': CAR_PLAN,
};
