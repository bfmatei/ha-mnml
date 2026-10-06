import type {
  BinarySensorId,
  ButtonId,
  CalendarId,
  ClimateId,
  Corners,
  EntityId,
  MdiIcon,
  MediaPlayerId,
  PopupHash,
  SceneId,
  ScriptId,
  SelectId,
  SensorId,
  ServiceName,
  Subnet,
} from './entities.ts';
import type { Value } from './templates.ts';

export type Color = 'red' | 'orange' | 'amber' | 'blue';

export interface StateRule {
  is?: string[];
  not?: string[];
}

export interface EntityRule extends StateRule {
  entity?: EntityId;
}

interface StateIsCondition {
  condition: 'state';
  entity: EntityId;
  state: string | string[];
  state_not?: never;
}

interface StateNotCondition {
  condition: 'state';
  entity: EntityId;
  state?: never;
  state_not: string | string[];
}

export type Condition = StateIsCondition | StateNotCondition;

interface StateBase {
  when?: EntityRule;
}

interface StateText extends StateBase {
  entity?: never;
  text: string;
  attribute?: never;
  minutes?: never;
  serial?: never;
  name?: never;
  icon?: never;
}

interface StateAttribute extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute: string;
  minutes?: never;
  serial?: never;
  name?: never;
  icon?: true;
}

interface StateMinutes extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes: true;
  serial?: never;
  name?: never;
  icon?: true;
}

interface StateSerial extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes?: never;
  serial: true;
  name?: never;
  icon?: never;
}

interface StateName extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes?: never;
  serial?: never;
  name: true;
  icon?: never;
}

interface StateValue extends StateBase {
  entity?: EntityId;
  text?: never;
  attribute?: never;
  minutes?: never;
  serial?: never;
  name?: never;
  icon?: true;
}

export type StateItem =
  | StateText
  | StateAttribute
  | StateMinutes
  | StateSerial
  | StateName
  | StateValue;

export type SliderKind = 'brightness' | 'color_temp' | 'hue' | 'temperature' | 'value' | 'volume';
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
  entity: SelectId | ClimateId;
  attribute?: ModeAttribute;
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
}

export interface NavControl extends ControlBase {
  type: 'nav';
  entity: EntityId;
  popup: PopupHash;
  color?: Color;
  when?: StateRule;
}

export interface IndicatorControl extends ControlBase {
  type: 'indicator';
  entity: EntityId;
  color: Color;
}

interface StatusRule extends StateRule {
  entities: EntityId[];
  label?: 'device';
  words?: Record<string, string>;
  color: Color;
}

export interface StatusControl extends ControlBase {
  type: 'status';
  name: string;
  icon: MdiIcon;
  rules: StatusRule[];
}

export interface TyresControl extends ControlBase {
  type: 'tyres';
  tyres: Corners<SensorId>;
  targets: Corners<SensorId>;
  low_share: number;
  warn_share: number;
}

export interface ScenesControl extends ControlBase {
  type: 'scenes';
  scenes: SceneId[];
  active_scene?: SelectId;
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
  | ScenesControl;

export interface Problems {
  leaks?: BinarySensorId[];
  batteries?: SensorId[];
}

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
  critical?: number;
  high?: number;
  critical_high?: number;
  reset?: ButtonId;
  color?: Color;
  when?: StateRule;
  show?: EntityRule;
  values?: EntityId[];
}

export type ListSummary = 'lowest' | 'highest' | { sum: number };

export interface ListCard {
  type: 'custom:mnml-list-card';
  lowest_first?: true;
  fold?: true;
  summary?: ListSummary;
  title?: string;
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

export interface MessagesCard {
  type: 'custom:mnml-messages-card';
  entity: SensorId;
  clear: ScriptId;
  sources?: MessageSource[];
}

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
  color?: Color;
  when?: StateRule;
  state?: StateItem[];
  controls?: Control[];
  back?: true;
} & Subject;

export type TileCard = {
  type: 'custom:mnml-tile-card';
  popup: PopupHash;
  state?: StateItem[];
  chips?: Control[];
  item?: Item;
  problems?: Problems;
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

export interface PopupsCard {
  type: 'custom:mnml-popups-card';
  width: `${number}px`;
  popups?: Popup[];
}

export interface TemplateCard {
  type: 'custom:mnml-template-card';
  template: string;
  area?: string;
  slots?: Record<string, Value>;
}

export type CustomCard =
  | HeadingCard
  | ListCard
  | AgendaCard
  | MessagesCard
  | ClientsCard
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
