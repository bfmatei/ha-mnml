import type {
  BinarySensorId,
  ButtonId,
  CalendarId,
  ClimateId,
  Corners,
  EntityId,
  MdiIcon,
  MediaPlayerId,
  PersonId,
  PopupHash,
  SceneId,
  ScriptId,
  SelectId,
  SensorId,
  ServiceName,
  Subnet,
  TimerId,
  WeatherId,
} from './entities.ts';
import type { Value } from './templates.ts';

export type Color = 'red' | 'orange' | 'amber' | 'blue';

export interface StateRule {
  attribute?: string;
  is?: string[];
  not?: string[];
}

export interface EntityRule extends StateRule {
  entity?: EntityId;
}

interface StateIsCondition {
  condition: 'state';
  entity?: EntityId;
  attribute?: string;
  state: string | string[];
  state_not?: never;
}

interface StateNotCondition {
  condition: 'state';
  entity?: EntityId;
  attribute?: string;
  state?: never;
  state_not: string | string[];
}

interface NumericStateCondition {
  condition: 'numeric_state';
  entity?: EntityId;
  attribute?: string;
  above?: number | EntityId;
  below?: number | EntityId;
}

interface ScreenCondition {
  condition: 'screen';
  media_query: string;
}

interface UserCondition {
  condition: 'user';
  users: string[];
}

interface LogicalCondition {
  condition: 'and' | 'or' | 'not';
  conditions: Condition[];
}

interface CoreCondition {
  condition: string;
  [key: string]: unknown;
}

export type Condition =
  | StateIsCondition
  | StateNotCondition
  | NumericStateCondition
  | ScreenCondition
  | UserCondition
  | LogicalCondition
  | CoreCondition;

interface StateBase {
  when?: EntityRule;
}

interface StateText extends StateBase {
  entity?: never;
  text: string;
  attribute?: never;
  minutes?: never;
  relative?: never;
  since?: never;
  remaining?: never;
  serial?: never;
  name?: never;
  icon?: never;
}

interface StateAttribute extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute: string;
  minutes?: never;
  relative?: true;
  since?: never;
  remaining?: never;
  serial?: never;
  name?: never;
  icon?: true;
}

interface StateMinutes extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes: true;
  relative?: never;
  since?: never;
  remaining?: never;
  serial?: never;
  name?: never;
  icon?: true;
}

interface StateRelative extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes?: never;
  relative: true;
  since?: never;
  remaining?: never;
  serial?: never;
  name?: never;
  icon?: true;
}

interface StateSince extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes?: never;
  relative?: never;
  since: true;
  remaining?: never;
  serial?: never;
  name?: never;
  icon?: true;
}

interface StateSerial extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes?: never;
  relative?: never;
  since?: never;
  remaining?: never;
  serial: true;
  name?: never;
  icon?: never;
}

interface StateName extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes?: never;
  relative?: never;
  since?: never;
  remaining?: never;
  serial?: never;
  name: true;
  icon?: never;
}

interface StateValue extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes?: never;
  relative?: never;
  since?: never;
  remaining?: never;
  serial?: never;
  name?: never;
  icon?: true;
}

interface StateRemaining extends StateBase {
  entity?: TimerId;
  text?: never;
  attribute?: never;
  minutes?: never;
  relative?: never;
  since?: never;
  remaining: true;
  serial?: never;
  name?: never;
  icon?: true;
}

export type StateItem =
  | StateText
  | StateAttribute
  | StateMinutes
  | StateRelative
  | StateSince
  | StateRemaining
  | StateSerial
  | StateName
  | StateValue;

export type SliderKind =
  | 'brightness'
  | 'color_temp'
  | 'hue'
  | 'temperature'
  | 'value'
  | 'volume'
  | 'position'
  | 'percentage'
  | 'humidity';
export type ModeAttribute =
  | 'hvac_modes'
  | 'preset_modes'
  | 'fan_modes'
  | 'swing_modes'
  | 'swing_horizontal_modes';

interface ControlBase {
  show?: EntityRule;
}

export interface ToggleControl extends ControlBase {
  type: 'toggle';
  entity: EntityId;
  icon?: MdiIcon;
  color?: Color;
  when?: StateRule;
  confirm?: StateRule;
  primary?: true;
}

export interface SliderControl extends ControlBase {
  type: 'slider';
  entity: EntityId;
  slider: SliderKind;
  name: string;
  icon: MdiIcon;
  color?: Color;
}

export interface SelectControl extends ControlBase {
  type: 'select';
  entity: SelectId | ClimateId | TimerId;
  attribute?: ModeAttribute;
  name?: string;
  icon?: MdiIcon;
  color?: Color;
  when?: StateRule;
  primary?: true;
}

export interface ServiceControl extends ControlBase {
  type: 'service';
  entity: EntityId;
  service: ServiceName;
  name: string;
  icon: MdiIcon;
  primary?: true;
  confirm?: StateRule;
}

export type SquareControl = ToggleControl | SliderControl | SelectControl | ScenesControl;

export interface NavControl extends ControlBase {
  type: 'nav';
  entity: EntityId;
  popup: PopupHash;
  color?: Color;
  when?: StateRule;
  controls?: SquareControl[];
}

export interface IndicatorControl extends ControlBase {
  type: 'indicator';
  entity: EntityId;
  color: Color;
}

interface StatusRule {
  entities: EntityId[];
  is?: string[];
  not?: string[];
  below?: number;
  within_days?: number;
  label?: 'device';
  words?: Record<string, string>;
  color: Color;
}

export interface StatusControl extends ControlBase {
  type: 'status';
  name: string;
  icon: MdiIcon;
  silent?: true;
  rules: StatusRule[];
}

export interface TyresControl extends ControlBase {
  type: 'tyres';
  tyres: Corners<SensorId>;
  targets: Corners<SensorId>;
  low_share: number;
  warn_share: number;
  silent?: true;
}

export interface ScenesControl extends ControlBase {
  type: 'scenes';
  scenes: SceneId[];
  active_scene?: SelectId;
  name: string;
  icon: MdiIcon;
}

export interface MessagesControl extends ControlBase {
  type: 'messages';
  popup: PopupHash;
  name: string;
  icon: MdiIcon;
  color?: Color;
}

export interface DismissControl extends ControlBase {
  type: 'dismiss';
  name: string;
  icon: MdiIcon;
}

export type Control =
  | ToggleControl
  | SliderControl
  | SelectControl
  | ServiceControl
  | NavControl
  | IndicatorControl
  | StatusControl
  | TyresControl
  | ScenesControl
  | MessagesControl
  | DismissControl;

export interface HeadingCard {
  type: 'custom:mnml-heading-card';
  title: string;
  icon: MdiIcon;
  state?: StateItem[];
  controls?: Control[];
}

export interface ListRow {
  entity: EntityId;
  name?: string;
  label?: 'device';
  strip?: string;
  words?: Record<string, string>;
  relative?: true;
  zero_when_empty?: true;
  flag?: true;
  bar?: true;
  of?: EntityId;
  low?: number;
  low_only?: true;
  critical?: number;
  high?: number;
  critical_high?: number;
  reset?: ButtonId;
  color?: Color;
  when?: StateRule;
  show?: EntityRule;
  values?: (EntityId | null)[];
}

export type ListSummary = 'lowest' | 'highest' | { sum: number };

export interface ListCard {
  type: 'custom:mnml-list-card';
  lowest_first?: true;
  highest_first?: true;
  fold?: true;
  summary?: ListSummary;
  title?: string;
  entity?: EntityId;
  icon?: MdiIcon;
  headers?: string[];
  rows: ListRow[];
}

export interface AgendaSource {
  entity: CalendarId;
  kind: 'episodes' | 'movies';
}

export interface AgendaCard {
  type: 'custom:mnml-agenda-card';
  title?: string;
  icon?: MdiIcon;
  sources: AgendaSource[];
}

export type MessageSource =
  | { source: string; entity: EntityId; name?: never }
  | { source: string; entity?: never; name: string };

interface SensorMessages {
  type: 'custom:mnml-messages-card';
  entity: SensorId;
  notifications?: never;
  repairs?: never;
  popup?: never;
  clear: ScriptId;
  sources?: MessageSource[];
  name?: never;
  icon?: never;
  color?: never;
}

interface NotificationMessages {
  type: 'custom:mnml-messages-card';
  entity?: never;
  notifications: true;
  repairs?: never;
  popup?: never;
  clear?: never;
  sources?: never;
  name?: never;
  icon?: never;
  color?: never;
}

interface RepairMessages {
  type: 'custom:mnml-messages-card';
  entity?: never;
  notifications?: never;
  repairs: true;
  popup?: never;
  clear?: never;
  sources?: never;
  name?: never;
  icon?: never;
  color?: never;
}

interface MessagesRow {
  type: 'custom:mnml-messages-card';
  entity?: never;
  notifications?: never;
  repairs?: never;
  popup: PopupHash;
  clear?: never;
  sources?: never;
  name: string;
  icon: MdiIcon;
  color?: Color;
}

export type MessagesCard = SensorMessages | NotificationMessages | RepairMessages | MessagesRow;

export interface ClientNetwork {
  name: string;
  icon: MdiIcon;
  subnet: Subnet;
}

export interface ClientFields {
  name?: string;
  ip_address?: string;
  type?: string;
}

export interface ClientsCard {
  type: 'custom:mnml-clients-card';
  entity: SensorId;
  attribute?: string;
  fields?: ClientFields;
  names?: SensorId;
  networks: ClientNetwork[];
  fold?: true;
}

export interface WeatherCard {
  type: 'custom:mnml-weather-card';
  entity: WeatherId;
  title?: string;
}

export interface ReportCard {
  type: 'custom:mnml-report-card';
  entity: SensorId;
  title?: string;
  icon?: MdiIcon;
  colors?: Record<string, Color>;
}

export interface GlanceOne {
  entity: EntityId;
  entities?: never;
  messages?: never;
  name?: string;
  icon?: MdiIcon;
  color?: Color;
  when?: StateRule;
  show?: StateRule;
  state?: StateItem[];
  popup?: PopupHash;
  toggle?: true;
  confirm?: StateRule;
  quiet?: true;
  calm?: true;
  bare?: true;
  alert?: StateRule;
  people?: PersonId[];
  is?: never;
  not?: never;
  below?: never;
  sum?: never;
  total?: never;
  critical?: never;
}

export interface GlanceCount {
  entity?: never;
  entities: EntityId[];
  messages?: never;
  name: string;
  icon?: MdiIcon;
  color?: Color;
  when?: never;
  show?: EntityRule;
  state?: never;
  popup?: PopupHash;
  toggle?: never;
  confirm?: never;
  quiet?: never;
  calm?: never;
  bare?: never;
  alert?: never;
  people?: never;
  is?: string[];
  not?: string[];
  below?: number;
  sum?: true;
  total?: true;
  critical?: number;
}

export interface GlanceMessages {
  entity?: never;
  entities?: never;
  messages: true;
  name: string;
  icon?: MdiIcon;
  color?: Color;
  when?: never;
  show?: never;
  state?: never;
  popup: PopupHash;
  toggle?: never;
  confirm?: never;
  quiet?: never;
  calm?: never;
  bare?: never;
  alert?: never;
  people?: never;
  is?: never;
  not?: never;
  below?: never;
  sum?: never;
  total?: never;
  critical?: never;
}

export type Glance = GlanceOne | GlanceCount | GlanceMessages;

export interface GlancesCard {
  type: 'custom:mnml-glances-card';
  items: Glance[];
}

export interface ButtonCard {
  type: 'custom:mnml-button-card';
  entity: ButtonId;
  service: ServiceName;
}

interface SelectEntityCard {
  type: 'custom:mnml-select-card';
  entity: SelectId | ClimateId;
  attribute?: ModeAttribute;
  scenes?: never;
  active_scene?: never;
  name?: string;
  icon?: MdiIcon;
}

interface SelectScenesCard {
  type: 'custom:mnml-select-card';
  entity?: never;
  attribute?: never;
  scenes: SceneId[];
  active_scene?: SelectId;
  name: string;
  icon: MdiIcon;
}

export type SelectCard = SelectEntityCard | SelectScenesCard;

export interface SliderCard {
  type: 'custom:mnml-slider-card';
  entity: EntityId;
  slider: SliderKind;
  name?: string;
  icon?: MdiIcon;
  color?: Color;
  turn_on?: true;
}

export interface Item {
  entity: EntityId;
  name?: string;
  label?: 'device';
  strip_word?: string;
  icon?: MdiIcon;
  color?: Color;
  when?: StateRule;
  state?: StateItem[];
  popup?: PopupHash;
  controls?: Control[];
}

export interface EntityCard extends Item {
  type: 'custom:mnml-entity-card';
  items?: Item[];
}

interface NamedSubject {
  entity?: EntityId;
  name: string;
  label?: never;
  icon: MdiIcon;
}

interface EntitySubject {
  entity: EntityId;
  name?: never;
  label?: 'device';
  icon?: MdiIcon;
}

type Subject = NamedSubject | EntitySubject;

export type HeaderCard = {
  type: 'custom:mnml-header-card';
  messages?: true;
  color?: Color;
  when?: StateRule;
  state?: StateItem[];
  controls?: Control[];
  back?: true;
} & Subject;

export interface TileTrend {
  entity: SensorId;
  color?: Color;
  when?: EntityRule;
}

export type TileCard = {
  type: 'custom:mnml-tile-card';
  popup: PopupHash;
  state?: StateItem[];
  trend?: TileTrend;
  square?: 'large' | 'small';
  chips?: Control[];
  item?: Item;
} & Subject;

export interface MediaCard {
  type: 'custom:mnml-media-card';
  entity: MediaPlayerId;
  popup?: PopupHash;
}

export interface CarPlanCard {
  type: 'custom:mnml-car-plan-card';
  title?: string;
  icon?: MdiIcon;
  doors: Corners<BinarySensorId>;
  hood: BinarySensorId;
  tailgate: BinarySensorId;
  windows: Corners<SensorId>;
  sunroof?: SensorId;
  open_states?: string[];
  half_states?: string[];
  tyres: Corners<SensorId>;
  tyre_targets: Corners<SensorId>;
  tyre_low_share: number;
  tyre_warn_share: number;
}

export interface LovelaceCardConfig {
  type: string;
  visibility?: Condition[];
  [key: string]: unknown;
}

export interface Popup {
  hash: PopupHash;
  cards: LovelaceCardConfig[];
}

export type PopupOpening = 'sheet' | 'dialog' | 'unfold';

export interface PopupOpen {
  phone?: PopupOpening;
  tablet?: PopupOpening;
  desktop?: PopupOpening;
}

export type PopupScreen = keyof PopupOpen;

export interface PopupAlert extends StateRule {
  entity: EntityId;
  popup: PopupHash;
  screens?: PopupScreen[];
  users?: string[];
}

export interface PopupsCard {
  type: 'custom:mnml-popups-card';
  width: `${number}px`;
  open?: PopupOpen;
  idle_close?: number;
  alerts?: PopupAlert[];
  popups?: Popup[];
}

export interface TemplateCard {
  type: 'custom:mnml-template-card';
  template: string;
  device?: string;
  area?: string;
  slots?: Record<string, Value>;
}

export type CustomCard =
  | HeadingCard
  | ListCard
  | AgendaCard
  | MessagesCard
  | ClientsCard
  | ReportCard
  | WeatherCard
  | GlancesCard
  | ButtonCard
  | SelectCard
  | SliderCard
  | EntityCard
  | HeaderCard
  | TileCard
  | MediaCard
  | CarPlanCard
  | PopupsCard
  | TemplateCard;
