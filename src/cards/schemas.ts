import type {
  AgendaSource,
  ClientNetwork,
  Control,
  EntityRule,
  Item,
  ListRow,
  MessageSource,
  Problems,
  StateItem,
  StateRule,
} from '../contract/cards.ts';

import { marked, schema, tagged, variant } from './keys.ts';

export const STATE_RULE = schema<StateRule>({ is: true, not: true });

const ENTITY_RULE = schema<EntityRule>({ is: true, not: true, entity: true });

export const STATE_ITEMS = marked(
  {
    text: variant<Extract<StateItem, { text: string }>>(
      { when: true, text: true },
      { when: ENTITY_RULE },
    ),
    attribute: variant<Extract<StateItem, { attribute: string }>>(
      { when: true, entity: true, attribute: true, icon: true },
      { when: ENTITY_RULE },
    ),
    minutes: variant<Extract<StateItem, { minutes: true }>>(
      { when: true, entity: true, minutes: true, icon: true },
      { when: ENTITY_RULE },
    ),
    serial: variant<Extract<StateItem, { serial: true }>>(
      { when: true, entity: true, serial: true },
      { when: ENTITY_RULE },
    ),
    name: variant<Extract<StateItem, { name: true }>>(
      { when: true, entity: true, name: true },
      { when: ENTITY_RULE },
    ),
  },
  variant<
    Extract<
      StateItem,
      { text?: never; attribute?: never; minutes?: never; serial?: never; name?: never }
    >
  >({ when: true, entity: true, icon: true }, { when: ENTITY_RULE }),
);

const STATUS_RULE = schema<Extract<Control, { type: 'status' }>['rules'][number]>({
  is: true,
  not: true,
  entities: true,
  label: true,
  words: true,
  color: true,
});

export const CONTROLS = tagged<Control>({
  toggle: variant<Extract<Control, { type: 'toggle' }>>(
    { type: true, show: true, entity: true, icon: true, color: true, when: true, primary: true },
    { show: ENTITY_RULE, when: STATE_RULE },
  ),
  slider: variant<Extract<Control, { type: 'slider' }>>(
    { type: true, show: true, entity: true, slider: true, name: true, icon: true, color: true },
    { show: ENTITY_RULE },
  ),
  select: variant<Extract<Control, { type: 'select' }>>(
    {
      type: true,
      show: true,
      entity: true,
      attribute: true,
      color: true,
      when: true,
      primary: true,
    },
    { show: ENTITY_RULE, when: STATE_RULE },
  ),
  service: variant<Extract<Control, { type: 'service' }>>(
    { type: true, show: true, entity: true, service: true, name: true, icon: true, primary: true },
    { show: ENTITY_RULE },
  ),
  nav: variant<Extract<Control, { type: 'nav' }>>(
    { type: true, show: true, entity: true, popup: true, color: true, when: true },
    { show: ENTITY_RULE, when: STATE_RULE },
  ),
  indicator: variant<Extract<Control, { type: 'indicator' }>>(
    { type: true, show: true, entity: true, color: true },
    { show: ENTITY_RULE },
  ),
  status: variant<Extract<Control, { type: 'status' }>>(
    { type: true, show: true, name: true, icon: true, rules: true },
    { show: ENTITY_RULE, rules: STATUS_RULE },
  ),
  tyres: variant<Extract<Control, { type: 'tyres' }>>(
    { type: true, show: true, tyres: true, targets: true, low_share: true, warn_share: true },
    { show: ENTITY_RULE },
  ),
  scenes: variant<Extract<Control, { type: 'scenes' }>>(
    { type: true, show: true, scenes: true, active_scene: true, name: true, icon: true },
    { show: ENTITY_RULE },
  ),
});

export const ITEM = schema<Item>(
  {
    entity: true,
    name: true,
    label: true,
    strip_word: true,
    icon: true,
    color: true,
    when: true,
    state: true,
    popup: true,
    controls: true,
  },
  { when: STATE_RULE, state: STATE_ITEMS, controls: CONTROLS },
);

export const LIST_ROW = schema<ListRow>(
  {
    entity: true,
    name: true,
    label: true,
    strip: true,
    words: true,
    relative: true,
    zero_when_empty: true,
    flag: true,
    bar: true,
    of: true,
    low: true,
    critical: true,
    high: true,
    critical_high: true,
    reset: true,
    color: true,
    when: true,
    show: true,
    values: true,
  },
  { when: STATE_RULE, show: ENTITY_RULE },
);

export const AGENDA_SOURCE = schema<AgendaSource>({ entity: true, kind: true });

export const MESSAGE_SOURCE = marked(
  { entity: variant<Extract<MessageSource, { entity: string }>>({ source: true, entity: true }) },
  variant<Extract<MessageSource, { name: string }>>({ source: true, name: true }),
);

export const CLIENT_NETWORK = schema<ClientNetwork>({ name: true, icon: true, subnet: true });

export const PROBLEMS = schema<Problems>({ leaks: true, batteries: true });
