import type { ClientNetwork, PopupAlert, PopupOpen } from '../contract/cards.ts';
import type {
  AlarmPanelId,
  BinarySensorId,
  ButtonId,
  CalendarId,
  CameraId,
  ClimateId,
  Corners,
  CoverId,
  DeviceTrackerId,
  FanId,
  HumidifierId,
  ImageId,
  InputBooleanId,
  LightId,
  LockId,
  MdiIcon,
  MediaPlayerId,
  NumberId,
  PersonId,
  SceneId,
  ScheduleId,
  ScriptId,
  SelectId,
  SensorId,
  SwitchId,
  TimerId,
  UpdateId,
  VacuumId,
  WeatherId,
} from '../contract/entities.ts';
import type { SectionKey } from '../contract/plan.ts';

export interface LightZone {
  group: LightId;
  members: LightId[];
}

export type LightMember = LightId | LightZone;

export interface Lights {
  group: LightId;
  color?: true;
  members?: LightMember[];
  scenes?: SceneId[];
  activeScene?: SelectId;
}

export interface Thermostat {
  valve: SensorId;
  battery: SensorId;
}

export interface Heating {
  entity: ClimateId;
  preset?: true;
  presetTemperatures?: NumberId[];
  schedule?: ScheduleId;
  thermostats: Thermostat[];
}

export interface Meter {
  power: SensorId;
  today: SensorId;
  total: SensorId;
}

export interface Ac {
  entity: ClimateId;
  fan?: true;
  swing?: true;
  horizontalSwing?: true;
  powerSaving?: SelectId;
  dehumidifier?: NumberId;
  energy?: Meter;
}

export interface Consumable {
  entity: SensorId;
  reset?: ButtonId;
}

export interface Dock {
  error: SensorId;
  dustEmptying: SwitchId;
  mopDrying: SwitchId;
  mopDryingTimeLeft: SensorId;
  mopWashing: SwitchId;
  consumables: Consumable[];
  warnings: BinarySensorId[];
}

export interface VacuumTotals {
  count: SensorId;
  area: SensorId;
  time: SensorId;
}

export interface Vacuum {
  entity: VacuumId;
  status: SensorId;
  error: SensorId;
  battery: SensorId;
  currentRoom: SensorId;
  progress: SensorId;
  area: SensorId;
  time: SensorId;
  lastClean: SensorId;
  mopAttached: BinarySensorId;
  waterBoxAttached?: BinarySensorId;
  totals?: VacuumTotals;
  map: ImageId;
  routines: ButtonId[];
  settings: SelectId[];
  consumables: Consumable[];
  warnings: BinarySensorId[];
  dock?: Dock;
}

export interface Outlet {
  entity: SwitchId;
  energy?: Meter;
}

export interface Heater {
  temperature: SensorId;
  target: SensorId;
}

export interface Printer3dActions {
  pause: ButtonId;
  resume: ButtonId;
  continue: ButtonId;
  cancel: ButtonId;
}

export interface Printer3d {
  entity: SensorId;
  progress: SensorId;
  filename: SensorId;
  material: SensorId;
  speed: SensorId;
  start: SensorId;
  finish: SensorId;
  nozzle: Heater;
  bed: Heater;
  camera?: CameraId;
  actions: Printer3dActions;
  outlet?: Outlet;
}

export interface Diffuser {
  entity: SwitchId;
  amount: NumberId;
}

export interface RoomCamera {
  entity: CameraId;
  motion?: BinarySensorId;
  person?: BinarySensorId;
  doorbell?: BinarySensorId;
}

export interface Cover {
  entity: CoverId;
  garage?: true;
}

export interface Fan {
  entity: FanId;
  quality?: SensorId;
}

export interface Humidifier {
  entity: HumidifierId;
}

export interface Appliance {
  entity: SensorId;
  remaining?: SensorId;
  power?: SensorId;
}

export interface Pet {
  feed: ButtonId;
  fed: SensorId;
  food?: SensorId;
  litter?: SensorId;
}

export interface Plant {
  moisture: SensorId;
}

export interface SpeakerTv {
  inputFormat?: SensorId;
  nightSound: SwitchId;
  speechEnhancement: SwitchId;
  audioDelay: NumberId;
}

export interface Subwoofer {
  enabled: SwitchId;
  gain: NumberId;
}

export interface Surround {
  enabled: SwitchId;
  level: NumberId;
  musicLevel: NumberId;
  musicFullVolume: SwitchId;
}

export interface Speaker {
  key: string;
  entity: MediaPlayerId;
  bass?: NumberId;
  treble?: NumberId;
  balance?: NumberId;
  loudness?: SwitchId;
  tv?: SpeakerTv;
  subwoofer?: Subwoofer;
  surround?: Surround;
}

export type MediaMember = MediaPlayerId | Speaker;

export interface Room {
  key: string;
  name: string;
  icon?: MdiIcon;
  temperature?: SensorId;
  humidity?: SensorId;
  window?: BinarySensorId;
  door?: BinarySensorId;
  lock?: LockId;
  lights: Lights;
  heating?: Heating;
  ac?: Ac;
  vacuum?: Vacuum;
  printer3d?: Printer3d;
  cameras?: RoomCamera[];
  covers?: Cover[];
  fans?: Fan[];
  humidifiers?: Humidifier[];
  appliances?: Appliance[];
  pets?: Pet[];
  plants?: Plant[];
  media?: MediaMember[];
  outlets?: Outlet[];
  diffuser?: Diffuser;
  timers?: TimerId[];
  schedules?: ScheduleId[];
  batteries?: SensorId[];
  leaks?: BinarySensorId[];
  firmware?: UpdateId[];
}

export interface Car {
  key: string;
  icon: MdiIcon;
  metadata: SensorId;
  fuel: SensorId;
  remainingFuel?: SensorId;
  range?: SensorId;
  mileage: SensorId;
  service?: SensorId;
  batteryVoltage?: SensorId;
  coolantTemperature?: SensorId;
  lock: SensorId;
  alarm: SensorId;
  alarmActive: BinarySensorId;
  doors: Corners<BinarySensorId>;
  hood: BinarySensorId;
  tailgate: BinarySensorId;
  windows: Corners<SensorId>;
  sunroof?: SensorId;
  tyres: Corners<SensorId>;
  tyreTargets: Corners<SensorId>;
  location: DeviceTrackerId;
}

export interface Health {
  steps: SensorId;
  distance: SensorId;
  flightsClimbed: SensorId;
  activeEnergy: SensorId;
  restingEnergy: SensorId;
}

export interface Device {
  key: string;
  name: string;
  icon: MdiIcon;
  tracker: DeviceTrackerId;
  battery: SensorId;
  batteryState: SensorId;
  connection: SensorId;
  network: SensorId;
  storage: SensorId;
  focus: BinarySensorId;
  focusName?: SensorId;
  activity: SensorId;
  permission: SensorId;
}

export interface Person {
  key: string;
  entity: PersonId;
  health?: Health;
  devices: readonly [Device, ...Device[]];
}

export interface GuestDisk {
  used: SensorId;
  size: SensorId;
}

export type HostName = `${string}.${string}`;

export interface Guest {
  host?: HostName;
  status: BinarySensorId;
  cpu: SensorId;
  memory: SensorId;
  disk?: GuestDisk;
}

export interface SystemBackups {
  last: SensorId;
  attempted?: SensorId;
  problem?: BinarySensorId;
}

export interface ServerBackups {
  last: SensorId;
  problem: BinarySensorId;
  bucket?: SensorId;
}

export interface ServerTemperatures {
  cpu: SensorId;
  rootDisk: SensorId;
}

export interface ServerDisks {
  pool: SensorId;
  failing: SensorId;
  lifeLeft: SensorId;
}

export interface ChecksActions {
  run: ButtonId;
  stop: ButtonId;
  running: BinarySensorId;
}

export interface ServerChecks {
  failed: SensorId;
  warnings?: SensorId;
  lastRun: SensorId;
  overdue: BinarySensorId;
  actions?: ChecksActions;
}

export interface NotificationSource {
  source: string;
  name: string;
}

export interface ProxmoxNotifications {
  messages: SensorId;
  clear: ScriptId;
  sources?: NotificationSource[];
}

export interface Proxmox {
  outlet: Outlet;
  cpu: SensorId;
  memory: SensorId;
  lastBoot: SensorId;
  uplink?: SensorId;
  temperatures?: ServerTemperatures;
  storage: SensorId[];
  disks?: ServerDisks;
  guests: Guest[];
  backups?: ServerBackups;
  checks?: ServerChecks;
  notifications?: ProxmoxNotifications;
}

export interface Adguard {
  protection: SwitchId;
  queries: SensorId;
  blocked: SensorId;
  ratio: SensorId;
  speed: SensorId;
  rules?: SensorId;
  update: UpdateId;
}

export interface Router {
  cpu: SensorId;
  temperature: SensorId;
}

export interface Clients {
  entity: SensorId;
  names?: SensorId;
  networks: ClientNetwork[];
}

export interface Wifi {
  key: string;
  enabled: SwitchId;
  qr: ImageId;
  switchable?: true;
}

export interface Network {
  latency: readonly [SensorId, ...SensorId[]];
  wan?: SensorId;
  devices: SensorId[];
  wifi?: Wifi[];
  clients?: Clients;
  router: Router;
  firmware: UpdateId[];
}

export interface TailscaleDevice {
  connected: BinarySensorId;
  essential?: true;
  ipAddress?: SensorId;
  lastSeen?: SensorId;
  expires?: SensorId;
  update?: BinarySensorId;
  udp?: BinarySensorId;
}

export interface Tailscale {
  devices: [TailscaleDevice, ...TailscaleDevice[]];
}

export interface MediaRequests {
  pending: SensorId;
  processing: SensorId;
}

export interface Movies {
  queue: SensorId;
  count: SensorId;
  health?: BinarySensorId;
  space?: SensorId;
  calendar?: CalendarId;
}

export interface Shows {
  queue: SensorId;
  count: SensorId;
  wanted?: SensorId;
  upcoming?: SensorId;
  calendar?: CalendarId;
}

export interface MediaServer {
  streams: SensorId;
  moreStreams?: SensorId[];
  update?: UpdateId;
  requests?: MediaRequests;
  movies?: Movies;
  shows?: Shows;
}

export interface Energy {
  usage: SensorId;
  grid: SensorId;
  solar?: SensorId;
  battery?: SensorId;
  ev?: SensorId;
  gridToday?: SensorId;
  solarToday?: SensorId;
  exportToday?: SensorId;
}

export interface System {
  cpu: SensorId;
  memory: SensorId;
  diskFree: SensorId;
  diskUsed: SensorId;
  services: BinarySensorId[];
  updates: UpdateId[];
  firmware: UpdateId[];
  backups?: SystemBackups;
  proxmox?: Proxmox;
  adguard?: Adguard;
  network?: Network;
  tailscale?: Tailscale;
  media?: MediaServer;
}

export interface Security {
  alarm: AlarmPanelId;
  smoke?: BinarySensorId[];
}

export type SectionTitles = Readonly<Record<SectionKey, string>>;

export interface Home {
  title: string;
  sections: SectionTitles;
  order?: readonly SectionKey[];
  popupOpen?: PopupOpen;
  idleClose?: number;
  alerts?: readonly PopupAlert[];
  squares?: true;
  outside?: WeatherId;
  vacation?: InputBooleanId;
  security?: Security;
  energy?: Energy;
  rooms: readonly Room[];
  people: readonly Person[];
  cars: readonly Car[];
  system: System;
}

export const HOME_KEYS: Record<keyof Home, true> = {
  title: true,
  sections: true,
  order: true,
  popupOpen: true,
  idleClose: true,
  alerts: true,
  squares: true,
  outside: true,
  vacation: true,
  security: true,
  energy: true,
  rooms: true,
  people: true,
  cars: true,
  system: true,
};

export const SECTION_TITLES_KEYS: Record<keyof SectionTitles, true> = {
  rooms: true,
  people: true,
  garage: true,
  system: true,
};

export const ROOM_KEYS: Record<keyof Room, true> = {
  key: true,
  name: true,
  icon: true,
  temperature: true,
  humidity: true,
  window: true,
  door: true,
  lock: true,
  lights: true,
  heating: true,
  ac: true,
  vacuum: true,
  printer3d: true,
  cameras: true,
  covers: true,
  fans: true,
  humidifiers: true,
  appliances: true,
  pets: true,
  plants: true,
  media: true,
  outlets: true,
  diffuser: true,
  timers: true,
  schedules: true,
  batteries: true,
  leaks: true,
  firmware: true,
};

export const PERSON_KEYS: Record<keyof Person, true> = {
  key: true,
  entity: true,
  health: true,
  devices: true,
};

export const CAR_KEYS: Record<keyof Car, true> = {
  key: true,
  icon: true,
  metadata: true,
  fuel: true,
  remainingFuel: true,
  range: true,
  mileage: true,
  service: true,
  batteryVoltage: true,
  coolantTemperature: true,
  lock: true,
  alarm: true,
  alarmActive: true,
  doors: true,
  hood: true,
  tailgate: true,
  windows: true,
  sunroof: true,
  tyres: true,
  tyreTargets: true,
  location: true,
};

export const SYSTEM_KEYS: Record<keyof System, true> = {
  cpu: true,
  memory: true,
  diskFree: true,
  diskUsed: true,
  services: true,
  updates: true,
  firmware: true,
  backups: true,
  proxmox: true,
  adguard: true,
  network: true,
  tailscale: true,
  media: true,
};
