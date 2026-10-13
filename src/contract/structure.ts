import type {
  AgendaCard,
  AgendaSource,
  ButtonCard,
  CarPlanCard,
  ClientFields,
  ClientNetwork,
  ClientsCard,
  Color,
  Control,
  CustomCard,
  EntityCard,
  EntityRule,
  Glance,
  GlancesCard,
  HeaderCard,
  HeadingCard,
  Item,
  ListCard,
  ListRow,
  MediaCard,
  MessageSource,
  MessagesCard,
  ModeAttribute,
  Popup,
  PopupOpen,
  PopupOpening,
  PopupsCard,
  ReportCard,
  SelectCard,
  SliderCard,
  SliderKind,
  StateItem,
  StateRule,
  StatusControl,
  TemplateCard,
  TileCard,
  WeatherCard,
} from './cards.ts';
import { isMapping } from './templates.ts';
import type { Value } from './templates.ts';

export type KeyKind =
  | 'text'
  | 'texts'
  | 'number'
  | 'share'
  | 'flag'
  | 'choice'
  | 'entity'
  | 'entities'
  | 'icon'
  | 'popup'
  | 'service'
  | 'color'
  | 'words'
  | 'corners'
  | 'rule'
  | 'summary'
  | 'part'
  | 'parts'
  | 'cards'
  | 'slots';

export interface Key {
  readonly kind: KeyKind;
  readonly required?: true;
  readonly default?: Value;
  readonly options?: readonly string[];
  readonly domains?: readonly string[];
  readonly writes?: string;
  readonly of?: Structure;
}

type Keyed = Readonly<Record<string, Key>>;

interface Variant {
  readonly when: string | undefined;
  readonly keys: Keyed;
}

interface Plain {
  readonly kind: 'plain';
  readonly name: string;
  readonly keys: Keyed;
  readonly variants?: never;
}

interface Choice {
  readonly kind: 'tagged' | 'marked';
  readonly name: string;
  readonly keys?: never;
  readonly variants: readonly Variant[];
}

export type Structure = Plain | Choice;

type Present<T> = {
  [K in keyof T]-?: [Exclude<T[K], undefined>] extends [never] ? never : K;
}[keyof T] &
  string;

type Needed<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K;
}[keyof T] &
  string;

type TagKey<T> = 'type' extends keyof T
  ? string extends T[Extract<'type', keyof T>]
    ? never
    : 'type'
  : never;

type Required = Key & { readonly required: true };
type Optional = Key & { readonly required?: undefined };

type Keys<T> = Readonly<Record<Exclude<Needed<T>, TagKey<T>>, Required>> &
  Readonly<Record<Exclude<Present<T>, Needed<T> | TagKey<T>>, Optional>>;

type AllKeys<T> = T extends unknown ? keyof T & string : never;

type Picked<T, M> = M extends string ? Extract<T, Record<M, unknown>> : never;

const isKey = (value: unknown): value is Key =>
  isMapping(value) && typeof value['kind'] === 'string';

function erase(keys: unknown): Keyed {
  const out: Record<string, Key> = {};
  for (const [key, value] of Object.entries(isMapping(keys) ? keys : {})) {
    if (isKey(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function plain<T>(name: string, keys: Keys<T>): Plain {
  return { kind: 'plain', name, keys: erase(keys) };
}

export function tagged<T extends { type: string }>(
  name: string,
  variants: { readonly [K in T['type']]: Keys<Extract<T, { type: K }>> },
): Choice {
  return {
    kind: 'tagged',
    name,
    variants: Object.entries(variants).map(([when, keys]) => ({
      when,
      keys: erase(keys),
    })),
  };
}

export function marked<T>(name: string) {
  return <M extends AllKeys<T>>(
    markers: { readonly [K in M]: Keys<Extract<T, Record<K, unknown>>> },
    otherwise: Keys<Exclude<T, Picked<T, M>>>,
  ): Choice => ({
    kind: 'marked',
    name,
    variants: [
      ...Object.entries(markers).map(([when, keys]) => ({
        when,
        keys: erase(keys),
      })),
      { when: undefined, keys: erase(otherwise) },
    ],
  });
}

export function chooseVariant<V extends { readonly when: string | undefined }>(
  choice: { readonly kind: 'tagged' | 'marked'; readonly variants: readonly V[] },
  has: (key: string) => boolean,
  type: unknown,
): V | undefined {
  return choice.kind === 'tagged'
    ? choice.variants.find((variant) => variant.when === type)
    : choice.variants.find((variant) => variant.when === undefined || has(variant.when));
}

export const need = (key: Key): Required => ({ ...key, required: true });
export const text = (fallback?: string): Optional => ({ kind: 'text', default: fallback });
export const texts = (fallback?: readonly string[]): Optional => ({
  kind: 'texts',
  default: fallback === undefined ? undefined : [...fallback],
});
export const number = (): Optional => ({ kind: 'number' });
const share = (): Optional => ({ kind: 'share' });
export const flag = (writes?: string): Optional => ({ kind: 'flag', writes });
const choice = (options: readonly string[]): Optional => ({ kind: 'choice', options });
export const entity = (domains?: readonly string[]): Optional => ({ kind: 'entity', domains });
export const entities = (domains?: readonly string[]): Optional => ({ kind: 'entities', domains });
export const icon = (): Optional => ({ kind: 'icon' });
const popup = (): Optional => ({ kind: 'popup' });
const service = (): Optional => ({ kind: 'service' });
const color = (): Optional => ({ kind: 'color' });
const words = (options?: readonly string[]): Optional => ({ kind: 'words', options });
export const corners = (domains: readonly string[]): Optional => ({ kind: 'corners', domains });
const summary = (): Optional => ({ kind: 'summary' });
export const part = (of: Structure): Optional => ({ kind: 'part', of });
export const parts = (of: Structure): Optional => ({ kind: 'parts', of });
const cards = (): Optional => ({ kind: 'cards' });
const slots = (): Optional => ({ kind: 'slots' });

const STATE_RULE = plain<StateRule>('state-rule', { is: texts(), not: texts() });

const ENTITY_RULE = plain<EntityRule>('entity-rule', {
  is: texts(),
  not: texts(),
  entity: entity(),
});

export const rule = (): Optional => ({ kind: 'rule', of: STATE_RULE });
export const entityRule = (): Optional => ({ kind: 'rule', of: ENTITY_RULE });

export const COLORS: readonly string[] = Object.keys({
  red: true,
  orange: true,
  amber: true,
  blue: true,
} satisfies Record<Color, true>);

export const SLIDER_KINDS: readonly string[] = Object.keys({
  brightness: true,
  color_temp: true,
  hue: true,
  temperature: true,
  value: true,
  volume: true,
  position: true,
  percentage: true,
  humidity: true,
} satisfies Record<SliderKind, true>);

export const MODE_ATTRIBUTES: readonly string[] = Object.keys({
  hvac_modes: true,
  preset_modes: true,
  fan_modes: true,
  swing_modes: true,
  swing_horizontal_modes: true,
} satisfies Record<ModeAttribute, true>);

export const AGENDA_KINDS: readonly string[] = Object.keys({
  episodes: true,
  movies: true,
} satisfies Record<AgendaSource['kind'], true>);

export const OPENINGS: readonly string[] = Object.keys({
  sheet: true,
  dialog: true,
  unfold: true,
} satisfies Record<PopupOpening, true>);

export const STATE_ITEM = marked<StateItem>('state')(
  {
    text: { text: need(text()), when: entityRule() },
    attribute: { entity: entity(), attribute: need(text()), icon: flag(), when: entityRule() },
    minutes: { entity: entity(), minutes: need(flag()), icon: flag(), when: entityRule() },
    relative: { entity: entity(), relative: need(flag()), icon: flag(), when: entityRule() },
    serial: { entity: entity(), serial: need(flag()), when: entityRule() },
    name: { entity: entity(), name: need(flag()), when: entityRule() },
  },
  { entity: entity(), icon: flag(), when: entityRule() },
);

const STATUS_RULE = plain<StatusControl['rules'][number]>('status-rule', {
  entities: need(entities()),
  label: flag('device'),
  words: words(),
  color: need(color()),
  is: texts(),
  not: texts(),
  below: number(),
  within_days: number(),
});

export const CONTROL = tagged<Control>('control', {
  toggle: {
    entity: need(entity()),
    icon: icon(),
    primary: flag(),
    color: color(),
    when: rule(),
    show: entityRule(),
  },
  slider: {
    entity: need(entity()),
    slider: need(choice(SLIDER_KINDS)),
    name: need(text()),
    icon: need(icon()),
    color: color(),
    show: entityRule(),
  },
  select: {
    entity: need(entity(['select', 'climate'])),
    attribute: choice(MODE_ATTRIBUTES),
    primary: flag(),
    color: color(),
    when: rule(),
    show: entityRule(),
  },
  service: {
    entity: need(entity()),
    service: need(service()),
    name: need(text()),
    icon: need(icon()),
    primary: flag(),
    show: entityRule(),
  },
  nav: {
    entity: need(entity()),
    popup: need(popup()),
    color: color(),
    when: rule(),
    show: entityRule(),
  },
  indicator: { entity: need(entity()), color: need(color()), show: entityRule() },
  status: {
    name: need(text()),
    icon: need(icon()),
    silent: flag(),
    rules: need(parts(STATUS_RULE)),
    show: entityRule(),
  },
  tyres: {
    tyres: need(corners(['sensor'])),
    targets: need(corners(['sensor'])),
    low_share: need(share()),
    warn_share: need(share()),
    silent: flag(),
    show: entityRule(),
  },
  scenes: {
    scenes: need(entities(['scene'])),
    active_scene: entity(['select']),
    name: need(text()),
    icon: need(icon()),
    show: entityRule(),
  },
});

export const CONTROL_TYPES: readonly string[] = CONTROL.variants.flatMap(
  (variant) => variant.when ?? [],
);

const ITEM = plain<Item>('item', {
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

const GLANCE = marked<Glance>('glance')(
  {
    entities: {
      entities: need(entities()),
      name: need(text()),
      icon: icon(),
      color: color(),
      popup: popup(),
      is: texts(),
      not: texts(),
      below: number(),
      sum: flag(),
      critical: number(),
    },
  },
  {
    entity: need(entity()),
    name: text(),
    icon: icon(),
    color: color(),
    when: rule(),
    show: rule(),
    state: parts(STATE_ITEM),
    popup: popup(),
    toggle: flag(),
    quiet: flag(),
    bare: flag(),
    alert: rule(),
    people: entities(['person']),
  },
);

export const LIST_ROW = plain<ListRow>('row', {
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
  low_only: flag(),
  critical: number(),
  high: number(),
  critical_high: number(),
  values: entities(),
  reset: entity(['button']),
  color: color(),
  when: rule(),
  show: entityRule(),
});

const AGENDA_SOURCE = plain<AgendaSource>('agenda-source', {
  entity: need(entity(['calendar'])),
  kind: need(choice(AGENDA_KINDS)),
});

const MESSAGE_SOURCE = marked<MessageSource>('message-source')(
  { entity: { source: need(text()), entity: need(entity()) } },
  { source: need(text()), name: need(text()) },
);

const CLIENT_NETWORK = plain<ClientNetwork>('client-network', {
  name: need(text()),
  icon: need(icon()),
  subnet: need(text()),
});

const CLIENT_FIELDS = plain<ClientFields>('client-fields', {
  name: text(),
  ip_address: text(),
  type: text(),
});

const POPUP_OPEN = plain<PopupOpen>('popup-open', {
  phone: choice(OPENINGS),
  tablet: choice(OPENINGS),
  desktop: choice(OPENINGS),
});

const POPUP = plain<Popup>('popup', { hash: need(popup()), cards: need(cards()) });

export const CARD_STRUCTURES: Readonly<Record<CustomCard['type'], Structure>> = {
  'custom:mnml-heading-card': plain<HeadingCard>('heading', {
    title: need(text()),
    icon: need(icon()),
    state: parts(STATE_ITEM),
    controls: parts(CONTROL),
  }),
  'custom:mnml-list-card': plain<ListCard>('list', {
    lowest_first: flag(),
    fold: flag(),
    summary: summary(),
    title: text(),
    icon: icon(),
    headers: texts(),
    rows: need(parts(LIST_ROW)),
  }),
  'custom:mnml-agenda-card': plain<AgendaCard>('agenda', {
    title: text(),
    icon: icon(),
    sources: need(parts(AGENDA_SOURCE)),
  }),
  'custom:mnml-messages-card': plain<MessagesCard>('messages', {
    entity: need(entity(['sensor'])),
    clear: need(entity(['script'])),
    sources: parts(MESSAGE_SOURCE),
  }),
  'custom:mnml-clients-card': plain<ClientsCard>('clients', {
    entity: need(entity(['sensor'])),
    attribute: text('data'),
    fields: part(CLIENT_FIELDS),
    names: entity(['sensor']),
    networks: need(parts(CLIENT_NETWORK)),
    fold: flag(),
  }),
  'custom:mnml-report-card': plain<ReportCard>('report', {
    entity: need(entity(['sensor'])),
    title: text(),
    icon: icon(),
    colors: words(COLORS),
  }),
  'custom:mnml-weather-card': plain<WeatherCard>('weather', {
    entity: need(entity(['weather'])),
    title: text(),
  }),
  'custom:mnml-glances-card': plain<GlancesCard>('glances', { items: need(parts(GLANCE)) }),
  'custom:mnml-button-card': plain<ButtonCard>('button', {
    entity: need(entity(['button'])),
    service: need(service()),
  }),
  'custom:mnml-select-card': marked<SelectCard>('select')(
    {
      scenes: {
        scenes: need(entities(['scene'])),
        active_scene: entity(['select']),
        name: need(text()),
        icon: need(icon()),
      },
    },
    {
      entity: need(entity(['select', 'climate'])),
      attribute: choice(MODE_ATTRIBUTES),
      name: text(),
      icon: icon(),
    },
  ),
  'custom:mnml-slider-card': plain<SliderCard>('slider', {
    entity: need(entity()),
    slider: need(choice(SLIDER_KINDS)),
    name: text(),
    icon: icon(),
    color: color(),
    turn_on: flag(),
  }),
  'custom:mnml-entity-card': plain<EntityCard>('entity', {
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
  }),
  'custom:mnml-header-card': marked<HeaderCard>('header')(
    {
      name: {
        entity: entity(),
        name: need(text()),
        icon: need(icon()),
        back: flag(),
        color: color(),
        when: rule(),
        state: parts(STATE_ITEM),
        controls: parts(CONTROL),
      },
    },
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
  ),
  'custom:mnml-tile-card': marked<TileCard>('tile')(
    {
      name: {
        entity: entity(),
        name: need(text()),
        icon: need(icon()),
        popup: need(popup()),
        state: parts(STATE_ITEM),
        chips: parts(CONTROL),
        item: part(ITEM),
      },
    },
    {
      entity: need(entity()),
      label: flag('device'),
      icon: icon(),
      popup: need(popup()),
      state: parts(STATE_ITEM),
      chips: parts(CONTROL),
      item: part(ITEM),
    },
  ),
  'custom:mnml-media-card': plain<MediaCard>('media', {
    entity: need(entity(['media_player'])),
    popup: popup(),
  }),
  'custom:mnml-car-plan-card': plain<CarPlanCard>('car-plan', {
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
  }),
  'custom:mnml-popups-card': plain<PopupsCard>('popups', {
    width: need(text()),
    open: part(POPUP_OPEN),
    popups: parts(POPUP),
  }),
  'custom:mnml-template-card': plain<TemplateCard>('template', {
    template: need(text()),
    area: text(),
    slots: slots(),
  }),
};
