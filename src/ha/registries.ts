export interface AreaEntry {
  area_id: string;
  name: string;
  aliases?: readonly string[];
  icon?: string | null;
  temperature_entity_id?: string | null;
  humidity_entity_id?: string | null;
}

export interface DeviceEntry {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  entry_type?: string | null;
  via_device_id?: string | null;
  labels?: string[];
}

export interface EntityEntry {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string;
  translation_key?: string | null;
  name?: string | null;
  entity_category?: string | null;
  hidden?: boolean;
  labels?: string[];
  display_precision?: number;
}

export interface EnergySource {
  type: string;
  stat_rate?: string;
  stat_soc?: string;
}

export interface EnergyDevice {
  stat_consumption: string;
  stat_rate?: string;
  included_in_stat?: string;
}

export interface EnergyPrefs {
  energy_sources: readonly EnergySource[];
  device_consumption: readonly EnergyDevice[];
}

export interface Registries {
  areas: Readonly<Record<string, AreaEntry>>;
  devices: Readonly<Record<string, DeviceEntry>>;
  entities: Readonly<Record<string, EntityEntry>>;
  states: Readonly<
    Record<string, { state?: string; attributes: Readonly<Record<string, unknown>> }>
  >;
  energy?: EnergyPrefs;
}
